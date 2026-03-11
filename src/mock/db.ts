import crypto from "node:crypto";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

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

export type MockDb = {
  users: UserRecord[];
  authSessions: AuthSessionRecord[];
  workbookSessions: WorkbookSessionRecord[];
  workbookParticipants: WorkbookSessionParticipantRecord[];
  workbookDrafts: WorkbookDraftRecord[];
  workbookInvites: WorkbookInviteRecord[];
  workbookEvents: WorkbookEventRecord[];
  workbookSnapshots: WorkbookSnapshotRecord[];
};

export type WorkbookEventInput = {
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
let db: MockDb | null = null;
let persistTimer: NodeJS.Timeout | null = null;
let persistInFlight = false;
let persistRequestedWhileWriting = false;
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;
let storageDriver: "file" | "postgres" = "file";
let storageError: string | null = null;
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
  workbookEvents: [],
  workbookSnapshots: [],
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
    workbookEvents: Array.isArray(source.workbookEvents)
      ? source.workbookEvents
      : base.workbookEvents,
    workbookSnapshots: Array.isArray(source.workbookSnapshots)
      ? source.workbookSnapshots
      : base.workbookSnapshots,
  };

  if (!next.users.some((user) => user.role === "teacher" && user.email === "teacher@axiom.demo")) {
    next.users.push(defaultTeacherUser());
  }

  return next;
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
  if (payload.workbookEvents.length === 0 && payload.workbookSnapshots.length === 0) {
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
      if (storageDriver === "postgres") {
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
          await writeDbToPostgres(JSON.stringify(loaded, null, 2));
        }
      } catch (error) {
        storageError = normalizeError(error);
      }
    }

    db = ensureShape(loaded);
    dbInitialized = true;
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
      pool.query<{
        id: string;
        session_id: string;
        seq: string | number;
        author_user_id: string;
        type: string;
        payload: unknown;
        created_at: Date | string;
      }>(
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

    const events = eventsResult.rows.map((row: {
      id: string;
      session_id: string;
      seq: string | number;
      author_user_id: string;
      type: string;
      payload: unknown;
      created_at: Date | string;
    }) => ({
      id: row.id,
      sessionId: row.session_id,
      seq: Number(row.seq),
      authorUserId: row.author_user_id,
      type: row.type,
      payload: row.payload ?? null,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    const latestSeq = Math.max(
      afterSeq,
      Number(latestResult.rows[0]?.last_seq ?? 0),
      events[events.length - 1]?.seq ?? 0
    );

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
    return Number(result.rows[0]?.last_seq ?? 0);
  }

  const localDb = getDb();
  return localDb.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .reduce((max, event) => Math.max(max, event.seq), 0);
};

export const appendWorkbookSessionEvents = async (params: {
  sessionId: string;
  authorUserId: string;
  events: WorkbookEventInput[];
  limit?: number;
}): Promise<{ events: PersistedWorkbookEvent[]; latestSeq: number; timestamp: string }> => {
  const sessionId = params.sessionId;
  const timestamp = nowIso();
  const events = params.events.filter((event) => typeof event.type === "string");
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

      const appended: PersistedWorkbookEvent[] = [];
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        const nextSeq = currentMaxSeq + index + 1;
        const persisted: PersistedWorkbookEvent = {
          id: ensureId(),
          sessionId,
          seq: nextSeq,
          authorUserId: params.authorUserId,
          type: event.type,
          payload: event.payload ?? null,
          createdAt: timestamp,
        };

        await client.query(
          `
            INSERT INTO ${EVENT_TABLE}
              (id, session_id, seq, author_user_id, type, payload, created_at)
            VALUES
              ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
          `,
          [
            persisted.id,
            persisted.sessionId,
            persisted.seq,
            persisted.authorUserId,
            persisted.type,
            JSON.stringify(persisted.payload),
            persisted.createdAt,
          ]
        );
        appended.push(persisted);
      }

      const latestSeq = currentMaxSeq + events.length;

      await client.query(
        `
          UPDATE ${EVENT_SEQ_TABLE}
          SET last_seq = $2, updated_at = now()
          WHERE session_id = $1
        `,
        [sessionId, latestSeq]
      );

      await client.query(
        `
          WITH boundary AS (
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
        `,
        [sessionId, Math.max(0, limit - 1)]
      );

      await client.query("COMMIT");
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
  const currentMaxSeq = localDb.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .reduce((max, event) => Math.max(max, event.seq), 0);

  const appended = events.map((event, index) => {
    const nextSeq = currentMaxSeq + index + 1;
    const record: WorkbookEventRecord = {
      id: ensureId(),
      sessionId,
      seq: nextSeq,
      authorUserId: params.authorUserId,
      type: event.type,
      payload: JSON.stringify(event.payload ?? null),
      createdAt: timestamp,
    };
    localDb.workbookEvents.push(record);
    return mapFileEvent(record);
  });

  const sessionEvents = localDb.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => left.seq - right.seq);
  if (sessionEvents.length > limit) {
    const overflow = sessionEvents.length - limit;
    const overflowIds = new Set(sessionEvents.slice(0, overflow).map((event) => event.id));
    localDb.workbookEvents = localDb.workbookEvents.filter((event) => !overflowIds.has(event.id));
  }

  saveDb();

  return {
    events: appended,
    latestSeq: appended[appended.length - 1]?.seq ?? currentMaxSeq,
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
      return;
    }
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

      for (const event of normalizedEvents) {
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
            sessionId,
            event.seq,
            event.authorUserId,
            event.type,
            JSON.stringify(event.payload ?? null),
            event.createdAt,
          ]
        );
      }

      await client.query(
        `
          WITH boundary AS (
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
        `,
        [sessionId, Math.max(0, limit - 1)]
      );

      await client.query("COMMIT");
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
    const overflow = sessionEvents.length - limit;
    const overflowIds = new Set(sessionEvents.slice(0, overflow).map((event) => event.id));
    localDb.workbookEvents = localDb.workbookEvents.filter((event) => !overflowIds.has(event.id));
  }
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
    const result = await pool.query<{
      id: string;
      session_id: string;
      layer: "board" | "annotations";
      version: string | number;
      payload: unknown;
      created_at: Date | string;
    }>(
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
        RETURNING id, session_id, layer, version, payload, created_at
      `,
      [snapshotId, sessionId, layer, version, JSON.stringify(payload), timestamp]
    );

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
  const existing = localDb.workbookSnapshots.find(
    (item) => item.sessionId === sessionId && item.layer === layer
  );

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

export const deleteWorkbookSessionArtifacts = async (sessionId: string) => {
  if (storageDriver === "postgres") {
    const pool = await ensurePgPool();
    await Promise.all([
      pool.query(`DELETE FROM ${EVENT_TABLE} WHERE session_id = $1`, [sessionId]),
      pool.query(`DELETE FROM ${SNAPSHOT_TABLE} WHERE session_id = $1`, [sessionId]),
      pool.query(`DELETE FROM ${EVENT_SEQ_TABLE} WHERE session_id = $1`, [sessionId]),
    ]);
    return;
  }

  const localDb = getDb();
  localDb.workbookEvents = localDb.workbookEvents.filter((item) => item.sessionId !== sessionId);
  localDb.workbookSnapshots = localDb.workbookSnapshots.filter(
    (item) => item.sessionId !== sessionId
  );
  saveDb();
};

export const getStorageDiagnostics = () => ({
  driver: storageDriver,
  ready: dbInitialized,
  databaseUrlConfigured: DATABASE_URL.length > 0,
  lastError: storageError,
});

export const shutdownDb = async () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (pgPool) {
    await pgPool.end().catch(() => undefined);
    pgPool = null;
  }
};
