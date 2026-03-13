import type {
  AuthSessionRecord,
  MockDb,
  UserRecord,
  WorkbookDraftRecord,
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
};

export type DbIndex = {
  usersById: Map<string, UserRecord>;
  authSessionsByToken: Map<string, AuthSessionRecord>;
  sessionsById: Map<string, WorkbookSessionRecord>;
  participantsBySession: Map<string, WorkbookSessionParticipantRecord[]>;
  participantsBySessionUser: Map<string, WorkbookSessionParticipantRecord>;
  draftsBySessionOwner: Map<string, WorkbookDraftRecord>;
  invitesByToken: Map<string, WorkbookInviteRecord>;
};

const dbIndexCache = new WeakMap<MockDb, { snapshot: DbIndexSnapshot; index: DbIndex }>();

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
  snapshot.workbookInvitesLen === db.workbookInvites.length;

const buildDbIndex = (db: MockDb): DbIndex => {
  const usersById = new Map(db.users.map((user) => [user.id, user]));
  const authSessionsByToken = new Map(db.authSessions.map((session) => [session.token, session]));
  const sessionsById = new Map(db.workbookSessions.map((session) => [session.id, session]));
  const participantsBySession = new Map<string, WorkbookSessionParticipantRecord[]>();
  const participantsBySessionUser = new Map<string, WorkbookSessionParticipantRecord>();
  db.workbookParticipants.forEach((participant) => {
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
  db.workbookDrafts.forEach((draft) => {
    draftsBySessionOwner.set(sessionOwnerKey(draft.sessionId, draft.ownerUserId), draft);
  });

  const invitesByToken = new Map(db.workbookInvites.map((invite) => [invite.token, invite]));

  return {
    usersById,
    authSessionsByToken,
    sessionsById,
    participantsBySession,
    participantsBySessionUser,
    draftsBySessionOwner,
    invitesByToken,
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
