import crypto from "node:crypto";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import {
  clearWorkbookLatestSeqCache,
  clearWorkbookSessionLatestSeqCached,
  readWorkbookSessionLatestSeqCached,
  setWorkbookSessionLatestSeqCached,
} from "./workbookSeqCache";

export type UserRole = "teacher" | "student";

export type UserRecord = {
  id: string;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
  photo?: string;
  createdAt: string;
};

export type AuthSessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type WorkbookSessionKind = "PERSONAL" | "CLASS";
export type WorkbookSessionStatus = "draft" | "in_progress" | "ended";
export type WorkbookRoleInSession = "teacher" | "student";

export type WorkbookSessionRecord = {
  id: string;
  kind: WorkbookSessionKind;
  createdBy: string;
  title: string;
  status: WorkbookSessionStatus;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  lastActivityAt: string;
  context: string;
};

export type WorkbookParticipantPermissions = {
  canDraw: boolean;
  canAnnotate: boolean;
  canUseMedia: boolean;
  canUseChat: boolean;
  canInvite: boolean;
  canManageSession: boolean;
  canSelect: boolean;
  canDelete: boolean;
  canInsertImage: boolean;
  canClear: boolean;
  canExport: boolean;
  canUseLaser: boolean;
};

export type WorkbookSessionParticipantRecord = {
  sessionId: string;
  userId: string;
  roleInSession: WorkbookRoleInSession;
  joinedAt: string;
  leftAt?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  currentVisitStartedAt?: string | null;
  lastVisitStartedAt?: string | null;
  lastVisitEndedAt?: string | null;
  lastVisitDurationMinutes?: number | null;
  boardToolsOverride?: "enabled" | "disabled" | null;
  permissions: WorkbookParticipantPermissions;
};

export type WorkbookDraftRecord = {
  id: string;
  ownerUserId: string;
  sessionId: string;
  redirectSessionId?: string | null;
  title: string;
  statusForCard: WorkbookSessionStatus;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string | null;
};

export type WorkbookInviteRecord = {
  id: string;
  sessionId: string;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  maxUses?: number | null;
  useCount: number;
  revokedAt?: string | null;
};

export type WorkbookEventRecord = {
  id: string;
  sessionId: string;
  seq: number;
  authorUserId: string;
  type: string;
  payload: string;
  createdAt: string;
};

export type WorkbookSnapshotRecord = {
  id: string;
  sessionId: string;
  layer: "board" | "annotations";
  version: number;
  payload: string;
  createdAt: string;
};

export type WorkbookAccessDeviceClass = "desktop" | "mobile" | "tablet" | "bot" | "unknown";

export type WorkbookAccessEventType =
  | "invite_resolved"
  | "invite_joined"
  | "invite_join_denied"
  | "presence_started"
  | "presence_ended"
  | "session_opened";

export type WorkbookAccessLogRecord = {
  id: string;
  sessionId: string;
  eventType: WorkbookAccessEventType;
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  actorName?: string | null;
  inviteTokenHash?: string | null;
  deviceIdHash?: string | null;
  userAgentHash?: string | null;
  ipHash?: string | null;
  userAgentFamily?: string | null;
  deviceClass?: WorkbookAccessDeviceClass | null;
  details: string;
  createdAt: string;
};

export type WorkbookAccessLogEntry = {
  id: string;
  sessionId: string;
  eventType: WorkbookAccessEventType;
  actorUserId: string | null;
  actorRole: UserRole | null;
  actorName: string | null;
  inviteTokenHash: string | null;
  deviceIdHash: string | null;
  userAgentHash: string | null;
  ipHash: string | null;
  userAgentFamily: string | null;
  deviceClass: WorkbookAccessDeviceClass | null;
  details: unknown;
  createdAt: string;
};

export type WorkbookAccessLogInput = {
  sessionId: string;
  eventType: WorkbookAccessEventType;
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  actorName?: string | null;
  inviteTokenHash?: string | null;
  deviceIdHash?: string | null;
  userAgentHash?: string | null;
  ipHash?: string | null;
  userAgentFamily?: string | null;
  deviceClass?: WorkbookAccessDeviceClass | null;
  details?: unknown;
  createdAt?: string;
};

export type WorkbookOperationScope =
  | "workbook_sessions_create"
  | "workbook_sessions_delete"
  | "workbook_invite_create";

export type WorkbookOperationRecord = {
  id: string;
  scope: WorkbookOperationScope;
  actorUserId: string;
  key: string;
  requestFingerprint: string;
  statusCode: number;
  responsePayload: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type MockDb = {
  users: UserRecord[];
  authSessions: AuthSessionRecord[];
  workbookSessions: WorkbookSessionRecord[];
  workbookParticipants: WorkbookSessionParticipantRecord[];
  workbookDrafts: WorkbookDraftRecord[];
  workbookInvites: WorkbookInviteRecord[];
  workbookOperations: WorkbookOperationRecord[];
  workbookEvents: WorkbookEventRecord[];
  workbookSnapshots: WorkbookSnapshotRecord[];
  workbookAccessLogs: WorkbookAccessLogRecord[];
};

export type WorkbookEventInput = {
  clientEventId?: string;
  type: string;
  payload: unknown;
};

export type PersistedWorkbookEvent = {
  id: string;
  sessionId: string;
  seq: number;
  authorUserId: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type PersistedWorkbookSnapshot = {
  id: string;
  sessionId: string;
  layer: "board" | "annotations";
  version: number;
  payload: unknown;
  createdAt: string;
};

const DB_FILE = path.resolve(process.cwd(), "mock-db.json");
const PERSIST_DEBOUNCE_MS = 1_000;
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const WORKBOOK_EVENT_LIMIT = 1_200;
const STATE_ROW_KEY = "mock_db_v1";
const STATE_TABLE = "app_state";
const EVENT_TABLE = "workbook_events";
const EVENT_SEQ_TABLE = "workbook_session_seq";
const SNAPSHOT_TABLE = "workbook_snapshots";
const ACCESS_LOG_TABLE = "workbook_access_logs";
const ACCESS_LOG_RETENTION_DAYS = (() => {
  const raw = Number.parseInt(
    String(process.env.WORKBOOK_ACCESS_LOG_RETENTION_DAYS ?? "90").trim(),
    10
  );
  if (!Number.isFinite(raw) || raw <= 0) return 90;
  return Math.min(3650, Math.floor(raw));
})();
const ACCESS_LOG_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const WORKBOOK_ACCESS_LOG_DEFAULT_LIMIT = 120;
let db: MockDb | null = null;
let persistTimer: NodeJS.Timeout | null = null;
let persistInFlight = false;
let persistRequestedWhileWriting = false;
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;
let storageDriver: "file" | "postgres" = "file";
let storageError: string | null = null;
let accessLogCleanupTimer: NodeJS.Timeout | null = null;
const postgresEventTrimTimerBySession = new Map<string, NodeJS.Timeout>();
type PgQueryResult<T> = {
  rows: T[];
  rowCount: number | null;
};

type PgClient = {
  query<T>(text: string, params?: readonly unknown[]): Promise<PgQueryResult<T>>;
  release(): void;
};

type PgPool = {
  query<T>(text: string, params?: readonly unknown[]): Promise<PgQueryResult<T>>;
  connect(): Promise<PgClient>;
  end(): Promise<void>;
};

let pgPool: PgPool | null = null;

type PgWorkbookEventRow = {
  id: string;
  session_id: string;
  seq: string | number;
  author_user_id: string;
  type: string;
  payload: unknown;
  created_at: Date | string;
};

type PgWorkbookSnapshotRow = {
  id: string;
  session_id: string;
  layer: "board" | "annotations";
  version: string | number;
  payload: unknown;
  created_at: Date | string;
};

type PgWorkbookAccessLogRow = {
  id: string;
  session_id: string;
  event_type: WorkbookAccessEventType;
  actor_user_id: string | null;
  actor_role: UserRole | null;
  actor_name: string | null;
  invite_token_hash: string | null;
  device_id_hash: string | null;
  user_agent_hash: string | null;
  ip_hash: string | null;
  user_agent_family: string | null;
  device_class: WorkbookAccessDeviceClass | null;
  details: unknown;
  created_at: Date | string;
};

const defaultTeacherUser = (): UserRecord => ({
  id: "teacher-axiom",
  role: "teacher",
  email: "teacher@axiom.demo",
  firstName: "Анна",
  lastName: "Викторовна",
  createdAt: new Date().toISOString(),
});

const createDefaultDb = (): MockDb => ({
  users: [defaultTeacherUser()],
  authSessions: [],
  workbookSessions: [],
  workbookParticipants: [],
  workbookDrafts: [],
  workbookInvites: [],
  workbookOperations: [],
  workbookEvents: [],
  workbookSnapshots: [],
  workbookAccessLogs: [],
});

const normalizeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const ensureId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2, 10)}`;

const nowIso = () => new Date().toISOString();

const safeParseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const resolveStoragePreference = (): "auto" | "file" | "postgres" => {
  const raw = String(process.env.BOARD_STORAGE_DRIVER ?? "auto")
    .trim()
    .toLowerCase();
  if (raw === "file" || raw === "postgres") return raw;
  return "auto";
};

const isPostgresRequired = () => resolveStoragePreference() === "postgres";

const shouldUsePostgres = () => {
  const preference = resolveStoragePreference();
  if (preference === "file") return false;
  if (!DATABASE_URL) return false;
  return true;
};

const shouldUsePgSsl = (connectionString: string) => {
  try {
    const url = new URL(connectionString);
    const sslMode = String(url.searchParams.get("sslmode") ?? "")
      .trim()
      .toLowerCase();
    const sslEnabled = String(url.searchParams.get("ssl") ?? "")
      .trim()
      .toLowerCase();
    if (sslEnabled === "1" || sslEnabled === "true") return true;
    return (
      sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full"
    );
  } catch {
    return false;
  }
};

const ensurePgSchema = async (pool: PgPool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
      key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${EVENT_SEQ_TABLE} (
      session_id TEXT PRIMARY KEY,
      last_seq BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${EVENT_TABLE} (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      seq BIGINT NOT NULL,
      author_user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ${EVENT_TABLE}_session_seq_idx
      ON ${EVENT_TABLE} (session_id, seq);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      layer TEXT NOT NULL CHECK (layer IN ('board', 'annotations')),
      version BIGINT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (session_id, layer)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${ACCESS_LOG_TABLE} (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_user_id TEXT NULL,
      actor_role TEXT NULL CHECK (actor_role IN ('teacher', 'student')),
      actor_name TEXT NULL,
      invite_token_hash TEXT NULL,
      device_id_hash TEXT NULL,
      user_agent_hash TEXT NULL,
      ip_hash TEXT NULL,
      user_agent_family TEXT NULL,
      device_class TEXT NULL CHECK (device_class IN ('desktop', 'mobile', 'tablet', 'bot', 'unknown')),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ${ACCESS_LOG_TABLE}_session_created_idx
      ON ${ACCESS_LOG_TABLE} (session_id, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ${ACCESS_LOG_TABLE}_created_idx
      ON ${ACCESS_LOG_TABLE} (created_at);
  `);
};

const ensurePgPool = async () => {
  if (pgPool) return pgPool;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  const { Pool } = await import("pg") as {
    Pool: new (config?: Record<string, unknown>) => PgPool;
  };
  const useSsl = shouldUsePgSsl(DATABASE_URL);
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await ensurePgSchema(pgPool);
  return pgPool;
};

const schedulePostgresEventTrim = (sessionId: string, limit: number) => {
  if (storageDriver !== "postgres") return;
  if (postgresEventTrimTimerBySession.has(sessionId)) return;
  const normalizedLimit = Math.max(1, Math.floor(limit));
  const timer = setTimeout(() => {
    postgresEventTrimTimerBySession.delete(sessionId);
    void (async () => {
      try {
        const pool = await ensurePgPool();
        await pool.query(
          `
            WITH barrier AS (
              SELECT
                CASE
                  WHEN COUNT(*) FILTER (WHERE layer = 'board') > 0
                    AND COUNT(*) FILTER (WHERE layer = 'annotations') > 0
                  THEN LEAST(
                    MAX(CASE WHEN layer = 'board' THEN version END),
                    MAX(CASE WHEN layer = 'annotations' THEN version END)
                  )
                  ELSE 0
                END AS safe_seq
              FROM ${SNAPSHOT_TABLE}
              WHERE session_id = $1
            ),
            boundary AS (
              SELECT seq
              FROM ${EVENT_TABLE}
              WHERE session_id = $1
              ORDER BY seq DESC
              OFFSET $2
              LIMIT 1
            )
            DELETE FROM ${EVENT_TABLE}
            WHERE session_id = $1
              AND seq < COALESCE((SELECT seq FROM boundary), -1)
              AND seq <= COALESCE((SELECT safe_seq FROM barrier), 0)
          `,
          [sessionId, Math.max(0, normalizedLimit - 1)]
        );
      } catch (error) {
        storageError = normalizeError(error);
      }
    })();
  }, 250);
  timer.unref?.();
  postgresEventTrimTimerBySession.set(sessionId, timer);
};

const ensureShape = (raw: unknown): MockDb => {
  const source = typeof raw === "object" && raw ? (raw as Partial<MockDb>) : {};
  const base = createDefaultDb();
  const next: MockDb = {
    users: Array.isArray(source.users) ? source.users : base.users,
    authSessions: Array.isArray(source.authSessions) ? source.authSessions : base.authSessions,
    workbookSessions: Array.isArray(source.workbookSessions)
      ? source.workbookSessions
      : base.workbookSessions,
    workbookParticipants: Array.isArray(source.workbookParticipants)
      ? source.workbookParticipants
      : base.workbookParticipants,
    workbookDrafts: Array.isArray(source.workbookDrafts)
      ? source.workbookDrafts
      : base.workbookDrafts,
    workbookInvites: Array.isArray(source.workbookInvites)
      ? source.workbookInvites
      : base.workbookInvites,
    workbookOperations: Array.isArray(source.workbookOperations)
      ? source.workbookOperations
      : base.workbookOperations,
    workbookEvents: Array.isArray(source.workbookEvents)
      ? source.workbookEvents
      : base.workbookEvents,
    workbookSnapshots: Array.isArray(source.workbookSnapshots)
      ? source.workbookSnapshots
      : base.workbookSnapshots,
    workbookAccessLogs: Array.isArray(source.workbookAccessLogs)
      ? source.workbookAccessLogs
      : base.workbookAccessLogs,
  };

  if (!next.users.some((user) => user.role === "teacher" && user.email === "teacher@axiom.demo")) {
    next.users.push(defaultTeacherUser());
  }

  const parseTs = (value: string | null | undefined) => {
    const parsed = Date.parse(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const dedupeBy = <T>(
    entries: T[],
    keyOf: (entry: T) => string,
    shouldReplace: (current: T, nextEntry: T) => boolean
  ) => {
    const map = new Map<string, T>();
    entries.forEach((entry) => {
      const key = keyOf(entry);
      if (!key) return;
      const current = map.get(key);
      if (!current) {
        map.set(key, entry);
        return;
      }
      if (shouldReplace(current, entry)) {
        map.set(key, entry);
      }
    });
    return Array.from(map.values());
  };

  const sessions = dedupeBy(
    next.workbookSessions,
    (entry) => entry.id,
    (current, candidate) => parseTs(candidate.lastActivityAt) >= parseTs(current.lastActivityAt)
  );
  const validSessionIds = new Set(sessions.map((entry) => entry.id));
  const validUserIds = new Set(next.users.map((entry) => entry.id));

  const participants = dedupeBy(
    next.workbookParticipants.filter(
      (entry) => validSessionIds.has(entry.sessionId) && validUserIds.has(entry.userId)
    ),
    (entry) => `${entry.sessionId}:${entry.userId}`,
    (current, candidate) => {
      const currentTs = Math.max(parseTs(current.lastSeenAt), parseTs(current.joinedAt));
      const candidateTs = Math.max(parseTs(candidate.lastSeenAt), parseTs(candidate.joinedAt));
      return candidateTs >= currentTs;
    }
  );

  const drafts = dedupeBy(
    next.workbookDrafts.filter(
      (entry) => validSessionIds.has(entry.sessionId) && validUserIds.has(entry.ownerUserId)
    ),
    (entry) => `${entry.sessionId}:${entry.ownerUserId}`,
    (current, candidate) => parseTs(candidate.updatedAt) >= parseTs(current.updatedAt)
  );

  const invites = dedupeBy(
    next.workbookInvites.filter(
      (entry) => validSessionIds.has(entry.sessionId) && validUserIds.has(entry.createdBy)
    ),
    (entry) => entry.token,
    (current, candidate) => parseTs(candidate.createdAt) >= parseTs(current.createdAt)
  );

  const operationRecords = dedupeBy(
    next.workbookOperations.filter(
      (entry) =>
        Boolean(entry.key) &&
        Boolean(entry.scope) &&
        validUserIds.has(entry.actorUserId) &&
        parseTs(entry.expiresAt) > Date.now()
    ),
    (entry) => `${entry.scope}:${entry.key}`,
    (current, candidate) => parseTs(candidate.updatedAt) >= parseTs(current.updatedAt)
  );

  const events = dedupeBy(
    next.workbookEvents.filter((entry) => validSessionIds.has(entry.sessionId)),
    (entry) => entry.id,
    (current, candidate) => {
      if (candidate.seq !== current.seq) return candidate.seq > current.seq;
      return parseTs(candidate.createdAt) >= parseTs(current.createdAt);
    }
  );

  const snapshots = dedupeBy(
    next.workbookSnapshots.filter((entry) => validSessionIds.has(entry.sessionId)),
    (entry) => `${entry.sessionId}:${entry.layer}`,
    (current, candidate) => candidate.version >= current.version
  );

  const accessLogs = dedupeBy(
    next.workbookAccessLogs.filter((entry) => validSessionIds.has(entry.sessionId)),
    (entry) => entry.id,
    (current, candidate) => parseTs(candidate.createdAt) >= parseTs(current.createdAt)
  );

  return {
    ...next,
    workbookSessions: sessions,
    workbookParticipants: participants,
    workbookDrafts: drafts,
    workbookInvites: invites,
    workbookOperations: operationRecords,
    workbookEvents: events,
    workbookSnapshots: snapshots,
    workbookAccessLogs: accessLogs,
  };
};

const mapFileEvent = (event: WorkbookEventRecord): PersistedWorkbookEvent => ({
  id: event.id,
  sessionId: event.sessionId,
  seq: event.seq,
  authorUserId: event.authorUserId,
  type: event.type,
  payload: safeParseJson(event.payload, null),
  createdAt: event.createdAt,
});

const mapFileSnapshot = (
  snapshot: WorkbookSnapshotRecord
): PersistedWorkbookSnapshot => ({
  id: snapshot.id,
  sessionId: snapshot.sessionId,
  layer: snapshot.layer,
  version: snapshot.version,
  payload: safeParseJson(snapshot.payload, null),
  createdAt: snapshot.createdAt,
});

const mapPgEvent = (row: PgWorkbookEventRow): PersistedWorkbookEvent => ({
  id: row.id,
  sessionId: row.session_id,
  seq: Number(row.seq),
  authorUserId: row.author_user_id,
  type: row.type,
  payload: row.payload ?? null,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

const mapPgSnapshot = (row: PgWorkbookSnapshotRow): PersistedWorkbookSnapshot => ({
  id: row.id,
  sessionId: row.session_id,
  layer: row.layer,
  version: Number(row.version),
  payload: row.payload ?? null,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

const mapFileAccessLog = (log: WorkbookAccessLogRecord): WorkbookAccessLogEntry => ({
  id: log.id,
  sessionId: log.sessionId,
  eventType: normalizeAccessEventType(log.eventType),
  actorUserId: log.actorUserId ?? null,
  actorRole: log.actorRole ?? null,
  actorName: log.actorName ?? null,
  inviteTokenHash: log.inviteTokenHash ?? null,
  deviceIdHash: log.deviceIdHash ?? null,
  userAgentHash: log.userAgentHash ?? null,
  ipHash: log.ipHash ?? null,
  userAgentFamily: log.userAgentFamily ?? null,
  deviceClass: normalizeAccessDeviceClass(log.deviceClass),
  details: safeParseJson(log.details, {}),
  createdAt: log.createdAt,
});

const mapPgAccessLog = (row: PgWorkbookAccessLogRow): WorkbookAccessLogEntry => ({
  id: row.id,
  sessionId: row.session_id,
  eventType: normalizeAccessEventType(row.event_type),
  actorUserId: row.actor_user_id ?? null,
  actorRole: row.actor_role ?? null,
  actorName: row.actor_name ?? null,
  inviteTokenHash: row.invite_token_hash ?? null,
  deviceIdHash: row.device_id_hash ?? null,
  userAgentHash: row.user_agent_hash ?? null,
  ipHash: row.ip_hash ?? null,
  userAgentFamily: row.user_agent_family ?? null,
  deviceClass: normalizeAccessDeviceClass(row.device_class),
  details: row.details ?? {},
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

const readDbFile = async (): Promise<MockDb> => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const fresh = createDefaultDb();
      await fsPromises.writeFile(DB_FILE, JSON.stringify(fresh, null, 2), "utf-8");
      return fresh;
    }
    const raw = await fsPromises.readFile(DB_FILE, "utf-8");
    return ensureShape(JSON.parse(raw));
  } catch {
    return createDefaultDb();
  }
};

const readDbFromPostgres = async (): Promise<MockDb | null> => {
  const pool = await ensurePgPool();
  const result = await pool.query<{ payload: unknown }>(
    `SELECT payload FROM ${STATE_TABLE} WHERE key = $1 LIMIT 1`,
    [STATE_ROW_KEY]
  );
  if (result.rowCount === 0) return null;
  return ensureShape(result.rows[0]?.payload);
};

const writeDbToPostgres = async (payload: string) => {
  const pool = await ensurePgPool();
  await pool.query(
    `
      INSERT INTO ${STATE_TABLE} (key, payload, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();
    `,
    [STATE_ROW_KEY, payload]
  );
};

const writeDbToFile = async (payload: string) => {
  await fsPromises.writeFile(DB_FILE, payload, "utf-8");
};

const migrateLegacyWorkbookCollections = async (payload: MockDb) => {
  if (storageDriver !== "postgres") return false;
  if (
    payload.workbookEvents.length === 0 &&
    payload.workbookSnapshots.length === 0 &&
    payload.workbookAccessLogs.length === 0
  ) {
    return false;
  }

  const pool = await ensurePgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (payload.workbookEvents.length > 0) {
      const sortedEvents = [...payload.workbookEvents].sort((left, right) => {
        if (left.sessionId !== right.sessionId) {
          return left.sessionId.localeCompare(right.sessionId);
        }
        return left.seq - right.seq;
      });
      const maxSeqBySession = new Map<string, number>();
      for (const event of sortedEvents) {
        const parsedPayload = safeParseJson(event.payload, null);
        await client.query(
          `
            INSERT INTO ${EVENT_TABLE}
              (id, session_id, seq, author_user_id, type, payload, created_at)
            VALUES
              ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
            ON CONFLICT (id) DO NOTHING
          `,
          [
            event.id,
            event.sessionId,
            event.seq,
            event.authorUserId,
            event.type,
            JSON.stringify(parsedPayload),
            event.createdAt,
          ]
        );
        const currentMax = maxSeqBySession.get(event.sessionId) ?? 0;
        if (event.seq > currentMax) {
          maxSeqBySession.set(event.sessionId, event.seq);
        }
      }

      for (const [sessionId, maxSeq] of maxSeqBySession.entries()) {
        await client.query(
          `
            INSERT INTO ${EVENT_SEQ_TABLE} (session_id, last_seq, updated_at)
            VALUES ($1, $2, now())
            ON CONFLICT (session_id)
            DO UPDATE SET
              last_seq = GREATEST(${EVENT_SEQ_TABLE}.last_seq, EXCLUDED.last_seq),
              updated_at = now()
          `,
          [sessionId, maxSeq]
        );
      }
    }

    if (payload.workbookSnapshots.length > 0) {
      const sortedSnapshots = [...payload.workbookSnapshots].sort((left, right) => {
        if (left.sessionId !== right.sessionId) {
          return left.sessionId.localeCompare(right.sessionId);
        }
        if (left.layer !== right.layer) {
          return left.layer.localeCompare(right.layer);
        }
        return left.version - right.version;
      });
      for (const snapshot of sortedSnapshots) {
        const parsedPayload = safeParseJson(snapshot.payload, null);
        await client.query(
          `
            INSERT INTO ${SNAPSHOT_TABLE}
              (id, session_id, layer, version, payload, created_at)
            VALUES
              ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)
            ON CONFLICT (session_id, layer)
            DO UPDATE SET
              id = EXCLUDED.id,
              version = EXCLUDED.version,
              payload = EXCLUDED.payload,
              created_at = EXCLUDED.created_at
          `,
          [
            snapshot.id,
            snapshot.sessionId,
            snapshot.layer,
            snapshot.version,
            JSON.stringify(parsedPayload),
            snapshot.createdAt,
          ]
        );
      }
    }

    if (payload.workbookAccessLogs.length > 0) {
      const sortedAccessLogs = [...payload.workbookAccessLogs].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      );
      for (const accessLog of sortedAccessLogs) {
        const details = safeParseJson(accessLog.details, {});
        await client.query(
          `
            INSERT INTO ${ACCESS_LOG_TABLE}
              (
                id,
                session_id,
                event_type,
                actor_user_id,
                actor_role,
                actor_name,
                invite_token_hash,
                device_id_hash,
                user_agent_hash,
                ip_hash,
                user_agent_family,
                device_class,
                details,
                created_at
              )
            VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13::jsonb,
                $14::timestamptz
              )
            ON CONFLICT (id) DO NOTHING
          `,
          [
            accessLog.id,
            accessLog.sessionId,
            normalizeAccessEventType(accessLog.eventType),
            normalizeNullableText(accessLog.actorUserId, 160),
            normalizeNullableText(accessLog.actorRole, 24) === "teacher" ||
            normalizeNullableText(accessLog.actorRole, 24) === "student"
              ? normalizeNullableText(accessLog.actorRole, 24)
              : null,
            normalizeNullableText(accessLog.actorName, 200),
            normalizeNullableText(accessLog.inviteTokenHash, 128),
            normalizeNullableText(accessLog.deviceIdHash, 128),
            normalizeNullableText(accessLog.userAgentHash, 128),
            normalizeNullableText(accessLog.ipHash, 128),
            normalizeNullableText(accessLog.userAgentFamily, 120),
            normalizeAccessDeviceClass(accessLog.deviceClass),
            JSON.stringify(details),
            normalizeAccessCreatedAt(accessLog.createdAt),
          ]
        );
      }
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const persistNow = () => {
  if (!db || !dbInitialized) return;
  if (persistInFlight) {
    persistRequestedWhileWriting = true;
    return;
  }
  persistInFlight = true;
  const payload = JSON.stringify(db);
  const attempt = async () => {
    if (storageDriver === "postgres") {
      await writeDbToPostgres(payload);
      return;
    }
    await writeDbToFile(payload);
  };
  void attempt()
    .catch(async (error) => {
      storageError = normalizeError(error);
      if (storageDriver === "postgres" && !isPostgresRequired()) {
        storageDriver = "file";
        await writeDbToFile(payload);
      }
    })
    .finally(() => {
      persistInFlight = false;
      if (persistRequestedWhileWriting) {
        persistRequestedWhileWriting = false;
        persistNow();
      }
    });
};

const schedulePersist = () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
};

export const getDb = (): MockDb => {
  if (!db) return ensureShape(createDefaultDb());
  return db;
};

export const saveDb = () => {
  if (!db || !dbInitialized) return;
  schedulePersist();
};

export const resetDb = () => {
  db = createDefaultDb();
  clearWorkbookLatestSeqCache();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!dbInitialized) return;
  persistNow();
};

export const initializeDb = async () => {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    let loaded: MockDb | null = null;
    if (shouldUsePostgres()) {
      try {
        loaded = await readDbFromPostgres();
        storageDriver = "postgres";
      } catch (error) {
        storageError = normalizeError(error);
        if (isPostgresRequired()) {
          throw error;
        }
        storageDriver = "file";
      }
    }
    if (!loaded) {
      loaded = await readDbFile();
      if (storageDriver === "postgres") {
        // First boot in postgres mode: bootstrap row from file payload.
        try {
          await writeDbToPostgres(JSON.stringify(loaded, null, 2));
        } catch (error) {
          storageError = normalizeError(error);
          if (isPostgresRequired()) {
            throw error;
          }
          storageDriver = "file";
        }
      }
    }

    if (storageDriver === "postgres") {
      try {
        const migrated = await migrateLegacyWorkbookCollections(loaded);
        if (migrated) {
          loaded.workbookEvents = [];
          loaded.workbookSnapshots = [];
          loaded.workbookAccessLogs = [];
          await writeDbToPostgres(JSON.stringify(loaded, null, 2));
        }
      } catch (error) {
        storageError = normalizeError(error);
        if (isPostgresRequired()) {
          throw error;
        }
      }
    }

    db = ensureShape(loaded);
    clearWorkbookLatestSeqCache();
    dbInitialized = true;
    ensureAccessLogCleanupTimer();
    try {
      await purgeWorkbookAccessLogs({ olderThanDays: ACCESS_LOG_RETENTION_DAYS });
    } catch (error) {
      storageError = normalizeError(error);
      if (isPostgresRequired()) {
        throw error;
      }
    }
  })().finally(() => {
    dbInitPromise = null;
  });
  return dbInitPromise;
};

const normalizeSeq = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const normalizeLimit = (value: number | undefined) => {
  if (!Number.isFinite(value)) return WORKBOOK_EVENT_LIMIT;
  return Math.max(1, Math.min(5_000, Math.floor(value ?? WORKBOOK_EVENT_LIMIT)));
};

const resolveSnapshotTrimBarrierSeq = (localDb: MockDb, sessionId: string) => {
  const boardSnapshot = localDb.workbookSnapshots
    .filter((snapshot) => snapshot.sessionId === sessionId && snapshot.layer === "board")
    .sort((left, right) => right.version - left.version)[0];
  const annotationsSnapshot = localDb.workbookSnapshots
    .filter((snapshot) => snapshot.sessionId === sessionId && snapshot.layer === "annotations")
    .sort((left, right) => right.version - left.version)[0];
  if (!boardSnapshot || !annotationsSnapshot) return 0;
  return Math.max(0, Math.min(boardSnapshot.version, annotationsSnapshot.version));
};

const normalizeClientEventId = (value: string | undefined) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 160);
};

const workbookAccessEventTypeSet = new Set<WorkbookAccessEventType>([
  "invite_resolved",
  "invite_joined",
  "invite_join_denied",
  "presence_started",
  "presence_ended",
  "session_opened",
]);

const workbookAccessDeviceClassSet = new Set<WorkbookAccessDeviceClass>([
  "desktop",
  "mobile",
  "tablet",
  "bot",
  "unknown",
]);

const normalizeAccessLogLimit = (value: number | undefined) => {
  if (!Number.isFinite(value)) return WORKBOOK_ACCESS_LOG_DEFAULT_LIMIT;
  return Math.max(1, Math.min(300, Math.floor(value ?? WORKBOOK_ACCESS_LOG_DEFAULT_LIMIT)));
};

const normalizeAccessEventType = (value: unknown): WorkbookAccessEventType => {
  if (typeof value === "string" && workbookAccessEventTypeSet.has(value as WorkbookAccessEventType)) {
    return value as WorkbookAccessEventType;
  }
  return "invite_resolved";
};

const normalizeAccessDeviceClass = (value: unknown): WorkbookAccessDeviceClass | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (workbookAccessDeviceClassSet.has(normalized as WorkbookAccessDeviceClass)) {
    return normalized as WorkbookAccessDeviceClass;
  }
  return "unknown";
};

const normalizeNullableText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeAccessCreatedAt = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return nowIso();
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return nowIso();
  return new Date(parsed).toISOString();
};

const normalizeAccessDetails = (value: unknown): unknown => {
  if (value === null || value === undefined) return {};
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? { message: normalized.slice(0, 600) } : {};
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return { value };
  }
  if (typeof value === "object") return value;
  return { value: String(value) };
};

const serializeAccessDetails = (value: unknown) => {
  try {
    return JSON.stringify(normalizeAccessDetails(value));
  } catch {
    return JSON.stringify({ value: "unserializable_details" });
  }
};

export const readWorkbookSessionEvents = async (params: {
  sessionId: string;
  afterSeq: number;
  limit?: number;
}): Promise<{ events: PersistedWorkbookEvent[]; latestSeq: number }> => {
  const sessionId = params.sessionId;
  const afterSeq = normalizeSeq(params.afterSeq);
  const limit = normalizeLimit(params.limit);

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const [eventsResult, latestResult] = await Promise.all([
      pool.query<PgWorkbookEventRow>(
        `
          SELECT id, session_id, seq, author_user_id, type, payload, created_at
          FROM ${EVENT_TABLE}
          WHERE session_id = $1 AND seq > $2
          ORDER BY seq ASC
          LIMIT $3
        `,
        [sessionId, afterSeq, limit]
      ),
      pool.query<{ last_seq: string | number }>(
        `SELECT last_seq FROM ${EVENT_SEQ_TABLE} WHERE session_id = $1 LIMIT 1`,
        [sessionId]
      ),
    ]);

    const events = eventsResult.rows.map(mapPgEvent);

    const latestSeq = Math.max(
      afterSeq,
      Number(latestResult.rows[0]?.last_seq ?? 0),
      events[events.length - 1]?.seq ?? 0
    );
    setWorkbookSessionLatestSeqCached(sessionId, latestSeq);

    return { events, latestSeq };
  }

  const localDb = getDb();
  const sessionEvents = localDb.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => left.seq - right.seq);
  const latestSeq = Math.max(afterSeq, sessionEvents[sessionEvents.length - 1]?.seq ?? 0);
  const events = sessionEvents
    .filter((event) => event.seq > afterSeq)
    .slice(-limit)
    .map(mapFileEvent);
  setWorkbookSessionLatestSeqCached(sessionId, latestSeq);

  return {
    events,
    latestSeq,
  };
};

export const getWorkbookSessionLatestSeq = async (sessionId: string): Promise<number> => {
  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const result = await pool.query<{ last_seq: string | number }>(
      `SELECT last_seq FROM ${EVENT_SEQ_TABLE} WHERE session_id = $1 LIMIT 1`,
      [sessionId]
    );
    const latestSeq = Number(result.rows[0]?.last_seq ?? 0);
    setWorkbookSessionLatestSeqCached(sessionId, latestSeq);
    return latestSeq;
  }

  const localDb = getDb();
  return readWorkbookSessionLatestSeqCached(sessionId, () =>
    localDb.workbookEvents
      .filter((event) => event.sessionId === sessionId)
      .reduce((max, event) => Math.max(max, event.seq), 0)
  );
};

export const appendWorkbookSessionEvents = async (params: {
  sessionId: string;
  authorUserId: string;
  events: WorkbookEventInput[];
  limit?: number;
}): Promise<{ events: PersistedWorkbookEvent[]; latestSeq: number; timestamp: string }> => {
  const sessionId = params.sessionId;
  const timestamp = nowIso();
  const events = params.events
    .filter((event) => typeof event.type === "string")
    .map((event) => ({
      ...event,
      clientEventId: normalizeClientEventId(event.clientEventId),
    }));
  const limit = normalizeLimit(params.limit);
  if (events.length === 0) {
    const current = await readWorkbookSessionEvents({
      sessionId,
      afterSeq: 0,
      limit: 1,
    });
    return {
      events: [],
      latestSeq: current.latestSeq,
      timestamp,
    };
  }

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO ${EVENT_SEQ_TABLE} (session_id, last_seq, updated_at)
          VALUES ($1, 0, now())
          ON CONFLICT (session_id) DO NOTHING
        `,
        [sessionId]
      );

      const seqResult = await client.query<{ last_seq: string | number }>(
        `SELECT last_seq FROM ${EVENT_SEQ_TABLE} WHERE session_id = $1 FOR UPDATE`,
        [sessionId]
      );
      const currentMaxSeq = Number(seqResult.rows[0]?.last_seq ?? 0);
      const preparedEvents = events.map((event) => ({
        eventId: event.clientEventId ?? ensureId(),
        type: event.type,
        payloadRaw: JSON.stringify(event.payload ?? null),
      }));
      const inputEventIds = Array.from(new Set(preparedEvents.map((event) => event.eventId)));
      const existingRowsResult =
        inputEventIds.length > 0
          ? await client.query<PgWorkbookEventRow>(
              `
                SELECT id, session_id, seq, author_user_id, type, payload, created_at
                FROM ${EVENT_TABLE}
                WHERE id = ANY($1::text[])
              `,
              [inputEventIds]
            )
          : { rows: [] as PgWorkbookEventRow[], rowCount: 0 };
      const existingRowsById = new Map(existingRowsResult.rows.map((row) => [row.id, row]));

      type ResolvedEventPlan = {
        sourceEventId: string;
        eventId: string;
        resolutionType: "existing" | "insert";
      };

      const resolvedBySourceEventId = new Map<string, ResolvedEventPlan>();
      const orderedPlans: ResolvedEventPlan[] = [];
      const insertCandidates: Array<{
        id: string;
        seq: number;
        type: string;
        payloadRaw: string;
      }> = [];
      let nextSeq = currentMaxSeq;
      for (const event of preparedEvents) {
        const duplicatePlan = resolvedBySourceEventId.get(event.eventId);
        if (duplicatePlan) {
          orderedPlans.push(duplicatePlan);
          continue;
        }

        const existing = existingRowsById.get(event.eventId);
        if (existing && existing.session_id === sessionId) {
          const plan: ResolvedEventPlan = {
            sourceEventId: event.eventId,
            eventId: existing.id,
            resolutionType: "existing",
          };
          resolvedBySourceEventId.set(event.eventId, plan);
          orderedPlans.push(plan);
          continue;
        }

        nextSeq += 1;
        const resolvedEventId =
          existing && existing.session_id !== sessionId ? ensureId() : event.eventId;
        const plan: ResolvedEventPlan = {
          sourceEventId: event.eventId,
          eventId: resolvedEventId,
          resolutionType: "insert",
        };
        resolvedBySourceEventId.set(event.eventId, plan);
        orderedPlans.push(plan);
        insertCandidates.push({
          id: resolvedEventId,
          seq: nextSeq,
          type: event.type,
          payloadRaw: event.payloadRaw,
        });
      }

      const insertedRowsById = new Map<string, PgWorkbookEventRow>();
      if (insertCandidates.length > 0) {
        const valuesSql: string[] = [];
        const valuesParams: unknown[] = [];
        let placeholder = 1;
        for (const candidate of insertCandidates) {
          valuesSql.push(
            `($${placeholder}, $${placeholder + 1}, $${placeholder + 2}, $${placeholder + 3}, $${placeholder + 4}, $${placeholder + 5}::jsonb, $${placeholder + 6}::timestamptz)`
          );
          valuesParams.push(
            candidate.id,
            sessionId,
            candidate.seq,
            params.authorUserId,
            candidate.type,
            candidate.payloadRaw,
            timestamp
          );
          placeholder += 7;
        }
        const insertedRowsResult = await client.query<PgWorkbookEventRow>(
          `
            INSERT INTO ${EVENT_TABLE}
              (id, session_id, seq, author_user_id, type, payload, created_at)
            VALUES
              ${valuesSql.join(", ")}
            ON CONFLICT (id) DO NOTHING
            RETURNING id, session_id, seq, author_user_id, type, payload, created_at
          `,
          valuesParams
        );
        insertedRowsResult.rows.forEach((row) => {
          insertedRowsById.set(row.id, row);
        });

        if (insertedRowsById.size < insertCandidates.length) {
          const missingIds = insertCandidates
            .map((candidate) => candidate.id)
            .filter((id) => !insertedRowsById.has(id));
          if (missingIds.length > 0) {
            const fetchedMissingResult = await client.query<PgWorkbookEventRow>(
              `
                SELECT id, session_id, seq, author_user_id, type, payload, created_at
                FROM ${EVENT_TABLE}
                WHERE id = ANY($1::text[])
              `,
              [missingIds]
            );
            fetchedMissingResult.rows.forEach((row) => {
              insertedRowsById.set(row.id, row);
            });
          }
        }
      }

      const appended: PersistedWorkbookEvent[] = [];
      const appendedEventIds = new Set<string>();
      orderedPlans.forEach((plan) => {
        const row =
          plan.resolutionType === "existing"
            ? existingRowsById.get(plan.eventId)
            : insertedRowsById.get(plan.eventId) ?? existingRowsById.get(plan.eventId);
        if (!row || row.session_id !== sessionId) return;
        if (appendedEventIds.has(row.id)) return;
        appendedEventIds.add(row.id);
        appended.push(mapPgEvent(row));
      });
      const latestSeq = appended.reduce((max, event) => Math.max(max, event.seq), currentMaxSeq);

      await client.query(
        `
          UPDATE ${EVENT_SEQ_TABLE}
          SET last_seq = $2, updated_at = now()
          WHERE session_id = $1
        `,
        [sessionId, latestSeq]
      );

      await client.query("COMMIT");
      setWorkbookSessionLatestSeqCached(sessionId, latestSeq);
      schedulePostgresEventTrim(sessionId, limit);
      return {
        events: appended,
        latestSeq,
        timestamp,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  const localDb = getDb();
  const sessionEvents = localDb.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => left.seq - right.seq);
  const existingById = new Map(sessionEvents.map((event) => [event.id, event]));
  let latestSeq = sessionEvents[sessionEvents.length - 1]?.seq ?? 0;
  const appended: PersistedWorkbookEvent[] = [];
  const appendedEventIds = new Set<string>();
  for (const event of events) {
    const eventId = event.clientEventId ?? ensureId();
    const existing = existingById.get(eventId);
    if (existing) {
      latestSeq = Math.max(latestSeq, existing.seq);
      if (!appendedEventIds.has(existing.id)) {
        appended.push(mapFileEvent(existing));
        appendedEventIds.add(existing.id);
      }
      continue;
    }
    const nextSeq = latestSeq + 1;
    const record: WorkbookEventRecord = {
      id: eventId,
      sessionId,
      seq: nextSeq,
      authorUserId: params.authorUserId,
      type: event.type,
      payload: JSON.stringify(event.payload ?? null),
      createdAt: timestamp,
    };
    localDb.workbookEvents.push(record);
    existingById.set(eventId, record);
    latestSeq = nextSeq;
    appended.push(mapFileEvent(record));
    appendedEventIds.add(record.id);
  }

  const sortedSessionEvents = localDb.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => left.seq - right.seq);
  if (sortedSessionEvents.length > limit) {
    const barrierSeq = resolveSnapshotTrimBarrierSeq(localDb, sessionId);
    const overflow = sortedSessionEvents.length - limit;
    const overflowIds = new Set(
      sortedSessionEvents
        .slice(0, overflow)
        .filter((event) => event.seq <= barrierSeq)
        .map((event) => event.id)
    );
    localDb.workbookEvents = localDb.workbookEvents.filter((event) => !overflowIds.has(event.id));
  }
  setWorkbookSessionLatestSeqCached(sessionId, latestSeq);

  saveDb();

  return {
    events: appended,
    latestSeq,
    timestamp,
  };
};

export const appendWorkbookSessionEventsWithKnownSeq = async (params: {
  sessionId: string;
  events: PersistedWorkbookEvent[];
  latestSeq: number;
  limit?: number;
}) => {
  const sessionId = params.sessionId;
  const limit = normalizeLimit(params.limit);
  const normalizedEvents = params.events
    .filter(
      (event) =>
        event &&
        typeof event.id === "string" &&
        typeof event.type === "string" &&
        Number.isFinite(event.seq)
    )
    .map((event) => ({
      ...event,
      seq: Math.max(0, Math.floor(event.seq)),
      payload: event.payload ?? null,
      createdAt: typeof event.createdAt === "string" ? event.createdAt : nowIso(),
    }))
    .sort((left, right) => left.seq - right.seq);

  const computedLatestSeq = Math.max(
    Number.isFinite(params.latestSeq) ? Math.floor(params.latestSeq) : 0,
    normalizedEvents[normalizedEvents.length - 1]?.seq ?? 0
  );

  if (normalizedEvents.length === 0) {
    if (storageDriver === "postgres") {
      const pool = await ensurePgPool();
      await pool.query(
        `
          INSERT INTO ${EVENT_SEQ_TABLE} (session_id, last_seq, updated_at)
          VALUES ($1, $2, now())
          ON CONFLICT (session_id)
          DO UPDATE SET
            last_seq = GREATEST(${EVENT_SEQ_TABLE}.last_seq, EXCLUDED.last_seq),
            updated_at = now()
        `,
        [sessionId, computedLatestSeq]
      );
      setWorkbookSessionLatestSeqCached(sessionId, computedLatestSeq);
      return;
    }
    setWorkbookSessionLatestSeqCached(sessionId, computedLatestSeq);
    return;
  }

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO ${EVENT_SEQ_TABLE} (session_id, last_seq, updated_at)
          VALUES ($1, $2, now())
          ON CONFLICT (session_id)
          DO UPDATE SET
            last_seq = GREATEST(${EVENT_SEQ_TABLE}.last_seq, EXCLUDED.last_seq),
            updated_at = now()
        `,
        [sessionId, computedLatestSeq]
      );

      if (normalizedEvents.length > 0) {
        const valuesSql: string[] = [];
        const valuesParams: unknown[] = [];
        let placeholder = 1;
        for (const event of normalizedEvents) {
          valuesSql.push(
            `($${placeholder}, $${placeholder + 1}, $${placeholder + 2}, $${placeholder + 3}, $${placeholder + 4}, $${placeholder + 5}::jsonb, $${placeholder + 6}::timestamptz)`
          );
          valuesParams.push(
            event.id,
            sessionId,
            event.seq,
            event.authorUserId,
            event.type,
            JSON.stringify(event.payload ?? null),
            event.createdAt
          );
          placeholder += 7;
        }
        await client.query(
          `
            INSERT INTO ${EVENT_TABLE}
              (id, session_id, seq, author_user_id, type, payload, created_at)
            VALUES
              ${valuesSql.join(", ")}
            ON CONFLICT (id) DO NOTHING
          `,
          valuesParams
        );
      }

      await client.query("COMMIT");
      setWorkbookSessionLatestSeqCached(sessionId, computedLatestSeq);
      schedulePostgresEventTrim(sessionId, limit);
      return;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  const localDb = getDb();
  const existingIds = new Set(
    localDb.workbookEvents.filter((event) => event.sessionId === sessionId).map((event) => event.id)
  );
  for (const event of normalizedEvents) {
    if (existingIds.has(event.id)) continue;
    localDb.workbookEvents.push({
      id: event.id,
      sessionId,
      seq: event.seq,
      authorUserId: event.authorUserId,
      type: event.type,
      payload: JSON.stringify(event.payload ?? null),
      createdAt: event.createdAt,
    });
  }

  const sessionEvents = localDb.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => left.seq - right.seq);
  if (sessionEvents.length > limit) {
    const barrierSeq = resolveSnapshotTrimBarrierSeq(localDb, sessionId);
    const overflow = sessionEvents.length - limit;
    const overflowIds = new Set(
      sessionEvents
        .slice(0, overflow)
        .filter((event) => event.seq <= barrierSeq)
        .map((event) => event.id)
    );
    localDb.workbookEvents = localDb.workbookEvents.filter((event) => !overflowIds.has(event.id));
  }
  setWorkbookSessionLatestSeqCached(sessionId, computedLatestSeq);
  saveDb();
};

export const readWorkbookSessionSnapshot = async (params: {
  sessionId: string;
  layer: "board" | "annotations";
}): Promise<PersistedWorkbookSnapshot | null> => {
  const { sessionId, layer } = params;

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const result = await pool.query<{
      id: string;
      session_id: string;
      layer: "board" | "annotations";
      version: string | number;
      payload: unknown;
      created_at: Date | string;
    }>(
      `
        SELECT id, session_id, layer, version, payload, created_at
        FROM ${SNAPSHOT_TABLE}
        WHERE session_id = $1 AND layer = $2
        LIMIT 1
      `,
      [sessionId, layer]
    );

    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      sessionId: row.session_id,
      layer: row.layer,
      version: Number(row.version),
      payload: row.payload ?? null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  const localDb = getDb();
  const snapshot = localDb.workbookSnapshots
    .filter((item) => item.sessionId === sessionId && item.layer === layer)
    .sort((left, right) => right.version - left.version)[0];

  return snapshot ? mapFileSnapshot(snapshot) : null;
};

export const upsertWorkbookSessionSnapshot = async (params: {
  sessionId: string;
  layer: "board" | "annotations";
  version: number;
  payload: unknown;
}): Promise<PersistedWorkbookSnapshot> => {
  const sessionId = params.sessionId;
  const layer = params.layer;
  const version = Number.isFinite(params.version) && params.version > 0 ? Math.floor(params.version) : 1;
  const payload = params.payload ?? null;
  const timestamp = nowIso();

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const snapshotId = ensureId();
    const result = await pool.query<PgWorkbookSnapshotRow>(
      `
        INSERT INTO ${SNAPSHOT_TABLE}
          (id, session_id, layer, version, payload, created_at)
        VALUES
          ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)
        ON CONFLICT (session_id, layer)
        DO UPDATE SET
          id = EXCLUDED.id,
          version = EXCLUDED.version,
          payload = EXCLUDED.payload,
          created_at = EXCLUDED.created_at
        WHERE EXCLUDED.version >= ${SNAPSHOT_TABLE}.version
        RETURNING id, session_id, layer, version, payload, created_at
      `,
      [snapshotId, sessionId, layer, version, JSON.stringify(payload), timestamp]
    );

    const row = result.rows[0];
    if (row) {
      return mapPgSnapshot(row);
    }

    const currentResult = await pool.query<PgWorkbookSnapshotRow>(
      `
        SELECT id, session_id, layer, version, payload, created_at
        FROM ${SNAPSHOT_TABLE}
        WHERE session_id = $1 AND layer = $2
        LIMIT 1
      `,
      [sessionId, layer]
    );
    const current = currentResult.rows[0];
    if (current) {
      return mapPgSnapshot(current);
    }
    throw new Error("Snapshot upsert failed");
  }

  const localDb = getDb();
  const existing = localDb.workbookSnapshots.find(
    (item) => item.sessionId === sessionId && item.layer === layer
  );

  let snapshot: WorkbookSnapshotRecord;
  if (existing) {
    if (version < existing.version) {
      return mapFileSnapshot(existing);
    }
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
    localDb.workbookSnapshots.push(snapshot);
  }

  saveDb();
  return mapFileSnapshot(snapshot);
};

export const copyWorkbookSessionSnapshots = async (params: {
  sourceSessionId: string;
  targetSessionId: string;
  createdAt?: string;
}) => {
  const { sourceSessionId, targetSessionId } = params;
  const createdAt = typeof params.createdAt === "string" && params.createdAt.trim().length > 0
    ? params.createdAt
    : nowIso();

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const sourceSnapshots = await pool.query<{
      layer: "board" | "annotations";
      version: string | number;
      payload: unknown;
    }>(
      `
        SELECT layer, version, payload
        FROM ${SNAPSHOT_TABLE}
        WHERE session_id = $1
      `,
      [sourceSessionId]
    );

    for (const row of sourceSnapshots.rows) {
      await pool.query(
        `
          INSERT INTO ${SNAPSHOT_TABLE}
            (id, session_id, layer, version, payload, created_at)
          VALUES
            ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)
          ON CONFLICT (session_id, layer)
          DO UPDATE SET
            id = EXCLUDED.id,
            version = EXCLUDED.version,
            payload = EXCLUDED.payload,
            created_at = EXCLUDED.created_at
        `,
        [
          ensureId(),
          targetSessionId,
          row.layer,
          Number(row.version),
          JSON.stringify(row.payload ?? null),
          createdAt,
        ]
      );
    }
    return;
  }

  const localDb = getDb();
  const sourceSnapshots = localDb.workbookSnapshots.filter(
    (item) => item.sessionId === sourceSessionId
  );

  sourceSnapshots.forEach((snapshot) => {
    localDb.workbookSnapshots.push({
      ...snapshot,
      id: ensureId(),
      sessionId: targetSessionId,
      createdAt,
    });
  });
  if (sourceSnapshots.length > 0) {
    saveDb();
  }
};

export const appendWorkbookAccessLog = async (
  params: WorkbookAccessLogInput
): Promise<WorkbookAccessLogEntry> => {
  const sessionId = normalizeNullableText(params.sessionId, 160);
  if (!sessionId) {
    throw new Error("session_id is required for workbook access log");
  }
  const createdAt = normalizeAccessCreatedAt(params.createdAt);
  const eventType = normalizeAccessEventType(params.eventType);
  const actorUserId = normalizeNullableText(params.actorUserId, 160);
  const actorRoleRaw = normalizeNullableText(params.actorRole, 24);
  const actorRole = actorRoleRaw === "teacher" || actorRoleRaw === "student" ? actorRoleRaw : null;
  const actorName = normalizeNullableText(params.actorName, 200);
  const inviteTokenHash = normalizeNullableText(params.inviteTokenHash, 128);
  const deviceIdHash = normalizeNullableText(params.deviceIdHash, 128);
  const userAgentHash = normalizeNullableText(params.userAgentHash, 128);
  const ipHash = normalizeNullableText(params.ipHash, 128);
  const userAgentFamily = normalizeNullableText(params.userAgentFamily, 120);
  const deviceClass = normalizeAccessDeviceClass(params.deviceClass);
  const details = normalizeAccessDetails(params.details);

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const result = await pool.query<PgWorkbookAccessLogRow>(
      `
        INSERT INTO ${ACCESS_LOG_TABLE}
          (
            id,
            session_id,
            event_type,
            actor_user_id,
            actor_role,
            actor_name,
            invite_token_hash,
            device_id_hash,
            user_agent_hash,
            ip_hash,
            user_agent_family,
            device_class,
            details,
            created_at
          )
        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13::jsonb,
            $14::timestamptz
          )
        RETURNING
          id,
          session_id,
          event_type,
          actor_user_id,
          actor_role,
          actor_name,
          invite_token_hash,
          device_id_hash,
          user_agent_hash,
          ip_hash,
          user_agent_family,
          device_class,
          details,
          created_at
      `,
      [
        ensureId(),
        sessionId,
        eventType,
        actorUserId,
        actorRole,
        actorName,
        inviteTokenHash,
        deviceIdHash,
        userAgentHash,
        ipHash,
        userAgentFamily,
        deviceClass,
        JSON.stringify(details),
        createdAt,
      ]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("access_log_insert_failed");
    }
    return mapPgAccessLog(row);
  }

  const localDb = getDb();
  const record: WorkbookAccessLogRecord = {
    id: ensureId(),
    sessionId,
    eventType,
    actorUserId,
    actorRole,
    actorName,
    inviteTokenHash,
    deviceIdHash,
    userAgentHash,
    ipHash,
    userAgentFamily,
    deviceClass,
    details: serializeAccessDetails(details),
    createdAt,
  };
  localDb.workbookAccessLogs.push(record);
  saveDb();
  return mapFileAccessLog(record);
};

export const readWorkbookSessionAccessLogs = async (params: {
  sessionId: string;
  limit?: number;
}): Promise<WorkbookAccessLogEntry[]> => {
  const sessionId = normalizeNullableText(params.sessionId, 160);
  if (!sessionId) return [];
  const limit = normalizeAccessLogLimit(params.limit);

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const result = await pool.query<PgWorkbookAccessLogRow>(
      `
        SELECT
          id,
          session_id,
          event_type,
          actor_user_id,
          actor_role,
          actor_name,
          invite_token_hash,
          device_id_hash,
          user_agent_hash,
          ip_hash,
          user_agent_family,
          device_class,
          details,
          created_at
        FROM ${ACCESS_LOG_TABLE}
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [sessionId, limit]
    );
    return result.rows.map(mapPgAccessLog);
  }

  const localDb = getDb();
  return localDb.workbookAccessLogs
    .filter((entry) => entry.sessionId === sessionId)
    .sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, limit)
    .map(mapFileAccessLog);
};

export const deleteWorkbookSessionAccessLogs = async (sessionId: string) => {
  const normalizedSessionId = normalizeNullableText(sessionId, 160);
  if (!normalizedSessionId) return;

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    await pool.query(`DELETE FROM ${ACCESS_LOG_TABLE} WHERE session_id = $1`, [normalizedSessionId]);
    return;
  }

  const localDb = getDb();
  const initialLength = localDb.workbookAccessLogs.length;
  localDb.workbookAccessLogs = localDb.workbookAccessLogs.filter(
    (entry) => entry.sessionId !== normalizedSessionId
  );
  if (localDb.workbookAccessLogs.length !== initialLength) {
    saveDb();
  }
};

export const purgeWorkbookAccessLogs = async (params?: {
  olderThanDays?: number;
}): Promise<{ deleted: number; retentionDays: number }> => {
  const requestedDays = Number.isFinite(params?.olderThanDays)
    ? Math.floor(params?.olderThanDays ?? ACCESS_LOG_RETENTION_DAYS)
    : ACCESS_LOG_RETENTION_DAYS;
  const retentionDays = Math.max(1, Math.min(3650, requestedDays));
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoffDate.toISOString();

  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    const result = await pool.query<{ id: string }>(
      `DELETE FROM ${ACCESS_LOG_TABLE} WHERE created_at < $1 RETURNING id`,
      [cutoffIso]
    );
    return {
      deleted: result.rowCount ?? result.rows.length,
      retentionDays,
    };
  }

  const localDb = getDb();
  const next = localDb.workbookAccessLogs.filter(
    (entry) => new Date(entry.createdAt).getTime() >= cutoffDate.getTime()
  );
  const deleted = localDb.workbookAccessLogs.length - next.length;
  if (deleted > 0) {
    localDb.workbookAccessLogs = next;
    saveDb();
  }
  return {
    deleted,
    retentionDays,
  };
};

const ensureAccessLogCleanupTimer = () => {
  if (accessLogCleanupTimer) return;
  accessLogCleanupTimer = setInterval(() => {
    void purgeWorkbookAccessLogs({ olderThanDays: ACCESS_LOG_RETENTION_DAYS }).catch((error) => {
      storageError = normalizeError(error);
    });
  }, ACCESS_LOG_CLEANUP_INTERVAL_MS);
  accessLogCleanupTimer.unref?.();
};

export const deleteWorkbookSessionArtifacts = async (sessionId: string) => {
  const pendingTrimTimer = postgresEventTrimTimerBySession.get(sessionId);
  if (pendingTrimTimer) {
    clearTimeout(pendingTrimTimer);
    postgresEventTrimTimerBySession.delete(sessionId);
  }
  clearWorkbookSessionLatestSeqCached(sessionId);
  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    await Promise.all([
      pool.query(`DELETE FROM ${EVENT_TABLE} WHERE session_id = $1`, [sessionId]),
      pool.query(`DELETE FROM ${SNAPSHOT_TABLE} WHERE session_id = $1`, [sessionId]),
      pool.query(`DELETE FROM ${EVENT_SEQ_TABLE} WHERE session_id = $1`, [sessionId]),
      pool.query(`DELETE FROM ${ACCESS_LOG_TABLE} WHERE session_id = $1`, [sessionId]),
    ]);
    return;
  }

  const localDb = getDb();
  localDb.workbookEvents = localDb.workbookEvents.filter((item) => item.sessionId !== sessionId);
  localDb.workbookSnapshots = localDb.workbookSnapshots.filter(
    (item) => item.sessionId !== sessionId
  );
  localDb.workbookAccessLogs = localDb.workbookAccessLogs.filter(
    (item) => item.sessionId !== sessionId
  );
  saveDb();
};

export const getStorageDiagnostics = () => ({
  driver: storageDriver,
  preferredDriver: resolveStoragePreference(),
  required: isPostgresRequired(),
  ready: dbInitialized,
  databaseUrlConfigured: DATABASE_URL.length > 0,
  accessLogRetentionDays: ACCESS_LOG_RETENTION_DAYS,
  lastError: storageError,
});

export const shutdownDb = async () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  postgresEventTrimTimerBySession.forEach((timer) => {
    clearTimeout(timer);
  });
  postgresEventTrimTimerBySession.clear();
  if (accessLogCleanupTimer) {
    clearInterval(accessLogCleanupTimer);
    accessLogCleanupTimer = null;
  }
  clearWorkbookLatestSeqCache();
  if (pgPool) {
    await pgPool.end().catch(() => undefined);
    pgPool = null;
  }
};
