import fs from "node:fs";
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
const PERSIST_DEBOUNCE_MS = 120;

let db: MockDb | null = null;
let persistTimer: NodeJS.Timeout | null = null;
let persistInFlight = false;
let persistRequestedWhileWriting = false;

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

const readDbFile = (): MockDb => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const fresh = createDefaultDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return ensureShape(JSON.parse(raw));
  } catch {
    return createDefaultDb();
  }
};

const persistNow = () => {
  if (!db) return;
  if (persistInFlight) {
    persistRequestedWhileWriting = true;
    return;
  }
  persistInFlight = true;
  const payload = JSON.stringify(db, null, 2);
  fs.writeFile(DB_FILE, payload, (error) => {
    persistInFlight = false;
    if (error) {
      // keep runtime resilient in showcase mode
      return;
    }
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
  if (!db) {
    db = readDbFile();
  }
  return db;
};

export const saveDb = () => {
  if (!db) return;
  schedulePersist();
};

export const resetDb = () => {
  db = createDefaultDb();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistNow();
};
