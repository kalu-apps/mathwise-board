import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { promises as fsPromises } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  getDb,
  saveDb,
  type AuthSessionRecord,
  type MockDb,
  type UserRecord,
  type WorkbookDraftRecord,
  type WorkbookEventRecord,
  type WorkbookInviteRecord,
  type WorkbookParticipantPermissions,
  type WorkbookSessionKind,
  type WorkbookSessionParticipantRecord,
  type WorkbookSessionRecord,
  type WorkbookSnapshotRecord,
} from "./db";

const execFileAsync = promisify(execFileCallback);

const WHITEBOARD_TEACHER_LOGIN = "teacher@axiom.demo";
const WHITEBOARD_TEACHER_PASSWORD =
  typeof process.env.VITE_WHITEBOARD_TEACHER_PASSWORD === "string" &&
  process.env.VITE_WHITEBOARD_TEACHER_PASSWORD.trim().length > 0
    ? process.env.VITE_WHITEBOARD_TEACHER_PASSWORD.trim()
    : "magic";

const AUTH_COOKIE_NAME = "math_tutor_session";
const AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const AUTH_LAST_SEEN_TOUCH_INTERVAL_MS = 30_000;
const ONLINE_TIMEOUT_MS = 20_000;
const INVITE_TTL_MS = 2 * 60 * 60 * 1000;
const WORKBOOK_EVENT_LIMIT = 1_200;
const WORKBOOK_PDF_RENDER_MAX_BYTES = 20 * 1024 * 1024;
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

type MiddlewareHost =
  | ViteDevServer
  | {
      middlewares: ViteDevServer["middlewares"];
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

type WorkbookEventPayload = {
  type: string;
  payload: unknown;
};

type WorkbookStreamClient = {
  id: string;
  userId: string;
  res: ServerResponse;
};

const workbookStreamClientsBySession = new Map<string, Map<string, WorkbookStreamClient>>();

const nowIso = () => new Date().toISOString();
const nowTs = () => Date.now();

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

const resolveAuthUser = (req: IncomingMessage, db: MockDb): UserRecord | null => {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE_NAME];
  const session = getSessionRecord(db, token);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId) ?? null;
  if (!user) return null;
  const currentTs = nowTs();
  const lastSeenTs = new Date(session.lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenTs) || currentTs - lastSeenTs >= AUTH_LAST_SEEN_TOUCH_INTERVAL_MS) {
    session.lastSeenAt = new Date(currentTs).toISOString();
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
    canUseMedia: false,
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

const DRAW_EVENT_TYPES = new Set<string>(["board.stroke", "board.object.create"]);
const ANNOTATE_EVENT_TYPES = new Set<string>(["annotations.stroke"]);
const SELECT_EVENT_TYPES = new Set<string>([
  "board.object.update",
  "board.object.preview",
  "board.object.pin",
  "board.undo",
  "board.redo",
]);
const DELETE_EVENT_TYPES = new Set<string>([
  "board.object.delete",
  "board.stroke.delete",
  "annotations.stroke.delete",
  "document.annotation.clear",
]);
const CLEAR_EVENT_TYPES = new Set<string>([
  "board.clear",
  "board.clear.request",
  "board.clear.confirm",
  "annotations.clear",
]);
const INSERT_EVENT_TYPES = new Set<string>([
  "document.asset.add",
  "document.pdf",
  "library.item.upsert",
  "library.item.remove",
  "library.folder.upsert",
  "library.folder.remove",
  "library.template.upsert",
  "library.template.remove",
]);

const resolveEventPermissionError = (
  eventType: string,
  permissions: WorkbookParticipantPermissions,
  sessionKind: WorkbookSessionKind
) => {
  if (eventType === "permissions.update") {
    return permissions.canManageSession ? null : "permissions_manage_disabled";
  }
  if (eventType === "media.signal") {
    return permissions.canUseMedia ? null : "media_disabled";
  }
  if (eventType === "chat.message") {
    return permissions.canUseChat ? null : "chat_disabled";
  }
  if (eventType === "focus.point") {
    return permissions.canUseLaser ? null : "laser_disabled";
  }
  if (eventType === "timer.update") {
    return permissions.canManageSession ? null : "timer_manage_disabled";
  }
  if (eventType === "board.settings.update" && sessionKind === "CLASS") {
    return permissions.canManageSession ? null : "settings_manage_disabled";
  }
  if (DRAW_EVENT_TYPES.has(eventType)) {
    return permissions.canDraw ? null : "draw_disabled";
  }
  if (ANNOTATE_EVENT_TYPES.has(eventType)) {
    return permissions.canAnnotate ? null : "annotate_disabled";
  }
  if (SELECT_EVENT_TYPES.has(eventType)) {
    return permissions.canSelect ? null : "select_disabled";
  }
  if (DELETE_EVENT_TYPES.has(eventType)) {
    return permissions.canDelete ? null : "delete_disabled";
  }
  if (CLEAR_EVENT_TYPES.has(eventType)) {
    return permissions.canClear ? null : "clear_disabled";
  }
  if (INSERT_EVENT_TYPES.has(eventType)) {
    return permissions.canInsertImage ? null : "insert_disabled";
  }
  return null;
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
    canDraw: false,
    canSelect: false,
    canDelete: false,
    canInsertImage: false,
    canClear: false,
    canExport: false,
    canUseLaser: false,
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

const closeWorkbookStreamClient = (sessionId: string, clientId: string) => {
  const sessionClients = workbookStreamClientsBySession.get(sessionId);
  if (!sessionClients) return;
  sessionClients.delete(clientId);
  if (sessionClients.size === 0) {
    workbookStreamClientsBySession.delete(sessionId);
  }
};

const publishWorkbookStreamEvents = (
  db: MockDb,
  payload: {
    sessionId: string;
    latestSeq: number;
    events: Array<{
      id: string;
      sessionId: string;
      seq: number;
      authorUserId: string;
      type: string;
      payload: unknown;
      createdAt: string;
    }>;
  }
) => {
  const sessionClients = workbookStreamClientsBySession.get(payload.sessionId);
  if (!sessionClients || sessionClients.size === 0) return;
  const chunk = `event: workbook\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const [clientId, client] of sessionClients.entries()) {
    const hasAccess = db.workbookParticipants.some(
      (participant) => participant.sessionId === payload.sessionId && participant.userId === client.userId
    );
    if (!hasAccess) {
      closeWorkbookStreamClient(payload.sessionId, clientId);
      continue;
    }
    try {
      client.res.write(chunk);
    } catch {
      closeWorkbookStreamClient(payload.sessionId, clientId);
    }
  }
};

const appendEvents = (
  db: MockDb,
  params: {
    sessionId: string;
    authorUserId: string;
    events: WorkbookEventPayload[];
    persist?: boolean;
  }
) => {
  const timestamp = nowIso();
  const currentMaxSeq = db.workbookEvents
    .filter((event) => event.sessionId === params.sessionId)
    .reduce((max, event) => Math.max(max, event.seq), 0);

  const appended = params.events.map((event, index) => {
    const nextSeq = currentMaxSeq + index + 1;
    const record: WorkbookEventRecord = {
      id: ensureId(),
      sessionId: params.sessionId,
      seq: nextSeq,
      authorUserId: params.authorUserId,
      type: event.type,
      payload: JSON.stringify(event.payload ?? null),
      createdAt: timestamp,
    };
    if (params.persist !== false) {
      db.workbookEvents.push(record);
    }
    return {
      id: record.id,
      sessionId: record.sessionId,
      seq: record.seq,
      authorUserId: record.authorUserId,
      type: record.type,
      payload: event.payload ?? null,
      createdAt: record.createdAt,
    };
  });

  if (params.persist !== false) {
    const sessionEvents = db.workbookEvents
      .filter((event) => event.sessionId === params.sessionId)
      .sort((a, b) => a.seq - b.seq);
    if (sessionEvents.length > WORKBOOK_EVENT_LIMIT) {
      const overflow = sessionEvents.length - WORKBOOK_EVENT_LIMIT;
      const overflowIds = new Set(sessionEvents.slice(0, overflow).map((event) => event.id));
      db.workbookEvents = db.workbookEvents.filter((event) => !overflowIds.has(event.id));
    }
  }

  return {
    events: appended,
    latestSeq: appended[appended.length - 1]?.seq ?? currentMaxSeq,
    timestamp,
  };
};

const decodePdfDataUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.startsWith("data:application/pdf;base64,")) {
    return null;
  }
  const base64 = value.slice("data:application/pdf;base64,".length).trim();
  if (!base64) return null;
  try {
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
};

const toDataUrl = (buffer: Buffer, mimeType: string) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const renderPdfPagesViaPoppler = async (params: {
  pdfBuffer: Buffer;
  dpi: number;
  maxPages: number;
}) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "workbook-pdf-"));
  const inputPath = path.join(tempRoot, "input.pdf");
  const outputPrefix = path.join(tempRoot, "page");
  await fsPromises.writeFile(inputPath, params.pdfBuffer);

  try {
    await execFileAsync("pdftoppm", [
      "-png",
      "-r",
      String(params.dpi),
      "-f",
      "1",
      "-l",
      String(params.maxPages),
      inputPath,
      outputPrefix,
    ]);

    const files = await fsPromises.readdir(tempRoot);
    const pages = await Promise.all(
      files
        .filter((name) => /^page-\d+\.png$/i.test(name))
        .map(async (name) => {
          const page = Number(name.match(/(\d+)/)?.[1] ?? "0");
          const fullPath = path.join(tempRoot, name);
          const image = await fsPromises.readFile(fullPath);
          return {
            id: ensureId(),
            page,
            imageUrl: toDataUrl(image, "image/png"),
          };
        })
    );

    return pages.sort((a, b) => a.page - b.page);
  } finally {
    await fsPromises.rm(tempRoot, { recursive: true, force: true });
  }
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

export function setupMockServer(host: MiddlewareHost) {
  const middlewares = resolveMiddlewares(host);

  middlewares.use(async (req, res, next) => {
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
        db.workbookEvents = db.workbookEvents.filter((item) => item.sessionId !== sessionId);
        db.workbookSnapshots = db.workbookSnapshots.filter((item) => item.sessionId !== sessionId);
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
        const sourceSnapshots = db.workbookSnapshots.filter((item) => item.sessionId === source.id);
        sourceSnapshots.forEach((snapshot) => {
          db.workbookSnapshots.push({
            ...snapshot,
            id: ensureId(),
            sessionId: session.id,
            createdAt: timestamp,
          });
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

        const latestSeq = events[events.length - 1]?.seq ?? (Number.isFinite(afterSeq) ? afterSeq : 0);
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

        const body = (await readBody(req)) as { events?: WorkbookEventPayload[] } | null;
        const events = Array.isArray(body?.events)
          ? body.events.filter((event) => typeof event?.type === "string")
          : [];
        if (!events.length) {
          badRequest(res, "Нет событий для сохранения.");
          return;
        }

        for (const event of events) {
          const permissionError = resolveEventPermissionError(
            event.type,
            participant.permissions,
            session.kind
          );
          if (permissionError) {
            forbidden(res, permissionError);
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

        const appendResult = appendEvents(db, {
          sessionId,
          authorUserId: actor.id,
          events,
          persist: true,
        });

        touchSessionActivity(session, appendResult.timestamp);
        ensureDraftForOwner(db, session, actor.id).updatedAt = appendResult.timestamp;
        saveDb();

        publishWorkbookStreamEvents(db, {
          sessionId,
          latestSeq: appendResult.latestSeq,
          events: appendResult.events,
        });

        json(res, 200, {
          events: appendResult.events,
          latestSeq: appendResult.latestSeq,
        });
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
          objectId?: string;
          patch?: Record<string, unknown>;
        } | null;

        const objectId = typeof body?.objectId === "string" ? body.objectId : "";
        const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
        if (!objectId || !patch) {
          badRequest(res, "Некорректные данные preview.");
          return;
        }

        const appendResult = appendEvents(db, {
          sessionId,
          authorUserId: actor.id,
          events: [
            {
              type: "board.object.preview",
              payload: {
                objectId,
                patch,
              },
            },
          ],
          persist: false,
        });

        touchSessionActivity(session, appendResult.timestamp);
        ensureDraftForOwner(db, session, actor.id).updatedAt = appendResult.timestamp;
        saveDb();

        publishWorkbookStreamEvents(db, {
          sessionId,
          latestSeq: appendResult.latestSeq,
          events: appendResult.events,
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
        const snapshot = db.workbookSnapshots
          .filter((item) => item.sessionId === sessionId && item.layer === layer)
          .sort((a, b) => b.version - a.version)[0];
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

        const existing = db.workbookSnapshots.find(
          (item) => item.sessionId === sessionId && item.layer === layer
        );
        const timestamp = nowIso();

        let snapshot: WorkbookSnapshotRecord;
        if (existing) {
          existing.version = version;
          existing.payload = JSON.stringify(payload);
          existing.createdAt = timestamp;
          snapshot = existing;
        } else {
          snapshot = {
            id: ensureId(),
            sessionId,
            layer,
            version,
            payload: JSON.stringify(payload),
            createdAt: timestamp,
          };
          db.workbookSnapshots.push(snapshot);
        }
        saveDb();

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

        participant.isActive = true;
        participant.leftAt = null;
        participant.lastSeenAt = nowIso();
        touchSessionActivity(session);
        ensureDraftForOwner(db, session, actor.id).updatedAt = session.lastActivityAt;
        saveDb();

        json(res, 200, {
          ok: true,
          participants: getWorkbookParticipants(db, sessionId).map((item) =>
            serializeParticipant(db, item)
          ),
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
        saveDb();

        json(res, 200, {
          ok: true,
          participants: getWorkbookParticipants(db, sessionId).map((item) =>
            serializeParticipant(db, item)
          ),
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

        const pdfBuffer = decodePdfDataUrl(body?.dataUrl);
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
          const pages = await renderPdfPagesViaPoppler({
            pdfBuffer,
            dpi,
            maxPages,
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
