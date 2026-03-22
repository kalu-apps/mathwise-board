import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { getWorkbookLiveSocketRuntime } from "./workbook-runtime-live-runtime";

export type HttpUpgradeServer = {
  on(
    event: "upgrade",
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void
  ): unknown;
};

const workbookLiveSocketServerByHost = new WeakMap<HttpUpgradeServer, WebSocketServer>();

const rejectUpgrade = (
  socket: Duplex,
  statusCode: 400 | 401 | 403 | 404 | 503,
  statusText: string
) => {
  try {
    socket.write(
      `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
    );
  } finally {
    socket.destroy();
  }
};

export const ensureWorkbookLiveSocketServer = (
  httpServer: HttpUpgradeServer | null | undefined
) => {
  if (!httpServer || workbookLiveSocketServerByHost.has(httpServer)) return;
  const socketServer = new WebSocketServer({ noServer: true });
  workbookLiveSocketServerByHost.set(httpServer, socketServer);

  httpServer.on("upgrade", (req, socket, head) => {
    const workbookLiveSocketRuntime = getWorkbookLiveSocketRuntime();
    const { pathname } = workbookLiveSocketRuntime.parsePath(req);
    const match = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events\/live$/);
    if (!match) return;
    const readiness = workbookLiveSocketRuntime.getWorkbookPersistenceReadiness();
    if (!readiness.ready) {
      rejectUpgrade(socket, 503, "Service Unavailable");
      return;
    }
    const db = workbookLiveSocketRuntime.getDb();
    workbookLiveSocketRuntime.pickTeacher(db);
    workbookLiveSocketRuntime.ensureDbParticipantPermissionsNormalized(db);
    const actor = workbookLiveSocketRuntime.resolveAuthUser(req, db);
    if (!actor) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    if (!workbookLiveSocketRuntime.getWorkbookParticipant(db, sessionId, actor.id)) {
      rejectUpgrade(socket, 403, "Forbidden");
      return;
    }
    void workbookLiveSocketRuntime
      .ensureRuntimeSessionBridge(sessionId)
      .catch((error) => {
        console.error("[workbook-live] bridge_init_failed", {
          sessionId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    socketServer.handleUpgrade(req, socket, head, (ws) => {
      const clientId = workbookLiveSocketRuntime.ensureId();
      const sessionClients =
        workbookLiveSocketRuntime.workbookLiveSocketClientsBySession.get(sessionId) ?? new Map();
      sessionClients.set(clientId, { id: clientId, userId: actor.id, socket: ws });
      workbookLiveSocketRuntime.workbookLiveSocketClientsBySession.set(sessionId, sessionClients);

      const cleanup = () => {
        const currentClients = workbookLiveSocketRuntime.workbookLiveSocketClientsBySession.get(sessionId);
        if (!currentClients) return;
        currentClients.delete(clientId);
        if (currentClients.size === 0) {
          workbookLiveSocketRuntime.workbookLiveSocketClientsBySession.delete(sessionId);
          void Promise.resolve(
            workbookLiveSocketRuntime.teardownRuntimeSessionBridgeIfIdle(sessionId)
          ).catch((error: unknown) => {
            console.error("[workbook-live] bridge_teardown_failed", {
              sessionId,
              message: error instanceof Error ? error.message : String(error),
            });
          });
        }
      };

      ws.on("message", async (rawMessage) => {
        try {
          let parsed: { events?: unknown[] } | null = null;
          try {
            parsed = JSON.parse(String(rawMessage)) as { events?: unknown[] };
          } catch {
            parsed = null;
          }
          const currentDb = workbookLiveSocketRuntime.getDb();
          const currentSession = workbookLiveSocketRuntime.getWorkbookSessionById(currentDb, sessionId);
          if (!currentSession) {
            try {
              ws.close();
            } catch {
              // ignore close failures
            }
            return;
          }
          workbookLiveSocketRuntime.applyStudentControls(currentSession, currentDb);
          const currentParticipant = workbookLiveSocketRuntime.getWorkbookParticipant(
            currentDb,
            sessionId,
            actor.id
          );
          if (!currentParticipant) {
            try {
              ws.close();
            } catch {
              // ignore close failures
            }
            return;
          }
          const volatileLimit = workbookLiveSocketRuntime.isVolatileRateLimitAllowed(
            sessionId,
            actor.id,
            "live_ws"
          );
          if (!volatileLimit.allowed) {
            // Drop current volatile frame, but keep connection alive.
            // Closing the socket here causes reconnect cooldowns and visible realtime lag.
            return;
          }
          const events = Array.isArray(parsed?.events) ? parsed.events : [];
          const sanitizedEvents = workbookLiveSocketRuntime.sanitizeWorkbookLiveEvents(
            currentParticipant,
            events
          );
          if (sanitizedEvents.length === 0) return;
          const appendResult = await workbookLiveSocketRuntime.appendWorkbookEvents(currentDb, {
            sessionId,
            authorUserId: actor.id,
            events: sanitizedEvents,
            persist: false,
          });
          workbookLiveSocketRuntime.touchSessionActivity(currentSession, appendResult.timestamp);
          workbookLiveSocketRuntime.publishWorkbookLiveEvents(currentDb, {
            sessionId,
            latestSeq: appendResult.latestSeq,
            events: appendResult.events,
            channel: "live",
          });
        } catch (error) {
          console.error("[workbook-live] message_handler_failed", {
            sessionId,
            userId: actor.id,
            message: error instanceof Error ? error.message : String(error),
          });
          try {
            ws.close(1011, "internal_error");
          } catch {
            // ignore close failures
          }
        }
      });

      ws.on("close", cleanup);
      ws.on("error", cleanup);
    });
  });
};
