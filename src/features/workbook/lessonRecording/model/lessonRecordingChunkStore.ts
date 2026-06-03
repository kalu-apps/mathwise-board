type LessonRecordingChunkRecord = {
  sequence: number;
  blob: Blob;
};

export type LessonRecordingChunkStore = {
  append: (blob: Blob) => Promise<void>;
  buildBlob: (mimeType: string) => Promise<Blob | null>;
  clear: () => Promise<void>;
};

const DATABASE_NAME = "mathwise-lesson-recordings";
const DATABASE_VERSION = 1;
const STORE_NAME = "recording-chunks";

const createMemoryChunkStore = (): LessonRecordingChunkStore => {
  const records: LessonRecordingChunkRecord[] = [];
  let nextSequence = 0;

  return {
    append: async (blob) => {
      records.push({ sequence: nextSequence, blob });
      nextSequence += 1;
    },
    buildBlob: async (mimeType) => {
      if (records.length === 0) return null;
      const orderedChunks = records
        .slice()
        .sort((left, right) => left.sequence - right.sequence)
        .map((record) => record.blob);
      return new Blob(orderedChunks, { type: mimeType });
    },
    clear: async () => {
      records.length = 0;
    },
  };
};

const resolveRecordingSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `recording-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException("IndexedDB transaction aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new DOMException("IndexedDB transaction failed"));
  });

const openRecordingDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new DOMException("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: ["sessionId", "sequence"],
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new DOMException("IndexedDB upgrade is blocked"));
  });

const createIndexedDbChunkStore = (db: IDBDatabase): LessonRecordingChunkStore => {
  const sessionId = resolveRecordingSessionId();
  const memoryFallbackRecords: LessonRecordingChunkRecord[] = [];
  let nextSequence = 0;

  const readStoredRecords = () =>
    new Promise<LessonRecordingChunkRecord[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER]);
      const request = store.openCursor(range);
      const records: LessonRecordingChunkRecord[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(records);
          return;
        }
        const value = cursor.value as { sequence?: unknown; blob?: unknown };
        if (typeof value.sequence === "number" && value.blob instanceof Blob) {
          records.push({ sequence: value.sequence, blob: value.blob });
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });

  return {
    append: async (blob) => {
      const sequence = nextSequence;
      nextSequence += 1;
      try {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put({
          sessionId,
          sequence,
          blob,
        });
        await transactionDone(transaction);
      } catch {
        memoryFallbackRecords.push({ sequence, blob });
      }
    },
    buildBlob: async (mimeType) => {
      const storedRecords = await readStoredRecords().catch(() => []);
      const records = [...storedRecords, ...memoryFallbackRecords].sort(
        (left, right) => left.sequence - right.sequence
      );
      if (records.length === 0) return null;
      return new Blob(
        records.map((record) => record.blob),
        { type: mimeType }
      );
    },
    clear: async () => {
      memoryFallbackRecords.length = 0;
      try {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER]);
        transaction.objectStore(STORE_NAME).delete(range);
        await transactionDone(transaction);
      } catch {
        // Best-effort cleanup. Failed removal should not block the lesson UI.
      } finally {
        db.close();
      }
    },
  };
};

export const createLessonRecordingChunkStore = async (): Promise<LessonRecordingChunkStore> => {
  try {
    const db = await openRecordingDatabase();
    return createIndexedDbChunkStore(db);
  } catch {
    return createMemoryChunkStore();
  }
};
