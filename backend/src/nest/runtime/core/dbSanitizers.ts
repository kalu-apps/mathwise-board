const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeIsoDate = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return new Date(parsed).toISOString();
};

const normalizeNullableIsoDate = (value: unknown): string | null => {
  if (value == null || typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const readNumber = (
  value: unknown,
  fallback: number,
  options?: { min?: number; max?: number }
) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const min = options?.min ?? Number.MIN_SAFE_INTEGER;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, parsed));
};

const serializeUnknownJson = (value: unknown, fallback: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 0) return value;
  }
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
};

const workbookSessionKindSet = new Set(["PERSONAL", "CLASS"]);
const workbookSessionStatusSet = new Set(["draft", "in_progress", "ended"]);
const workbookRoleInSessionSet = new Set(["teacher", "student"]);
const workbookSnapshotLayerSet = new Set(["board", "annotations"]);
const workbookAccessEventTypeSet = new Set([
  "invite_resolved",
  "invite_joined",
  "invite_join_denied",
  "presence_started",
  "presence_ended",
  "session_opened",
]);
const workbookAccessDeviceClassSet = new Set(["desktop", "mobile", "tablet", "bot", "unknown"]);
const workbookOperationScopeSet = new Set([
  "workbook_sessions_create",
  "workbook_sessions_delete",
  "workbook_invite_create",
  "workbook_events_append",
  "workbook_events_live",
  "workbook_events_preview",
  "workbook_snapshot_upsert",
  "workbook_presence_heartbeat",
  "workbook_presence_leave",
]);

const workbookParticipantPermissionKeys = [
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
] as const;

type PermissionKey = (typeof workbookParticipantPermissionKeys)[number];

const defaultPermissionsByRole = (roleInSession: string): Record<PermissionKey, boolean> =>
  roleInSession === "teacher"
    ? {
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
      }
    : {
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

const sanitizeParticipantPermissions = (value: unknown, roleInSession: string) => {
  const source = isObjectRecord(value) ? value : {};
  const defaults = defaultPermissionsByRole(roleInSession);
  const normalized = { ...defaults };
  for (const key of workbookParticipantPermissionKeys) {
    normalized[key] = readBoolean(source[key], defaults[key]);
  }
  return normalized;
};

const nowIso = () => new Date().toISOString();

export const sanitizeUserRecords = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const email = readTrimmedString(entry.email).toLowerCase();
    if (!id || !email) continue;
    const role = entry.role === "teacher" || entry.role === "student" ? entry.role : "student";
    const firstName = readTrimmedString(entry.firstName) || "Пользователь";
    const lastName = readTrimmedString(entry.lastName);
    const createdAt = normalizeIsoDate(entry.createdAt, nowIso());
    const photo = readTrimmedString(entry.photo);
    sanitized.push({ id, role, email, firstName, lastName, createdAt, ...(photo ? { photo } : {}) });
  }
  return sanitized;
};

export const sanitizeAuthSessions = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const token = readTrimmedString(entry.token);
    const userId = readTrimmedString(entry.userId);
    if (!token || !userId) continue;
    const createdAt = normalizeIsoDate(entry.createdAt, nowIso());
    const lastSeenAt = normalizeIsoDate(entry.lastSeenAt, createdAt);
    const expiresAt = normalizeIsoDate(
      entry.expiresAt,
      new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    );
    sanitized.push({ token, userId, createdAt, lastSeenAt, expiresAt });
  }
  return sanitized;
};

export const sanitizeWorkbookSessions = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const createdBy = readTrimmedString(entry.createdBy);
    if (!id || !createdBy) continue;
    const kind = workbookSessionKindSet.has(String(entry.kind)) ? String(entry.kind) : "PERSONAL";
    const status = workbookSessionStatusSet.has(String(entry.status)) ? String(entry.status) : "draft";
    const createdAt = normalizeIsoDate(entry.createdAt, nowIso());
    const lastActivityAt = normalizeIsoDate(entry.lastActivityAt, createdAt);
    const titleFallback = kind === "CLASS" ? "Индивидуальное занятие" : "Личная тетрадь";
    sanitized.push({
      id,
      kind,
      createdBy,
      title: readTrimmedString(entry.title) || titleFallback,
      status,
      createdAt,
      startedAt: normalizeNullableIsoDate(entry.startedAt),
      endedAt: normalizeNullableIsoDate(entry.endedAt),
      lastActivityAt,
      context: serializeUnknownJson(entry.context, { settings: {} }),
    });
  }
  return sanitized;
};

export const sanitizeWorkbookParticipants = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const sessionId = readTrimmedString(entry.sessionId);
    const userId = readTrimmedString(entry.userId);
    if (!sessionId || !userId) continue;
    const roleInSession = workbookRoleInSessionSet.has(String(entry.roleInSession))
      ? String(entry.roleInSession)
      : "student";
    const lastVisitDurationMinutesRaw = readNumber(entry.lastVisitDurationMinutes, 0, { min: 0 });
    const boardToolsOverride =
      entry.boardToolsOverride === "enabled" || entry.boardToolsOverride === "disabled"
        ? entry.boardToolsOverride
        : null;
    sanitized.push({
      sessionId,
      userId,
      roleInSession,
      joinedAt: normalizeIsoDate(entry.joinedAt, nowIso()),
      leftAt: normalizeNullableIsoDate(entry.leftAt),
      isActive: readBoolean(entry.isActive, true),
      lastSeenAt: normalizeNullableIsoDate(entry.lastSeenAt),
      currentVisitStartedAt: normalizeNullableIsoDate(entry.currentVisitStartedAt),
      lastVisitStartedAt: normalizeNullableIsoDate(entry.lastVisitStartedAt),
      lastVisitEndedAt: normalizeNullableIsoDate(entry.lastVisitEndedAt),
      lastVisitDurationMinutes:
        entry.lastVisitDurationMinutes == null
          ? null
          : Math.floor(Number.isFinite(lastVisitDurationMinutesRaw) ? lastVisitDurationMinutesRaw : 0),
      boardToolsOverride,
      permissions: sanitizeParticipantPermissions(entry.permissions, roleInSession),
    });
  }
  return sanitized;
};

export const sanitizeWorkbookDrafts = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const ownerUserId = readTrimmedString(entry.ownerUserId);
    const sessionId = readTrimmedString(entry.sessionId);
    if (!id || !ownerUserId || !sessionId) continue;
    const statusForCard = workbookSessionStatusSet.has(String(entry.statusForCard))
      ? String(entry.statusForCard)
      : "draft";
    const createdAt = normalizeIsoDate(entry.createdAt, nowIso());
    const updatedAt = normalizeIsoDate(entry.updatedAt, createdAt);
    sanitized.push({
      id,
      ownerUserId,
      sessionId,
      redirectSessionId: readTrimmedString(entry.redirectSessionId) || null,
      title: readTrimmedString(entry.title) || "Черновик",
      statusForCard,
      createdAt,
      updatedAt,
      lastOpenedAt: normalizeNullableIsoDate(entry.lastOpenedAt),
    });
  }
  return sanitized;
};

export const sanitizeWorkbookInvites = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const sessionId = readTrimmedString(entry.sessionId);
    const token = readTrimmedString(entry.token);
    const createdBy = readTrimmedString(entry.createdBy);
    if (!id || !sessionId || !token || !createdBy) continue;
    const maxUsesRaw = readNumber(entry.maxUses, 0, { min: 0 });
    sanitized.push({
      id,
      sessionId,
      token,
      createdBy,
      createdAt: normalizeIsoDate(entry.createdAt, nowIso()),
      expiresAt: normalizeIsoDate(
        entry.expiresAt,
        new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      ),
      maxUses: entry.maxUses == null ? null : Math.floor(maxUsesRaw),
      useCount: Math.floor(readNumber(entry.useCount, 0, { min: 0 })),
      revokedAt: normalizeNullableIsoDate(entry.revokedAt),
    });
  }
  return sanitized;
};

export const sanitizeWorkbookOperations = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const scopeRaw = readTrimmedString(entry.scope);
    const actorUserId = readTrimmedString(entry.actorUserId);
    const key = readTrimmedString(entry.key);
    const requestFingerprint = readTrimmedString(entry.requestFingerprint);
    if (!id || !scopeRaw || !actorUserId || !key || !requestFingerprint) continue;
    if (!workbookOperationScopeSet.has(scopeRaw)) continue;
    const createdAt = normalizeIsoDate(entry.createdAt, nowIso());
    const updatedAt = normalizeIsoDate(entry.updatedAt, createdAt);
    sanitized.push({
      id,
      scope: scopeRaw,
      actorUserId,
      key,
      requestFingerprint,
      statusCode: Math.floor(readNumber(entry.statusCode, 200, { min: 100, max: 599 })),
      responsePayload: serializeUnknownJson(entry.responsePayload, {}),
      createdAt,
      updatedAt,
      expiresAt: normalizeIsoDate(
        entry.expiresAt,
        new Date(Date.now() + 5 * 60 * 1000).toISOString()
      ),
    });
  }
  return sanitized;
};

export const sanitizeWorkbookEvents = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const sessionId = readTrimmedString(entry.sessionId);
    const authorUserId = readTrimmedString(entry.authorUserId);
    const type = readTrimmedString(entry.type);
    if (!id || !sessionId || !authorUserId || !type) continue;
    sanitized.push({
      id,
      sessionId,
      seq: Math.floor(readNumber(entry.seq, 0, { min: 0 })),
      authorUserId,
      type,
      payload: serializeUnknownJson(entry.payload, null),
      createdAt: normalizeIsoDate(entry.createdAt, nowIso()),
    });
  }
  return sanitized;
};

export const sanitizeWorkbookSnapshots = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const sessionId = readTrimmedString(entry.sessionId);
    const layerRaw = readTrimmedString(entry.layer);
    if (!id || !sessionId || !layerRaw || !workbookSnapshotLayerSet.has(layerRaw)) continue;
    sanitized.push({
      id,
      sessionId,
      layer: layerRaw,
      version: Math.floor(readNumber(entry.version, 0, { min: 0 })),
      payload: serializeUnknownJson(entry.payload, null),
      createdAt: normalizeIsoDate(entry.createdAt, nowIso()),
    });
  }
  return sanitized;
};

export const sanitizeWorkbookAccessLogs = (entries: unknown[]): unknown[] => {
  const sanitized: unknown[] = [];
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const id = readTrimmedString(entry.id);
    const sessionId = readTrimmedString(entry.sessionId);
    if (!id || !sessionId) continue;
    const eventTypeRaw = readTrimmedString(entry.eventType);
    const eventType = workbookAccessEventTypeSet.has(eventTypeRaw)
      ? eventTypeRaw
      : "session_opened";
    const actorRoleRaw = readTrimmedString(entry.actorRole);
    const actorRole = actorRoleRaw === "teacher" || actorRoleRaw === "student" ? actorRoleRaw : null;
    const deviceClassRaw = readTrimmedString(entry.deviceClass);
    const deviceClass = workbookAccessDeviceClassSet.has(deviceClassRaw)
      ? deviceClassRaw
      : null;
    sanitized.push({
      id,
      sessionId,
      eventType,
      actorUserId: readTrimmedString(entry.actorUserId) || null,
      actorRole,
      actorName: readTrimmedString(entry.actorName) || null,
      inviteTokenHash: readTrimmedString(entry.inviteTokenHash) || null,
      deviceIdHash: readTrimmedString(entry.deviceIdHash) || null,
      userAgentHash: readTrimmedString(entry.userAgentHash) || null,
      ipHash: readTrimmedString(entry.ipHash) || null,
      userAgentFamily: readTrimmedString(entry.userAgentFamily) || null,
      deviceClass,
      details: serializeUnknownJson(entry.details, {}),
      createdAt: normalizeIsoDate(entry.createdAt, nowIso()),
    });
  }
  return sanitized;
};
