const workbookLatestSeqBySession = new Map<string, number>();

const normalizeSeq = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export const readWorkbookSessionLatestSeqCached = (
  sessionId: string,
  fallbackResolver: () => number
) => {
  const cached = workbookLatestSeqBySession.get(sessionId);
  if (typeof cached === "number" && Number.isFinite(cached)) {
    return normalizeSeq(cached);
  }
  const resolved = normalizeSeq(fallbackResolver());
  workbookLatestSeqBySession.set(sessionId, resolved);
  return resolved;
};

export const setWorkbookSessionLatestSeqCached = (sessionId: string, seq: number) => {
  workbookLatestSeqBySession.set(sessionId, normalizeSeq(seq));
};

export const bumpWorkbookSessionLatestSeqCached = (sessionId: string, seq: number) => {
  const nextSeq = normalizeSeq(seq);
  const currentSeq = workbookLatestSeqBySession.get(sessionId);
  if (typeof currentSeq !== "number" || !Number.isFinite(currentSeq) || nextSeq > currentSeq) {
    workbookLatestSeqBySession.set(sessionId, nextSeq);
    return nextSeq;
  }
  return normalizeSeq(currentSeq);
};

export const clearWorkbookSessionLatestSeqCached = (sessionId: string) => {
  workbookLatestSeqBySession.delete(sessionId);
};

export const clearWorkbookLatestSeqCache = () => {
  workbookLatestSeqBySession.clear();
};
