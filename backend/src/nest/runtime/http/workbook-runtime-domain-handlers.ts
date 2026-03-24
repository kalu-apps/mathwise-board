import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  AuthSessionRecord,
  MockDb,
  UserRecord,
} from "../core/db";

type RuntimeRequestContext = {
  req: IncomingMessage;
  res: ServerResponse;
  db: MockDb;
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
};

type ResolveAuthUser = (
  req: IncomingMessage,
  db: MockDb,
  options?: { touchSession?: boolean }
) => UserRecord | null;

type RequireAuthUser = (
  req: IncomingMessage,
  res: ServerResponse,
  db: MockDb
) => UserRecord | null;

type JsonResponse = (res: ServerResponse, status: number, payload: unknown) => void;

type AuthHandlerDeps = {
  authCookieName: string;
  teacherPassword: string;
  resolveAuthUser: ResolveAuthUser;
  readBody: (req: IncomingMessage) => Promise<unknown>;
  unauthorized: (res: ServerResponse, message?: string) => void;
  pickTeacher: (db: MockDb) => UserRecord;
  setAuthSession: (db: MockDb, res: ServerResponse, user: UserRecord) => AuthSessionRecord;
  saveDb: () => void;
  safeUser: (user: UserRecord) => unknown;
  parseCookies: (req: IncomingMessage) => Record<string, string>;
  readAuthSessionByToken: (db: MockDb, token: string) => AuthSessionRecord | null;
  closeUserPresenceAcrossSessions: (db: MockDb, userId: string, timestamp?: string) => boolean;
  removeAuthSessionPersistenceToken: (token: string) => void;
  clearAuthCookie: (res: ServerResponse) => void;
  json: JsonResponse;
};

type RuntimeInfraHandlerDeps = {
  getWorkbookPersistenceReadiness: () => unknown;
  getStorageDiagnostics: () => unknown;
  getRuntimeServicesStatus: () => unknown;
  getTelemetryDiagnostics: () => unknown;
  getWorkbookSessionAffinityDiagnostics: () => unknown;
  json: JsonResponse;
};

type TelemetryHandlerDeps = {
  resolveAuthUser: ResolveAuthUser;
  requireAuthUser: RequireAuthUser;
  readBody: (req: IncomingMessage) => Promise<unknown>;
  ingestRumTelemetryEvents: (
    events: unknown[],
    context: { userId: string | null; sessionId: string | null }
  ) => { accepted: number };
  getTelemetryDiagnostics: () => unknown;
  readRecentWorkbookServerTraces: (limit: number) => unknown;
  readRecentRumTelemetryEvents: (limit: number) => unknown;
  json: JsonResponse;
};

export const handleAuthDomainRoute = async (
  context: RuntimeRequestContext,
  deps: AuthHandlerDeps
): Promise<boolean> => {
  const { req, res, db, method, pathname } = context;

  if (pathname === "/api/auth/session" && method === "GET") {
    const user = deps.resolveAuthUser(req, db);
    deps.json(res, 200, user ? deps.safeUser(user) : null);
    return true;
  }

  if (pathname === "/api/auth/password/login" && method === "POST") {
    const body = (await deps.readBody(req)) as { email?: string; password?: string } | null;
    const password = String(body?.password ?? "").normalize("NFKC").trim();
    const teacherPassword = deps.teacherPassword.normalize("NFKC");
    if (password !== teacherPassword) {
      deps.unauthorized(res, "Неверный логин или пароль.");
      return true;
    }
    const teacher = deps.pickTeacher(db);
    const now = Date.now();
    const expiredTeacherTokens = db.authSessions
      .filter((session) => {
        if (session.userId !== teacher.id) return false;
        return new Date(session.expiresAt).getTime() <= now;
      })
      .map((session) => session.token);
    if (expiredTeacherTokens.length > 0) {
      const expiredTokenSet = new Set(expiredTeacherTokens);
      db.authSessions = db.authSessions.filter((session) => !expiredTokenSet.has(session.token));
      expiredTeacherTokens.forEach((token) => deps.removeAuthSessionPersistenceToken(token));
      deps.closeUserPresenceAcrossSessions(db, teacher.id);
    }
    const hasActiveTeacherSession = db.authSessions.some((session) => {
      if (session.userId !== teacher.id) return false;
      return new Date(session.expiresAt).getTime() > now;
    });
    if (hasActiveTeacherSession) {
      deps.json(res, 409, {
        error:
          "Учитель уже авторизован в другом браузере или устройстве. Завершите текущую сессию или дождитесь авто-выхода через 30 минут неактивности.",
        code: "teacher_already_logged_in",
      });
      return true;
    }
    deps.setAuthSession(db, res, teacher);
    deps.saveDb();
    deps.json(res, 200, deps.safeUser(teacher));
    return true;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    const cookies = deps.parseCookies(req);
    const token = cookies[deps.authCookieName];
    if (token) {
      const authSession = deps.readAuthSessionByToken(db, token);
      if (authSession) {
        deps.closeUserPresenceAcrossSessions(db, authSession.userId);
      }
      db.authSessions = db.authSessions.filter((session) => session.token !== token);
      deps.removeAuthSessionPersistenceToken(token);
      deps.saveDb();
    }
    deps.clearAuthCookie(res);
    deps.json(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/auth/password/status" && method === "GET") {
    deps.json(res, 200, {
      ok: true,
      hasPassword: true,
      state: "active",
      lockedUntil: null,
      lastPasswordChangeAt: null,
    });
    return true;
  }

  return false;
};

export const handleRuntimeInfraDomainRoute = (
  context: RuntimeRequestContext,
  deps: RuntimeInfraHandlerDeps
): boolean => {
  const { method, pathname, res } = context;

  if (pathname === "/api/runtime/readiness" && method === "GET") {
    const readiness = deps.getWorkbookPersistenceReadiness();
    const ready = Boolean((readiness as { ready?: boolean } | null)?.ready);
    deps.json(res, ready ? 200 : 503, readiness);
    return true;
  }

  if (pathname === "/api/runtime/infra" && method === "GET") {
    const readiness = deps.getWorkbookPersistenceReadiness();
    const ready = Boolean((readiness as { ready?: boolean } | null)?.ready);
    deps.json(res, ready ? 200 : 503, {
      ok: ready,
      service: "mathboard-runtime-infra",
      timestamp: new Date().toISOString(),
      readiness,
      storage: deps.getStorageDiagnostics(),
      runtime: deps.getRuntimeServicesStatus(),
      telemetry: deps.getTelemetryDiagnostics(),
      affinity: deps.getWorkbookSessionAffinityDiagnostics(),
    });
    return true;
  }

  return false;
};

export const handleTelemetryDomainRoute = async (
  context: RuntimeRequestContext,
  deps: TelemetryHandlerDeps
): Promise<boolean> => {
  const { req, res, db, method, pathname, searchParams } = context;

  if (pathname === "/api/telemetry/rum" && method === "POST") {
    const actor = deps.resolveAuthUser(req, db, { touchSession: false });
    const body = (await deps.readBody(req)) as { events?: unknown[]; sessionId?: unknown } | null;
    const events = Array.isArray(body?.events) ? body.events : [];
    const sessionId =
      typeof body?.sessionId === "string" && body.sessionId.trim().length > 0
        ? body.sessionId.trim()
        : null;
    const result = deps.ingestRumTelemetryEvents(events, {
      userId: actor?.id ?? null,
      sessionId,
    });
    deps.json(res, 202, { ok: true, accepted: result.accepted });
    return true;
  }

  if (pathname === "/api/telemetry/runtime" && method === "GET") {
    const actor = deps.requireAuthUser(req, res, db);
    if (!actor) return true;
    const limit = Math.max(
      1,
      Math.min(200, Number.parseInt(String(searchParams.get("limit") ?? "50"), 10) || 50)
    );
    deps.json(res, 200, {
      diagnostics: deps.getTelemetryDiagnostics(),
      workbookServerTraces: deps.readRecentWorkbookServerTraces(limit),
      rumEvents: deps.readRecentRumTelemetryEvents(limit),
    });
    return true;
  }

  return false;
};
