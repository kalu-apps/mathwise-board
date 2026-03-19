/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  MockDb,
  WorkbookOperationRecord,
} from "../core/db";
import type { WorkbookClientEventInput } from "../../../../../src/features/workbook/model/events";

type RuntimeRequestContext = {
  req: IncomingMessage;
  res: ServerResponse;
  db: MockDb;
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
};

type WorkbookStreamClient = {
  id: string;
  userId: string;
  res: ServerResponse;
};

type PresenceState = "active" | "inactive";

type WorkbookDomainDeps = Record<string, any> & {
  WORKBOOK_EVENT_LIMIT: number;
  WORKBOOK_PDF_RENDER_MAX_BYTES: number;
  PRESENCE_ACTIVITY_TOUCH_INTERVAL_MS: number;
  workbookStreamClientsBySession: Map<string, Map<string, WorkbookStreamClient>>;
  nowIso: () => string;
  ensureId: () => string;
  nowTs: () => number;
};

const HEARTBEAT_INTERVAL_MS = 15_000;

const handleWorkbookEventsRoute = async (
  context: RuntimeRequestContext,
  deps: WorkbookDomainDeps
): Promise<boolean> => {
  const { req, res, db, method, pathname, searchParams } = context;

  const workbookEventsMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events$/);
  if (workbookEventsMatch && method === "GET") {
    if (!deps.ensureWorkbookPersistenceReady(res)) return true;
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookEventsMatch[1]);
    if (!deps.getWorkbookParticipant(db, sessionId, actor.id)) {
      deps.forbidden(res);
      return true;
    }

    const afterSeq = Number(searchParams.get("afterSeq") ?? "0");
    const { events, latestSeq } = await deps.workbookEventStore.read({
      sessionId,
      afterSeq: Number.isFinite(afterSeq) ? afterSeq : 0,
      limit: deps.WORKBOOK_EVENT_LIMIT,
    });
    deps.json(res, 200, { sessionId, latestSeq, events });
    return true;
  }

  if (workbookEventsMatch && method === "POST") {
    if (!deps.ensureWorkbookPersistenceReady(res)) return true;
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookEventsMatch[1]);
    const session = deps.getWorkbookSessionById(db, sessionId);
    if (!session) {
      deps.notFound(res);
      return true;
    }
    deps.applyStudentControls(session, db);
    let participant = deps.getWorkbookParticipant(db, sessionId, actor.id);
    if (!participant) {
      deps.forbidden(res);
      return true;
    }

    const body = (await deps.readBody(req)) as { events?: WorkbookClientEventInput[] } | null;
    const events = Array.isArray(body?.events)
      ? body.events.filter((event) => typeof event?.type === "string")
      : [];
    if (!events.length) {
      deps.badRequest(res, "Нет событий для сохранения.");
      return true;
    }
    const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_events_append";
    const requestFingerprint = deps.hashWorkbookOperationFingerprint({
      sessionId,
      events,
    });
    const idempotencyKey = deps.resolveWriteIdempotencyKey({
      req,
      scope: idempotencyScope,
      actorUserId: actor.id,
      sessionId,
      payloadFingerprint: {
        events,
      },
    });
    const existingOperation = deps.readWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
    });
    if (existingOperation?.conflict) {
      deps.conflict(res, "idempotency_key_reused_with_different_payload");
      return true;
    }
    if (existingOperation) {
      deps.json(res, existingOperation.statusCode, existingOperation.payload);
      return true;
    }

    for (const event of events) {
      if (event.type === "media.signal" && !participant.permissions.canUseMedia) {
        deps.forbidden(res, "media_disabled");
        return true;
      }
      if (event.type === "chat.message" && !participant.permissions.canUseChat) {
        deps.forbidden(res, "chat_disabled");
        return true;
      }
      if (
        (event.type === "chat.message.delete" || event.type === "chat.clear") &&
        !participant.permissions.canManageSession
      ) {
        deps.forbidden(res);
        return true;
      }
      if (event.type !== "permissions.update") continue;
      if (!participant.permissions.canManageSession) {
        deps.forbidden(res);
        return true;
      }
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as { userId?: unknown; permissions?: unknown })
          : null;
      const targetUserId = typeof payload?.userId === "string" ? payload.userId : "";
      if (!targetUserId) continue;
      const targetParticipant = deps.getWorkbookParticipant(db, sessionId, targetUserId);
      if (!targetParticipant || targetParticipant.roleInSession !== "student") continue;
      const patch = deps.sanitizePermissionPatch(payload?.permissions ?? null);
      if (Object.keys(patch).length === 0) continue;
      const nextPermissions = deps.normalizeParticipantPermissions("student", {
        ...targetParticipant.permissions,
        ...patch,
      });
      targetParticipant.permissions = nextPermissions;
      if (deps.hasBoardToolsPermissionPatch(patch)) {
        targetParticipant.boardToolsOverride = deps.resolveBoardToolsOverrideState(nextPermissions);
      }
      participant = deps.getWorkbookParticipant(db, sessionId, actor.id) ?? participant;
    }

    const versionGuardResult = await deps.applyWorkbookObjectVersionGuard({
      db,
      sessionId,
      events,
    });
    if (!versionGuardResult.ok) {
      deps.json(res, 409, {
        error: "object_version_conflict",
        conflicts: versionGuardResult.conflicts,
      });
      return true;
    }

    const appendResult = await deps.workbookEventStore.append({
      sessionId,
      authorUserId: actor.id,
      events: versionGuardResult.events,
      limit: deps.WORKBOOK_EVENT_LIMIT,
    });

    deps.touchSessionActivity(session, appendResult.timestamp);
    deps.ensureDraftForOwner(db, session, actor.id).updatedAt = appendResult.timestamp;
    const urgentLiveEvents = deps.collectUrgentWorkbookLiveEvents(appendResult.events);
    if (urgentLiveEvents.length > 0) {
      deps.publishWorkbookLiveEvents(db, {
        sessionId,
        latestSeq: appendResult.latestSeq,
        events: urgentLiveEvents,
        channel: "live",
      });
    }

    deps.publishWorkbookStreamEvents(db, {
      sessionId,
      latestSeq: appendResult.latestSeq,
      events: appendResult.events,
    });
    deps.saveDb();
    const responsePayload = {
      events: appendResult.events,
      latestSeq: appendResult.latestSeq,
    };
    deps.saveWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
      statusCode: 200,
      payload: responsePayload,
    });
    deps.json(res, 200, responsePayload);
    return true;
  }

  const workbookLiveMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events\/live$/);
  if (workbookLiveMatch && method === "POST") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookLiveMatch[1]);
    const session = deps.getWorkbookSessionById(db, sessionId);
    if (!session) {
      deps.notFound(res);
      return true;
    }
    deps.applyStudentControls(session, db);
    const participant = deps.getWorkbookParticipant(db, sessionId, actor.id);
    if (!participant) {
      deps.forbidden(res);
      return true;
    }
    if (!deps.enforceVolatileRateLimit(res, sessionId, actor.id, "live_http")) {
      return true;
    }
    const body = (await deps.readBody(req)) as { events?: unknown[] } | null;
    const events = Array.isArray(body?.events) ? body.events : [];
    const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_events_live";
    const requestFingerprint = deps.hashWorkbookOperationFingerprint({
      sessionId,
      events,
    });
    const idempotencyKey = deps.resolveWriteIdempotencyKey({
      req,
      scope: idempotencyScope,
      actorUserId: actor.id,
      sessionId,
      payloadFingerprint: {
        events,
      },
    });
    const existingOperation = deps.readWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
    });
    if (existingOperation?.conflict) {
      deps.conflict(res, "idempotency_key_reused_with_different_payload");
      return true;
    }
    if (existingOperation) {
      deps.json(res, existingOperation.statusCode, existingOperation.payload);
      return true;
    }
    const sanitizedEvents = deps.sanitizeWorkbookLiveEvents(participant, events);
    if (sanitizedEvents.length === 0) {
      deps.json(res, 200, { ok: true });
      return true;
    }
    const appendResult = await deps.appendWorkbookEvents(db, {
      sessionId,
      authorUserId: actor.id,
      events: sanitizedEvents,
      persist: false,
    });
    deps.touchSessionActivity(session, appendResult.timestamp);
    deps.publishWorkbookLiveEvents(db, {
      sessionId,
      latestSeq: appendResult.latestSeq,
      events: appendResult.events,
      channel: "live",
    });
    const responsePayload = { ok: true as const };
    deps.saveWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
      statusCode: 200,
      payload: responsePayload,
    });
    deps.json(res, 200, responsePayload);
    return true;
  }

  const workbookPreviewMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events\/preview$/);
  if (workbookPreviewMatch && method === "POST") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookPreviewMatch[1]);
    const session = deps.getWorkbookSessionById(db, sessionId);
    if (!session) {
      deps.notFound(res);
      return true;
    }
    deps.applyStudentControls(session, db);
    const participant = deps.getWorkbookParticipant(db, sessionId, actor.id);
    if (!participant) {
      deps.forbidden(res);
      return true;
    }
    if (!deps.enforceVolatileRateLimit(res, sessionId, actor.id, "preview_http")) {
      return true;
    }

    const body = (await deps.readBody(req)) as {
      type?: string;
      objectId?: string;
      patch?: Record<string, unknown>;
      stroke?: Record<string, unknown>;
      previewVersion?: unknown;
    } | null;
    const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_events_preview";
    const requestFingerprint = deps.hashWorkbookOperationFingerprint({
      sessionId,
      body,
    });
    const idempotencyKey = deps.resolveWriteIdempotencyKey({
      req,
      scope: idempotencyScope,
      actorUserId: actor.id,
      sessionId,
      payloadFingerprint: body ?? {},
    });
    const existingOperation = deps.readWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
    });
    if (existingOperation?.conflict) {
      deps.conflict(res, "idempotency_key_reused_with_different_payload");
      return true;
    }
    if (existingOperation) {
      deps.json(res, existingOperation.statusCode, existingOperation.payload);
      return true;
    }

    const previewVersion =
      typeof body?.previewVersion === "number" && Number.isFinite(body.previewVersion)
        ? Math.max(1, Math.trunc(body.previewVersion))
        : null;
    const previewType =
      body?.type === "board.stroke.preview" || body?.type === "annotations.stroke.preview"
        ? body.type
        : "board.object.preview";
    let previewEvent: WorkbookClientEventInput | null = null;

    if (previewType === "board.stroke.preview" || previewType === "annotations.stroke.preview") {
      if (!participant.permissions.canDraw) {
        deps.forbidden(res);
        return true;
      }
      const stroke = body?.stroke && typeof body.stroke === "object" ? body.stroke : null;
      if (!stroke) {
        deps.badRequest(res, "Некорректные данные preview.");
        return true;
      }
      previewEvent = {
        type: previewType,
        payload: {
          stroke,
          ...(previewVersion ? { previewVersion } : {}),
        },
      };
    } else {
      if (!participant.permissions.canSelect) {
        deps.forbidden(res);
        return true;
      }
      const objectId = typeof body?.objectId === "string" ? body.objectId : "";
      const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
      if (!objectId || !patch) {
        deps.badRequest(res, "Некорректные данные preview.");
        return true;
      }
      previewEvent = {
        type: "board.object.preview",
        payload: {
          objectId,
          patch,
          ...(previewVersion ? { previewVersion } : {}),
        },
      };
    }

    const appendResult = await deps.appendWorkbookEvents(db, {
      sessionId,
      authorUserId: actor.id,
      events: previewEvent ? [previewEvent] : [],
      persist: false,
    });

    deps.touchSessionActivity(session, appendResult.timestamp);
    deps.publishWorkbookLiveEvents(db, {
      sessionId,
      latestSeq: appendResult.latestSeq,
      events: appendResult.events,
      channel: "live",
    });
    const responsePayload = { ok: true as const };
    deps.saveWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
      statusCode: 200,
      payload: responsePayload,
    });
    deps.json(res, 200, responsePayload);
    return true;
  }

  const workbookEventsStreamMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events\/stream$/);
  if (workbookEventsStreamMatch && method === "GET") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookEventsStreamMatch[1]);
    if (!deps.getWorkbookParticipant(db, sessionId, actor.id)) {
      deps.forbidden(res);
      return true;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const clientId = deps.ensureId();
    const sessionClients = deps.workbookStreamClientsBySession.get(sessionId) ?? new Map();
    sessionClients.set(clientId, { id: clientId, userId: actor.id, res });
    deps.workbookStreamClientsBySession.set(sessionId, sessionClients);
    void deps.ensureRuntimeSessionBridge(sessionId);

    try {
      res.write(`event: ping\\ndata: ${JSON.stringify({ ts: deps.nowIso() })}\\n\\n`);
    } catch {
      deps.closeWorkbookStreamClient(sessionId, clientId);
      res.end();
      return true;
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\\ndata: ${JSON.stringify({ ts: deps.nowIso() })}\\n\\n`);
      } catch {
        clearInterval(heartbeat);
        deps.closeWorkbookStreamClient(sessionId, clientId);
        res.end();
      }
    }, HEARTBEAT_INTERVAL_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      deps.closeWorkbookStreamClient(sessionId, clientId);
    };

    req.on("close", cleanup);
    req.on("end", cleanup);
    req.on("error", cleanup);
    return true;
  }

  return false;
};

const handleWorkbookSnapshotAndPdfRoute = async (
  context: RuntimeRequestContext,
  deps: WorkbookDomainDeps
): Promise<boolean> => {
  const { req, res, db, method, pathname, searchParams } = context;

  const workbookSnapshotMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/snapshot$/);
  if (workbookSnapshotMatch && method === "GET") {
    if (!deps.ensureWorkbookPersistenceReady(res)) return true;
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookSnapshotMatch[1]);
    if (!deps.getWorkbookParticipant(db, sessionId, actor.id)) {
      deps.forbidden(res);
      return true;
    }
    const layer = searchParams.get("layer") === "annotations" ? "annotations" : "board";
    const snapshot = await deps.workbookSnapshotStore.read({ sessionId, layer });
    if (!snapshot) {
      deps.json(res, 200, null);
      return true;
    }
    deps.json(res, 200, {
      id: snapshot.id,
      sessionId: snapshot.sessionId,
      layer: snapshot.layer,
      version: snapshot.version,
      payload: snapshot.payload,
      createdAt: snapshot.createdAt,
    });
    return true;
  }

  if (workbookSnapshotMatch && method === "PUT") {
    if (!deps.ensureWorkbookPersistenceReady(res)) return true;
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookSnapshotMatch[1]);
    if (!deps.getWorkbookParticipant(db, sessionId, actor.id)) {
      deps.forbidden(res);
      return true;
    }
    const body = (await deps.readBody(req)) as {
      layer?: "board" | "annotations";
      version?: number;
      payload?: unknown;
    } | null;
    const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_snapshot_upsert";
    const requestFingerprint = deps.hashWorkbookOperationFingerprint({
      sessionId,
      body,
    });
    const idempotencyKey = deps.resolveWriteIdempotencyKey({
      req,
      scope: idempotencyScope,
      actorUserId: actor.id,
      sessionId,
      payloadFingerprint: body ?? {},
    });
    const existingOperation = deps.readWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
    });
    if (existingOperation?.conflict) {
      deps.conflict(res, "idempotency_key_reused_with_different_payload");
      return true;
    }
    if (existingOperation) {
      deps.json(res, existingOperation.statusCode, existingOperation.payload);
      return true;
    }
    const layer = body?.layer === "annotations" ? "annotations" : "board";
    const requestedVersion =
      typeof body?.version === "number" && body.version > 0 ? Math.trunc(body.version) : 1;
    const latestSeq = deps.getWorkbookSessionLatestSeq(db, sessionId);
    const version =
      latestSeq > 0 ? Math.max(1, Math.min(requestedVersion, latestSeq)) : Math.max(1, requestedVersion);
    const payload = body?.payload ?? null;
    const snapshot = await deps.workbookSnapshotStore.upsert({
      sessionId,
      layer,
      version,
      payload,
    });
    const barrier = deps.resolveWorkbookSnapshotBarrier(db, sessionId);
    const beforeTrimCount = db.workbookEvents.filter((event) => event.sessionId === sessionId).length;
    const accepted = requestedVersion === version && version >= snapshot.version;
    if (beforeTrimCount > deps.WORKBOOK_EVENT_LIMIT && barrier.confirmed) {
      const before = db.workbookEvents.length;
      deps.trimWorkbookEventsOverflow(db, sessionId);
      if (db.workbookEvents.length !== before) {
        deps.saveDb();
      }
    }
    const responsePayload = {
      id: snapshot.id,
      sessionId: snapshot.sessionId,
      layer: snapshot.layer,
      version: snapshot.version,
      payload: snapshot.payload,
      accepted,
      requestedVersion,
      barrierSeq: barrier.barrierSeq,
      createdAt: snapshot.createdAt,
    };
    deps.saveWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
      statusCode: 200,
      payload: responsePayload,
    });

    deps.json(res, 200, responsePayload);
    return true;
  }

  if (pathname === "/api/workbook/pdf/render" && method === "POST") {
    const body = (await deps.readBody(req)) as {
      fileName?: string;
      dataUrl?: string;
      dpi?: number;
      maxPages?: number;
    } | null;

    const pdfBuffer = deps.decodeWorkbookPdfDataUrl(body?.dataUrl);
    if (!pdfBuffer) {
      deps.badRequest(res, "Некорректный PDF payload.");
      return true;
    }
    if (pdfBuffer.length > deps.WORKBOOK_PDF_RENDER_MAX_BYTES) {
      deps.json(res, 413, {
        error: "pdf_too_large",
      });
      return true;
    }

    const dpi =
      typeof body?.dpi === "number" && Number.isFinite(body.dpi)
        ? Math.max(72, Math.min(240, Math.floor(body.dpi)))
        : 128;
    const maxPages =
      typeof body?.maxPages === "number" && Number.isFinite(body.maxPages)
        ? Math.max(1, Math.min(12, Math.floor(body.maxPages)))
        : 8;

    try {
      const pages = await deps.renderWorkbookPdfPagesViaPoppler({
        pdfBuffer,
        dpi,
        maxPages,
        ensureId: deps.ensureId,
      });
      deps.json(res, 200, {
        renderer: "poppler",
        fileName: typeof body?.fileName === "string" ? body.fileName : "document.pdf",
        pages,
      });
      return true;
    } catch {
      deps.json(res, 503, {
        renderer: "unavailable",
        fileName: typeof body?.fileName === "string" ? body.fileName : "document.pdf",
        pages: [],
        error:
          "PDF render backend недоступен. Установите poppler (pdftoppm) или используйте image-файл.",
      });
      return true;
    }
  }

  return false;
};

const handleWorkbookPresenceRoute = async (
  context: RuntimeRequestContext,
  deps: WorkbookDomainDeps
): Promise<boolean> => {
  const { req, res, db, method, pathname } = context;

  const workbookPresenceMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/presence$/);
  if (workbookPresenceMatch && method === "POST") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const body = (await deps.readBody(req)) as {
      state?: PresenceState;
      tabId?: string;
    } | null;
    const sessionId = decodeURIComponent(workbookPresenceMatch[1]);
    const session = deps.getWorkbookSessionById(db, sessionId);
    if (!session) {
      deps.notFound(res);
      return true;
    }
    const participant = deps.getWorkbookParticipant(db, sessionId, actor.id);
    if (!participant) {
      deps.forbidden(res);
      return true;
    }
    const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_presence_heartbeat";
    const requestFingerprint = deps.hashWorkbookOperationFingerprint({
      sessionId,
      body,
    });
    const idempotencyKey = deps.resolveWriteIdempotencyKey({
      req,
      scope: idempotencyScope,
      actorUserId: actor.id,
      sessionId,
      payloadFingerprint: body ?? {},
    });
    const existingOperation = deps.readWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
    });
    if (existingOperation?.conflict) {
      deps.conflict(res, "idempotency_key_reused_with_different_payload");
      return true;
    }
    if (existingOperation) {
      deps.json(res, existingOperation.statusCode, existingOperation.payload);
      return true;
    }

    const state = deps.normalizePresenceState(body?.state);
    const tabId = deps.normalizePresenceTabId(body?.tabId);
    const wasActive = participant.isActive;
    const heartbeatTs = deps.nowTs();
    const heartbeatAt = deps.nowIso();
    const presenceResult = deps.applyParticipantPresenceState(participant, {
      sessionId,
      state,
      tabId,
      timestamp: heartbeatAt,
    });
    const lastActivityTouchAt = deps.presenceActivityTouchAtBySession.get(sessionId) ?? 0;
    const shouldTouchSessionActivity =
      state === "active" &&
      (!wasActive || heartbeatTs - lastActivityTouchAt >= deps.PRESENCE_ACTIVITY_TOUCH_INTERVAL_MS);
    if (shouldTouchSessionActivity) {
      deps.touchSessionActivity(session, heartbeatAt);
      deps.ensureDraftForOwner(db, session, actor.id).updatedAt = session.lastActivityAt;
      deps.presenceActivityTouchAtBySession.set(sessionId, heartbeatTs);
    } else if (!presenceResult.hasActiveTabs) {
      deps.presenceActivityTouchAtBySession.delete(sessionId);
    }
    deps.applyStudentControls(session, db);
    deps.persistPresenceIfNeeded(participant, {
      force: presenceResult.changed || shouldTouchSessionActivity,
    });
    const participants = deps.maybePublishPresenceSync(db, sessionId, actor.id);
    if (presenceResult.visitStarted) {
      await deps.recordWorkbookAccessEvent({
        req,
        sessionId,
        eventType: "presence_started",
        actor,
        details: {
          state,
          tabId,
        },
      });
    }
    if (presenceResult.visitEnded) {
      await deps.recordWorkbookAccessEvent({
        req,
        sessionId,
        eventType: "presence_ended",
        actor,
        details: {
          reason: "presence_inactive",
          state,
          tabId,
        },
      });
    }
    const responsePayload = {
      ok: true,
      participants,
    } as const;
    deps.saveWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
      statusCode: 200,
      payload: responsePayload,
    });
    deps.json(res, 200, responsePayload);
    return true;
  }

  const workbookPresenceLeaveMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/presence\/leave$/);
  if (workbookPresenceLeaveMatch && method === "POST") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const body = (await deps.readBody(req)) as {
      tabId?: string;
      reason?: string;
    } | null;
    const sessionId = decodeURIComponent(workbookPresenceLeaveMatch[1]);
    const session = deps.getWorkbookSessionById(db, sessionId);
    if (!session) {
      deps.notFound(res);
      return true;
    }
    const participant = deps.getWorkbookParticipant(db, sessionId, actor.id);
    if (!participant) {
      deps.forbidden(res);
      return true;
    }
    const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_presence_leave";
    const requestFingerprint = deps.hashWorkbookOperationFingerprint({
      sessionId,
      body,
    });
    const idempotencyKey = deps.resolveWriteIdempotencyKey({
      req,
      scope: idempotencyScope,
      actorUserId: actor.id,
      sessionId,
      payloadFingerprint: body ?? {},
    });
    const existingOperation = deps.readWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
    });
    if (existingOperation?.conflict) {
      deps.conflict(res, "idempotency_key_reused_with_different_payload");
      return true;
    }
    if (existingOperation) {
      deps.json(res, existingOperation.statusCode, existingOperation.payload);
      return true;
    }
    const leftAt = deps.nowIso();
    const hasTabId = typeof body?.tabId === "string" && body.tabId.trim().length > 0;
    const tabId = deps.normalizePresenceTabId(body?.tabId);
    const presenceResult = deps.applyParticipantPresenceState(participant, {
      sessionId,
      state: "inactive",
      tabId,
      timestamp: leftAt,
      clearTabs: !hasTabId,
    });
    if (!presenceResult.hasActiveTabs) {
      deps.presenceActivityTouchAtBySession.delete(sessionId);
    }
    deps.applyStudentControls(session, db);
    deps.persistPresenceIfNeeded(participant, { force: presenceResult.changed });
    const participants = deps.maybePublishPresenceSync(db, sessionId, actor.id);
    if (presenceResult.visitEnded) {
      await deps.recordWorkbookAccessEvent({
        req,
        sessionId,
        eventType: "presence_ended",
        actor,
        details: {
          reason:
            typeof body?.reason === "string" && body.reason.trim().length > 0
              ? body.reason.trim().slice(0, 120)
              : "leave_endpoint",
          tabId,
        },
      });
    }
    const responsePayload = {
      ok: true,
      participants,
    } as const;
    deps.saveWorkbookIdempotentOperation(db, {
      scope: idempotencyScope,
      actorUserId: actor.id,
      idempotencyKey,
      requestFingerprint,
      statusCode: 200,
      payload: responsePayload,
    });
    deps.json(res, 200, responsePayload);
    return true;
  }

  return false;
};

export const handleWorkbookDomainRoute = async (
  context: RuntimeRequestContext,
  deps: WorkbookDomainDeps
): Promise<boolean> => {
  if (await handleWorkbookEventsRoute(context, deps)) {
    return true;
  }

  if (await handleWorkbookPresenceRoute(context, deps)) {
    return true;
  }

  if (await handleWorkbookSnapshotAndPdfRoute(context, deps)) {
    return true;
  }

  return false;
};
