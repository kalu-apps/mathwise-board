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

const DB_FILE = path.resolve(process.cwd(), "mock-db.json");
const PERSIST_DEBOUNCE_MS = 1_000;
const STATE_ROW_KEY = "mock_db_v1";
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();

let db: MockDb | null = null;
let persistTimer: NodeJS.Timeout | null = null;
let persistInFlight = false;
let persistRequestedWhileWriting = false;
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;
let storageDriver: "file" | "postgres" = "file";
let storageError: string | null = null;
let pgPool: import("pg").Pool | null = null;

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

const ensurePgPool = async () => {
  if (pgPool) return pgPool;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  const { Pool } = await import("pg");
  const useSsl = shouldUsePgSsl(DATABASE_URL);
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
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
    "SELECT payload FROM app_state WHERE key = $1 LIMIT 1",
    [STATE_ROW_KEY]
  );
  if (result.rowCount === 0) return null;
  return ensureShape(result.rows[0]?.payload);
};

const writeDbToPostgres = async (payload: string) => {
  const pool = await ensurePgPool();
  await pool.query(
    `
      INSERT INTO app_state (key, payload, updated_at)
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
    db = ensureShape(loaded);
    dbInitialized = true;
  })().finally(() => {
    dbInitPromise = null;
  });
  return dbInitPromise;
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
