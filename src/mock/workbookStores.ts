import {
  appendWorkbookSessionEvents,
  readWorkbookSessionEvents,
  readWorkbookSessionSnapshot,
  upsertWorkbookSessionSnapshot,
  type PersistedWorkbookEvent,
  type PersistedWorkbookSnapshot,
  type WorkbookEventInput,
} from "./db";

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
  read: (params) => readWorkbookSessionEvents(params),
  append: (params) => appendWorkbookSessionEvents(params),
};

export const workbookSnapshotStore: WorkbookSnapshotStore = {
  read: (params) => readWorkbookSessionSnapshot(params),
  upsert: (params) => upsertWorkbookSessionSnapshot(params),
};
