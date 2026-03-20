import type {
  AuthSessionRecord,
  MockDb,
  UserRecord,
  WorkbookDraftRecord,
  WorkbookOperationRecord,
  WorkbookInviteRecord,
  WorkbookSessionParticipantRecord,
  WorkbookSessionRecord,
} from "./db";

const sessionUserKey = (sessionId: string, userId: string) => `${sessionId}:${userId}`;
const sessionOwnerKey = (sessionId: string, ownerUserId: string) => `${sessionId}:${ownerUserId}`;

type DbIndexSnapshot = {
  usersRef: MockDb["users"];
  usersLen: number;
  authSessionsRef: MockDb["authSessions"];
  authSessionsLen: number;
  workbookSessionsRef: MockDb["workbookSessions"];
  workbookSessionsLen: number;
  workbookParticipantsRef: MockDb["workbookParticipants"];
  workbookParticipantsLen: number;
  workbookDraftsRef: MockDb["workbookDrafts"];
  workbookDraftsLen: number;
  workbookInvitesRef: MockDb["workbookInvites"];
  workbookInvitesLen: number;
  workbookOperationsRef: MockDb["workbookOperations"];
  workbookOperationsLen: number;
};

export type DbIndex = {
  usersById: Map<string, UserRecord>;
  authSessionsByToken: Map<string, AuthSessionRecord>;
  sessionsById: Map<string, WorkbookSessionRecord>;
  participantsBySession: Map<string, WorkbookSessionParticipantRecord[]>;
  participantsBySessionUser: Map<string, WorkbookSessionParticipantRecord>;
  draftsBySessionOwner: Map<string, WorkbookDraftRecord>;
  invitesByToken: Map<string, WorkbookInviteRecord>;
  operationsByScopeKey: Map<string, WorkbookOperationRecord>;
};

const dbIndexCache = new WeakMap<MockDb, { snapshot: DbIndexSnapshot; index: DbIndex }>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readKey = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const createSnapshot = (db: MockDb): DbIndexSnapshot => ({
  usersRef: db.users,
  usersLen: db.users.length,
  authSessionsRef: db.authSessions,
  authSessionsLen: db.authSessions.length,
  workbookSessionsRef: db.workbookSessions,
  workbookSessionsLen: db.workbookSessions.length,
  workbookParticipantsRef: db.workbookParticipants,
  workbookParticipantsLen: db.workbookParticipants.length,
  workbookDraftsRef: db.workbookDrafts,
  workbookDraftsLen: db.workbookDrafts.length,
  workbookInvitesRef: db.workbookInvites,
  workbookInvitesLen: db.workbookInvites.length,
  workbookOperationsRef: db.workbookOperations,
  workbookOperationsLen: db.workbookOperations.length,
});

const isSnapshotReusable = (db: MockDb, snapshot: DbIndexSnapshot) =>
  snapshot.usersRef === db.users &&
  snapshot.usersLen === db.users.length &&
  snapshot.authSessionsRef === db.authSessions &&
  snapshot.authSessionsLen === db.authSessions.length &&
  snapshot.workbookSessionsRef === db.workbookSessions &&
  snapshot.workbookSessionsLen === db.workbookSessions.length &&
  snapshot.workbookParticipantsRef === db.workbookParticipants &&
  snapshot.workbookParticipantsLen === db.workbookParticipants.length &&
  snapshot.workbookDraftsRef === db.workbookDrafts &&
  snapshot.workbookDraftsLen === db.workbookDrafts.length &&
  snapshot.workbookInvitesRef === db.workbookInvites &&
  snapshot.workbookInvitesLen === db.workbookInvites.length &&
  snapshot.workbookOperationsRef === db.workbookOperations &&
  snapshot.workbookOperationsLen === db.workbookOperations.length;

const buildDbIndex = (db: MockDb): DbIndex => {
  const usersById = new Map<string, UserRecord>();
  for (const candidate of db.users) {
    if (!isRecord(candidate)) continue;
    const id = readKey(candidate.id);
    if (!id) continue;
    usersById.set(id, candidate as UserRecord);
  }

  const authSessionsByToken = new Map<string, AuthSessionRecord>();
  for (const candidate of db.authSessions) {
    if (!isRecord(candidate)) continue;
    const token = readKey(candidate.token);
    if (!token) continue;
    authSessionsByToken.set(token, candidate as AuthSessionRecord);
  }

  const sessionsById = new Map<string, WorkbookSessionRecord>();
  for (const candidate of db.workbookSessions) {
    if (!isRecord(candidate)) continue;
    const id = readKey(candidate.id);
    if (!id) continue;
    sessionsById.set(id, candidate as WorkbookSessionRecord);
  }

  const participantsBySession = new Map<string, WorkbookSessionParticipantRecord[]>();
  const participantsBySessionUser = new Map<string, WorkbookSessionParticipantRecord>();
  db.workbookParticipants.forEach((candidate) => {
    if (!isRecord(candidate)) return;
    const sessionId = readKey(candidate.sessionId);
    const userId = readKey(candidate.userId);
    if (!sessionId || !userId) return;
    const participant = candidate as WorkbookSessionParticipantRecord;
    const sessionParticipants = participantsBySession.get(participant.sessionId);
    if (sessionParticipants) {
      sessionParticipants.push(participant);
    } else {
      participantsBySession.set(participant.sessionId, [participant]);
    }
    participantsBySessionUser.set(
      sessionUserKey(participant.sessionId, participant.userId),
      participant
    );
  });

  const draftsBySessionOwner = new Map<string, WorkbookDraftRecord>();
  db.workbookDrafts.forEach((candidate) => {
    if (!isRecord(candidate)) return;
    const sessionId = readKey(candidate.sessionId);
    const ownerUserId = readKey(candidate.ownerUserId);
    if (!sessionId || !ownerUserId) return;
    const draft = candidate as WorkbookDraftRecord;
    draftsBySessionOwner.set(sessionOwnerKey(draft.sessionId, draft.ownerUserId), draft);
  });

  const invitesByToken = new Map<string, WorkbookInviteRecord>();
  db.workbookInvites.forEach((candidate) => {
    if (!isRecord(candidate)) return;
    const token = readKey(candidate.token);
    if (!token) return;
    invitesByToken.set(token, candidate as WorkbookInviteRecord);
  });

  const operationsByScopeKey = new Map<string, WorkbookOperationRecord>();
  db.workbookOperations.forEach((candidate) => {
    if (!isRecord(candidate)) return;
    const scope = readKey(candidate.scope);
    const key = readKey(candidate.key);
    if (!scope || !key) return;
    operationsByScopeKey.set(`${scope}:${key}`, candidate as WorkbookOperationRecord);
  });

  return {
    usersById,
    authSessionsByToken,
    sessionsById,
    participantsBySession,
    participantsBySessionUser,
    draftsBySessionOwner,
    invitesByToken,
    operationsByScopeKey,
  };
};

export const getDbIndex = (db: MockDb): DbIndex => {
  const cached = dbIndexCache.get(db);
  if (cached && isSnapshotReusable(db, cached.snapshot)) {
    return cached.index;
  }
  const index = buildDbIndex(db);
  dbIndexCache.set(db, {
    snapshot: createSnapshot(db),
    index,
  });
  return index;
};

export const getSessionUserKey = sessionUserKey;
export const getSessionOwnerKey = sessionOwnerKey;
