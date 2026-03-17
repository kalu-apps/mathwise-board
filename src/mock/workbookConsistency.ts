import crypto from "node:crypto";
import type { MockDb, WorkbookEventRecord, WorkbookOperationScope } from "./db";
import type { WorkbookClientEventInput } from "../features/workbook/model/events";

const readBool = (value: string | undefined, fallback: boolean) => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const readPositiveInt = (value: string | undefined, fallback: number, cap: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(cap, parsed);
};

const readFloat = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const nowIso = () => new Date().toISOString();

const WORKBOOK_WRITE_OPERATION_SCOPES: WorkbookOperationScope[] = [
  "workbook_events_append",
  "workbook_events_live",
  "workbook_events_preview",
  "workbook_snapshot_upsert",
  "workbook_presence_heartbeat",
  "workbook_presence_leave",
];

const writeScopeSet = new Set<WorkbookOperationScope>(WORKBOOK_WRITE_OPERATION_SCOPES);

export const isWorkbookWriteOperationScope = (
  scope: WorkbookOperationScope
) => writeScopeSet.has(scope);

export const workbookConsistencyConfig = {
  strictObjectVersion: readBool(process.env.NEST_OBJECT_VERSION_STRICT, false),
  idempotencyTtlMs: readPositiveInt(process.env.NEST_IDEMPOTENCY_TTL_MS, 300_000, 86_400_000),
  idempotencyMaxRecords: readPositiveInt(process.env.NEST_IDEMPOTENCY_MAX_RECORDS, 20_000, 200_000),
  idempotencyBodyFallback: readBool(process.env.NEST_IDEMPOTENCY_BODY_FALLBACK, true),
  idempotencySampleRate: readFloat(process.env.NEST_IDEMPOTENCY_SAMPLE_RATE, 1, 0.01, 1),
} as const;

type IdempotencyStats = {
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
  conflicts: number;
};

type ObjectVersionStats = {
  acceptedMutations: number;
  conflicts: number;
  trackedSessions: Set<string>;
  lastTrackedObjects: number;
  lastUpdatedAt: string | null;
};

const idempotencyStats: IdempotencyStats = {
  hits: 0,
  misses: 0,
  writes: 0,
  evictions: 0,
  conflicts: 0,
};

const objectVersionStats: ObjectVersionStats = {
  acceptedMutations: 0,
  conflicts: 0,
  trackedSessions: new Set<string>(),
  lastTrackedObjects: 0,
  lastUpdatedAt: null,
};

export const registerWorkbookIdempotencyHit = () => {
  idempotencyStats.hits += 1;
};

export const registerWorkbookIdempotencyMiss = () => {
  idempotencyStats.misses += 1;
};

export const registerWorkbookIdempotencyWrite = () => {
  idempotencyStats.writes += 1;
};

export const registerWorkbookIdempotencyConflict = () => {
  idempotencyStats.conflicts += 1;
};

export const registerWorkbookIdempotencyEvictions = (count: number) => {
  if (!Number.isFinite(count) || count <= 0) return;
  idempotencyStats.evictions += Math.trunc(count);
};

const registerObjectVersionCoverage = (sessionId: string, trackedObjects: number) => {
  objectVersionStats.trackedSessions.add(sessionId);
  objectVersionStats.lastTrackedObjects = trackedObjects;
  objectVersionStats.lastUpdatedAt = nowIso();
};

const registerObjectVersionAccepted = (count: number) => {
  if (count <= 0) return;
  objectVersionStats.acceptedMutations += count;
};

const registerObjectVersionConflict = (count: number) => {
  if (count <= 0) return;
  objectVersionStats.conflicts += count;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
};

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export const hashWorkbookOperationFingerprint = (value: unknown) =>
  sha256(stableStringify(value));

export const resolveWorkbookWriteIdempotencyKey = (params: {
  headerKey: string | null;
  scope: WorkbookOperationScope;
  actorUserId: string;
  sessionId: string;
  payloadFingerprint: unknown;
}) => {
  if (typeof params.headerKey === "string" && params.headerKey.trim().length > 0) {
    return params.headerKey.trim().slice(0, 240);
  }
  if (!workbookConsistencyConfig.idempotencyBodyFallback) {
    return null;
  }
  if (Math.random() > workbookConsistencyConfig.idempotencySampleRate) {
    return null;
  }
  const digest = hashWorkbookOperationFingerprint({
    scope: params.scope,
    actorUserId: params.actorUserId,
    sessionId: params.sessionId,
    payload: params.payloadFingerprint,
  });
  return `body:${digest.slice(0, 64)}`;
};

const safeParsePayload = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

type ObjectVersionState = {
  version: number;
  deleted: boolean;
  updatedAt: string;
};

type ParsedMutation = {
  objectId: string;
  type: "board.object.create" | "board.object.update" | "board.object.delete" | "board.object.pin";
  payload: Record<string, unknown>;
  objectPayload: Record<string, unknown> | null;
};

type ObjectVersionConflict = {
  objectId: string;
  type: ParsedMutation["type"];
  expectedVersion: number | null;
  actualVersion: number;
  reason:
    | "missing_expected_version"
    | "expected_version_mismatch"
    | "object_already_exists"
    | "object_not_found"
    | "object_deleted";
};

const parseMutationFromIncomingEvent = (
  event: WorkbookClientEventInput
): ParsedMutation | null => {
  if (!event || typeof event !== "object") return null;
  if (
    event.type !== "board.object.create" &&
    event.type !== "board.object.update" &&
    event.type !== "board.object.delete" &&
    event.type !== "board.object.pin"
  ) {
    return null;
  }
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : null;
  if (!payload) return null;

  if (event.type === "board.object.create") {
    const object =
      payload.object && typeof payload.object === "object"
        ? (payload.object as Record<string, unknown>)
        : null;
    const objectId = typeof object?.id === "string" ? object.id.trim() : "";
    if (!objectId) return null;
    return {
      objectId,
      type: event.type,
      payload,
      objectPayload: object,
    };
  }

  const objectId = typeof payload.objectId === "string" ? payload.objectId.trim() : "";
  if (!objectId) return null;
  return {
    objectId,
    type: event.type,
    payload,
    objectPayload: null,
  };
};

const parseMutationFromPersistedEvent = (
  event: WorkbookEventRecord
): ParsedMutation | null => {
  const payloadRaw = safeParsePayload(event.payload);
  const payload =
    payloadRaw && typeof payloadRaw === "object"
      ? (payloadRaw as Record<string, unknown>)
      : null;
  if (!payload) return null;
  if (
    event.type !== "board.object.create" &&
    event.type !== "board.object.update" &&
    event.type !== "board.object.delete" &&
    event.type !== "board.object.pin"
  ) {
    return null;
  }

  if (event.type === "board.object.create") {
    const object =
      payload.object && typeof payload.object === "object"
        ? (payload.object as Record<string, unknown>)
        : null;
    const objectId = typeof object?.id === "string" ? object.id.trim() : "";
    if (!objectId) return null;
    return {
      objectId,
      type: event.type,
      payload,
      objectPayload: object,
    };
  }

  const objectId = typeof payload.objectId === "string" ? payload.objectId.trim() : "";
  if (!objectId) return null;
  return {
    objectId,
    type: event.type,
    payload,
    objectPayload: null,
  };
};

const readVersion = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
};

const deriveObjectVersionStateFromEvents = (
  events: WorkbookEventRecord[]
) => {
  const state = new Map<string, ObjectVersionState>();
  const ordered = events.slice().sort((left, right) => left.seq - right.seq);
  ordered.forEach((event) => {
    const mutation = parseMutationFromPersistedEvent(event);
    if (!mutation) return;
    const current = state.get(mutation.objectId) ?? null;
    const currentVersion = current?.version ?? 0;
    const explicitVersion =
      readVersion(mutation.payload.objectVersion) ??
      readVersion(mutation.objectPayload?.objectVersion) ??
      null;
    const resolvedVersion =
      explicitVersion ?? Math.max(1, currentVersion + 1);
    state.set(mutation.objectId, {
      version: resolvedVersion,
      deleted: mutation.type === "board.object.delete",
      updatedAt: typeof event.createdAt === "string" ? event.createdAt : nowIso(),
    });
  });
  return state;
};

const readSnapshotPayloadObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = safeParsePayload(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
};

const deriveObjectVersionStateFromSnapshotAndEvents = (params: {
  snapshotVersion: number | null;
  snapshotPayload: unknown;
  events: WorkbookEventRecord[];
}) => {
  const state = new Map<string, ObjectVersionState>();
  const payload = readSnapshotPayloadObject(params.snapshotPayload);
  const objects = Array.isArray(payload?.objects) ? payload.objects : [];
  const baseVersion =
    typeof params.snapshotVersion === "number" && Number.isFinite(params.snapshotVersion)
      ? Math.max(1, Math.trunc(params.snapshotVersion))
      : 1;

  objects.forEach((rawObject) => {
    if (!rawObject || typeof rawObject !== "object") return;
    const object = rawObject as Record<string, unknown>;
    const objectId = typeof object.id === "string" ? object.id.trim() : "";
    if (!objectId) return;
    const objectVersion = readVersion(object.objectVersion) ?? baseVersion;
    state.set(objectId, {
      version: Math.max(1, objectVersion),
      deleted: false,
      updatedAt: nowIso(),
    });
  });

  const replayFromSeq =
    typeof params.snapshotVersion === "number" && Number.isFinite(params.snapshotVersion)
      ? Math.max(0, Math.trunc(params.snapshotVersion))
      : 0;
  const ordered = params.events
    .filter((event) => event.seq > replayFromSeq)
    .sort((left, right) => left.seq - right.seq);
  ordered.forEach((event) => {
    const mutation = parseMutationFromPersistedEvent(event);
    if (!mutation) return;
    const current = state.get(mutation.objectId) ?? null;
    const currentVersion = current?.version ?? 0;
    const explicitVersion =
      readVersion(mutation.payload.objectVersion) ??
      readVersion(mutation.objectPayload?.objectVersion) ??
      null;
    const resolvedVersion = explicitVersion ?? Math.max(1, currentVersion + 1);
    state.set(mutation.objectId, {
      version: resolvedVersion,
      deleted: mutation.type === "board.object.delete",
      updatedAt: typeof event.createdAt === "string" ? event.createdAt : nowIso(),
    });
  });

  return state;
};

const buildVersionPlan = (params: {
  current: ObjectVersionState | null;
  expectedVersion: number | null;
  type: ParsedMutation["type"];
}) => {
  const currentVersion = params.current?.version ?? 0;
  if (workbookConsistencyConfig.strictObjectVersion && params.expectedVersion === null) {
    return { ok: false as const, reason: "missing_expected_version" as const, actualVersion: currentVersion };
  }
  if (params.expectedVersion !== null && params.expectedVersion !== currentVersion) {
    return { ok: false as const, reason: "expected_version_mismatch" as const, actualVersion: currentVersion };
  }
  if (params.type === "board.object.create" && params.current && !params.current.deleted) {
    return { ok: false as const, reason: "object_already_exists" as const, actualVersion: currentVersion };
  }
  if (params.type !== "board.object.create" && !params.current) {
    return { ok: false as const, reason: "object_not_found" as const, actualVersion: 0 };
  }
  if (params.type !== "board.object.create" && params.current?.deleted) {
    return { ok: false as const, reason: "object_deleted" as const, actualVersion: currentVersion };
  }
  return { ok: true as const, nextVersion: currentVersion + 1, actualVersion: currentVersion };
};

export const applyWorkbookObjectVersionGuard = (params: {
  db: MockDb;
  sessionId: string;
  events: WorkbookClientEventInput[];
}) => {
  const incomingMutations = params.events
    .map((event) => parseMutationFromIncomingEvent(event))
    .filter((mutation): mutation is ParsedMutation => Boolean(mutation));
  if (incomingMutations.length === 0) {
    return { ok: true as const, events: params.events };
  }

  const persistedSessionEvents = params.db.workbookEvents.filter(
    (event) => event.sessionId === params.sessionId
  );
  const latestBoardSnapshot = params.db.workbookSnapshots
    .filter((snapshot) => snapshot.sessionId === params.sessionId && snapshot.layer === "board")
    .sort((left, right) => right.version - left.version)[0];
  const state = latestBoardSnapshot
    ? deriveObjectVersionStateFromSnapshotAndEvents({
        snapshotVersion: latestBoardSnapshot.version,
        snapshotPayload: latestBoardSnapshot.payload,
        events: persistedSessionEvents,
      })
    : deriveObjectVersionStateFromEvents(persistedSessionEvents);
  registerObjectVersionCoverage(params.sessionId, state.size);

  const conflicts: ObjectVersionConflict[] = [];
  incomingMutations.forEach((mutation) => {
    const current = state.get(mutation.objectId) ?? null;
    const expectedVersion = readVersion(mutation.payload.expectedVersion);
    const plan = buildVersionPlan({
      current,
      expectedVersion,
      type: mutation.type,
    });
    if (!plan.ok) {
      conflicts.push({
        objectId: mutation.objectId,
        type: mutation.type,
        expectedVersion,
        actualVersion: plan.actualVersion,
        reason: plan.reason,
      });
      return;
    }

    mutation.payload.objectVersion = plan.nextVersion;
    if (mutation.objectPayload) {
      mutation.objectPayload.objectVersion = plan.nextVersion;
    }
    if (expectedVersion === null) {
      mutation.payload.expectedVersion = plan.actualVersion;
    }
    state.set(mutation.objectId, {
      version: plan.nextVersion,
      deleted: mutation.type === "board.object.delete",
      updatedAt: nowIso(),
    });
  });

  if (conflicts.length > 0) {
    registerObjectVersionConflict(conflicts.length);
    return { ok: false as const, conflicts };
  }
  registerObjectVersionAccepted(incomingMutations.length);
  return { ok: true as const, events: params.events };
};

export const resolveWorkbookSnapshotBarrier = (db: MockDb, sessionId: string) => {
  const boardSnapshot = db.workbookSnapshots
    .filter((snapshot) => snapshot.sessionId === sessionId && snapshot.layer === "board")
    .sort((left, right) => right.version - left.version)[0];
  const annotationsSnapshot = db.workbookSnapshots
    .filter((snapshot) => snapshot.sessionId === sessionId && snapshot.layer === "annotations")
    .sort((left, right) => right.version - left.version)[0];
  const latestEventSeq = db.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .reduce((max, event) => Math.max(max, event.seq), 0);
  const confirmed = Boolean(boardSnapshot && annotationsSnapshot);
  const barrierSeq = confirmed
    ? Math.max(0, Math.min(boardSnapshot!.version, annotationsSnapshot!.version))
    : 0;
  return {
    confirmed,
    latestEventSeq,
    barrierSeq,
    boardVersion: boardSnapshot?.version ?? null,
    annotationsVersion: annotationsSnapshot?.version ?? null,
  };
};

export const getWorkbookWriteConsistencyDiagnostics = (db: MockDb) => {
  const sessionIds = new Set<string>();
  db.workbookEvents.forEach((event) => sessionIds.add(event.sessionId));
  db.workbookSnapshots.forEach((snapshot) => sessionIds.add(snapshot.sessionId));

  let sessionsWithBarrier = 0;
  let maxBarrierSeq = 0;
  let minBarrierSeq: number | null = null;
  sessionIds.forEach((sessionId) => {
    const barrier = resolveWorkbookSnapshotBarrier(db, sessionId);
    if (!barrier.confirmed) return;
    sessionsWithBarrier += 1;
    maxBarrierSeq = Math.max(maxBarrierSeq, barrier.barrierSeq);
    minBarrierSeq =
      minBarrierSeq === null
        ? barrier.barrierSeq
        : Math.min(minBarrierSeq, barrier.barrierSeq);
  });

  const writeRecords = db.workbookOperations.filter((entry) =>
    isWorkbookWriteOperationScope(entry.scope)
  );

  return {
    mode: "nest-native-api",
    strictObjectVersion: workbookConsistencyConfig.strictObjectVersion,
    idempotency: {
      ttlMs: workbookConsistencyConfig.idempotencyTtlMs,
      maxRecords: workbookConsistencyConfig.idempotencyMaxRecords,
      records: writeRecords.length,
      sampleRate: workbookConsistencyConfig.idempotencySampleRate,
      bodyFallbackEnabled: workbookConsistencyConfig.idempotencyBodyFallback,
      ...idempotencyStats,
    },
    objectVersions: {
      strictMode: workbookConsistencyConfig.strictObjectVersion,
      trackedSessions: objectVersionStats.trackedSessions.size,
      trackedObjects: objectVersionStats.lastTrackedObjects,
      acceptedMutations: objectVersionStats.acceptedMutations,
      conflicts: objectVersionStats.conflicts,
      lastUpdatedAt: objectVersionStats.lastUpdatedAt,
    },
    snapshotBarrier: {
      sessions: sessionIds.size,
      confirmedSessions: sessionsWithBarrier,
      pendingSessions: Math.max(0, sessionIds.size - sessionsWithBarrier),
      maxBarrierSeq,
      minBarrierSeq,
    },
  };
};
