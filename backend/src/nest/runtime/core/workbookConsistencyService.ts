import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  applyWorkbookObjectVersionGuard,
  isWorkbookWriteOperationScope,
  registerWorkbookIdempotencyConflict,
  registerWorkbookIdempotencyEvictions,
  registerWorkbookIdempotencyHit,
  registerWorkbookIdempotencyMiss,
  registerWorkbookIdempotencyWrite,
  resolveWorkbookSnapshotBarrier,
  resolveWorkbookWriteIdempotencyKey,
  type WorkbookObjectVersionGuardInput,
  type WorkbookObjectVersionGuardResult,
  type WorkbookSnapshotBarrier,
  workbookConsistencyConfig,
} from "./workbookConsistency";
import { getDbIndex } from "./dbIndex";
import type { MockDb, WorkbookOperationRecord } from "./db";

const readHeaderValue = (req: IncomingMessage, name: string) => {
  const header = req.headers[name.toLowerCase()];
  if (Array.isArray(header)) {
    return header[0] ?? "";
  }
  return header ?? "";
};

const readIdempotencyKey = (req: IncomingMessage) => {
  const raw = readHeaderValue(req, "x-idempotency-key");
  if (!raw) return null;
  return String(raw).slice(0, 240);
};

const safeParseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const normalizeOperationFingerprint = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value ?? "");
  }
};

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

type WorkbookConsistencyServiceConfig = {
  fallbackIdempotencyTtlMs: number;
  fallbackIdempotencyMaxRecords: number;
};

type WorkbookConsistencyServiceDeps = {
  config: WorkbookConsistencyServiceConfig;
  ensureId: () => string;
  nowIso: () => string;
  nowTs: () => number;
  saveDb: () => void;
};

const resolveOperationStorageLimits = (
  scope: WorkbookOperationRecord["scope"],
  config: WorkbookConsistencyServiceConfig
) => {
  if (isWorkbookWriteOperationScope(scope)) {
    return {
      ttlMs: workbookConsistencyConfig.idempotencyTtlMs,
      maxRecords: workbookConsistencyConfig.idempotencyMaxRecords,
    };
  }
  return {
    ttlMs: config.fallbackIdempotencyTtlMs,
    maxRecords: config.fallbackIdempotencyMaxRecords,
  };
};

export type WorkbookConsistencyService = {
  resolveWriteIdempotencyKey: (params: {
    req: IncomingMessage;
    scope: WorkbookOperationRecord["scope"];
    actorUserId: string;
    sessionId: string;
    payloadFingerprint: unknown;
  }) => string | null;
  readIdempotentOperation: <TPayload>(
    db: MockDb,
    params: {
      scope: WorkbookOperationRecord["scope"];
      actorUserId: string;
      idempotencyKey: string | null;
      requestFingerprint: string;
    }
  ) =>
    | {
        conflict: true;
      }
    | {
        conflict: false;
        statusCode: number;
        payload: TPayload;
      }
    | null;
  saveIdempotentOperation: (
    db: MockDb,
    params: {
      scope: WorkbookOperationRecord["scope"];
      actorUserId: string;
      idempotencyKey: string | null;
      requestFingerprint: string;
      statusCode: number;
      payload: unknown;
    }
  ) => void;
  applyObjectVersionGuard: (
    input: WorkbookObjectVersionGuardInput
  ) => Promise<WorkbookObjectVersionGuardResult>;
  resolveSnapshotBarrier: (db: MockDb, sessionId: string) => WorkbookSnapshotBarrier;
};

export const createWorkbookConsistencyService = (
  deps: WorkbookConsistencyServiceDeps
): WorkbookConsistencyService => {
  const cleanupIdempotencyOperations = (db: MockDb) => {
    const before = db.workbookOperations.length;
    const now = deps.nowTs();
    const writeLimit = resolveOperationStorageLimits("workbook_events_append", deps.config).maxRecords;
    const writeScopes = db.workbookOperations.filter((entry) =>
      isWorkbookWriteOperationScope(entry.scope)
    );
    const writeOverflowThreshold = Math.max(0, writeScopes.length - writeLimit);

    let operations = db.workbookOperations.filter(
      (entry) => new Date(entry.expiresAt).getTime() > now
    );
    if (operations.length > deps.config.fallbackIdempotencyMaxRecords || writeOverflowThreshold > 0) {
      const sorted = operations
        .slice()
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        );
      let globalTrimmed = sorted.slice(0, deps.config.fallbackIdempotencyMaxRecords);
      if (writeOverflowThreshold > 0) {
        const keepWrite = new Set(
          globalTrimmed
            .filter((entry) => isWorkbookWriteOperationScope(entry.scope))
            .slice(0, writeLimit)
            .map((entry) => entry.id)
        );
        globalTrimmed = globalTrimmed.filter(
          (entry) => !isWorkbookWriteOperationScope(entry.scope) || keepWrite.has(entry.id)
        );
      }
      operations = globalTrimmed;
    }
    if (operations.length === db.workbookOperations.length) return 0;

    const writeBefore = db.workbookOperations.filter((entry) =>
      isWorkbookWriteOperationScope(entry.scope)
    ).length;
    const writeAfter = operations.filter((entry) =>
      isWorkbookWriteOperationScope(entry.scope)
    ).length;

    db.workbookOperations = operations;
    deps.saveDb();
    const writeEvictions = Math.max(0, writeBefore - writeAfter);
    if (writeEvictions > 0) {
      registerWorkbookIdempotencyEvictions(writeEvictions);
    }
    return Math.max(0, before - operations.length);
  };

  return {
    resolveWriteIdempotencyKey: (params) =>
      resolveWorkbookWriteIdempotencyKey({
        headerKey: readIdempotencyKey(params.req),
        scope: params.scope,
        actorUserId: params.actorUserId,
        sessionId: params.sessionId,
        payloadFingerprint: params.payloadFingerprint,
      }) ??
      `auto:${sha256(
        normalizeOperationFingerprint({
          scope: params.scope,
          actorUserId: params.actorUserId,
          sessionId: params.sessionId,
          payloadFingerprint: params.payloadFingerprint,
        })
      ).slice(0, 64)}`,

    readIdempotentOperation: (db, params) => {
      const writeScope = isWorkbookWriteOperationScope(params.scope);
      if (!params.idempotencyKey) {
        if (writeScope) {
          registerWorkbookIdempotencyMiss();
        }
        return null;
      }
      cleanupIdempotencyOperations(db);
      const key = `${params.actorUserId}:${params.idempotencyKey}`;
      const operation = getDbIndex(db).operationsByScopeKey.get(`${params.scope}:${key}`) ?? null;
      if (!operation) {
        if (writeScope) {
          registerWorkbookIdempotencyMiss();
        }
        return null;
      }
      if (operation.requestFingerprint !== params.requestFingerprint) {
        if (writeScope) {
          registerWorkbookIdempotencyConflict();
        }
        return { conflict: true } as const;
      }
      if (writeScope) {
        registerWorkbookIdempotencyHit();
      }
      return {
        conflict: false as const,
        statusCode: operation.statusCode,
        payload: safeParseJson(operation.responsePayload, null),
      };
    },

    saveIdempotentOperation: (db, params) => {
      if (!params.idempotencyKey) return;
      cleanupIdempotencyOperations(db);
      const key = `${params.actorUserId}:${params.idempotencyKey}`;
      const timestamp = deps.nowIso();
      const expiresAt = new Date(
        deps.nowTs() + resolveOperationStorageLimits(params.scope, deps.config).ttlMs
      ).toISOString();
      const payloadRaw = normalizeOperationFingerprint(params.payload);
      const existingIndex = db.workbookOperations.findIndex(
        (entry) => entry.scope === params.scope && entry.key === key
      );
      const record: WorkbookOperationRecord = {
        id: existingIndex >= 0 ? db.workbookOperations[existingIndex].id : deps.ensureId(),
        scope: params.scope,
        actorUserId: params.actorUserId,
        key,
        requestFingerprint: params.requestFingerprint,
        statusCode: params.statusCode,
        responsePayload: payloadRaw,
        createdAt: existingIndex >= 0 ? db.workbookOperations[existingIndex].createdAt : timestamp,
        updatedAt: timestamp,
        expiresAt,
      };
      if (existingIndex >= 0) {
        db.workbookOperations[existingIndex] = record;
      } else {
        db.workbookOperations.push(record);
      }
      if (isWorkbookWriteOperationScope(params.scope)) {
        registerWorkbookIdempotencyWrite();
      }
      deps.saveDb();
    },

    applyObjectVersionGuard: (input) => applyWorkbookObjectVersionGuard(input),

    resolveSnapshotBarrier: (db, sessionId) => resolveWorkbookSnapshotBarrier(db, sessionId),
  };
};
