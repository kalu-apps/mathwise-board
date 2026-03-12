import crypto from "node:crypto";
import os from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { Connect, PreviewServer, ViteDevServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import {
  copyWorkbookSessionSnapshots,
  deleteWorkbookSessionArtifacts,
  getDb,
  readWorkbookSessionSnapshot,
  saveDb,
  upsertWorkbookSessionSnapshot,
  type AuthSessionRecord,
  type MockDb,
  type UserRecord,
  type WorkbookDraftRecord,
  type WorkbookInviteRecord,
  type WorkbookParticipantPermissions,
  type WorkbookSessionKind,
  type WorkbookSessionParticipantRecord,
  type WorkbookSessionRecord,
} from "./db";
import {
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

const WHITEBOARD_TEACHER_LOGIN = "teacher@axiom.demo";
const WHITEBOARD_TEACHER_PASSWORD =
  typeof process.env.VITE_WHITEBOARD_TEACHER_PASSWORD === "string" &&
  process.env.VITE_WHITEBOARD_TEACHER_PASSWORD.trim().length > 0
    ? process.env.VITE_WHITEBOARD_TEACHER_PASSWORD.trim()
    : "magic";

const AUTH_COOKIE_NAME = "math_tutor_session";
const AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ONLINE_TIMEOUT_MS = 3_500;
const PRESENCE_PERSIST_INTERVAL_MS = 15_000;
const INVITE_TTL_MS = 2 * 60 * 60 * 1000;
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

type HttpUpgradeServer = {
  on(
    event: "upgrade",
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void
  ): unknown;
};

type MiddlewareHost =
  | ViteDevServer
  | PreviewServer
  | {
      middlewares: Connect.Server;
      httpServer?: HttpUpgradeServer | null;
    };

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
const presencePersistAtByParticipant = new Map<string, number>();
const presenceSnapshotHashBySession = new Map<string, string>();
const runtimeUnsubscribeBySession = new Map<string, () => Promise<void> | void>();
const runtimeSubscribeInFlightBySession = new Map<string, Promise<void>>();
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

const serviceUnavailable = (res: ServerResponse, message = "Service unavailable") => {
  json(res, 503, { error: message });
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

const writeAuthCookie = (res: ServerResponse, token: string) => {
  res.setHeader(
    "Set-Cookie",
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
  res.setHeader(
    "Set-Cookie",
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
    "Content-Type, X-Request-Id, X-Retry-Attempt, X-Idempotency-Key"
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
  let body = "";
  for await (const chunk of req) {
    body += String(chunk);
  }
  if (!body.trim()) return null;
  return JSON.parse(body);
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
  const session = db.authSessions.find((item) => item.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= nowTs()) {
    db.authSessions = db.authSessions.filter((item) => item.token !== token);
    saveDb();
    return null;
  }
  return session;
};

const resolveAuthUser = (
  req: IncomingMessage,
  db: MockDb,
  options?: { touchSession?: boolean }
): UserRecord | null => {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE_NAME];
  const session = getSessionRecord(db, token);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId) ?? null;
  if (!user) return null;
  if (options?.touchSession !== false) {
    session.lastSeenAt = nowIso();
    saveDb();
  }
  return user;
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
  db.workbookSessions.find((session) => session.id === sessionId) ?? null;

const getWorkbookParticipants = (db: MockDb, sessionId: string) =>
  db.workbookParticipants.filter((participant) => participant.sessionId === sessionId);

const getWorkbookParticipant = (db: MockDb, sessionId: string, userId: string) =>
  db.workbookParticipants.find(
    (participant) => participant.sessionId === sessionId && participant.userId === userId
  ) ?? null;

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
  const existing = db.workbookDrafts.find(
    (draft) => draft.sessionId === session.id && draft.ownerUserId === ownerUserId
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
  const user = db.users.find((item) => item.id === participant.userId);
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

const durationMinutes = (session: WorkbookSessionRecord) => {
  const startTs = session.startedAt ? new Date(session.startedAt).getTime() : NaN;
  const endTs = session.endedAt
    ? new Date(session.endedAt).getTime()
    : new Date(session.lastActivityAt).getTime();
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
    return null;
  }
  return Math.max(1, Math.round((endTs - startTs) / 60000));
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
    durationMinutes: durationMinutes(session),
    canEdit: actorParticipant.permissions.canDraw || actorParticipant.permissions.canSelect,
    canInvite: actorParticipant.permissions.canInvite,
    canDelete: actorParticipant.permissions.canManageSession,
    participantsCount: participants.length,
    isOwner: session.createdBy === actorUserId,
    participants: participants.map((participant) => {
      const user = db.users.find((item) => item.id === participant.userId);
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
    const hasAccess = db.workbookParticipants.some(
      (participant) =>
        participant.sessionId === payload.sessionId && participant.userId === client.userId
    );
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
    const hasAccess = db.workbookParticipants.some(
      (participant) =>
        participant.sessionId === payload.sessionId && participant.userId === client.userId
    );
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
  db.workbookInvites.find((invite) => invite.token === token) ?? null;

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
  statusCode: 400 | 401 | 403 | 404,
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

const attachWorkbookLiveSocketServer = (host: MiddlewareHost) => {
  const httpServer = resolveHttpServer(host);
  if (!httpServer || workbookLiveSocketServerByHost.has(httpServer)) return;
  const socketServer = new WebSocketServer({ noServer: true });
  workbookLiveSocketServerByHost.set(httpServer, socketServer);

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = parsePath(req);
    const match = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/events\/live$/);
    if (!match) return;
    const db = getDb();
    pickTeacher(db);
    normalizeDbParticipantPermissions(db);
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
        const currentParticipant = getWorkbookParticipant(currentDb, sessionId, actor.id);
        if (!currentSession || !currentParticipant) {
          try {
            ws.close();
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

const applyStudentControls = (session: WorkbookSessionRecord, db: MockDb) => {
  const settings = readSessionSettings(session);
  db.workbookParticipants = db.workbookParticipants.map((participant) => {
    if (participant.sessionId !== session.id || participant.roleInSession !== "student") {
      return participant;
    }
    return {
      ...participant,
      permissions: {
        ...participant.permissions,
        canDraw: settings.studentControls.canDraw,
        canSelect: settings.studentControls.canSelect,
        canDelete: settings.studentControls.canDelete,
        canInsertImage: settings.studentControls.canInsertImage,
        canClear: settings.studentControls.canClear,
        canExport: settings.studentControls.canExport,
        canUseLaser: settings.studentControls.canUseLaser,
      },
    };
  });
};

const requireAuthUser = (req: IncomingMessage, res: ServerResponse, db: MockDb) => {
  const user = resolveAuthUser(req, db);
  if (!user) {
    unauthorized(res);
    return null;
  }
  return user;
};

const setAuthSession = (db: MockDb, res: ServerResponse, user: UserRecord) => {
  const token = ensureId();
  const createdAt = nowIso();
  const session: AuthSessionRecord = {
    token,
    userId: user.id,
    createdAt,
    lastSeenAt: createdAt,
    expiresAt: new Date(nowTs() + AUTH_SESSION_TTL_MS).toISOString(),
  };
  db.authSessions.push(session);
  writeAuthCookie(res, token);
  return session;
};

const resolveMiddlewares = (host: MiddlewareHost) => host.middlewares;
const resolveHttpServer = (host: MiddlewareHost): HttpUpgradeServer | null => {
  if ("httpServer" in host) {
    return host.httpServer ?? null;
  }
  return null;
};

export function setupMockServer(host: MiddlewareHost) {
  const middlewares = resolveMiddlewares(host);
  attachWorkbookLiveSocketServer(host);

  middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
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

    applyCors(req, res);
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const db = getDb();
    pickTeacher(db);
    normalizeDbParticipantPermissions(db);

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
          db.authSessions = db.authSessions.filter((session) => session.token !== token);
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

        const drafts = db.workbookDrafts
          .filter((draft) => {
            const session = getWorkbookSessionById(db, draft.sessionId);
            if (!session) return false;
            const participant = getWorkbookParticipant(db, session.id, actor.id);
            if (!participant) return false;
            if (scope === "class" && session.kind !== "CLASS") return false;
            if (scope === "personal" && session.kind !== "PERSONAL") return false;
            return true;
          })
          .map((draft) => serializeDraft(db, draft, actor.id))
          .filter((item) => Boolean(item));

        json(res, 200, { items: drafts });
        return;
      }

      if (pathname === "/api/workbook/sessions" && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const body = (await readBody(req)) as { kind?: WorkbookSessionKind; title?: string } | null;
        const kind = body?.kind === "CLASS" ? "CLASS" : "PERSONAL";
        const title =
          typeof body?.title === "string" && body.title.trim().length > 0
            ? body.title.trim().slice(0, 140)
            : kind === "CLASS"
              ? "Коллективный урок"
              : "Личная тетрадь";
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
        saveDb();
        json(res, 200, {
          session: serializeSession(db, session, actor.id),
          draft: serializeDraft(db, draft, actor.id),
        });
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

        db.workbookSessions = db.workbookSessions.filter((item) => item.id !== sessionId);
        db.workbookParticipants = db.workbookParticipants.filter(
          (item) => item.sessionId !== sessionId
        );
        db.workbookDrafts = db.workbookDrafts.filter((item) => item.sessionId !== sessionId);
        db.workbookInvites = db.workbookInvites.filter((item) => item.sessionId !== sessionId);
        await deleteWorkbookSessionArtifacts(sessionId);
        workbookStreamClientsBySession.delete(sessionId);
        saveDb();
        json(res, 200, {
          ok: true,
          deletedSessionId: sessionId,
          message: "Сессия удалена",
        });
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
        const invite: WorkbookInviteRecord = {
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
        db.workbookInvites.push(invite);
        saveDb();
        json(res, 200, {
          inviteId: invite.id,
          sessionId: invite.sessionId,
          token: invite.token,
          inviteUrl: buildInviteUrl(req, invite.token),
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses ?? null,
          useCount: invite.useCount,
        });
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
        if (session.status === "ended") {
          forbidden(res, "lesson_ended");
          return;
        }
        if (invite.revokedAt || isInviteExpired(invite)) {
          forbidden(res, "invite_inactive");
          return;
        }

        let actor = resolveAuthUser(req, db);
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

        invite.useCount += 1;
        session.status = "in_progress";
        session.startedAt = session.startedAt ?? nowIso();
        session.lastActivityAt = nowIso();

        const draft = ensureDraftForOwner(db, session, actor.id);
        saveDb();

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
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookEventsMatch[1]);
        if (!getWorkbookParticipant(db, sessionId, actor.id)) {
          forbidden(res);
          return;
        }

        const afterSeq = Number(searchParams.get("afterSeq") ?? "0");
        const sessionLatestSeq = getWorkbookSessionLatestSeq(db, sessionId);
        const events = db.workbookEvents
          .filter((event) => event.sessionId === sessionId && event.seq > (Number.isFinite(afterSeq) ? afterSeq : 0))
          .sort((a, b) => a.seq - b.seq)
          .slice(-WORKBOOK_EVENT_LIMIT)
          .map((event) => ({
            id: event.id,
            sessionId: event.sessionId,
            seq: event.seq,
            authorUserId: event.authorUserId,
            type: event.type,
            payload: safeParseJson(event.payload, null),
            createdAt: event.createdAt,
          }));

        const latestSeq = events[events.length - 1]?.seq ?? sessionLatestSeq;
        json(res, 200, { sessionId, latestSeq, events });
        return;
      }

      if (workbookEventsMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookEventsMatch[1]);
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

        const body = (await readBody(req)) as { events?: WorkbookClientEventInput[] } | null;
        const events = Array.isArray(body?.events)
          ? body.events.filter((event) => typeof event?.type === "string")
          : [];
        if (!events.length) {
          badRequest(res, "Нет событий для сохранения.");
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
          targetParticipant.permissions = {
            ...targetParticipant.permissions,
            ...patch,
          };
        }

        const appendResult = await appendWorkbookEvents(db, {
          sessionId,
          authorUserId: actor.id,
          events,
          persist: true,
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

        json(res, 200, {
          events: appendResult.events,
          latestSeq: appendResult.latestSeq,
        });
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
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        const body = (await readBody(req)) as { events?: unknown[] } | null;
        const events = Array.isArray(body?.events) ? body.events : [];
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
        json(res, 200, { ok: true });
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
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }

        const body = (await readBody(req)) as {
          type?: string;
          objectId?: string;
          patch?: Record<string, unknown>;
          stroke?: Record<string, unknown>;
          previewVersion?: unknown;
        } | null;

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

        json(res, 200, { ok: true });
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
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookSnapshotMatch[1]);
        if (!getWorkbookParticipant(db, sessionId, actor.id)) {
          forbidden(res);
          return;
        }
        const layer = searchParams.get("layer") === "annotations" ? "annotations" : "board";
        const snapshot = await readWorkbookSessionSnapshot({ sessionId, layer });
        if (!snapshot) {
          json(res, 200, null);
          return;
        }
        json(res, 200, {
          id: snapshot.id,
          sessionId: snapshot.sessionId,
          layer: snapshot.layer,
          version: snapshot.version,
          payload: safeParseJson(snapshot.payload, null),
          createdAt: snapshot.createdAt,
        });
        return;
      }

      if (workbookSnapshotMatch && method === "PUT") {
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
        const layer = body?.layer === "annotations" ? "annotations" : "board";
        const version = typeof body?.version === "number" && body.version > 0 ? body.version : 1;
        const payload = body?.payload ?? null;
        const snapshot = await upsertWorkbookSessionSnapshot({
          sessionId,
          layer,
          version,
          payload,
        });

        json(res, 200, {
          id: snapshot.id,
          sessionId: snapshot.sessionId,
          layer: snapshot.layer,
          version: snapshot.version,
          payload,
          createdAt: snapshot.createdAt,
        });
        return;
      }

      const workbookPresenceMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)\/presence$/);
      if (workbookPresenceMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
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

        const wasActive = participant.isActive;
        participant.leftAt = null;
        participant.isActive = true;
        participant.lastSeenAt = nowIso();
        touchSessionActivity(session);
        ensureDraftForOwner(db, session, actor.id).updatedAt = session.lastActivityAt;
        persistPresenceIfNeeded(participant, { force: !wasActive });
        const participants = maybePublishPresenceSync(db, sessionId, actor.id);

        json(res, 200, {
          ok: true,
          participants,
        });
        return;
      }

      const workbookPresenceLeaveMatch = pathname.match(
        /^\/api\/workbook\/sessions\/([^/]+)\/presence\/leave$/
      );
      if (workbookPresenceLeaveMatch && method === "POST") {
        const actor = requireAuthUser(req, res, db);
        if (!actor) return;
        const sessionId = decodeURIComponent(workbookPresenceLeaveMatch[1]);
        const participant = getWorkbookParticipant(db, sessionId, actor.id);
        if (!participant) {
          forbidden(res);
          return;
        }
        participant.isActive = false;
        participant.leftAt = nowIso();
        participant.lastSeenAt = participant.leftAt;
        persistPresenceIfNeeded(participant, { force: true });
        const participants = maybePublishPresenceSync(db, sessionId, actor.id);

        json(res, 200, {
          ok: true,
          participants,
        });
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
      json(res, 500, {
        error: message,
      });
    }
  });
}
