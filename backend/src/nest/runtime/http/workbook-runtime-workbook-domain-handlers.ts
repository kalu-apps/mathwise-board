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

const isDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:");

const WORKBOOK_ASSET_URL_RE = /^\/api\/workbook\/sessions\/[^/]+\/assets\/[^/]+(?:\/content)?$/i;

const normalizeWorkbookAssetContentUrl = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) return value;
  const rawValue = value.trim();
  const isAbsolute = /^[a-z]+:\/\//i.test(rawValue);
  try {
    const parsed = new URL(rawValue, "http://workbook.local");
    if (!WORKBOOK_ASSET_URL_RE.test(parsed.pathname)) {
      return rawValue;
    }
    if (!parsed.pathname.endsWith("/content")) {
      parsed.pathname = `${parsed.pathname}/content`;
    }
    if (isAbsolute) return parsed.toString();
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawValue;
  }
};

const normalizeBoardObjectImageUrl = async (
  sessionId: string,
  object: unknown,
  deps: WorkbookDomainDeps
) => {
  if (!object || typeof object !== "object") return;
  const typedObject = object as { imageUrl?: unknown; imageName?: unknown };
  if (isDataUrl(typedObject.imageUrl)) {
    const stored = await deps.persistWorkbookAssetFromDataUrl({
      sessionId,
      dataUrl: typedObject.imageUrl,
      fileName: typeof typedObject.imageName === "string" ? typedObject.imageName : undefined,
    });
    typedObject.imageUrl = stored.url;
    return;
  }
  typedObject.imageUrl = normalizeWorkbookAssetContentUrl(typedObject.imageUrl);
};

const normalizeDocumentAssetMedia = async (
  sessionId: string,
  asset: unknown,
  deps: WorkbookDomainDeps
) => {
  if (!asset || typeof asset !== "object") return;
  const typedAsset = asset as {
    name?: unknown;
    url?: unknown;
    renderedPages?: unknown;
  };
  if (isDataUrl(typedAsset.url)) {
    const stored = await deps.persistWorkbookAssetFromDataUrl({
      sessionId,
      dataUrl: typedAsset.url,
      fileName: typeof typedAsset.name === "string" ? typedAsset.name : undefined,
    });
    typedAsset.url = stored.url;
  } else {
    typedAsset.url = normalizeWorkbookAssetContentUrl(typedAsset.url);
  }
  if (!Array.isArray(typedAsset.renderedPages)) return;
  for (const page of typedAsset.renderedPages) {
    if (!page || typeof page !== "object") continue;
    const typedPage = page as { imageUrl?: unknown; id?: unknown };
    if (isDataUrl(typedPage.imageUrl)) {
      const stored = await deps.persistWorkbookAssetFromDataUrl({
        sessionId,
        dataUrl: typedPage.imageUrl,
        fileName: typeof typedAsset.name === "string" ? `${typedAsset.name}-render` : undefined,
      });
      typedPage.imageUrl = stored.url;
      continue;
    }
    typedPage.imageUrl = normalizeWorkbookAssetContentUrl(typedPage.imageUrl);
  }
};

const normalizeSnapshotPayloadMedia = async (
  sessionId: string,
  payload: unknown,
  deps: WorkbookDomainDeps
) => {
  if (!payload || typeof payload !== "object") return payload;
  const typedPayload = payload as {
    objects?: unknown;
    document?: unknown;
  };

  if (Array.isArray(typedPayload.objects)) {
    for (const object of typedPayload.objects) {
      await normalizeBoardObjectImageUrl(sessionId, object, deps);
    }
  }

  const normalizeDocumentStateAssets = async (documentState: unknown) => {
    if (!documentState || typeof documentState !== "object") return;
    const typedDocumentState = documentState as { assets?: unknown };
    if (!Array.isArray(typedDocumentState.assets)) return;
    for (const asset of typedDocumentState.assets) {
      await normalizeDocumentAssetMedia(sessionId, asset, deps);
    }
  };

  await normalizeDocumentStateAssets(typedPayload.document);
  if (Array.isArray((typedPayload as { assets?: unknown }).assets)) {
    await normalizeDocumentStateAssets(typedPayload);
  }
  return typedPayload;
};

const normalizeEventsMediaPayloads = async (
  sessionId: string,
  events: WorkbookClientEventInput[],
  deps: WorkbookDomainDeps
) => {
  const normalizedEvents: WorkbookClientEventInput[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    if (typeof event.type !== "string") continue;
    const nextEvent = {
      ...event,
      payload:
        event.payload && typeof event.payload === "object"
          ? { ...(event.payload as Record<string, unknown>) }
          : event.payload,
    } as WorkbookClientEventInput;

    if (
      (nextEvent.type === "board.object.create" || nextEvent.type === "board.object.update") &&
      nextEvent.payload &&
      typeof nextEvent.payload === "object"
    ) {
      const payload = nextEvent.payload as {
        object?: unknown;
        patch?: unknown;
      };
      if (payload.object && typeof payload.object === "object") {
        await normalizeBoardObjectImageUrl(sessionId, payload.object, deps);
      }
      if (payload.patch && typeof payload.patch === "object") {
        await normalizeBoardObjectImageUrl(sessionId, payload.patch, deps);
      }
    }

    if (nextEvent.type === "document.asset.add" && nextEvent.payload && typeof nextEvent.payload === "object") {
      const payload = nextEvent.payload as { asset?: unknown };
      await normalizeDocumentAssetMedia(sessionId, payload.asset, deps);
    }

    if (nextEvent.type === "document.state.update" && nextEvent.payload && typeof nextEvent.payload === "object") {
      const payload = nextEvent.payload as { document?: unknown };
      await normalizeSnapshotPayloadMedia(sessionId, payload.document, deps);
    }

    normalizedEvents.push(nextEvent);
  }
  return normalizedEvents;
};

const handleWorkbookAssetsRoute = async (
  context: RuntimeRequestContext,
  deps: WorkbookDomainDeps
): Promise<boolean> => {
  const { req, res, db, method, pathname } = context;

  const workbookAssetUploadMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/assets$/);
  if (workbookAssetUploadMatch && method === "POST") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookAssetUploadMatch[1]);
    if (!deps.getWorkbookParticipant(db, sessionId, actor.id)) {
      deps.forbidden(res);
      return true;
    }
    const body = (await deps.readBody(req)) as {
      fileName?: string;
      mimeType?: string;
      dataUrl?: string;
    } | null;
    if (typeof body?.dataUrl !== "string" || !body.dataUrl.startsWith("data:")) {
      deps.badRequest(res, "Некорректный payload ассета.");
      return true;
    }
    try {
      const stored = await deps.persistWorkbookAssetFromDataUrl({
        sessionId,
        dataUrl: body.dataUrl,
        fileName: typeof body.fileName === "string" ? body.fileName : undefined,
        mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      });
      deps.json(res, 200, {
        assetId: stored.assetId,
        url: stored.url,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "workbook_asset_upload_failed";
      if (message === "workbook_asset_too_large") {
        deps.json(res, 413, { error: message });
        return true;
      }
      if (message === "workbook_asset_invalid_data_url") {
        deps.badRequest(res, "Некорректный data URL ассета.");
        return true;
      }
      deps.json(res, 500, { error: "workbook_asset_upload_failed" });
      return true;
    }
  }

  const workbookAssetReadMatch = pathname.match(
    /^\/api\/workbook\/sessions\/([^/]+)\/assets\/([^/]+)(?:\/content)?$/
  );
  if (workbookAssetReadMatch && method === "GET") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const sessionId = decodeURIComponent(workbookAssetReadMatch[1]);
    const assetId = decodeURIComponent(workbookAssetReadMatch[2]);
    if (!deps.getWorkbookParticipant(db, sessionId, actor.id)) {
      deps.forbidden(res);
      return true;
    }
    const asset = await deps.readWorkbookAssetById(assetId);
    if (!asset) {
      deps.notFound(res);
      return true;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Content-Length", String(asset.sizeBytes));
    res.setHeader("Cache-Control", asset.cacheControl);
    res.setHeader("X-Content-Type-Options", "nosniff");
    const stream = deps.createWorkbookAssetReadStream(asset.filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        deps.notFound(res);
        return;
      }
      res.end();
    });
    stream.pipe(res);
    return true;
  }

  return false;
};

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
    const normalizedEvents = await normalizeEventsMediaPayloads(sessionId, events, deps);
    const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_events_append";
    const requestFingerprint = deps.hashWorkbookOperationFingerprint({
      sessionId,
      events: normalizedEvents,
    });
    const idempotencyKey = deps.resolveWriteIdempotencyKey({
      req,
      scope: idempotencyScope,
      actorUserId: actor.id,
      sessionId,
      payloadFingerprint: {
        events: normalizedEvents,
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

    for (const event of normalizedEvents) {
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
      events: normalizedEvents,
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
    const rawBody = (await deps.readBody(req)) as {
      layer?: "board" | "annotations";
      version?: number;
      payload?: unknown;
    } | null;
    const body = {
      layer: rawBody?.layer,
      version: rawBody?.version,
      payload: await normalizeSnapshotPayloadMedia(sessionId, rawBody?.payload ?? null, deps),
    };
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
  if (await handleWorkbookAssetsRoute(context, deps)) {
    return true;
  }

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
