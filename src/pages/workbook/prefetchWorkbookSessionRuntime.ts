let workbookSessionRuntimePrefetchPromise: Promise<void> | null = null;

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
