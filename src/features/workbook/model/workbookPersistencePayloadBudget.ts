const MAX_QUEUED_SNAPSHOT_PAYLOAD_CHARS = 900_000;

export const safeJsonClone = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

const estimateJsonChars = (value: unknown) => {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

export const shouldQueueWorkbookSnapshotPayload = (payload: unknown) =>
  estimateJsonChars(payload) <= MAX_QUEUED_SNAPSHOT_PAYLOAD_CHARS;
