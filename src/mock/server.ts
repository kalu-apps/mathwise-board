import crypto from "node:crypto";
import os from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import {
  appendWorkbookAccessLog,
  copyWorkbookSessionSnapshots,
  deleteWorkbookSessionArtifacts,
  getStorageDiagnostics,
  getDb,
  saveDb,
  type AuthSessionRecord,
  type MockDb,
  type UserRecord,
  type WorkbookAccessDeviceClass,
  type WorkbookDraftRecord,
  type WorkbookInviteRecord,
  type WorkbookOperationRecord,
  type WorkbookParticipantPermissions,
  type WorkbookSessionKind,
  type WorkbookSessionParticipantRecord,
  type WorkbookSessionRecord,
} from "./db";
import {
  getRuntimeServicesStatus,
  publishWorkbookRealtimePayload,
  subscribeWorkbookRealtimePayload,
} from "./runtimeServices";
import {
  type WorkbookClientEventInput,
} from "../features/workbook/model/events";
import {
  appendWorkbookEvents,
  collectUrgentWorkbookLiveEvents,
  getWorkbookSessionLatestSeq,
  mergeRuntimeWorkbookEventsIntoDb,
  trimWorkbookEventsOverflow,
  type WorkbookRealtimeEnvelope,
} from "./workbookEventService";
import {
  getTelemetryDiagnostics,
  ingestRumTelemetryEvents,
  readRecentRumTelemetryEvents,
  readRecentWorkbookServerTraces,
  recordWorkbookServerTrace,
} from "./telemetryService";
import {
  decodeWorkbookPdfDataUrl,
  renderWorkbookPdfPagesViaPoppler,
  WORKBOOK_PDF_RENDER_MAX_BYTES,
} from "./workbookPdfService";
import {
  workbookEventStore,
  workbookSnapshotStore,
} from "./workbookStores";
import {
  getDbIndex,
  getSessionOwnerKey,
  getSessionUserKey,
} from "./dbIndex";
import { getWorkbookPersistenceReadiness } from "./runtimeReadiness";
import {
  INVALID_JSON_BODY_ERROR,
  readJsonBody,
  REQUEST_BODY_TOO_LARGE_ERROR,
} from "./httpBody";
import { createTokenBucketRateLimiter } from "./tokenBucketRateLimiter";
import {
  appendSetCookieHeader,
  applyWorkbookSessionAffinityHeaders,
  extractWorkbookSessionIdFromPath,
  getWorkbookSessionAffinityDiagnostics,
} from "./sessionAffinity";
import {
  applyWorkbookObjectVersionGuard,
  hashWorkbookOperationFingerprint,
  isWorkbookWriteOperationScope,
  registerWorkbookIdempotencyConflict,
  registerWorkbookIdempotencyEvictions,
  registerWorkbookIdempotencyHit,
  registerWorkbookIdempotencyMiss,
  registerWorkbookIdempotencyWrite,
  resolveWorkbookSnapshotBarrier,
  resolveWorkbookWriteIdempotencyKey,
  workbookConsistencyConfig,
} from "./workbookConsistency";

const WHITEBOARD_TEACHER_LOGIN = "teacher@axiom.demo";
const WHITEBOARD_TEACHER_PASSWORD =
  typeof process.env.VITE_WHITEBOARD_TEACHER_PASSWORD === "string" &&
  process.env.VITE_WHITEBOARD_TEACHER_PASSWORD.trim().length > 0
    ? process.env.VITE_WHITEBOARD_TEACHER_PASSWORD.trim()
    : "magic";

const AUTH_COOKIE_NAME = "math_tutor_session";
const AUTH_SESSION_TTL_MS = (() => {
  const fallback = 12 * 60 * 60 * 1000;
  const parsed = Number.parseInt(String(process.env.AUTH_SESSION_TTL_MS ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 5 * 60_000) return fallback;
  return parsed;
})();
const AUTH_SESSION_PERSIST_INTERVAL_MS = 60_000;
const ONLINE_TIMEOUT_MS = 15_000;
const PRESENCE_PERSIST_INTERVAL_MS = 15_000;
const PRESENCE_ACTIVITY_TOUCH_INTERVAL_MS = 20_000;
const PRESENCE_TAB_ID_MAX_LENGTH = 96;
const PRESENCE_FALLBACK_TAB_ID = "__legacy__";
const INVITE_TTL_MS = 2 * 60 * 60 * 1000;
const CLASS_INVITE_PERSISTENT_EXPIRES_AT = "2999-12-31T23:59:59.999Z";
const WORKBOOK_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const WORKBOOK_IDEMPOTENCY_MAX_RECORDS = 5_000;
const WORKBOOK_EVENT_LIMIT = 1_200;
const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const AUTH_COOKIE_DOMAIN = String(process.env.AUTH_COOKIE_DOMAIN ?? "").trim();
const AUTH_COOKIE_SAME_SITE_RAW = String(process.env.AUTH_COOKIE_SAME_SITE ?? "Lax")
  .trim()
  .toLowerCase();
const AUTH_COOKIE_SAME_SITE =
  AUTH_COOKIE_SAME_SITE_RAW === "strict"
    ? "Strict"
    : AUTH_COOKIE_SAME_SITE_RAW === "none"
      ? "None"
      : "Lax";
const AUTH_COOKIE_SECURE =
  String(process.env.AUTH_COOKIE_SECURE ?? "").trim() === "1" ||
  AUTH_COOKIE_SAME_SITE === "None";
const DEFAULT_MEDIA_STUN_URL = "stun:stun.l.google.com:19302";
const parseCsvEnv = (name: string) =>
  String(process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
const sanitizeIceUrls = (urls: string[]) => {
  const allowed = urls.filter((value) => /^(stun|stuns|turn|turns):/i.test(value));
  return Array.from(new Set(allowed));
};
const readPositiveInt = (name: string, fallback: number) => {
  const raw = Number.parseInt(String(process.env[name] ?? "").trim(), 10);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return raw;
};
const WORKBOOK_DEVICE_ID_HEADER = "x-workbook-device-id";
const WORKBOOK_ACCESS_LOG_HASH_SALT = String(process.env.WORKBOOK_ACCESS_LOG_HASH_SALT ?? "").trim();
const WORKBOOK_REQUEST_BODY_MAX_BYTES = readPositiveInt("WORKBOOK_REQUEST_BODY_MAX_BYTES", 2_097_152);
const WORKBOOK_VOLATILE_RATE_LIMIT_CAPACITY = readPositiveInt(
  "WORKBOOK_VOLATILE_RATE_LIMIT_CAPACITY",
  120
);
const WORKBOOK_VOLATILE_RATE_LIMIT_REFILL_PER_SEC = readPositiveInt(
  "WORKBOOK_VOLATILE_RATE_LIMIT_REFILL_PER_SEC",
  90
);
const WORKBOOK_VOLATILE_RATE_LIMIT_IDLE_TTL_MS = readPositiveInt(
  "WORKBOOK_VOLATILE_RATE_LIMIT_IDLE_TTL_MS",
  2 * 60_000
);
const MEDIA_STUN_URLS_RAW = sanitizeIceUrls(parseCsvEnv("MEDIA_STUN_URLS"));
const MEDIA_STUN_URLS = MEDIA_STUN_URLS_RAW.length
  ? MEDIA_STUN_URLS_RAW
  : [DEFAULT_MEDIA_STUN_URL];
const MEDIA_TURN_URLS = sanitizeIceUrls(parseCsvEnv("MEDIA_TURN_URLS"));
const MEDIA_TURN_SECRET = String(process.env.MEDIA_TURN_SECRET ?? "").trim();
const MEDIA_TURN_STATIC_USERNAME = String(process.env.MEDIA_TURN_STATIC_USERNAME ?? "").trim();
const MEDIA_TURN_STATIC_CREDENTIAL = String(process.env.MEDIA_TURN_STATIC_CREDENTIAL ?? "").trim();
const MEDIA_TURN_TTL_SECONDS = readPositiveInt("MEDIA_TURN_TTL_SECONDS", 3600);
const MEDIA_LIVEKIT_WS_URL = String(process.env.MEDIA_LIVEKIT_WS_URL ?? "").trim();
const MEDIA_LIVEKIT_API_KEY = String(process.env.MEDIA_LIVEKIT_API_KEY ?? "").trim();
const MEDIA_LIVEKIT_API_SECRET = String(process.env.MEDIA_LIVEKIT_API_SECRET ?? "").trim();
const MEDIA_LIVEKIT_ROOM_PREFIX = String(process.env.MEDIA_LIVEKIT_ROOM_PREFIX ?? "workbook")
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 32) || "workbook";
const MEDIA_LIVEKIT_TOKEN_TTL_SECONDS = readPositiveInt(
  "MEDIA_LIVEKIT_TOKEN_TTL_SECONDS",
  3600
);
const MEDIA_LIVEKIT_ENABLED =
  MEDIA_LIVEKIT_WS_URL.length > 0 &&
  MEDIA_LIVEKIT_API_KEY.length > 0 &&
  MEDIA_LIVEKIT_API_SECRET.length > 0;
const PUBLIC_BASE_URL = String(process.env.VITE_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/g, "");

export type HttpUpgradeServer = {
  on(
    event: "upgrade",
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void
  ): unknown;
};

type WorkbookApiNext = () => void;
type WorkbookApiMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: WorkbookApiNext
) => void | Promise<void>;

type WorkbookSettings = {
  undoPolicy: "everyone" | "teacher_only" | "own_only";
  strictGeometry: boolean;
  smartInk: {
    mode: "off" | "basic" | "full";
    confidenceThreshold: number;
    smartShapes: boolean;
    smartTextOcr: boolean;
    smartMathOcr: boolean;
  };
  studentControls: {
    canDraw: boolean;
    canSelect: boolean;
    canDelete: boolean;
    canInsertImage: boolean;
    canClear: boolean;
    canExport: boolean;
    canUseLaser: boolean;
  };
};

type WorkbookStreamClient = {
  id: string;
  userId: string;
  res: ServerResponse;
};

type WorkbookLiveSocketClient = {
  id: string;
  userId: string;
  socket: WebSocket;
};

const workbookStreamClientsBySession = new Map<string, Map<string, WorkbookStreamClient>>();
const workbookLiveSocketClientsBySession = new Map<
  string,
  Map<string, WorkbookLiveSocketClient>
>();
const authSessionPersistAtByToken = new Map<string, number>();
const presencePersistAtByParticipant = new Map<string, number>();
const presenceActivityTouchAtBySession = new Map<string, number>();
const presenceSnapshotHashBySession = new Map<string, string>();
const presenceActiveTabsByParticipant = new Map<string, Set<string>>();
const runtimeUnsubscribeBySession = new Map<string, () => Promise<void> | void>();
const runtimeSubscribeInFlightBySession = new Map<string, Promise<void>>();
const workbookVolatileRateLimiter = createTokenBucketRateLimiter({
  capacity: WORKBOOK_VOLATILE_RATE_LIMIT_CAPACITY,
  refillPerSecond: WORKBOOK_VOLATILE_RATE_LIMIT_REFILL_PER_SEC,
  idleTtlMs: WORKBOOK_VOLATILE_RATE_LIMIT_IDLE_TTL_MS,
  maxKeys: 20_000,
});
const RUNTIME_NODE_ID = `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
const workbookLiveSocketServerByHost = new WeakMap<HttpUpgradeServer, WebSocketServer>();
const nowIso = () => new Date().toISOString();
const nowTs = () => Date.now();
const summarizeRealtimeEventTypes = (eventTypes: string[]) =>
  Array.from(new Set(eventTypes.filter((type) => typeof type === "string" && type.length > 0))).slice(
    0,
    6
  );
const summarizeRealtimeLatency = (events: Array<{ createdAt?: string }>) => {
  const latencies = events.reduce<number[]>((acc, event) => {
    const createdAt = typeof event.createdAt === "string" ? Date.parse(event.createdAt) : NaN;
    if (!Number.isFinite(createdAt)) return acc;
    acc.push(Math.max(0, Date.now() - createdAt));
    return acc;
  }, []);
  if (latencies.length === 0) return {};
  const total = latencies.reduce((sum, value) => sum + value, 0);
  return {
    averageLatencyMs: Math.round(total / latencies.length),
    maxLatencyMs: Math.max(...latencies),
  };
};
const persistPresenceIfNeeded = (
  participant: WorkbookSessionParticipantRecord,
  options?: { force?: boolean }
) => {
  const key = `${participant.sessionId}:${participant.userId}`;
  const now = nowTs();
  const lastPersistAt = presencePersistAtByParticipant.get(key) ?? 0;
  if (!options?.force && now - lastPersistAt < PRESENCE_PERSIST_INTERVAL_MS) {
    return;
  }
  presencePersistAtByParticipant.set(key, now);
  saveDb();
};

type WorkbookPresenceState = "active" | "inactive";

const resolveParticipantPresenceKey = (sessionId: string, userId: string) => `${sessionId}:${userId}`;

const normalizePresenceState = (value: unknown): WorkbookPresenceState =>
  value === "inactive" ? "inactive" : "active";

const normalizePresenceTabId = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return PRESENCE_FALLBACK_TAB_ID;
  return raw.slice(0, PRESENCE_TAB_ID_MAX_LENGTH);
};

const resolveDurationMinutes = (startedAt: string | null | undefined, endedAt: string) => {
  const startTs = startedAt ? new Date(startedAt).getTime() : NaN;
  const endTs = new Date(endedAt).getTime();
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
    return null;
  }
  return Math.max(1, Math.round((endTs - startTs) / 60000));
};

const startParticipantVisit = (
  participant: WorkbookSessionParticipantRecord,
  timestamp: string
) => {
  if (participant.currentVisitStartedAt) return false;
  participant.currentVisitStartedAt = timestamp;
  participant.lastVisitStartedAt = timestamp;
  participant.lastVisitEndedAt = null;
  participant.lastVisitDurationMinutes = null;
  return true;
};

const finishParticipantVisit = (
  participant: WorkbookSessionParticipantRecord,
  timestamp: string
) => {
  if (!participant.currentVisitStartedAt) return false;
  const startedAt = participant.currentVisitStartedAt;
  participant.currentVisitStartedAt = null;
  participant.lastVisitStartedAt = startedAt;
  participant.lastVisitEndedAt = timestamp;
  participant.lastVisitDurationMinutes = resolveDurationMinutes(startedAt, timestamp);
  return true;
};

const applyParticipantPresenceState = (
  participant: WorkbookSessionParticipantRecord,
  options: {
    sessionId: string;
    state: WorkbookPresenceState;
    tabId: string;
    timestamp: string;
    clearTabs?: boolean;
  }
) => {
  const key = resolveParticipantPresenceKey(options.sessionId, participant.userId);
  const currentTabs = presenceActiveTabsByParticipant.get(key) ?? new Set<string>();
  const tabs = new Set(currentTabs);
  if (options.clearTabs) {
    tabs.clear();
  }
  const wasActive = participant.isActive;
  const hadCurrentVisit = Boolean(participant.currentVisitStartedAt);
  let changed = false;
  let visitStarted = false;
  let visitEnded = false;

  if (options.state === "active") {
    if (!tabs.has(options.tabId)) {
      tabs.add(options.tabId);
      changed = true;
    }
    if (startParticipantVisit(participant, options.timestamp)) {
      changed = true;
      visitStarted = true;
    }
    if (!participant.isActive) {
      participant.isActive = true;
      changed = true;
    }
    if (participant.leftAt) {
      participant.leftAt = null;
      changed = true;
    }
    participant.lastSeenAt = options.timestamp;
  } else {
    if (tabs.delete(options.tabId)) {
      changed = true;
    }
    const hasActiveTabs = tabs.size > 0;
    if (!hasActiveTabs) {
      if (participant.isActive) {
        participant.isActive = false;
        changed = true;
      }
      if (participant.leftAt !== options.timestamp) {
        participant.leftAt = options.timestamp;
        changed = true;
      }
      if (finishParticipantVisit(participant, options.timestamp)) {
        changed = true;
        visitEnded = true;
      }
    } else {
      if (!participant.isActive) {
        participant.isActive = true;
        changed = true;
      }
      if (participant.leftAt) {
        participant.leftAt = null;
        changed = true;
      }
    }
    participant.lastSeenAt = options.timestamp;
  }

  if (tabs.size > 0) {
    presenceActiveTabsByParticipant.set(key, tabs);
  } else {
    presenceActiveTabsByParticipant.delete(key);
  }

  return {
    changed: changed || wasActive !== participant.isActive || hadCurrentVisit !== Boolean(participant.currentVisitStartedAt),
    hasActiveTabs: tabs.size > 0,
    visitStarted,
    visitEnded,
  };
};

const ensureId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2, 10)}`;

const safeParseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const json = (res: ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const notFound = (res: ServerResponse) => {
  json(res, 404, { error: "not_found" });
};

const unauthorized = (res: ServerResponse, message = "Unauthorized") => {
  json(res, 401, { error: message });
};

const forbidden = (res: ServerResponse, message = "Forbidden") => {
  json(res, 403, { error: message });
};

const badRequest = (res: ServerResponse, message = "Bad request") => {
  json(res, 400, { error: message });
};

const conflict = (res: ServerResponse, message = "Conflict") => {
  json(res, 409, { error: message });
};

const tooManyRequests = (
  res: ServerResponse,
  message = "Too many requests",
  retryAfterMs?: number
) => {
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1_000))));
  }
  json(res, 429, {
    error: message,
    ...(typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs > 0
      ? { retryAfterMs: Math.ceil(retryAfterMs) }
      : {}),
  });
};

const serviceUnavailable = (res: ServerResponse, message = "Service unavailable") => {
  json(res, 503, { error: message });
};

const ensureWorkbookPersistenceReady = (res: ServerResponse) => {
  const readiness = getWorkbookPersistenceReadiness();
  if (readiness.ready) return true;
  serviceUnavailable(res, readiness.reasons[0] ?? "workbook_persistence_unavailable");
  return false;
};

const parseCookies = (req: IncomingMessage): Record<string, string> => {
  const raw = req.headers.cookie;
  if (!raw) return {};
  return raw.split(";").reduce<Record<string, string>>((acc, part) => {
    const [keyRaw, ...rest] = part.trim().split("=");
    const key = keyRaw?.trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("=") ?? "");
    return acc;
  }, {});
};

const readHeaderValue = (req: IncomingMessage, name: string) => {
  const target = name.toLowerCase();
  const entry = Object.entries(req.headers).find(([key]) => key.toLowerCase() === target);
  if (!entry) return "";
  const value = entry[1];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return typeof value === "string" ? value.trim() : "";
};

const hashWorkbookAccessValue = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return crypto
    .createHash("sha256")
    .update(`${WORKBOOK_ACCESS_LOG_HASH_SALT}:${normalized}`)
    .digest("hex")
    .slice(0, 32);
};

const resolveWorkbookClientIp = (req: IncomingMessage) => {
  const forwardedFor = readHeaderValue(req, "x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);
    if (first) return first.replace(/^::ffff:/, "");
  }
  const realIp = readHeaderValue(req, "x-real-ip");
  if (realIp) return realIp.replace(/^::ffff:/, "");
  const remote = req.socket?.remoteAddress;
  if (!remote) return null;
  return remote.replace(/^::ffff:/, "");
};

const resolveWorkbookUserAgentFamily = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("postmanruntime")) return "Postman";
  return "Unknown";
};

const resolveWorkbookDeviceClass = (userAgent: string): WorkbookAccessDeviceClass => {
  const ua = userAgent.toLowerCase();
  if (ua.includes("bot") || ua.includes("spider") || ua.includes("crawler")) return "bot";
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "mobile";
  if (!ua) return "unknown";
  return "desktop";
};

const resolveWorkbookActorName = (actor: UserRecord | null | undefined) => {
  if (!actor) return null;
  const fullName = `${actor.firstName} ${actor.lastName}`.trim();
  if (fullName.length > 0) return fullName.slice(0, 200);
  const email = actor.email.trim();
  if (email.length > 0) return email.slice(0, 200);
  return actor.id.slice(0, 200);
};

const recordWorkbookAccessEvent = async (params: {
  req: IncomingMessage;
  sessionId: string;
  eventType:
    | "invite_resolved"
    | "invite_joined"
    | "invite_join_denied"
    | "presence_started"
    | "presence_ended"
    | "session_opened";
  actor?: UserRecord | null;
  inviteToken?: string | null;
  details?: unknown;
}) => {
  const userAgent = readHeaderValue(params.req, "user-agent");
  const workbookDeviceId = readHeaderValue(params.req, WORKBOOK_DEVICE_ID_HEADER);
  const clientIp = resolveWorkbookClientIp(params.req);
  try {
    await appendWorkbookAccessLog({
      sessionId: params.sessionId,
      eventType: params.eventType,
      actorUserId: params.actor?.id ?? null,
      actorRole: params.actor?.role ?? null,
      actorName: resolveWorkbookActorName(params.actor),
      inviteTokenHash: hashWorkbookAccessValue(params.inviteToken ?? null),
      deviceIdHash: hashWorkbookAccessValue(workbookDeviceId),
      userAgentHash: hashWorkbookAccessValue(userAgent),
      ipHash: hashWorkbookAccessValue(clientIp),
      userAgentFamily: resolveWorkbookUserAgentFamily(userAgent),
      deviceClass: resolveWorkbookDeviceClass(userAgent),
      details: params.details ?? {},
    });
  } catch {
    // Access logs are best-effort and must not impact workbook request handling.
  }
};

const readIdempotencyKey = (req: IncomingMessage) => {
  const raw = readHeaderValue(req, "x-idempotency-key");
  if (!raw) return null;
  return raw.slice(0, 240);
};

const resolveWriteIdempotencyKey = (params: {
  req: IncomingMessage;
  scope: WorkbookOperationRecord["scope"];
  actorUserId: string;
  sessionId: string;
  payloadFingerprint: unknown;
}) =>
  resolveWorkbookWriteIdempotencyKey({
    headerKey: readIdempotencyKey(params.req),
    scope: params.scope,
    actorUserId: params.actorUserId,
    sessionId: params.sessionId,
    payloadFingerprint: params.payloadFingerprint,
  });

const normalizeOperationFingerprint = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value ?? "");
  }
};

const resolveOperationStorageLimits = (scope: WorkbookOperationRecord["scope"]) => {
  if (isWorkbookWriteOperationScope(scope)) {
    return {
      ttlMs: workbookConsistencyConfig.idempotencyTtlMs,
      maxRecords: workbookConsistencyConfig.idempotencyMaxRecords,
    };
  }
  return {
    ttlMs: WORKBOOK_IDEMPOTENCY_TTL_MS,
    maxRecords: WORKBOOK_IDEMPOTENCY_MAX_RECORDS,
  };
};

const cleanupWorkbookIdempotencyOperations = (db: MockDb) => {
  const before = db.workbookOperations.length;
  const now = nowTs();
  const writeLimit = resolveOperationStorageLimits("workbook_events_append").maxRecords;
  const writeScopes = db.workbookOperations.filter((entry) =>
    isWorkbookWriteOperationScope(entry.scope)
  );
  const writeOverflowThreshold = Math.max(0, writeScopes.length - writeLimit);

  let operations = db.workbookOperations.filter(
    (entry) => new Date(entry.expiresAt).getTime() > now
  );
  if (operations.length > WORKBOOK_IDEMPOTENCY_MAX_RECORDS || writeOverflowThreshold > 0) {
    const sorted = operations
      .slice()
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    let globalTrimmed = sorted.slice(0, WORKBOOK_IDEMPOTENCY_MAX_RECORDS);
    if (writeOverflowThreshold > 0) {
      const keepWrite = new Set(
        globalTrimmed
          .filter((entry) => isWorkbookWriteOperationScope(entry.scope))
          .slice(0, writeLimit)
          .map((entry) => entry.id)
      );
      globalTrimmed = globalTrimmed.filter(
        (entry) =>
          !isWorkbookWriteOperationScope(entry.scope) || keepWrite.has(entry.id)
      );
    }
    operations = globalTrimmed;
  }
  if (operations.length === db.workbookOperations.length) return 0;

  const writeBefore = db.workbookOperations.filter((entry) =>
    isWorkbookWriteOperationScope(entry.scope)
  ).length;
  const writeAfter = operations.filter((entry) =>
    isWorkbookWriteOperationScope(entry.scope)
  ).length;

  db.workbookOperations = operations;
  saveDb();
  const writeEvictions = Math.max(0, writeBefore - writeAfter);
  if (writeEvictions > 0) {
    registerWorkbookIdempotencyEvictions(writeEvictions);
  }
  return Math.max(0, before - operations.length);
};

const readWorkbookIdempotentOperation = <TPayload>(
  db: MockDb,
  params: {
    scope: WorkbookOperationRecord["scope"];
    actorUserId: string;
    idempotencyKey: string | null;
    requestFingerprint: string;
  }
) => {
  const writeScope = isWorkbookWriteOperationScope(params.scope);
  if (!params.idempotencyKey) {
    if (writeScope) {
      registerWorkbookIdempotencyMiss();
    }
    return null;
  }
  cleanupWorkbookIdempotencyOperations(db);
  const key = `${params.actorUserId}:${params.idempotencyKey}`;
  const operation =
    getDbIndex(db).operationsByScopeKey.get(`${params.scope}:${key}`) ?? null;
  if (!operation) {
    if (writeScope) {
      registerWorkbookIdempotencyMiss();
    }
    return null;
  }
  if (operation.requestFingerprint !== params.requestFingerprint) {
    if (writeScope) {
      registerWorkbookIdempotencyConflict();
    }
    return { conflict: true } as const;
  }
  if (writeScope) {
    registerWorkbookIdempotencyHit();
  }
  return {
    conflict: false as const,
    statusCode: operation.statusCode,
    payload: safeParseJson<TPayload>(operation.responsePayload, null as TPayload),
  };
};

const saveWorkbookIdempotentOperation = (
  db: MockDb,
  params: {
    scope: WorkbookOperationRecord["scope"];
    actorUserId: string;
    idempotencyKey: string | null;
    requestFingerprint: string;
    statusCode: number;
    payload: unknown;
  }
) => {
  if (!params.idempotencyKey) return;
  cleanupWorkbookIdempotencyOperations(db);
  const key = `${params.actorUserId}:${params.idempotencyKey}`;
  const timestamp = nowIso();
  const expiresAt = new Date(
    nowTs() + resolveOperationStorageLimits(params.scope).ttlMs
  ).toISOString();
  const payloadRaw = normalizeOperationFingerprint(params.payload);
  const existingIndex = db.workbookOperations.findIndex(
    (entry) => entry.scope === params.scope && entry.key === key
  );
  const record: WorkbookOperationRecord = {
    id: existingIndex >= 0 ? db.workbookOperations[existingIndex].id : ensureId(),
    scope: params.scope,
    actorUserId: params.actorUserId,
    key,
    requestFingerprint: params.requestFingerprint,
    statusCode: params.statusCode,
    responsePayload: payloadRaw,
    createdAt:
      existingIndex >= 0 ? db.workbookOperations[existingIndex].createdAt : timestamp,
    updatedAt: timestamp,
    expiresAt,
  };
  if (existingIndex >= 0) {
    db.workbookOperations[existingIndex] = record;
  } else {
    db.workbookOperations.push(record);
  }
  saveDb();
  if (isWorkbookWriteOperationScope(params.scope)) {
    registerWorkbookIdempotencyWrite();
  }
};

const writeAuthCookie = (res: ServerResponse, token: string) => {
  appendSetCookieHeader(
    res,
    [
      `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      `SameSite=${AUTH_COOKIE_SAME_SITE}`,
      `Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}`,
      ...(AUTH_COOKIE_DOMAIN ? [`Domain=${AUTH_COOKIE_DOMAIN}`] : []),
      ...(AUTH_COOKIE_SECURE ? ["Secure"] : []),
    ].join("; ")
  );
};

const clearAuthCookie = (res: ServerResponse) => {
  appendSetCookieHeader(
    res,
    [
      `${AUTH_COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      `SameSite=${AUTH_COOKIE_SAME_SITE}`,
      "Max-Age=0",
      ...(AUTH_COOKIE_DOMAIN ? [`Domain=${AUTH_COOKIE_DOMAIN}`] : []),
      ...(AUTH_COOKIE_SECURE ? ["Secure"] : []),
    ].join("; ")
  );
};

const isOriginAllowed = (origin: string) =>
  CORS_ALLOWED_ORIGINS.length === 0 || CORS_ALLOWED_ORIGINS.includes(origin);

const appendVary = (res: ServerResponse, value: string) => {
  const existing = res.getHeader("Vary");
  if (!existing) {
    res.setHeader("Vary", value);
    return;
  }
  const normalized = Array.isArray(existing) ? existing.join(",") : String(existing);
  const parts = normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parts.includes(value)) {
    parts.push(value);
  }
  res.setHeader("Vary", parts.join(", "));
};

const applyCors = (req: IncomingMessage, res: ServerResponse) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (!origin || !isOriginAllowed(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Request-Id, X-Retry-Attempt, X-Idempotency-Key, X-Workbook-Device-Id, X-Workbook-Session-Affinity"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  appendVary(res, "Origin");
};

const inferPublicOrigin = (req: IncomingMessage) => {
  const forwardedProtoHeader = req.headers["x-forwarded-proto"];
  const forwardedHostHeader = req.headers["x-forwarded-host"];
  const hostHeader = req.headers.host;
  const protoRaw = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : typeof forwardedProtoHeader === "string"
      ? forwardedProtoHeader.split(",")[0]
      : "";
  const hostRaw = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : typeof forwardedHostHeader === "string"
      ? forwardedHostHeader.split(",")[0]
      : typeof hostHeader === "string"
        ? hostHeader
        : "";
  const proto = protoRaw.trim().toLowerCase() || "https";
  const host = hostRaw.trim();
  if (!host) return "";
  return `${proto}://${host}`.replace(/\/+$/g, "");
};

const buildInviteUrl = (req: IncomingMessage, token: string) => {
  const base = PUBLIC_BASE_URL || inferPublicOrigin(req);
  const path = `/workbook/invite/${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  return readJsonBody(req, {
    maxBytes: WORKBOOK_REQUEST_BODY_MAX_BYTES,
  });
};

const pickTeacher = (db: MockDb): UserRecord => {
  const existing = db.users.find((user) => user.role === "teacher" && user.email === WHITEBOARD_TEACHER_LOGIN);
  if (existing) return existing;
  const created: UserRecord = {
    id: "teacher-axiom",
    role: "teacher",
    email: WHITEBOARD_TEACHER_LOGIN,
    firstName: "Анна",
    lastName: "Викторовна",
    createdAt: nowIso(),
  };
  db.users.push(created);
  return created;
};

const safeUser = (user: UserRecord) => ({
  id: user.id,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  photo: user.photo,
});

const getSessionRecord = (db: MockDb, token: string | undefined | null): AuthSessionRecord | null => {
  if (!token) return null;
  const session = getDbIndex(db).authSessionsByToken.get(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= nowTs()) {
    closeUserPresenceAcrossSessions(db, session.userId);
    db.authSessions = db.authSessions.filter((item) => item.token !== token);
    authSessionPersistAtByToken.delete(token);
    saveDb();
    return null;
  }
  return session;
};

type ResolvedAuthSession = {
  user: UserRecord;
  session: AuthSessionRecord;
};

const resolveAuthSession = (
  req: IncomingMessage,
  db: MockDb,
  options?: { touchSession?: boolean }
): ResolvedAuthSession | null => {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE_NAME];
  const session = getSessionRecord(db, token);
  if (!session) return null;
  const user = getDbIndex(db).usersById.get(session.userId) ?? null;
  if (!user) return null;
  if (options?.touchSession !== false) {
    const now = nowTs();
    session.lastSeenAt = nowIso();
    session.expiresAt = new Date(now + AUTH_SESSION_TTL_MS).toISOString();
    const lastPersistAt = authSessionPersistAtByToken.get(session.token) ?? 0;
    if (now - lastPersistAt >= AUTH_SESSION_PERSIST_INTERVAL_MS) {
      authSessionPersistAtByToken.set(session.token, now);
      saveDb();
    }
  }
  return { user, session };
};

const resolveAuthUser = (
  req: IncomingMessage,
  db: MockDb,
  options?: { touchSession?: boolean }
): UserRecord | null => {
  return resolveAuthSession(req, db, options)?.user ?? null;
};

const defaultPermissions = (role: "teacher" | "student"): WorkbookParticipantPermissions => {
  if (role === "teacher") {
    return {
      canDraw: true,
      canAnnotate: true,
      canUseMedia: true,
      canUseChat: true,
      canInvite: true,
      canManageSession: true,
      canSelect: true,
      canDelete: true,
      canInsertImage: true,
      canClear: true,
      canExport: true,
      canUseLaser: true,
    };
  }

  return {
    canDraw: false,
    canAnnotate: false,
    canUseMedia: true,
    canUseChat: false,
    canInvite: false,
    canManageSession: false,
    canSelect: false,
    canDelete: false,
    canInsertImage: false,
    canClear: false,
    canExport: false,
    canUseLaser: false,
  };
};

const normalizeParticipantPermissions = (
  roleInSession: "teacher" | "student",
  permissions: Partial<WorkbookParticipantPermissions> | null | undefined
): WorkbookParticipantPermissions => ({
  ...defaultPermissions(roleInSession),
  ...(permissions ?? {}),
});

const normalizeParticipantPermissionsInPlace = (
  participant: WorkbookSessionParticipantRecord
) => {
  const normalized = normalizeParticipantPermissions(
    participant.roleInSession,
    participant.permissions
  );
  const hadChanges = participantPermissionKeys.some(
    (key) => participant.permissions?.[key] !== normalized[key]
  );
  if (hadChanges) {
    participant.permissions = normalized;
  }
  return hadChanges;
};

const normalizeDbParticipantPermissions = (db: MockDb) => {
  let changed = false;
  for (const participant of db.workbookParticipants) {
    if (normalizeParticipantPermissionsInPlace(participant)) {
      changed = true;
    }
  }
  if (changed) {
    saveDb();
  }
};

const participantPermissionsNormalizedDb = new WeakSet<MockDb>();

const ensureDbParticipantPermissionsNormalized = (db: MockDb) => {
  if (participantPermissionsNormalizedDb.has(db)) return;
  normalizeDbParticipantPermissions(db);
  participantPermissionsNormalizedDb.add(db);
};

const participantPermissionKeys: Array<keyof WorkbookParticipantPermissions> = [
  "canDraw",
  "canAnnotate",
  "canUseMedia",
  "canUseChat",
  "canInvite",
  "canManageSession",
  "canSelect",
  "canDelete",
  "canInsertImage",
  "canClear",
  "canExport",
  "canUseLaser",
];

const boardToolsPermissionKeys: Array<
  | "canDraw"
  | "canAnnotate"
  | "canSelect"
  | "canDelete"
  | "canInsertImage"
  | "canClear"
  | "canUseLaser"
> = [
  "canDraw",
  "canAnnotate",
  "canSelect",
  "canDelete",
  "canInsertImage",
  "canClear",
  "canUseLaser",
];

type BoardToolsOverrideState = "enabled" | "disabled" | null;

const hasBoardToolsPermissionPatch = (patch: Partial<WorkbookParticipantPermissions>) =>
  boardToolsPermissionKeys.some((key) => typeof patch[key] === "boolean");

const resolveBoardToolsOverrideState = (
  permissions: WorkbookParticipantPermissions
): BoardToolsOverrideState => {
  const allEnabled = boardToolsPermissionKeys.every((key) => permissions[key] === true);
  if (allEnabled) return "enabled";
  const allDisabled = boardToolsPermissionKeys.every((key) => permissions[key] === false);
  if (allDisabled) return "disabled";
  return null;
};

const sanitizePermissionPatch = (value: unknown): Partial<WorkbookParticipantPermissions> => {
  if (!value || typeof value !== "object") return {};
  const source = value as Partial<Record<keyof WorkbookParticipantPermissions, unknown>>;
  return participantPermissionKeys.reduce<Partial<WorkbookParticipantPermissions>>((acc, key) => {
    if (typeof source[key] !== "boolean") return acc;
    acc[key] = source[key] as boolean;
    return acc;
  }, {});
};

type WorkbookMediaIceServerPayload = {
  urls: string[];
  username?: string;
  credential?: string;
  credentialType?: "password";
};

type WorkbookLivekitGrantPayload = {
  roomJoin: true;
  room: string;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
};

type WorkbookLivekitTokenPayload = {
  jti: string;
  iss: string;
  sub: string;
  name: string;
  nbf: number;
  iat: number;
  exp: number;
  video: WorkbookLivekitGrantPayload;
};

const buildWorkbookMediaIceConfig = (userId: string) => {
  const servers: WorkbookMediaIceServerPayload[] = [];
  if (MEDIA_STUN_URLS.length > 0) {
    servers.push({
      urls: MEDIA_STUN_URLS,
    });
  }
  if (MEDIA_TURN_URLS.length > 0) {
    if (MEDIA_TURN_SECRET.length > 0) {
      const expiresAtUnix = Math.floor(nowTs() / 1000) + MEDIA_TURN_TTL_SECONDS;
      const username = `${expiresAtUnix}:${userId}`;
      const credential = crypto
        .createHmac("sha1", MEDIA_TURN_SECRET)
        .update(username)
        .digest("base64");
      servers.push({
        urls: MEDIA_TURN_URLS,
        username,
        credential,
        credentialType: "password",
      });
    } else if (
      MEDIA_TURN_STATIC_USERNAME.length > 0 &&
      MEDIA_TURN_STATIC_CREDENTIAL.length > 0
    ) {
      servers.push({
        urls: MEDIA_TURN_URLS,
        username: MEDIA_TURN_STATIC_USERNAME,
        credential: MEDIA_TURN_STATIC_CREDENTIAL,
        credentialType: "password",
      });
    }
  }

  if (servers.length === 0) {
    servers.push({
      urls: [DEFAULT_MEDIA_STUN_URL],
    });
  }

  return {
    generatedAt: nowIso(),
    ttlSeconds: MEDIA_TURN_TTL_SECONDS,
    iceServers: servers,
  };
};

const base64UrlEncode = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

const signJwtHs256 = (payload: WorkbookLivekitTokenPayload, secret: string) => {
  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const formatUserDisplayName = (user: UserRecord) => {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  if (fullName.length > 0) return fullName;
  return user.email || user.id;
};

const buildWorkbookLivekitRoomName = (sessionId: string) =>
  `${MEDIA_LIVEKIT_ROOM_PREFIX}-${sessionId}`.slice(0, 128);

const buildWorkbookLivekitTokenPayload = (
  sessionId: string,
  user: UserRecord,
  canPublish: boolean
) => {
  const issuedAtUnix = Math.floor(nowTs() / 1000);
  const roomName = buildWorkbookLivekitRoomName(sessionId);
  const identity = user.id;
  const payload: WorkbookLivekitTokenPayload = {
    jti: ensureId(),
    iss: MEDIA_LIVEKIT_API_KEY,
    sub: identity,
    name: formatUserDisplayName(user),
    iat: issuedAtUnix,
    nbf: issuedAtUnix - 5,
    exp: issuedAtUnix + MEDIA_LIVEKIT_TOKEN_TTL_SECONDS,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    },
  };
  return {
    roomName,
    identity,
    payload,
  };
};

const defaultSettings = (): WorkbookSettings => ({
  undoPolicy: "everyone",
  strictGeometry: false,
  smartInk: {
    mode: "off",
    confidenceThreshold: 0.65,
    smartShapes: true,
    smartTextOcr: false,
    smartMathOcr: true,
  },
  studentControls: {
    canDraw: true,
    canSelect: true,
    canDelete: true,
    canInsertImage: true,
    canClear: true,
    canExport: false,
    canUseLaser: true,
  },
});

const readSessionSettings = (session: WorkbookSessionRecord): WorkbookSettings => {
  const parsed = safeParseJson<{ settings?: WorkbookSettings }>(session.context, {
    settings: defaultSettings(),
  });
  return parsed.settings ?? defaultSettings();
};

const writeSessionSettings = (session: WorkbookSessionRecord, settings: WorkbookSettings) => {
  session.context = JSON.stringify({ settings });
};

const getWorkbookSessionById = (db: MockDb, sessionId: string) =>
  getDbIndex(db).sessionsById.get(sessionId) ?? null;

const getWorkbookParticipants = (db: MockDb, sessionId: string) =>
  getDbIndex(db).participantsBySession.get(sessionId) ?? [];

const getWorkbookParticipant = (db: MockDb, sessionId: string, userId: string) =>
  getDbIndex(db).participantsBySessionUser.get(getSessionUserKey(sessionId, userId)) ?? null;

const buildVolatileRateLimitKey = (
  sessionId: string,
  userId: string,
  channel: "preview_http" | "live_http" | "live_ws"
) => `${channel}:${sessionId}:${userId}`;

const enforceVolatileRateLimit = (
  res: ServerResponse,
  sessionId: string,
  userId: string,
  channel: "preview_http" | "live_http"
) => {
  const result = workbookVolatileRateLimiter.consume(
    buildVolatileRateLimitKey(sessionId, userId, channel)
  );
  if (result.allowed) return true;
  tooManyRequests(res, "volatile_stream_rate_limited", result.retryAfterMs);
  return false;
};

const isVolatileRateLimitAllowed = (
  sessionId: string,
  userId: string,
  channel: "live_ws"
) =>
  workbookVolatileRateLimiter.consume(
    buildVolatileRateLimitKey(sessionId, userId, channel)
  );

const isParticipantOnline = (participant: WorkbookSessionParticipantRecord) => {
  if (!participant.isActive || !participant.lastSeenAt) return false;
  const seenAt = new Date(participant.lastSeenAt).getTime();
  if (!Number.isFinite(seenAt)) return false;
  return nowTs() - seenAt <= ONLINE_TIMEOUT_MS;
};

const touchSessionActivity = (session: WorkbookSessionRecord, timestamp = nowIso()) => {
  session.lastActivityAt = timestamp;
  if (!session.startedAt) session.startedAt = timestamp;
  if (session.status !== "ended") {
    session.status = "in_progress";
  }
};

const ensureDraftForOwner = (
  db: MockDb,
  session: WorkbookSessionRecord,
  ownerUserId: string
): WorkbookDraftRecord => {
  const existing = getDbIndex(db).draftsBySessionOwner.get(
    getSessionOwnerKey(session.id, ownerUserId)
  );
  if (existing) {
    existing.title = session.title;
    existing.statusForCard = session.status;
    existing.updatedAt = session.lastActivityAt;
    return existing;
  }
  const created: WorkbookDraftRecord = {
    id: ensureId(),
    ownerUserId,
    sessionId: session.id,
    title: session.title,
    statusForCard: session.status,
    createdAt: session.createdAt,
    updatedAt: session.lastActivityAt,
    lastOpenedAt: null,
  };
  db.workbookDrafts.push(created);
  return created;
};

const serializeParticipant = (db: MockDb, participant: WorkbookSessionParticipantRecord) => {
  const normalizedPermissions = normalizeParticipantPermissions(
    participant.roleInSession,
    participant.permissions
  );
  const user = getDbIndex(db).usersById.get(participant.userId);
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : participant.userId;
  return {
    userId: participant.userId,
    roleInSession: participant.roleInSession,
    displayName,
    photo: user?.photo,
    isActive: participant.isActive,
    isOnline: isParticipantOnline(participant),
    lastSeenAt: participant.lastSeenAt ?? null,
    permissions: normalizedPermissions,
  };
};

const serializeSession = (db: MockDb, session: WorkbookSessionRecord, actorUserId: string) => {
  const participants = getWorkbookParticipants(db, session.id);
  const actor = participants.find((item) => item.userId === actorUserId) ?? null;
  const actorPermissions = actor
    ? normalizeParticipantPermissions(actor.roleInSession, actor.permissions)
    : defaultPermissions("student");
  return {
    id: session.id,
    kind: session.kind,
    status: session.status,
    title: session.title,
    createdBy: session.createdBy,
    createdAt: session.createdAt,
    startedAt: session.startedAt ?? null,
    endedAt: session.endedAt ?? null,
    lastActivityAt: session.lastActivityAt,
    canInvite: actorPermissions.canInvite,
    canEdit: actorPermissions.canDraw || actorPermissions.canSelect,
    roleInSession: actor?.roleInSession ?? "student",
    participants: participants.map((participant) => serializeParticipant(db, participant)),
    settings: readSessionSettings(session),
  };
};

const resolveTeacherLastVisitDurationMinutes = (db: MockDb, session: WorkbookSessionRecord) => {
  const teacherParticipant = getWorkbookParticipant(db, session.id, session.createdBy);
  if (!teacherParticipant || teacherParticipant.roleInSession !== "teacher") {
    return null;
  }
  const key = resolveParticipantPresenceKey(session.id, teacherParticipant.userId);
  const activeTabs = presenceActiveTabsByParticipant.get(key);
  if (activeTabs?.size && teacherParticipant.currentVisitStartedAt) {
    return resolveDurationMinutes(teacherParticipant.currentVisitStartedAt, nowIso());
  }
  if (
    typeof teacherParticipant.lastVisitDurationMinutes === "number" &&
    Number.isFinite(teacherParticipant.lastVisitDurationMinutes) &&
    teacherParticipant.lastVisitDurationMinutes > 0
  ) {
    return teacherParticipant.lastVisitDurationMinutes;
  }
  if (teacherParticipant.lastVisitStartedAt && teacherParticipant.lastVisitEndedAt) {
    return resolveDurationMinutes(
      teacherParticipant.lastVisitStartedAt,
      teacherParticipant.lastVisitEndedAt
    );
  }
  return null;
};

const serializeDraft = (db: MockDb, draft: WorkbookDraftRecord, actorUserId: string) => {
  const session = getWorkbookSessionById(db, draft.sessionId);
  if (!session) return null;
  const participants = getWorkbookParticipants(db, session.id);
  const actorParticipant = participants.find((item) => item.userId === actorUserId);
  if (!actorParticipant) return null;
  return {
    draftId: draft.id,
    sessionId: session.id,
    redirectSessionId: draft.redirectSessionId ?? null,
    title: draft.title,
    kind: session.kind,
    statusForCard: session.status,
    updatedAt: draft.updatedAt,
    createdAt: draft.createdAt,
    startedAt: session.startedAt ?? null,
    endedAt: session.endedAt ?? null,
    durationMinutes: resolveTeacherLastVisitDurationMinutes(db, session),
    canEdit: actorParticipant.permissions.canDraw || actorParticipant.permissions.canSelect,
    canInvite: actorParticipant.permissions.canInvite,
    canDelete: actorParticipant.permissions.canManageSession,
    participantsCount: participants.length,
    isOwner: session.createdBy === actorUserId,
    participants: participants.map((participant) => {
      const user = getDbIndex(db).usersById.get(participant.userId);
      return {
        userId: participant.userId,
        displayName: user
          ? `${user.firstName} ${user.lastName}`.trim() || user.email
          : participant.userId,
        photo: user?.photo,
        roleInSession: participant.roleInSession,
      };
    }),
  };
};

const deliverWorkbookStreamEventsToLocalClients = (
  db: MockDb,
  payload: WorkbookRealtimeEnvelope
) => {
  const startedAt = nowTs();
  const sessionClients = workbookStreamClientsBySession.get(payload.sessionId);
  if (!sessionClients || sessionClients.size === 0) return;
  const chunk = `event: workbook\ndata: ${JSON.stringify(payload)}\n\n`;
  let deliveredClientCount = 0;
  for (const [clientId, client] of sessionClients.entries()) {
    const hasAccess = Boolean(getWorkbookParticipant(db, payload.sessionId, client.userId));
    if (!hasAccess) {
      closeWorkbookStreamClient(payload.sessionId, clientId);
      continue;
    }
    try {
      client.res.write(chunk);
      deliveredClientCount += 1;
    } catch {
      closeWorkbookStreamClient(payload.sessionId, clientId);
    }
  }
  recordWorkbookServerTrace({
    scope: "workbook",
    op: "deliver_local",
    channel: "stream",
    sessionId: payload.sessionId,
    eventCount: payload.events.length,
    eventTypes: summarizeRealtimeEventTypes(payload.events.map((event) => event.type)),
    durationMs: nowTs() - startedAt,
    latestSeq: payload.latestSeq,
    clientCount: deliveredClientCount,
    success: true,
    ...summarizeRealtimeLatency(payload.events),
  });
};

const deliverWorkbookLiveEventsToLocalClients = (
  db: MockDb,
  payload: WorkbookRealtimeEnvelope
) => {
  const startedAt = nowTs();
  const sessionClients = workbookLiveSocketClientsBySession.get(payload.sessionId);
  if (!sessionClients || sessionClients.size === 0) return;
  const chunk = JSON.stringify({
    sessionId: payload.sessionId,
    latestSeq: payload.latestSeq,
    events: payload.events,
  });
  let deliveredClientCount = 0;
  for (const [clientId, client] of sessionClients.entries()) {
    const hasAccess = Boolean(getWorkbookParticipant(db, payload.sessionId, client.userId));
    if (!hasAccess || client.socket.readyState !== WebSocket.OPEN) {
      closeWorkbookLiveSocketClient(payload.sessionId, clientId);
      continue;
    }
    try {
      client.socket.send(chunk);
      deliveredClientCount += 1;
    } catch {
      closeWorkbookLiveSocketClient(payload.sessionId, clientId);
    }
  }
  recordWorkbookServerTrace({
    scope: "workbook",
    op: "deliver_local",
    channel: "live",
    sessionId: payload.sessionId,
    eventCount: payload.events.length,
    eventTypes: summarizeRealtimeEventTypes(payload.events.map((event) => event.type)),
    durationMs: nowTs() - startedAt,
    latestSeq: payload.latestSeq,
    clientCount: deliveredClientCount,
    success: true,
    ...summarizeRealtimeLatency(payload.events),
  });
};

async function ensureRuntimeSessionBridge(sessionId: string) {
  if (runtimeUnsubscribeBySession.has(sessionId)) return;
  const inFlight = runtimeSubscribeInFlightBySession.get(sessionId);
  if (inFlight) {
    await inFlight;
    return;
  }
  const task = (async () => {
    const unsubscribe = await subscribeWorkbookRealtimePayload(
      sessionId,
      (payload: WorkbookRealtimeEnvelope) => {
        if (!payload || payload.sessionId !== sessionId) return;
        if (payload.nodeId && payload.nodeId === RUNTIME_NODE_ID) return;
        const db = getDb();
        if (payload.channel === "live") {
          deliverWorkbookLiveEventsToLocalClients(db, payload);
          return;
        }
        mergeRuntimeWorkbookEventsIntoDb(db, payload);
        deliverWorkbookStreamEventsToLocalClients(db, payload);
      }
    );
    runtimeUnsubscribeBySession.set(sessionId, unsubscribe);
  })()
    .catch(() => undefined)
    .finally(() => {
      runtimeSubscribeInFlightBySession.delete(sessionId);
    });
  runtimeSubscribeInFlightBySession.set(sessionId, task);
  await task;
}

async function teardownRuntimeSessionBridgeIfIdle(sessionId: string) {
  const sessionClients = workbookStreamClientsBySession.get(sessionId);
  if (sessionClients && sessionClients.size > 0) return;
  const liveClients = workbookLiveSocketClientsBySession.get(sessionId);
  if (liveClients && liveClients.size > 0) return;
  const inFlight = runtimeSubscribeInFlightBySession.get(sessionId);
  if (inFlight) {
    await inFlight.catch(() => undefined);
  }
  const unsubscribe = runtimeUnsubscribeBySession.get(sessionId);
  if (!unsubscribe) return;
  runtimeUnsubscribeBySession.delete(sessionId);
  try {
    await unsubscribe();
  } catch {
    // ignore redis unsubscribe errors
  }
}

function closeWorkbookStreamClient(sessionId: string, clientId: string) {
  const sessionClients = workbookStreamClientsBySession.get(sessionId);
  if (!sessionClients) return;
  sessionClients.delete(clientId);
  if (sessionClients.size === 0) {
    workbookStreamClientsBySession.delete(sessionId);
    void teardownRuntimeSessionBridgeIfIdle(sessionId);
  }
}

function closeWorkbookLiveSocketClient(sessionId: string, clientId: string) {
  const sessionClients = workbookLiveSocketClientsBySession.get(sessionId);
  if (!sessionClients) return;
  const client = sessionClients.get(clientId);
  sessionClients.delete(clientId);
  if (client && client.socket.readyState === WebSocket.OPEN) {
    try {
      client.socket.close();
    } catch {
      // ignore close failures
    }
  }
  if (sessionClients.size === 0) {
    workbookLiveSocketClientsBySession.delete(sessionId);
    void teardownRuntimeSessionBridgeIfIdle(sessionId);
  }
}

const publishWorkbookStreamEvents = (
  db: MockDb,
  payload: WorkbookRealtimeEnvelope,
  options?: { publishRuntime?: boolean }
) => {
  deliverWorkbookStreamEventsToLocalClients(db, payload);
  if (options?.publishRuntime === false) return;
  void publishWorkbookRealtimePayload(payload.sessionId, {
    ...payload,
    nodeId: RUNTIME_NODE_ID,
    channel: "stream",
  });
};

const publishWorkbookLiveEvents = (
  db: MockDb,
  payload: WorkbookRealtimeEnvelope,
  options?: { publishRuntime?: boolean }
) => {
  deliverWorkbookLiveEventsToLocalClients(db, payload);
  if (options?.publishRuntime === false) return;
  void publishWorkbookRealtimePayload(payload.sessionId, {
    ...payload,
    nodeId: RUNTIME_NODE_ID,
    channel: "live",
  });
};

const hashParticipantsPresence = (participants: ReturnType<typeof serializeParticipant>[]) =>
  JSON.stringify(
    participants.map((participant) => ({
      userId: participant.userId,
      isActive: participant.isActive,
      isOnline: participant.isOnline,
    }))
  );

const maybePublishPresenceSync = (
  db: MockDb,
  sessionId: string,
  authorUserId: string
) => {
  const participants = getWorkbookParticipants(db, sessionId).map((item) =>
    serializeParticipant(db, item)
  );
  const nextHash = hashParticipantsPresence(participants);
  if (presenceSnapshotHashBySession.get(sessionId) === nextHash) {
    return participants;
  }
  presenceSnapshotHashBySession.set(sessionId, nextHash);
  const latestSeq = getWorkbookSessionLatestSeq(db, sessionId);
  publishWorkbookStreamEvents(db, {
    sessionId,
    latestSeq,
    events: [
      {
        id: ensureId(),
        sessionId,
        seq: latestSeq,
        authorUserId,
        type: "presence.sync",
        payload: { participants },
        createdAt: nowIso(),
      },
    ],
  });
  return participants;
};

const normalizeGuestName = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Ученик";
  return raw.slice(0, 60);
};

const splitName = (displayName: string) => {
  const normalized = normalizeGuestName(displayName);
  const [firstName, ...rest] = normalized.split(/\s+/).filter(Boolean);
  return {
    firstName: firstName || "Ученик",
    lastName: rest.join(" "),
  };
};

const createGuestUser = (db: MockDb, displayName: string): UserRecord => {
  const normalized = normalizeGuestName(displayName);
  const existing = db.users.find(
    (user) => user.role === "student" && `${user.firstName} ${user.lastName}`.trim() === normalized
  );
  if (existing) return existing;
  const { firstName, lastName } = splitName(normalized);
  const user: UserRecord = {
    id: `guest_${ensureId()}`,
    role: "student",
    email: `guest_${ensureId()}@axiom.demo`,
    firstName,
    lastName,
    createdAt: nowIso(),
  };
  db.users.push(user);
  return user;
};

const applyStudentDisplayName = (user: UserRecord, displayName: string) => {
  if (user.role === "teacher") return false;
  const { firstName, lastName } = splitName(displayName);
  if (user.firstName === firstName && user.lastName === lastName) return false;
  user.firstName = firstName;
  user.lastName = lastName;
  return true;
};

const getInviteByToken = (db: MockDb, token: string) =>
  getDbIndex(db).invitesByToken.get(token) ?? null;

const isInviteExpired = (invite: WorkbookInviteRecord) => {
  const expiresAtTs = new Date(invite.expiresAt).getTime();
  if (!Number.isFinite(expiresAtTs)) return true;
  if (expiresAtTs <= nowTs()) return true;
  if (invite.maxUses != null && invite.useCount >= invite.maxUses) return true;
  return false;
};

const ensureParticipant = (
  db: MockDb,
  params: {
    sessionId: string;
    userId: string;
    roleInSession: "teacher" | "student";
    permissions: WorkbookParticipantPermissions;
  }
) => {
  const existing = getWorkbookParticipant(db, params.sessionId, params.userId);
  if (existing) {
    existing.isActive = true;
    existing.lastSeenAt = nowIso();
    if (typeof existing.currentVisitStartedAt === "undefined") {
      existing.currentVisitStartedAt = null;
    }
    if (typeof existing.lastVisitStartedAt === "undefined") {
      existing.lastVisitStartedAt = null;
    }
    if (typeof existing.lastVisitEndedAt === "undefined") {
      existing.lastVisitEndedAt = null;
    }
    if (typeof existing.lastVisitDurationMinutes === "undefined") {
      existing.lastVisitDurationMinutes = null;
    }
    if (typeof existing.boardToolsOverride === "undefined") {
      existing.boardToolsOverride = null;
    }
    existing.permissions = normalizeParticipantPermissions(
      params.roleInSession,
      params.permissions
    );
    return existing;
  }

  const created: WorkbookSessionParticipantRecord = {
    sessionId: params.sessionId,
    userId: params.userId,
    roleInSession: params.roleInSession,
    joinedAt: nowIso(),
    leftAt: null,
    isActive: true,
    lastSeenAt: nowIso(),
    currentVisitStartedAt: null,
    lastVisitStartedAt: null,
    lastVisitEndedAt: null,
    lastVisitDurationMinutes: null,
    boardToolsOverride: null,
    permissions: normalizeParticipantPermissions(params.roleInSession, params.permissions),
  };
  db.workbookParticipants.push(created);
  return created;
};

const parsePath = (req: IncomingMessage) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  return {
    pathname: url.pathname,
    searchParams: url.searchParams,
  };
};

const sanitizeLivePreviewVersion = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.trunc(value))
    : undefined;

const sanitizeWorkbookLiveEvents = (
  participant: WorkbookSessionParticipantRecord,
  events: unknown[]
): WorkbookClientEventInput[] => {
  const sanitized: WorkbookClientEventInput[] = [];
  for (const candidate of events.slice(0, 96)) {
    const raw =
      candidate && typeof candidate === "object"
        ? (candidate as { type?: unknown; payload?: unknown; clientEventId?: unknown })
        : null;
    const type = typeof raw?.type === "string" ? raw.type : "";
    const payload = raw?.payload;
    const clientEventId =
      typeof raw?.clientEventId === "string" && raw.clientEventId.trim()
        ? raw.clientEventId.trim()
        : undefined;
    if (type === "board.stroke.preview" || type === "annotations.stroke.preview") {
      if (!participant.permissions.canDraw) continue;
      const stroke =
        payload && typeof payload === "object" && (payload as { stroke?: unknown }).stroke
          ? (payload as { stroke: unknown }).stroke
          : null;
      if (!stroke || typeof stroke !== "object") continue;
      const previewVersion = sanitizeLivePreviewVersion(
        payload && typeof payload === "object"
          ? (payload as { previewVersion?: unknown }).previewVersion
          : undefined
      );
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: {
          stroke,
          ...(previewVersion ? { previewVersion } : {}),
        },
      });
      continue;
    }
    if (type === "board.object.preview") {
      if (!participant.permissions.canSelect) continue;
      const objectId =
        payload && typeof payload === "object"
          ? String((payload as { objectId?: unknown }).objectId ?? "").trim()
          : "";
      const patch =
        payload && typeof payload === "object" && (payload as { patch?: unknown }).patch
          ? (payload as { patch: unknown }).patch
          : null;
      if (!objectId || !patch || typeof patch !== "object") continue;
      const previewVersion = sanitizeLivePreviewVersion(
        payload && typeof payload === "object"
          ? (payload as { previewVersion?: unknown }).previewVersion
          : undefined
      );
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: {
          objectId,
          patch,
          ...(previewVersion ? { previewVersion } : {}),
        },
      });
      continue;
    }
    if (type === "board.eraser.preview") {
      if (!participant.permissions.canDelete) continue;
      const gestureId =
        payload && typeof payload === "object"
          ? String((payload as { gestureId?: unknown }).gestureId ?? "").trim()
          : "";
      const layer =
        payload && typeof payload === "object" && (payload as { layer?: unknown }).layer === "annotations"
          ? "annotations"
          : "board";
      const pageRaw =
        payload && typeof payload === "object"
          ? (payload as { page?: unknown }).page
          : undefined;
      const page =
        typeof pageRaw === "number" && Number.isFinite(pageRaw)
          ? Math.max(1, Math.trunc(pageRaw))
          : 1;
      const radiusRaw =
        payload && typeof payload === "object"
          ? (payload as { radius?: unknown }).radius
          : undefined;
      const radius =
        typeof radiusRaw === "number" && Number.isFinite(radiusRaw)
          ? Math.max(4, Math.min(160, radiusRaw))
          : 14;
      const ended =
        payload && typeof payload === "object"
          ? Boolean((payload as { ended?: unknown }).ended)
          : false;
      const rawPoints =
        payload && typeof payload === "object" && Array.isArray((payload as { points?: unknown }).points)
          ? ((payload as { points: unknown[] }).points ?? [])
          : [];
      const points = rawPoints.reduce<Array<{ x: number; y: number }>>((acc, point) => {
        if (!point || typeof point !== "object") return acc;
        const x = (point as { x?: unknown }).x;
        const y = (point as { y?: unknown }).y;
        if (
          typeof x !== "number" ||
          !Number.isFinite(x) ||
          typeof y !== "number" ||
          !Number.isFinite(y)
        ) {
          return acc;
        }
        if (acc.length >= 48) return acc;
        acc.push({ x, y });
        return acc;
      }, []);
      if (!gestureId || (!ended && points.length === 0)) continue;
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: {
          gestureId,
          layer,
          page,
          radius,
          points,
          ...(ended ? { ended: true } : {}),
        },
      });
      continue;
    }
    if (type === "board.viewport.sync") {
      const offset =
        payload && typeof payload === "object"
          ? (payload as { offset?: unknown }).offset
          : null;
      if (
        !offset ||
        typeof offset !== "object" ||
        typeof (offset as { x?: unknown }).x !== "number" ||
        !Number.isFinite((offset as { x: number }).x) ||
        typeof (offset as { y?: unknown }).y !== "number" ||
        !Number.isFinite((offset as { y: number }).y)
      ) {
        continue;
      }
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: {
          offset: {
            x: (offset as { x: number }).x,
            y: (offset as { y: number }).y,
          },
        },
      });
      continue;
    }
    if (type === "chat.message") {
      if (!participant.permissions.canUseChat) continue;
      const message =
        payload && typeof payload === "object"
          ? (payload as { message?: unknown }).message
          : null;
      if (!message || typeof message !== "object") continue;
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: { message },
      });
      continue;
    }
    if (type === "chat.clear") {
      if (!participant.permissions.canManageSession) continue;
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: {},
      });
      continue;
    }
    if (type === "board.undo" || type === "board.redo") {
      const operations =
        payload && typeof payload === "object"
          ? (payload as { operations?: unknown }).operations
          : null;
      if (!Array.isArray(operations)) continue;
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: { operations },
      });
      continue;
    }
    if (type === "board.object.create") {
      if (!participant.permissions.canDraw) continue;
      const object =
        payload && typeof payload === "object"
          ? (payload as { object?: unknown }).object
          : null;
      if (!object || typeof object !== "object") continue;
      sanitized.push({
        ...(clientEventId ? { clientEventId } : {}),
        type,
        payload: { object },
      });
    }
  }
  return sanitized;
};

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

export const attachWorkbookLiveSocketServer = (
  httpServer: HttpUpgradeServer | null | undefined
) => {
  if (!httpServer || workbookLiveSocketServerByHost.has(httpServer)) return;
  const socketServer = new WebSocketServer({ noServer: true });
  workbookLiveSocketServerByHost.set(httpServer, socketServer);

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = parsePath(req);
    const match = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events\/live$/);
    if (!match) return;
    const readiness = getWorkbookPersistenceReadiness();
    if (!readiness.ready) {
      rejectUpgrade(socket, 503, "Service Unavailable");
      return;
    }
    const db = getDb();
    pickTeacher(db);
    ensureDbParticipantPermissionsNormalized(db);
    const actor = resolveAuthUser(req, db);
    if (!actor) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    if (!getWorkbookParticipant(db, sessionId, actor.id)) {
      rejectUpgrade(socket, 403, "Forbidden");
      return;
    }
    void ensureRuntimeSessionBridge(sessionId);
    socketServer.handleUpgrade(req, socket, head, (ws) => {
      const clientId = ensureId();
      const sessionClients = workbookLiveSocketClientsBySession.get(sessionId) ?? new Map();
      sessionClients.set(clientId, { id: clientId, userId: actor.id, socket: ws });
      workbookLiveSocketClientsBySession.set(sessionId, sessionClients);

      const cleanup = () => {
        const currentClients = workbookLiveSocketClientsBySession.get(sessionId);
        if (!currentClients) return;
        currentClients.delete(clientId);
        if (currentClients.size === 0) {
          workbookLiveSocketClientsBySession.delete(sessionId);
          void teardownRuntimeSessionBridgeIfIdle(sessionId);
        }
      };

      ws.on("message", async (rawMessage) => {
        let parsed: { events?: unknown[] } | null = null;
        try {
          parsed = JSON.parse(String(rawMessage)) as { events?: unknown[] };
        } catch {
          parsed = null;
        }
        const currentDb = getDb();
        const currentSession = getWorkbookSessionById(currentDb, sessionId);
        if (!currentSession) {
          try {
            ws.close();
          } catch {
            // ignore close failures
          }
          return;
        }
        applyStudentControls(currentSession, currentDb);
        const currentParticipant = getWorkbookParticipant(currentDb, sessionId, actor.id);
        if (!currentParticipant) {
          try {
            ws.close();
          } catch {
            // ignore close failures
          }
          return;
        }
        const volatileLimit = isVolatileRateLimitAllowed(sessionId, actor.id, "live_ws");
        if (!volatileLimit.allowed) {
          try {
            ws.close(1013, "rate_limited");
          } catch {
            // ignore close failures
          }
          return;
        }
        const events = Array.isArray(parsed?.events) ? parsed.events : [];
        const sanitizedEvents = sanitizeWorkbookLiveEvents(currentParticipant, events);
        if (sanitizedEvents.length === 0) return;
        const appendResult = await appendWorkbookEvents(currentDb, {
          sessionId,
          authorUserId: actor.id,
          events: sanitizedEvents,
          persist: false,
        });
        touchSessionActivity(currentSession, appendResult.timestamp);
        publishWorkbookLiveEvents(currentDb, {
          sessionId,
          latestSeq: appendResult.latestSeq,
          events: appendResult.events,
          channel: "live",
        });
      });

      ws.on("close", cleanup);
      ws.on("error", cleanup);
    });
  });
};

const resolveEffectiveStudentControls = (
  session: WorkbookSessionRecord,
  hasOnlineTeacher: boolean
) => {
  const settings = readSessionSettings(session);
  if (hasOnlineTeacher) {
    return settings.studentControls;
  }
  return {
    ...settings.studentControls,
    canDraw: true,
    canSelect: true,
    canDelete: true,
    canInsertImage: true,
    canClear: true,
    canUseLaser: true,
  };
};

const applyStudentControls = (session: WorkbookSessionRecord, db: MockDb) => {
  const sessionParticipants = getWorkbookParticipants(db, session.id);
  if (sessionParticipants.length === 0) return false;
  const hasOnlineTeacher = sessionParticipants.some(
    (participant) => participant.roleInSession === "teacher" && isParticipantOnline(participant)
  );
  const controls = resolveEffectiveStudentControls(session, hasOnlineTeacher);
  let changed = false;
  for (const participant of sessionParticipants) {
    if (participant.roleInSession !== "student") continue;
    const boardToolsOverride =
      participant.boardToolsOverride === "enabled" || participant.boardToolsOverride === "disabled"
        ? participant.boardToolsOverride
        : null;
    const hasBoardToolsOverride = hasOnlineTeacher && boardToolsOverride !== null;
    const boardToolsEnabled = boardToolsOverride === "enabled";
    const nextPermissions = normalizeParticipantPermissions("student", {
      ...participant.permissions,
      canDraw: hasBoardToolsOverride ? boardToolsEnabled : controls.canDraw,
      canAnnotate: hasBoardToolsOverride ? boardToolsEnabled : controls.canDraw,
      canSelect: hasBoardToolsOverride ? boardToolsEnabled : controls.canSelect,
      canDelete: hasBoardToolsOverride ? boardToolsEnabled : controls.canDelete,
      canInsertImage: hasBoardToolsOverride ? boardToolsEnabled : controls.canInsertImage,
      canClear: hasBoardToolsOverride ? boardToolsEnabled : controls.canClear,
      canExport: controls.canExport,
      canUseLaser: hasBoardToolsOverride ? boardToolsEnabled : controls.canUseLaser,
    });
    const unchanged = participantPermissionKeys.every(
      (key) => participant.permissions?.[key] === nextPermissions[key]
    );
    if (unchanged) continue;
    changed = true;
    participant.permissions = nextPermissions;
  }
  return changed;
};

const closeUserPresenceAcrossSessions = (db: MockDb, userId: string, timestamp = nowIso()) => {
  const affectedSessions = new Set<string>();
  db.workbookParticipants.forEach((participant) => {
    if (participant.userId !== userId) return;
    const key = resolveParticipantPresenceKey(participant.sessionId, participant.userId);
    const tabs = presenceActiveTabsByParticipant.get(key);
    const hadActiveTabs = Boolean(tabs && tabs.size > 0);
    if (hadActiveTabs) {
      presenceActiveTabsByParticipant.delete(key);
    }
    const hadCurrentVisit = Boolean(participant.currentVisitStartedAt);
    const wasActive = participant.isActive;
    participant.isActive = false;
    participant.leftAt = timestamp;
    participant.lastSeenAt = timestamp;
    finishParticipantVisit(participant, timestamp);
    if (wasActive || hadCurrentVisit || hadActiveTabs) {
      affectedSessions.add(participant.sessionId);
      persistPresenceIfNeeded(participant, { force: true });
      presenceActivityTouchAtBySession.delete(participant.sessionId);
    }
  });
  affectedSessions.forEach((sessionId) => {
    const session = getWorkbookSessionById(db, sessionId);
    if (!session) return;
    applyStudentControls(session, db);
    maybePublishPresenceSync(db, sessionId, userId);
  });
  return affectedSessions.size > 0;
};

const requireAuthUser = (req: IncomingMessage, res: ServerResponse, db: MockDb) => {
  const auth = resolveAuthSession(req, db);
  if (!auth) {
    unauthorized(res);
    return null;
  }
  writeAuthCookie(res, auth.session.token);
  return auth.user;
};

const setAuthSession = (db: MockDb, res: ServerResponse, user: UserRecord) => {
  const token = ensureId();
  const createdAt = nowIso();
  const createdAtTs = nowTs();
  const session: AuthSessionRecord = {
    token,
    userId: user.id,
    createdAt,
    lastSeenAt: createdAt,
    expiresAt: new Date(nowTs() + AUTH_SESSION_TTL_MS).toISOString(),
  };
  db.authSessions.push(session);
  authSessionPersistAtByToken.set(token, createdAtTs);
  writeAuthCookie(res, token);
  return session;
};

export const createWorkbookApiMiddleware = (): WorkbookApiMiddleware => {
  return async (req: IncomingMessage, res: ServerResponse, next: WorkbookApiNext) => {
    if (!req.url) {
      next();
      return;
    }

    const method = (req.method ?? "GET").toUpperCase();
    const { pathname, searchParams } = parsePath(req);

    if (!pathname.startsWith("/api/")) {
      next();
      return;
    }
    if (pathname.startsWith("/api/nest/")) {
      next();
      return;
    }

    const sessionIdFromPath = extractWorkbookSessionIdFromPath(pathname);
    if (sessionIdFromPath && method !== "OPTIONS") {
      applyWorkbookSessionAffinityHeaders({
        req,
        res,
        sessionId: sessionIdFromPath,
      });
    }

    applyCors(req, res);
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const db = getDb();
    pickTeacher(db);
    ensureDbParticipantPermissionsNormalized(db);

    try {
      if (pathname === "/api/auth/session" && method === "GET") {
        const user = resolveAuthUser(req, db);
        json(res, 200, user ? safeUser(user) : null);
        return;
      }

      if (pathname === "/api/telemetry/rum" && method === "POST") {
        const actor = resolveAuthUser(req, db, { touchSession: false });
        const body = (await readBody(req)) as { events?: unknown[]; sessionId?: unknown } | null;
        const events = Array.isArray(body?.events) ? body.events : [];
        const sessionId =
          typeof body?.sessionId === "string" && body.sessionId.trim().length > 0
            ? body.sessionId.trim()
            : null;
        const result = ingestRumTelemetryEvents(events, {
          userId: actor?.id ?? null,
          sessionId,
        });
        json(res, 202, { ok: true, accepted: result.accepted });
        return;
      }

      if (pathname === "/api/telemetry/runtime" && method === "GET") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const limit = Math.max(
          1,
          Math.min(200, Number.parseInt(String(searchParams.get("limit") ?? "50"), 10) || 50)
        );
        json(res, 200, {
          diagnostics: getTelemetryDiagnostics(),
          workbookServerTraces: readRecentWorkbookServerTraces(limit),
          rumEvents: readRecentRumTelemetryEvents(limit),
        });
        return;
      }

      if (pathname === "/api/runtime/readiness" && method === "GET") {
        const readiness = getWorkbookPersistenceReadiness();
        json(res, readiness.ready ? 200 : 503, readiness);
        return;
      }

      if (pathname === "/api/runtime/infra" && method === "GET") {
        const readiness = getWorkbookPersistenceReadiness();
        json(res, readiness.ready ? 200 : 503, {
          ok: readiness.ready,
          service: "mathboard-runtime-infra",
          timestamp: new Date().toISOString(),
          readiness,
          storage: getStorageDiagnostics(),
          runtime: getRuntimeServicesStatus(),
          telemetry: getTelemetryDiagnostics(),
          affinity: getWorkbookSessionAffinityDiagnostics(),
        });
        return;
      }

      if (pathname === "/api/auth/password/login" && method === "POST") {
        const body = (await readBody(req)) as { email?: string; password?: string } | null;
        const email = String(body?.email ?? "").trim().toLowerCase();
        const password = String(body?.password ?? "");
        if (email !== WHITEBOARD_TEACHER_LOGIN || password !== WHITEBOARD_TEACHER_PASSWORD) {
          unauthorized(res, "Неверный логин или пароль.");
          return;
        }
        const teacher = pickTeacher(db);
        setAuthSession(db, res, teacher);
        saveDb();
        json(res, 200, safeUser(teacher));
        return;
      }

      if (pathname === "/api/auth/logout" && method === "POST") {
        const cookies = parseCookies(req);
        const token = cookies[AUTH_COOKIE_NAME];
        if (token) {
          const authSession = getDbIndex(db).authSessionsByToken.get(token) ?? null;
          if (authSession) {
            closeUserPresenceAcrossSessions(db, authSession.userId);
          }
          db.authSessions = db.authSessions.filter((session) => session.token !== token);
          authSessionPersistAtByToken.delete(token);
          saveDb();
        }
        clearAuthCookie(res);
        json(res, 200, { ok: true });
        return;
      }

      if (pathname === "/api/auth/password/status" && method === "GET") {
        json(res, 200, {
          ok: true,
          hasPassword: true,
          state: "active",
          lockedUntil: null,
          lastPasswordChangeAt: null,
        });
        return;
      }

      if (pathname === "/api/workbook/drafts" && method === "GET") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const scope = searchParams.get("scope") ?? "all";
        const sessions = db.workbookSessions
          .filter((session) => {
            if (scope === "class" && session.kind !== "CLASS") return false;
            if (scope === "personal" && session.kind !== "PERSONAL") return false;
            if (actor.role === "teacher" && session.createdBy !== actor.id) return false;
            const participant = getWorkbookParticipant(db, session.id, actor.id);
            if (!participant) return false;
            return true;
          })
          .sort(
            (left, right) =>
              new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime()
          );
        sessions.forEach((session) => {
          if (session.kind !== "CLASS") return;
          applyStudentControls(session, db);
        });
        const latestDraftBySession = new Map<string, WorkbookDraftRecord>();
        db.workbookDrafts.forEach((draft) => {
          const current = latestDraftBySession.get(draft.sessionId);
          if (!current) {
            latestDraftBySession.set(draft.sessionId, draft);
            return;
          }
          const currentUpdatedAt = new Date(current.updatedAt).getTime();
          const draftUpdatedAt = new Date(draft.updatedAt).getTime();
          if (draftUpdatedAt > currentUpdatedAt) {
            latestDraftBySession.set(draft.sessionId, draft);
          }
        });

        const drafts = sessions
          .map((session) => {
            const actorDraft =
              getDbIndex(db).draftsBySessionOwner.get(getSessionOwnerKey(session.id, actor.id)) ??
              null;
            const latestSessionDraft = latestDraftBySession.get(session.id) ?? null;
            const fallbackDraft: WorkbookDraftRecord = {
              id: `draft_${session.id}_${actor.id}`,
              ownerUserId: actor.id,
              sessionId: session.id,
              title: session.title,
              statusForCard: session.status,
              createdAt: session.createdAt,
              updatedAt: session.lastActivityAt,
              lastOpenedAt: session.lastActivityAt,
            };
            return serializeDraft(
              db,
              actorDraft ?? latestSessionDraft ?? fallbackDraft,
              actor.id
            );
          })
          .filter((item) => Boolean(item));

        json(res, 200, { items: drafts });
        return;
      }

      if (
        (pathname === "/api/workbook/sessions" || pathname === "/api/workbook/sessions/") &&
        method === "POST"
      ) {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const body = (await readBody(req)) as { kind?: WorkbookSessionKind; title?: string } | null;
        const kind = body?.kind === "CLASS" ? "CLASS" : "PERSONAL";
        const title =
          typeof body?.title === "string" && body.title.trim().length > 0
            ? body.title.trim().slice(0, 140)
            : kind === "CLASS"
              ? "Индивидуальное занятие"
              : "Личная тетрадь";
        const idempotencyKey = readIdempotencyKey(req);
        const requestFingerprint = normalizeOperationFingerprint({
          kind,
          title,
        });
        const existingOperation = readWorkbookIdempotentOperation<{
          session: ReturnType<typeof serializeSession>;
          draft: ReturnType<typeof serializeDraft>;
        }>(db, {
          scope: "workbook_sessions_create",
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }
        const timestamp = nowIso();
        const session: WorkbookSessionRecord = {
          id: ensureId(),
          kind,
          createdBy: actor.id,
          title,
          status: "draft",
          createdAt: timestamp,
          startedAt: null,
          endedAt: null,
          lastActivityAt: timestamp,
          context: JSON.stringify({ settings: defaultSettings() }),
        };
        db.workbookSessions.push(session);

        ensureParticipant(db, {
          sessionId: session.id,
          userId: actor.id,
          roleInSession: actor.role === "teacher" ? "teacher" : "student",
          permissions: defaultPermissions(actor.role),
        });

        const draft = ensureDraftForOwner(db, session, actor.id);
        const payload = {
          session: serializeSession(db, session, actor.id),
          draft: serializeDraft(db, draft, actor.id),
        };
        saveWorkbookIdempotentOperation(db, {
          scope: "workbook_sessions_create",
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload,
        });
        saveDb();
        json(res, 200, payload);
        return;
      }

      const workbookSessionMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)$/);
      if (workbookSessionMatch && method === "GET") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookSessionMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        if (!getWorkbookParticipant(db, sessionId, actor.id)) {
          forbidden(res);
          return;
        }
        applyStudentControls(session, db);
        json(res, 200, serializeSession(db, session, actor.id));
        return;
      }

      if (workbookSessionMatch && method === "PUT") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookSessionMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant || !participant.permissions.canManageSession) {
          forbidden(res);
          return;
        }

        const body = (await readBody(req)) as Partial<WorkbookSessionRecord> | null;
        if (typeof body?.title === "string" && body.title.trim().length > 0) {
          session.title = body.title.trim().slice(0, 140);
        }
        if (body?.status === "draft" || body?.status === "in_progress" || body?.status === "ended") {
          session.status = body.status;
          if (body.status === "ended") {
            session.endedAt = nowIso();
          }
        }

        touchSessionActivity(session);
        db.workbookDrafts = db.workbookDrafts.map((draft) =>
          draft.sessionId === session.id
            ? {
                ...draft,
                title: session.title,
                statusForCard: session.status,
                updatedAt: session.lastActivityAt,
              }
            : draft
        );

        saveDb();
        json(res, 200, {
          ok: true,
          session: serializeSession(db, session, actor.id),
        });
        return;
      }

      if (workbookSessionMatch && method === "DELETE") {
        if (!ensureWorkbookPersistenceReady(res)) return;
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookSessionMatch[1]);
        const idempotencyKey = readIdempotencyKey(req);
        const requestFingerprint = normalizeOperationFingerprint({ sessionId });
        const existingOperation = readWorkbookIdempotentOperation<{
          ok: true;
          deletedSessionId: string;
          message: string;
        }>(db, {
          scope: "workbook_sessions_delete",
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant || !participant.permissions.canManageSession) {
          forbidden(res);
          return;
        }

        db.workbookSessions = db.workbookSessions.filter((item) => item.id !== sessionId);
        db.workbookParticipants = db.workbookParticipants.filter((item) => {
          if (item.sessionId !== sessionId) return true;
          presenceActiveTabsByParticipant.delete(
            resolveParticipantPresenceKey(item.sessionId, item.userId)
          );
          return false;
        });
        db.workbookDrafts = db.workbookDrafts.filter((item) => item.sessionId !== sessionId);
        db.workbookInvites = db.workbookInvites.filter((item) => item.sessionId !== sessionId);
        await deleteWorkbookSessionArtifacts(sessionId);
        workbookStreamClientsBySession.delete(sessionId);
        workbookLiveSocketClientsBySession.delete(sessionId);
        presenceSnapshotHashBySession.delete(sessionId);
        presenceActivityTouchAtBySession.delete(sessionId);
        const payload = {
          ok: true as const,
          deletedSessionId: sessionId,
          message: "Сессия удалена",
        };
        saveWorkbookIdempotentOperation(db, {
          scope: "workbook_sessions_delete",
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload,
        });
        saveDb();
        json(res, 200, payload);
        return;
      }

      const workbookOpenMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/open$/);
      if (workbookOpenMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookOpenMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        participant.isActive = true;
        participant.leftAt = null;
        participant.lastSeenAt = nowIso();
        touchSessionActivity(session);
        ensureDraftForOwner(db, session, actor.id).lastOpenedAt = nowIso();
        saveDb();
        await recordWorkbookAccessEvent({
          req,
          sessionId: session.id,
          eventType: "session_opened",
          actor,
          details: {
            via: "open_endpoint",
          },
        });
        json(res, 200, { ok: true });
        return;
      }

      const workbookEndMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/end$/);
      if (workbookEndMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookEndMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant || !participant.permissions.canManageSession) {
          forbidden(res);
          return;
        }

        const timestamp = nowIso();
        session.status = "ended";
        session.endedAt = timestamp;
        session.lastActivityAt = timestamp;

        db.workbookDrafts = db.workbookDrafts.map((draft) =>
          draft.sessionId === session.id
            ? {
                ...draft,
                statusForCard: "ended",
                updatedAt: timestamp,
              }
            : draft
        );

        db.workbookParticipants = db.workbookParticipants.map((item) =>
          item.sessionId === session.id
            ? {
                ...item,
                isActive: false,
                leftAt: timestamp,
              }
            : item
        );

        saveDb();
        json(res, 200, {
          ok: true,
          session: serializeSession(db, session, actor.id),
        });
        return;
      }

      const workbookSettingsMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/settings$/);
      if (workbookSettingsMatch && method === "PUT") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookSettingsMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant || !participant.permissions.canManageSession) {
          forbidden(res);
          return;
        }

        const body = (await readBody(req)) as Partial<WorkbookSettings> | null;
        const current = readSessionSettings(session);
        const next: WorkbookSettings = {
          undoPolicy:
            body?.undoPolicy === "teacher_only" || body?.undoPolicy === "own_only"
              ? body.undoPolicy
              : current.undoPolicy,
          strictGeometry:
            typeof body?.strictGeometry === "boolean"
              ? body.strictGeometry
              : current.strictGeometry,
          smartInk: {
            mode:
              body?.smartInk?.mode === "basic" || body?.smartInk?.mode === "full"
                ? body.smartInk.mode
                : body?.smartInk?.mode === "off"
                  ? "off"
                  : current.smartInk.mode,
            confidenceThreshold:
              typeof body?.smartInk?.confidenceThreshold === "number"
                ? Math.max(0, Math.min(1, body.smartInk.confidenceThreshold))
                : current.smartInk.confidenceThreshold,
            smartShapes:
              typeof body?.smartInk?.smartShapes === "boolean"
                ? body.smartInk.smartShapes
                : current.smartInk.smartShapes,
            smartTextOcr:
              typeof body?.smartInk?.smartTextOcr === "boolean"
                ? body.smartInk.smartTextOcr
                : current.smartInk.smartTextOcr,
            smartMathOcr:
              typeof body?.smartInk?.smartMathOcr === "boolean"
                ? body.smartInk.smartMathOcr
                : current.smartInk.smartMathOcr,
          },
          studentControls: {
            canDraw:
              typeof body?.studentControls?.canDraw === "boolean"
                ? body.studentControls.canDraw
                : current.studentControls.canDraw,
            canSelect:
              typeof body?.studentControls?.canSelect === "boolean"
                ? body.studentControls.canSelect
                : current.studentControls.canSelect,
            canDelete:
              typeof body?.studentControls?.canDelete === "boolean"
                ? body.studentControls.canDelete
                : current.studentControls.canDelete,
            canInsertImage:
              typeof body?.studentControls?.canInsertImage === "boolean"
                ? body.studentControls.canInsertImage
                : current.studentControls.canInsertImage,
            canClear:
              typeof body?.studentControls?.canClear === "boolean"
                ? body.studentControls.canClear
                : current.studentControls.canClear,
            canExport:
              typeof body?.studentControls?.canExport === "boolean"
                ? body.studentControls.canExport
                : current.studentControls.canExport,
            canUseLaser:
              typeof body?.studentControls?.canUseLaser === "boolean"
                ? body.studentControls.canUseLaser
                : current.studentControls.canUseLaser,
          },
        };

        writeSessionSettings(session, next);
        applyStudentControls(session, db);
        saveDb();
        json(res, 200, { ok: true, session: serializeSession(db, session, actor.id) });
        return;
      }

      const workbookDuplicateMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/duplicate$/);
      if (workbookDuplicateMatch && method === "POST") {
        if (!ensureWorkbookPersistenceReady(res)) return;
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sourceId = decodeURIComponent(workbookDuplicateMatch[1]);
        const source = getWorkbookSessionById(db, sourceId);
        if (!source) {
          notFound(res);
          return;
        }
        if (!getWorkbookParticipant(db, sourceId, actor.id)) {
          forbidden(res);
          return;
        }

        const timestamp = nowIso();
        const session: WorkbookSessionRecord = {
          id: ensureId(),
          kind: "PERSONAL",
          createdBy: actor.id,
          title: `${source.title} (копия)`,
          status: "draft",
          createdAt: timestamp,
          startedAt: null,
          endedAt: null,
          lastActivityAt: timestamp,
          context: source.context,
        };
        db.workbookSessions.push(session);
        ensureParticipant(db, {
          sessionId: session.id,
          userId: actor.id,
          roleInSession: actor.role === "teacher" ? "teacher" : "student",
          permissions: defaultPermissions(actor.role),
        });
        await copyWorkbookSessionSnapshots({
          sourceSessionId: source.id,
          targetSessionId: session.id,
          createdAt: timestamp,
        });

        const draft = ensureDraftForOwner(db, session, actor.id);
        saveDb();
        json(res, 200, {
          session: serializeSession(db, session, actor.id),
          draft: serializeDraft(db, draft, actor.id),
        });
        return;
      }

      const workbookTitleMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/title$/);
      if (workbookTitleMatch && method === "PUT") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookTitleMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant || !participant.permissions.canManageSession) {
          forbidden(res);
          return;
        }
        const body = (await readBody(req)) as { title?: string } | null;
        if (typeof body?.title !== "string" || body.title.trim().length < 2) {
          badRequest(res, "Введите название сессии.");
          return;
        }

        session.title = body.title.trim().slice(0, 140);
        session.lastActivityAt = nowIso();
        db.workbookDrafts = db.workbookDrafts.map((draft) =>
          draft.sessionId === session.id
            ? {
                ...draft,
                title: session.title,
                updatedAt: session.lastActivityAt,
              }
            : draft
        );
        saveDb();
        json(res, 200, { ok: true, session: serializeSession(db, session, actor.id) });
        return;
      }

      const workbookInviteCreateMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/invite$/);
      if (workbookInviteCreateMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookInviteCreateMatch[1]);
        const idempotencyKey = readIdempotencyKey(req);
        const requestFingerprint = normalizeOperationFingerprint({ sessionId });
        const existingOperation = readWorkbookIdempotentOperation<{
          inviteId: string;
          sessionId: string;
          token: string;
          inviteUrl: string;
          expiresAt?: string | null;
          maxUses?: number | null;
          useCount: number;
        }>(db, {
          scope: "workbook_invite_create",
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant || !participant.permissions.canInvite) {
          forbidden(res);
          return;
        }

        const timestamp = nowIso();
        const existingInvite =
          session.kind === "CLASS"
            ? db.workbookInvites
                .filter((item) => item.sessionId === sessionId && !item.revokedAt)
                .sort(
                  (left, right) =>
                    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
                )[0]
            : null;
        const invite: WorkbookInviteRecord =
          existingInvite ??
          {
            id: ensureId(),
            sessionId,
            token: ensureId(),
            createdBy: actor.id,
            createdAt: timestamp,
            expiresAt: new Date(nowTs() + INVITE_TTL_MS).toISOString(),
            maxUses: 1,
            useCount: 0,
            revokedAt: null,
          };
        if (session.kind === "CLASS") {
          invite.expiresAt = CLASS_INVITE_PERSISTENT_EXPIRES_AT;
          invite.maxUses = null;
        } else if (!existingInvite) {
          invite.expiresAt = new Date(nowTs() + INVITE_TTL_MS).toISOString();
          invite.maxUses = 1;
        }
        if (!existingInvite) {
          db.workbookInvites.push(invite);
        }
        const payload = {
          inviteId: invite.id,
          sessionId: invite.sessionId,
          token: invite.token,
          inviteUrl: buildInviteUrl(req, invite.token),
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses ?? null,
          useCount: invite.useCount,
        };
        saveWorkbookIdempotentOperation(db, {
          scope: "workbook_invite_create",
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload,
        });
        saveDb();
        json(res, 200, payload);
        return;
      }

      const workbookInviteResolveMatch = pathname.match(/^\/api\/workbook\/invites\/([^/]+)$/);
      if (workbookInviteResolveMatch && method === "GET") {
        const token = decodeURIComponent(workbookInviteResolveMatch[1]);
        const invite = getInviteByToken(db, token);
        if (!invite) {
          notFound(res);
          return;
        }
        const session = getWorkbookSessionById(db, invite.sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const hostUser = db.users.find((item) => item.id === session.createdBy);
        const expired = isInviteExpired(invite);
        const actor = resolveAuthUser(req, db, { touchSession: false });
        await recordWorkbookAccessEvent({
          req,
          sessionId: session.id,
          eventType: "invite_resolved",
          actor,
          inviteToken: token,
          details: {
            expired,
            revoked: Boolean(invite.revokedAt),
            ended: session.status === "ended",
          },
        });
        json(res, 200, {
          sessionId: session.id,
          title: session.title,
          kind: session.kind,
          hostName: hostUser
            ? `${hostUser.firstName} ${hostUser.lastName}`.trim() || hostUser.email
            : "Преподаватель",
          ended: session.status === "ended",
          expired,
          revoked: Boolean(invite.revokedAt),
        });
        return;
      }

      const workbookInviteJoinMatch = pathname.match(/^\/api\/workbook\/invites\/([^/]+)\/join$/);
      if (workbookInviteJoinMatch && method === "POST") {
        const token = decodeURIComponent(workbookInviteJoinMatch[1]);
        const invite = getInviteByToken(db, token);
        if (!invite) {
          notFound(res);
          return;
        }
        const session = getWorkbookSessionById(db, invite.sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const requestingActor = resolveAuthUser(req, db, { touchSession: false });
        if (session.status === "ended") {
          await recordWorkbookAccessEvent({
            req,
            sessionId: session.id,
            eventType: "invite_join_denied",
            actor: requestingActor,
            inviteToken: token,
            details: { reason: "lesson_ended" },
          });
          forbidden(res, "lesson_ended");
          return;
        }
        if (invite.revokedAt || isInviteExpired(invite)) {
          await recordWorkbookAccessEvent({
            req,
            sessionId: session.id,
            eventType: "invite_join_denied",
            actor: requestingActor,
            inviteToken: token,
            details: {
              reason: "invite_inactive",
              revoked: Boolean(invite.revokedAt),
              expired: isInviteExpired(invite),
            },
          });
          forbidden(res, "invite_inactive");
          return;
        }

        let actor = requestingActor;
        const body = (await readBody(req)) as { guestName?: string } | null;
        const requestedGuestName =
          typeof body?.guestName === "string" ? body.guestName.trim() : "";
        if (!actor) {
          actor = createGuestUser(db, requestedGuestName || "Ученик");
          setAuthSession(db, res, actor);
        }
        if (requestedGuestName) {
          applyStudentDisplayName(actor, requestedGuestName);
        }

        ensureParticipant(db, {
          sessionId: session.id,
          userId: actor.id,
          roleInSession: actor.role === "teacher" ? "teacher" : "student",
          permissions: defaultPermissions(actor.role),
        });
        applyStudentControls(session, db);

        invite.useCount += 1;
        session.status = "in_progress";
        session.startedAt = session.startedAt ?? nowIso();
        session.lastActivityAt = nowIso();

        const draft = ensureDraftForOwner(db, session, actor.id);
        saveDb();
        await recordWorkbookAccessEvent({
          req,
          sessionId: session.id,
          eventType: "invite_joined",
          actor,
          inviteToken: token,
          details: {
            kind: session.kind,
            role: actor.role,
            inviteUseCount: invite.useCount,
          },
        });

        json(res, 200, {
          session: serializeSession(db, session, actor.id),
          draft: serializeDraft(db, draft, actor.id),
          user: safeUser(actor),
        });
        return;
      }

      const workbookMediaConfigMatch = pathname.match(
        /^\/api\/workbook\/sessions\/([^/]+)\/media\/config$/
      );
      if (workbookMediaConfigMatch && method === "GET") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookMediaConfigMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        if (!participant.permissions.canUseMedia) {
          forbidden(res, "media_disabled");
          return;
        }
        json(res, 200, buildWorkbookMediaIceConfig(actor.id));
        return;
      }

      const workbookMediaLivekitTokenMatch = pathname.match(
        /^\/api\/workbook\/sessions\/([^/]+)\/media\/livekit-token$/
      );
      if (workbookMediaLivekitTokenMatch && method === "GET") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookMediaLivekitTokenMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        if (!participant.permissions.canUseMedia) {
          forbidden(res, "media_disabled");
          return;
        }
        if (!MEDIA_LIVEKIT_ENABLED) {
          serviceUnavailable(res, "livekit_unavailable");
          return;
        }
        const permissions = normalizeParticipantPermissions(
          participant.roleInSession,
          participant.permissions
        );
        const tokenConfig = buildWorkbookLivekitTokenPayload(
          session.id,
          actor,
          Boolean(permissions.canUseMedia)
        );
        const token = signJwtHs256(tokenConfig.payload, MEDIA_LIVEKIT_API_SECRET);
        json(res, 200, {
          generatedAt: nowIso(),
          ttlSeconds: MEDIA_LIVEKIT_TOKEN_TTL_SECONDS,
          wsUrl: MEDIA_LIVEKIT_WS_URL,
          roomName: tokenConfig.roomName,
          participant: {
            identity: tokenConfig.identity,
            name: tokenConfig.payload.name,
            canPublish: tokenConfig.payload.video.canPublish,
            roleInSession: participant.roleInSession,
          },
          token,
        });
        return;
      }

      const workbookEventsMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events$/);
      if (workbookEventsMatch && method === "GET") {
        if (!ensureWorkbookPersistenceReady(res)) return;
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookEventsMatch[1]);
        if (!getWorkbookParticipant(db, sessionId, actor.id)) {
          forbidden(res);
          return;
        }

        const afterSeq = Number(searchParams.get("afterSeq") ?? "0");
        const { events, latestSeq } = await workbookEventStore.read({
          sessionId,
          afterSeq: Number.isFinite(afterSeq) ? afterSeq : 0,
          limit: WORKBOOK_EVENT_LIMIT,
        });
        json(res, 200, { sessionId, latestSeq, events });
        return;
      }

      if (workbookEventsMatch && method === "POST") {
        if (!ensureWorkbookPersistenceReady(res)) return;
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookEventsMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        applyStudentControls(session, db);
        let participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }

        const body = (await readBody(req)) as { events?: WorkbookClientEventInput[] } | null;
        const events = Array.isArray(body?.events)
          ? body.events.filter((event) => typeof event?.type === "string")
          : [];
        if (!events.length) {
          badRequest(res, "Нет событий для сохранения.");
          return;
        }
        const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_events_append";
        const requestFingerprint = hashWorkbookOperationFingerprint({
          sessionId,
          events,
        });
        const idempotencyKey = resolveWriteIdempotencyKey({
          req,
          scope: idempotencyScope,
          actorUserId: actor.id,
          sessionId,
          payloadFingerprint: {
            events,
          },
        });
        const existingOperation = readWorkbookIdempotentOperation<{
          events: unknown[];
          latestSeq: number;
        }>(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }

        for (const event of events) {
          if (event.type === "media.signal" && !participant.permissions.canUseMedia) {
            forbidden(res, "media_disabled");
            return;
          }
          if (event.type === "chat.message" && !participant.permissions.canUseChat) {
            forbidden(res, "chat_disabled");
            return;
          }
          if (
            (event.type === "chat.message.delete" || event.type === "chat.clear") &&
            !participant.permissions.canManageSession
          ) {
            forbidden(res);
            return;
          }
          if (event.type !== "permissions.update") continue;
          if (!participant.permissions.canManageSession) {
            forbidden(res);
            return;
          }
          const payload =
            event.payload && typeof event.payload === "object"
              ? (event.payload as { userId?: unknown; permissions?: unknown })
              : null;
          const targetUserId = typeof payload?.userId === "string" ? payload.userId : "";
          if (!targetUserId) continue;
          const targetParticipant = getWorkbookParticipant(db, sessionId, targetUserId);
          if (!targetParticipant || targetParticipant.roleInSession !== "student") continue;
          const patch = sanitizePermissionPatch(payload?.permissions ?? null);
          if (Object.keys(patch).length === 0) continue;
          const nextPermissions = normalizeParticipantPermissions("student", {
            ...targetParticipant.permissions,
            ...patch,
          });
          targetParticipant.permissions = nextPermissions;
          if (hasBoardToolsPermissionPatch(patch)) {
            targetParticipant.boardToolsOverride = resolveBoardToolsOverrideState(nextPermissions);
          }
          participant = getWorkbookParticipant(db, sessionId, actor.id) ?? participant;
        }
        const versionGuardResult = await applyWorkbookObjectVersionGuard({
          db,
          sessionId,
          events,
        });
        if (!versionGuardResult.ok) {
          json(res, 409, {
            error: "object_version_conflict",
            conflicts: versionGuardResult.conflicts,
          });
          return;
        }

        const appendResult = await workbookEventStore.append({
          sessionId,
          authorUserId: actor.id,
          events: versionGuardResult.events,
          limit: WORKBOOK_EVENT_LIMIT,
        });

        touchSessionActivity(session, appendResult.timestamp);
        ensureDraftForOwner(db, session, actor.id).updatedAt = appendResult.timestamp;
        const urgentLiveEvents = collectUrgentWorkbookLiveEvents(appendResult.events);
        if (urgentLiveEvents.length > 0) {
          publishWorkbookLiveEvents(db, {
            sessionId,
            latestSeq: appendResult.latestSeq,
            events: urgentLiveEvents,
            channel: "live",
          });
        }

        publishWorkbookStreamEvents(db, {
          sessionId,
          latestSeq: appendResult.latestSeq,
          events: appendResult.events,
        });
        saveDb();
        const responsePayload = {
          events: appendResult.events,
          latestSeq: appendResult.latestSeq,
        };
        saveWorkbookIdempotentOperation(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload: responsePayload,
        });
        json(res, 200, responsePayload);
        return;
      }

      const workbookLiveMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events\/live$/);
      if (workbookLiveMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookLiveMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        applyStudentControls(session, db);
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        if (!enforceVolatileRateLimit(res, sessionId, actor.id, "live_http")) {
          return;
        }
        const body = (await readBody(req)) as { events?: unknown[] } | null;
        const events = Array.isArray(body?.events) ? body.events : [];
        const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_events_live";
        const requestFingerprint = hashWorkbookOperationFingerprint({
          sessionId,
          events,
        });
        const idempotencyKey = resolveWriteIdempotencyKey({
          req,
          scope: idempotencyScope,
          actorUserId: actor.id,
          sessionId,
          payloadFingerprint: {
            events,
          },
        });
        const existingOperation = readWorkbookIdempotentOperation<{ ok: true }>(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }
        const sanitizedEvents = sanitizeWorkbookLiveEvents(participant, events);
        if (sanitizedEvents.length === 0) {
          json(res, 200, { ok: true });
          return;
        }
        const appendResult = await appendWorkbookEvents(db, {
          sessionId,
          authorUserId: actor.id,
          events: sanitizedEvents,
          persist: false,
        });
        touchSessionActivity(session, appendResult.timestamp);
        publishWorkbookLiveEvents(db, {
          sessionId,
          latestSeq: appendResult.latestSeq,
          events: appendResult.events,
          channel: "live",
        });
        const responsePayload = { ok: true as const };
        saveWorkbookIdempotentOperation(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload: responsePayload,
        });
        json(res, 200, responsePayload);
        return;
      }

      const workbookPreviewMatch = pathname.match(
        /^\/api\/workbook\/sessions\/([^/]+)\/events\/preview$/
      );
      if (workbookPreviewMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookPreviewMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        applyStudentControls(session, db);
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        if (!enforceVolatileRateLimit(res, sessionId, actor.id, "preview_http")) {
          return;
        }

        const body = (await readBody(req)) as {
          type?: string;
          objectId?: string;
          patch?: Record<string, unknown>;
          stroke?: Record<string, unknown>;
          previewVersion?: unknown;
        } | null;
        const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_events_preview";
        const requestFingerprint = hashWorkbookOperationFingerprint({
          sessionId,
          body,
        });
        const idempotencyKey = resolveWriteIdempotencyKey({
          req,
          scope: idempotencyScope,
          actorUserId: actor.id,
          sessionId,
          payloadFingerprint: body ?? {},
        });
        const existingOperation = readWorkbookIdempotentOperation<{ ok: true }>(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
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
            forbidden(res);
            return;
          }
          const stroke = body?.stroke && typeof body.stroke === "object" ? body.stroke : null;
          if (!stroke) {
            badRequest(res, "Некорректные данные preview.");
            return;
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
            forbidden(res);
            return;
          }
          const objectId = typeof body?.objectId === "string" ? body.objectId : "";
          const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
          if (!objectId || !patch) {
            badRequest(res, "Некорректные данные preview.");
            return;
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

        const appendResult = await appendWorkbookEvents(db, {
          sessionId,
          authorUserId: actor.id,
          events: previewEvent ? [previewEvent] : [],
          persist: false,
        });

        touchSessionActivity(session, appendResult.timestamp);
        publishWorkbookLiveEvents(db, {
          sessionId,
          latestSeq: appendResult.latestSeq,
          events: appendResult.events,
          channel: "live",
        });
        const responsePayload = { ok: true as const };
        saveWorkbookIdempotentOperation(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload: responsePayload,
        });
        json(res, 200, responsePayload);
        return;
      }

      const workbookEventsStreamMatch = pathname.match(
        /^\/api\/workbook\/sessions\/([^/]+)\/events\/stream$/
      );
      if (workbookEventsStreamMatch && method === "GET") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookEventsStreamMatch[1]);
        if (!getWorkbookParticipant(db, sessionId, actor.id)) {
          forbidden(res);
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        const clientId = ensureId();
        const sessionClients = workbookStreamClientsBySession.get(sessionId) ?? new Map();
        sessionClients.set(clientId, { id: clientId, userId: actor.id, res });
        workbookStreamClientsBySession.set(sessionId, sessionClients);
        void ensureRuntimeSessionBridge(sessionId);

        try {
          res.write(`event: ping\\ndata: ${JSON.stringify({ ts: nowIso() })}\\n\\n`);
        } catch {
          closeWorkbookStreamClient(sessionId, clientId);
          res.end();
          return;
        }

        const heartbeat = setInterval(() => {
          try {
            res.write(`event: ping\\ndata: ${JSON.stringify({ ts: nowIso() })}\\n\\n`);
          } catch {
            clearInterval(heartbeat);
            closeWorkbookStreamClient(sessionId, clientId);
            res.end();
          }
        }, 15_000);

        const cleanup = () => {
          clearInterval(heartbeat);
          closeWorkbookStreamClient(sessionId, clientId);
        };

        req.on("close", cleanup);
        req.on("end", cleanup);
        req.on("error", cleanup);
        return;
      }

      const workbookSnapshotMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/snapshot$/);
      if (workbookSnapshotMatch && method === "GET") {
        if (!ensureWorkbookPersistenceReady(res)) return;
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookSnapshotMatch[1]);
        if (!getWorkbookParticipant(db, sessionId, actor.id)) {
          forbidden(res);
          return;
        }
        const layer = searchParams.get("layer") === "annotations" ? "annotations" : "board";
        const snapshot = await workbookSnapshotStore.read({ sessionId, layer });
        if (!snapshot) {
          json(res, 200, null);
          return;
        }
        json(res, 200, {
          id: snapshot.id,
          sessionId: snapshot.sessionId,
          layer: snapshot.layer,
          version: snapshot.version,
          payload: snapshot.payload,
          createdAt: snapshot.createdAt,
        });
        return;
      }

      if (workbookSnapshotMatch && method === "PUT") {
        if (!ensureWorkbookPersistenceReady(res)) return;
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookSnapshotMatch[1]);
        if (!getWorkbookParticipant(db, sessionId, actor.id)) {
          forbidden(res);
          return;
        }
        const body = (await readBody(req)) as {
          layer?: "board" | "annotations";
          version?: number;
          payload?: unknown;
        } | null;
        const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_snapshot_upsert";
        const requestFingerprint = hashWorkbookOperationFingerprint({
          sessionId,
          body,
        });
        const idempotencyKey = resolveWriteIdempotencyKey({
          req,
          scope: idempotencyScope,
          actorUserId: actor.id,
          sessionId,
          payloadFingerprint: body ?? {},
        });
        const existingOperation = readWorkbookIdempotentOperation<{
          id: string;
          sessionId: string;
          layer: "board" | "annotations";
          version: number;
          payload: unknown;
          accepted: boolean;
          requestedVersion: number;
          barrierSeq: number;
          createdAt: string;
        }>(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }
        const layer = body?.layer === "annotations" ? "annotations" : "board";
        const requestedVersion =
          typeof body?.version === "number" && body.version > 0 ? Math.trunc(body.version) : 1;
        const latestSeq = getWorkbookSessionLatestSeq(db, sessionId);
        const version =
          latestSeq > 0
            ? Math.max(1, Math.min(requestedVersion, latestSeq))
            : Math.max(1, requestedVersion);
        const payload = body?.payload ?? null;
        const snapshot = await workbookSnapshotStore.upsert({
          sessionId,
          layer,
          version,
          payload,
        });
        const barrier = resolveWorkbookSnapshotBarrier(db, sessionId);
        const beforeTrimCount = db.workbookEvents.filter((event) => event.sessionId === sessionId).length;
        const accepted =
          requestedVersion === version && version >= snapshot.version;
        if (beforeTrimCount > WORKBOOK_EVENT_LIMIT && barrier.confirmed) {
          const before = db.workbookEvents.length;
          // Snapshot barrier confirms recovery point; now overflow trim is safe.
          trimWorkbookEventsOverflow(db, sessionId);
          if (db.workbookEvents.length !== before) {
            saveDb();
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
        saveWorkbookIdempotentOperation(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload: responsePayload,
        });

        json(res, 200, responsePayload);
        return;
      }

      const workbookPresenceMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/presence$/);
      if (workbookPresenceMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const body = (await readBody(req)) as {
          state?: WorkbookPresenceState;
          tabId?: string;
        } | null;
        const sessionId = decodeURIComponent(workbookPresenceMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_presence_heartbeat";
        const requestFingerprint = hashWorkbookOperationFingerprint({
          sessionId,
          body,
        });
        const idempotencyKey = resolveWriteIdempotencyKey({
          req,
          scope: idempotencyScope,
          actorUserId: actor.id,
          sessionId,
          payloadFingerprint: body ?? {},
        });
        const existingOperation = readWorkbookIdempotentOperation<{
          ok: true;
          participants: ReturnType<typeof maybePublishPresenceSync>;
        }>(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }

        const state = normalizePresenceState(body?.state);
        const tabId = normalizePresenceTabId(body?.tabId);
        const wasActive = participant.isActive;
        const heartbeatTs = nowTs();
        const heartbeatAt = nowIso();
        const presenceResult = applyParticipantPresenceState(participant, {
          sessionId,
          state,
          tabId,
          timestamp: heartbeatAt,
        });
        const lastActivityTouchAt = presenceActivityTouchAtBySession.get(sessionId) ?? 0;
        const shouldTouchSessionActivity =
          state === "active" &&
          (!wasActive || heartbeatTs - lastActivityTouchAt >= PRESENCE_ACTIVITY_TOUCH_INTERVAL_MS);
        if (shouldTouchSessionActivity) {
          touchSessionActivity(session, heartbeatAt);
          ensureDraftForOwner(db, session, actor.id).updatedAt = session.lastActivityAt;
          presenceActivityTouchAtBySession.set(sessionId, heartbeatTs);
        } else if (!presenceResult.hasActiveTabs) {
          presenceActivityTouchAtBySession.delete(sessionId);
        }
        applyStudentControls(session, db);
        persistPresenceIfNeeded(participant, {
          force: presenceResult.changed || shouldTouchSessionActivity,
        });
        const participants = maybePublishPresenceSync(db, sessionId, actor.id);
        if (presenceResult.visitStarted) {
          await recordWorkbookAccessEvent({
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
          await recordWorkbookAccessEvent({
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
        saveWorkbookIdempotentOperation(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload: responsePayload,
        });
        json(res, 200, responsePayload);
        return;
      }

      const workbookPresenceLeaveMatch = pathname.match(
        /^\/api\/workbook\/sessions\/([^/]+)\/presence\/leave$/
      );
      if (workbookPresenceLeaveMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const body = (await readBody(req)) as {
          tabId?: string;
          reason?: string;
        } | null;
        const sessionId = decodeURIComponent(workbookPresenceLeaveMatch[1]);
        const session = getWorkbookSessionById(db, sessionId);
        if (!session) {
          notFound(res);
          return;
        }
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        const idempotencyScope: WorkbookOperationRecord["scope"] = "workbook_presence_leave";
        const requestFingerprint = hashWorkbookOperationFingerprint({
          sessionId,
          body,
        });
        const idempotencyKey = resolveWriteIdempotencyKey({
          req,
          scope: idempotencyScope,
          actorUserId: actor.id,
          sessionId,
          payloadFingerprint: body ?? {},
        });
        const existingOperation = readWorkbookIdempotentOperation<{
          ok: true;
          participants: ReturnType<typeof maybePublishPresenceSync>;
        }>(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
        });
        if (existingOperation?.conflict) {
          conflict(res, "idempotency_key_reused_with_different_payload");
          return;
        }
        if (existingOperation) {
          json(res, existingOperation.statusCode, existingOperation.payload);
          return;
        }
        const leftAt = nowIso();
        const hasTabId = typeof body?.tabId === "string" && body.tabId.trim().length > 0;
        const tabId = normalizePresenceTabId(body?.tabId);
        const presenceResult = applyParticipantPresenceState(participant, {
          sessionId,
          state: "inactive",
          tabId,
          timestamp: leftAt,
          clearTabs: !hasTabId,
        });
        if (!presenceResult.hasActiveTabs) {
          presenceActivityTouchAtBySession.delete(sessionId);
        }
        applyStudentControls(session, db);
        persistPresenceIfNeeded(participant, { force: presenceResult.changed });
        const participants = maybePublishPresenceSync(db, sessionId, actor.id);
        if (presenceResult.visitEnded) {
          await recordWorkbookAccessEvent({
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
        saveWorkbookIdempotentOperation(db, {
          scope: idempotencyScope,
          actorUserId: actor.id,
          idempotencyKey,
          requestFingerprint,
          statusCode: 200,
          payload: responsePayload,
        });
        json(res, 200, responsePayload);
        return;
      }

      if (pathname === "/api/workbook/pdf/render" && method === "POST") {
        const body = (await readBody(req)) as {
          fileName?: string;
          dataUrl?: string;
          dpi?: number;
          maxPages?: number;
        } | null;

        const pdfBuffer = decodeWorkbookPdfDataUrl(body?.dataUrl);
        if (!pdfBuffer) {
          badRequest(res, "Некорректный PDF payload.");
          return;
        }
        if (pdfBuffer.length > WORKBOOK_PDF_RENDER_MAX_BYTES) {
          json(res, 413, {
            error: "pdf_too_large",
          });
          return;
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
          const pages = await renderWorkbookPdfPagesViaPoppler({
            pdfBuffer,
            dpi,
            maxPages,
            ensureId,
          });
          json(res, 200, {
            renderer: "poppler",
            fileName: typeof body?.fileName === "string" ? body.fileName : "document.pdf",
            pages,
          });
          return;
        } catch {
          json(res, 503, {
            renderer: "unavailable",
            fileName: typeof body?.fileName === "string" ? body.fileName : "document.pdf",
            pages: [],
            error:
              "PDF render backend недоступен. Установите poppler (pdftoppm) или используйте image-файл.",
          });
          return;
        }
      }

      if (pathname === "/api/workbook/ink/recognize" && method === "POST") {
        const body = (await readBody(req)) as {
          strokes?: Array<{ points?: unknown[] }>;
        } | null;
        const strokesCount = Array.isArray(body?.strokes) ? body.strokes.length : 0;
        json(res, 200, {
          provider: "mock",
          supported: true,
          result:
            strokesCount > 0
              ? {
                  text: "Распознавание доступно в mock-режиме",
                  confidence: 0.82,
                }
              : null,
        });
        return;
      }

      notFound(res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      const isRuntimeTimeout = /_timeout$/i.test(message);
      const isRateLimitedError = /_rate_limited$/i.test(message);
      const statusCode =
        message === REQUEST_BODY_TOO_LARGE_ERROR
          ? 413
          : message === INVALID_JSON_BODY_ERROR
            ? 400
            : isRateLimitedError
              ? 429
              : isRuntimeTimeout
                ? 503
                : 500;
      json(res, statusCode, {
        error: message,
      });
    }
  };
};
