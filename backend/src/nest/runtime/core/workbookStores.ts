import {
  appendWorkbookSessionEvents,
  readWorkbookSessionEvents,
  readWorkbookSessionSnapshot,
  upsertWorkbookSessionSnapshot,
  type PersistedWorkbookEvent,
  type PersistedWorkbookSnapshot,
  type WorkbookEventInput,
} from "./db";

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const WORKBOOK_STORE_READ_TIMEOUT_MS = readPositiveInt(
  process.env.WORKBOOK_STORE_READ_TIMEOUT_MS,
  3_000
);
const WORKBOOK_STORE_WRITE_TIMEOUT_MS = readPositiveInt(
  process.env.WORKBOOK_STORE_WRITE_TIMEOUT_MS,
  5_000
);

const withTimeout = async <T>(task: Promise<T>, timeoutMs: number, code: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(code)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export interface WorkbookEventStore {
  read(params: {
    sessionId: string;
    afterSeq: number;
    limit?: number;
  }): Promise<{ events: PersistedWorkbookEvent[]; latestSeq: number }>;
  append(params: {
    sessionId: string;
    authorUserId: string;
    events: WorkbookEventInput[];
    limit?: number;
  }): Promise<{ events: PersistedWorkbookEvent[]; latestSeq: number; timestamp: string }>;
}

export interface WorkbookSnapshotStore {
  read(params: {
    sessionId: string;
    layer: "board" | "annotations";
  }): Promise<PersistedWorkbookSnapshot | null>;
  upsert(params: {
    sessionId: string;
    layer: "board" | "annotations";
    version: number;
    payload: unknown;
  }): Promise<PersistedWorkbookSnapshot>;
}

export const workbookEventStore: WorkbookEventStore = {
  read: (params) =>
    withTimeout(readWorkbookSessionEvents(params), WORKBOOK_STORE_READ_TIMEOUT_MS, "event_store_read_timeout"),
  append: (params) =>
    withTimeout(
      appendWorkbookSessionEvents(params),
      WORKBOOK_STORE_WRITE_TIMEOUT_MS,
      "event_store_append_timeout"
    ),
};

export const workbookSnapshotStore: WorkbookSnapshotStore = {
  read: (params) =>
    withTimeout(
      readWorkbookSessionSnapshot(params),
      WORKBOOK_STORE_READ_TIMEOUT_MS,
      "snapshot_store_read_timeout"
    ),
  upsert: (params) =>
    withTimeout(
      upsertWorkbookSessionSnapshot(params),
      WORKBOOK_STORE_WRITE_TIMEOUT_MS,
      "snapshot_store_upsert_timeout"
    ),
};
