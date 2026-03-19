import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";

type WorkbookLiveSocketRuntimeClient = {
  id: string;
  userId: string;
  socket: WebSocket;
};

type WorkbookLiveAppendResult = {
  timestamp: string;
  latestSeq: number;
  events: unknown[];
};

export type WorkbookLiveSocketRuntime = {
  parsePath: (req: IncomingMessage) => { pathname: string; searchParams: URLSearchParams };
  getWorkbookPersistenceReadiness: () => { ready: boolean };
  getDb: () => unknown;
  pickTeacher: (db: unknown) => unknown;
  ensureDbParticipantPermissionsNormalized: (db: unknown) => void;
  resolveAuthUser: (req: IncomingMessage, db: unknown) => { id: string } | null;
  getWorkbookParticipant: (db: unknown, sessionId: string, userId: string) => unknown | null;
  ensureRuntimeSessionBridge: (sessionId: string) => Promise<void>;
  ensureId: () => string;
  workbookLiveSocketClientsBySession: Map<
    string,
    Map<string, WorkbookLiveSocketRuntimeClient>
  >;
  teardownRuntimeSessionBridgeIfIdle: (sessionId: string) => Promise<void> | void;
  getWorkbookSessionById: (db: unknown, sessionId: string) => unknown | null;
  applyStudentControls: (session: unknown, db: unknown) => void;
  isVolatileRateLimitAllowed: (
    sessionId: string,
    userId: string,
    source: string
  ) => { allowed: boolean };
  sanitizeWorkbookLiveEvents: (participant: unknown, events: unknown[]) => unknown[];
  appendWorkbookEvents: (
    db: unknown,
    params: {
      sessionId: string;
      authorUserId: string;
      events: unknown[];
      persist: boolean;
    }
  ) => Promise<WorkbookLiveAppendResult>;
  touchSessionActivity: (session: unknown, timestamp?: string) => void;
  publishWorkbookLiveEvents: (
    db: unknown,
    params: {
      sessionId: string;
      latestSeq: number;
      events: unknown[];
      channel: "live" | "stream";
    }
  ) => void;
};

let workbookLiveSocketRuntimeRef: WorkbookLiveSocketRuntime | null = null;

export const registerWorkbookLiveSocketRuntime = (runtime: WorkbookLiveSocketRuntime) => {
  workbookLiveSocketRuntimeRef = runtime;
};

export const getWorkbookLiveSocketRuntime = () => {
  if (!workbookLiveSocketRuntimeRef) {
    throw new Error("[backend:nest] workbook live runtime is not registered");
  }
  return workbookLiveSocketRuntimeRef;
};
