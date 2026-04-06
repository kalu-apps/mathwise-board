import { ApiError, api, isRecoverableApiError } from "@/shared/api/client";
import { readStorage, writeStorage } from "@/shared/lib/localDb";
import { generateId } from "@/shared/lib/id";
import { buildIdempotencyHeaders } from "@/shared/lib/idempotency";
import type { WorkbookClientEventInput } from "./events";
import type { WorkbookLayer } from "./types";

type WorkbookPersistenceTaskBase = {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  retryAt?: string | null;
  expiresAt: string;
  idempotencyKey: string;
};

type WorkbookEventsPersistenceTask = WorkbookPersistenceTaskBase & {
  type: "events";
  events: WorkbookClientEventInput[];
};

type WorkbookSnapshotPersistenceTask = WorkbookPersistenceTaskBase & {
  type: "snapshot";
  layer: WorkbookLayer;
  version: number;
  payload: unknown;
};

type WorkbookPersistenceTask =
  | WorkbookEventsPersistenceTask
  | WorkbookSnapshotPersistenceTask;

type WorkbookPersistenceQueueSnapshot = {
  pendingCount: number;
  flushing: boolean;
  nextRetryAt: string | null;
};

type WorkbookPersistenceConflictHandler = (sessionId: string) => void;

const STORAGE_KEY = "WORKBOOK_PERSISTENCE_QUEUE_V1";
const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TASK_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const RETRY_BASE_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 90_000;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE_LENGTH = 120;
const CONFLICT_PAUSE_DEFAULT_MS = 12_000;
const MAX_CONFLICT_ATTEMPTS_PER_TASK = 2;

let queue = readStorage<WorkbookPersistenceTask[]>(STORAGE_KEY, []);
let flushing = false;
let runtimeInitialized = false;
const pausedSessionsUntilTs = new Map<string, number>();
const blockedSessions = new Set<string>();
let onWorkbookPersistenceConflict: WorkbookPersistenceConflictHandler | null = null;

const listeners = new Set<() => void>();

const nowTs = () => Date.now();
const nowIso = () => new Date().toISOString();

const normalizeSnapshotVersion = (version: number) =>
  Number.isFinite(version) ? Math.max(1, Math.trunc(version)) : 1;

const createSnapshotIdempotencyKey = (
  sessionId: string,
  layer: WorkbookLayer,
  version: number
) => `snapshot-${sessionId}-${layer}-v${normalizeSnapshotVersion(version)}-${generateId()}`;

const isLegacySnapshotIdempotencyKey = (task: WorkbookSnapshotPersistenceTask) =>
  task.idempotencyKey.trim() === `snapshot-${task.sessionId}-${task.layer}`;

const safeJsonClone = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

const parseTs = (value?: string | null) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const persistQueue = () => {
  writeStorage(STORAGE_KEY, queue, { ttlMs: QUEUE_TTL_MS });
};

const emit = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // noop
    }
  });
};

const cleanupExpiredSessionPauses = () => {
  const now = nowTs();
  pausedSessionsUntilTs.forEach((untilTs, sessionId) => {
    if (untilTs <= now) {
      pausedSessionsUntilTs.delete(sessionId);
    }
  });
};

const isSessionPersistencePaused = (sessionId: string) => {
  cleanupExpiredSessionPauses();
  if (blockedSessions.has(sessionId)) return true;
  const untilTs = pausedSessionsUntilTs.get(sessionId);
  return typeof untilTs === "number" && untilTs > nowTs();
};

const removeTasksBySessionId = (sessionId: string) => {
  if (!sessionId) return 0;
  const before = queue.length;
  queue = queue.filter((task) => task.sessionId !== sessionId);
  return before - queue.length;
};

const clampQueueLength = () => {
  if (queue.length <= MAX_QUEUE_LENGTH) return;
  queue = queue
    .slice()
    .sort((left, right) => parseTs(right.updatedAt) - parseTs(left.updatedAt))
    .slice(0, MAX_QUEUE_LENGTH);
};

const normalizeQueue = () => {
  const now = nowTs();
  queue = queue.filter((task) => parseTs(task.expiresAt) > now);
  queue = queue.map((task) => {
    if (task.type !== "snapshot") return task;
    if (!task.idempotencyKey || isLegacySnapshotIdempotencyKey(task)) {
      return {
        ...task,
        idempotencyKey: createSnapshotIdempotencyKey(
          task.sessionId,
          task.layer,
          task.version
        ),
      };
    }
    return task;
  });
  const latestSnapshotByScope = new Map<string, WorkbookSnapshotPersistenceTask>();
  const next: WorkbookPersistenceTask[] = [];
  queue.forEach((task) => {
    if (task.type === "snapshot") {
      const key = `${task.sessionId}:${task.layer}`;
      const current = latestSnapshotByScope.get(key);
      if (!current || task.version >= current.version) {
        latestSnapshotByScope.set(key, task);
      }
      return;
    }
    next.push(task);
  });
  queue = [...next, ...Array.from(latestSnapshotByScope.values())].sort(
    (left, right) => parseTs(left.createdAt) - parseTs(right.createdAt)
  );
  clampQueueLength();
};

const ensureRuntime = () => {
  if (runtimeInitialized || typeof window === "undefined") return;
  runtimeInitialized = true;
  const triggerFlush = () => {
    void flushWorkbookPersistenceQueue();
  };
  window.setInterval(triggerFlush, FLUSH_INTERVAL_MS);
  window.addEventListener("online", triggerFlush);
  window.addEventListener("focus", triggerFlush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      triggerFlush();
    }
  });
};

const computeRetryDelayMs = (attempt: number) => {
  const raw = RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(RETRY_MAX_DELAY_MS, raw);
  const jitter = Math.floor(capped * (0.15 + Math.random() * 0.2));
  return Math.min(RETRY_MAX_DELAY_MS, capped + jitter);
};

const isOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

const upsertTask = (task: WorkbookPersistenceTask) => {
  if (task.type === "snapshot") {
    const existingIndex = queue.findIndex(
      (entry) =>
        entry.type === "snapshot" &&
        entry.sessionId === task.sessionId &&
        entry.layer === task.layer
    );
    if (existingIndex >= 0) {
      const current = queue[existingIndex] as WorkbookSnapshotPersistenceTask;
      const nextVersion = Math.max(current.version, task.version);
      queue[existingIndex] = {
        ...current,
        version: nextVersion,
        payload: task.payload,
        updatedAt: nowIso(),
        retryAt: null,
        attempts: 0,
        idempotencyKey: task.idempotencyKey,
      };
      return;
    }
  }
  queue.push(task);
};

const executeTask = async (task: WorkbookPersistenceTask) => {
  if (task.type === "events") {
    await api.post<{ events: unknown[]; latestSeq: number }>(
      `/workbook/sessions/${encodeURIComponent(task.sessionId)}/events`,
      { events: task.events },
      {
        notifyDataUpdate: false,
        headers: buildIdempotencyHeaders("workbook-events", task.idempotencyKey),
      }
    );
    return;
  }
  await api.put<{
    id: string;
    sessionId: string;
    layer: WorkbookLayer;
    version: number;
    payload: unknown;
    accepted?: boolean;
    createdAt: string;
  }>(
    `/workbook/sessions/${encodeURIComponent(task.sessionId)}/snapshot`,
    {
      sessionId: task.sessionId,
      layer: task.layer,
      version: task.version,
      payload: task.payload,
    },
    {
      notifyDataUpdate: false,
      headers: buildIdempotencyHeaders("workbook-snapshot", task.idempotencyKey),
    }
  );
};

export const getWorkbookPersistenceQueueSnapshot = (): WorkbookPersistenceQueueSnapshot => {
  normalizeQueue();
  const nextRetryAt = queue
    .map((task) => task.retryAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => parseTs(left) - parseTs(right))[0] ?? null;
  return {
    pendingCount: queue.length,
    flushing,
    nextRetryAt,
  };
};

export const subscribeWorkbookPersistenceQueue = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const dropWorkbookPersistenceTasksForSession = (sessionId: string) => {
  ensureRuntime();
  normalizeQueue();
  const dropped = removeTasksBySessionId(sessionId);
  const pauseDeleted = pausedSessionsUntilTs.delete(sessionId);
  const blockDeleted = blockedSessions.delete(sessionId);
  if (dropped > 0) {
    persistQueue();
  }
  if (dropped > 0 || pauseDeleted || blockDeleted) {
    emit();
  }
  return dropped;
};

export const getWorkbookPersistencePendingCountForSession = (sessionId: string) => {
  if (!sessionId) return 0;
  normalizeQueue();
  return queue.reduce((count, task) => count + (task.sessionId === sessionId ? 1 : 0), 0);
};

export const pauseWorkbookPersistenceForSession = (
  sessionId: string,
  options?: { ttlMs?: number }
) => {
  if (!sessionId) return;
  const ttlMs = Number.isFinite(options?.ttlMs)
    ? Math.max(1_000, Math.trunc(options?.ttlMs ?? CONFLICT_PAUSE_DEFAULT_MS))
    : CONFLICT_PAUSE_DEFAULT_MS;
  pausedSessionsUntilTs.set(sessionId, nowTs() + ttlMs);
  emit();
};

export const resumeWorkbookPersistenceForSession = (sessionId: string) => {
  if (!sessionId) return;
  if (pausedSessionsUntilTs.delete(sessionId)) {
    emit();
  }
};

export const setWorkbookPersistenceBlockedForSession = (
  sessionId: string,
  blocked: boolean
) => {
  if (!sessionId) return;
  if (blocked) {
    if (!blockedSessions.has(sessionId)) {
      blockedSessions.add(sessionId);
      emit();
    }
    return;
  }
  if (blockedSessions.delete(sessionId)) {
    emit();
  }
};

export const setWorkbookPersistenceConflictHandler = (
  handler: WorkbookPersistenceConflictHandler | null
) => {
  onWorkbookPersistenceConflict = handler;
};

export const enqueueWorkbookEventsPersistence = (params: {
  sessionId: string;
  events: WorkbookClientEventInput[];
  idempotencyKey?: string;
}) => {
  ensureRuntime();
  const timestamp = nowIso();
  const idempotencyKey = params.idempotencyKey?.trim() || `event-${generateId()}`;
  const task: WorkbookEventsPersistenceTask = {
    id: generateId(),
    type: "events",
    sessionId: params.sessionId,
    events: safeJsonClone(params.events),
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: 0,
    retryAt: null,
    expiresAt: new Date(nowTs() + TASK_TTL_MS).toISOString(),
    idempotencyKey,
  };
  upsertTask(task);
  normalizeQueue();
  persistQueue();
  emit();
  void flushWorkbookPersistenceQueue();
};

export const enqueueWorkbookSnapshotPersistence = (params: {
  sessionId: string;
  layer: WorkbookLayer;
  version: number;
  payload: unknown;
  idempotencyKey?: string;
}) => {
  ensureRuntime();
  const timestamp = nowIso();
  const version = normalizeSnapshotVersion(params.version);
  const idempotencyKey =
    params.idempotencyKey?.trim() ||
    createSnapshotIdempotencyKey(params.sessionId, params.layer, version);
  const task: WorkbookSnapshotPersistenceTask = {
    id: generateId(),
    type: "snapshot",
    sessionId: params.sessionId,
    layer: params.layer,
    version,
    payload: safeJsonClone(params.payload),
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: 0,
    retryAt: null,
    expiresAt: new Date(nowTs() + TASK_TTL_MS).toISOString(),
    idempotencyKey,
  };
  upsertTask(task);
  normalizeQueue();
  persistQueue();
  emit();
  void flushWorkbookPersistenceQueue();
};

export const flushWorkbookPersistenceQueue = async () => {
  ensureRuntime();
  normalizeQueue();
  if (!isOnline()) return;
  if (flushing) return;
  if (queue.length === 0) return;
  if (!queue.some((task) => !isSessionPersistencePaused(task.sessionId))) return;
  flushing = true;
  emit();

  try {
    while (queue.length > 0) {
      cleanupExpiredSessionPauses();
      const executableTaskIndex = queue.findIndex((task) => {
        if (isSessionPersistencePaused(task.sessionId)) return false;
        return parseTs(task.retryAt) <= nowTs();
      });
      if (executableTaskIndex < 0) {
        break;
      }
      const task = queue[executableTaskIndex];
      try {
        await executeTask(task);
        queue.splice(executableTaskIndex, 1);
        persistQueue();
        emit();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const dropped = removeTasksBySessionId(task.sessionId);
          if (dropped === 0) {
            queue.splice(executableTaskIndex, 1);
          }
          persistQueue();
          emit();
          continue;
        }
        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          if (task.type === "snapshot") {
            // Snapshot ACL/routing mismatches should not purge queued event intents.
            queue.splice(executableTaskIndex, 1);
          } else {
            const dropped = removeTasksBySessionId(task.sessionId);
            if (dropped === 0) {
              queue.splice(executableTaskIndex, 1);
            }
          }
          persistQueue();
          emit();
          continue;
        }
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          error.code === "conflict"
        ) {
          const attempts = task.attempts + 1;
          if (attempts >= MAX_CONFLICT_ATTEMPTS_PER_TASK) {
            // Deterministic safeguard: do not keep replaying the same conflicting intent forever.
            queue.splice(executableTaskIndex, 1);
            pauseWorkbookPersistenceForSession(task.sessionId, {
              ttlMs: CONFLICT_PAUSE_DEFAULT_MS,
            });
            persistQueue();
            emit();
            onWorkbookPersistenceConflict?.(task.sessionId);
            break;
          }
          const retryDelayMs = computeRetryDelayMs(attempts);
          queue[executableTaskIndex] = {
            ...task,
            attempts,
            updatedAt: nowIso(),
            retryAt: new Date(nowTs() + retryDelayMs).toISOString(),
          };
          pauseWorkbookPersistenceForSession(task.sessionId, {
            ttlMs: Math.max(CONFLICT_PAUSE_DEFAULT_MS, retryDelayMs),
          });
          persistQueue();
          emit();
          onWorkbookPersistenceConflict?.(task.sessionId);
          break;
        }
        if (isRecoverableApiError(error)) {
          const attempts = task.attempts + 1;
          const nextRetryAt = new Date(
            nowTs() + computeRetryDelayMs(attempts)
          ).toISOString();
          queue[executableTaskIndex] = {
            ...task,
            attempts,
            updatedAt: nowIso(),
            retryAt: nextRetryAt,
          };
          persistQueue();
          emit();
          break;
        }
        queue.splice(executableTaskIndex, 1);
        persistQueue();
        emit();
      }
    }
  } finally {
    flushing = false;
    emit();
  }
};
