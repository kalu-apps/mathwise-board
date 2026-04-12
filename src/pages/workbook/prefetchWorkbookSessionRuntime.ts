let workbookSessionRuntimePrefetchPromise: Promise<void> | null = null;
let workbookSessionRuntimeIdleScheduled = false;

export const prefetchWorkbookSessionRuntime = () => {
  if (workbookSessionRuntimePrefetchPromise) {
    return workbookSessionRuntimePrefetchPromise;
  }
  workbookSessionRuntimePrefetchPromise = import("./WorkbookSessionPage")
    .then(() => undefined)
    .catch((error) => {
      workbookSessionRuntimePrefetchPromise = null;
      throw error;
    });
  return workbookSessionRuntimePrefetchPromise;
};

const scheduleIdlePrefetch = (timeoutMs: number) => {
  if (typeof window === "undefined") return;
  if (workbookSessionRuntimeIdleScheduled) return;
  if (workbookSessionRuntimePrefetchPromise) return;
  workbookSessionRuntimeIdleScheduled = true;

  const runPrefetch = () => {
    workbookSessionRuntimeIdleScheduled = false;
    void prefetchWorkbookSessionRuntime();
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(runPrefetch, { timeout: timeoutMs });
    return;
  }

  window.setTimeout(runPrefetch, Math.max(0, Math.trunc(timeoutMs / 2)));
};

export const prefetchWorkbookSessionRuntimeOnIdle = (timeoutMs = 1_200) => {
  scheduleIdlePrefetch(timeoutMs);
};
