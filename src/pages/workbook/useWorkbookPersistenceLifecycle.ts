import { useEffect, type MutableRefObject } from "react";
import { flushWorkbookPersistenceQueue } from "@/features/workbook/model/persistenceQueue";

type PersistSnapshotsFn = (options?: { silent?: boolean; force?: boolean }) => Promise<boolean>;

type UseWorkbookPersistenceLifecycleParams = {
  sessionId: string | null;
  sessionReady: boolean;
  persistSnapshots: PersistSnapshotsFn;
  persistSnapshotsRef: MutableRefObject<PersistSnapshotsFn | null>;
  dirtyRef: MutableRefObject<boolean>;
  autosaveIntervalMs: number;
  queueFlushIntervalMs?: number;
};

export const useWorkbookPersistenceLifecycle = ({
  sessionId,
  sessionReady,
  persistSnapshots,
  persistSnapshotsRef,
  dirtyRef,
  autosaveIntervalMs,
  queueFlushIntervalMs = 4_000,
}: UseWorkbookPersistenceLifecycleParams) => {
  useEffect(() => {
    persistSnapshotsRef.current = persistSnapshots;
    return () => {
      persistSnapshotsRef.current = null;
    };
  }, [persistSnapshots, persistSnapshotsRef]);

  useEffect(() => {
    if (!sessionId || !sessionReady) return;
    void flushWorkbookPersistenceQueue();
    const intervalId = window.setInterval(() => {
      void flushWorkbookPersistenceQueue();
    }, queueFlushIntervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [queueFlushIntervalMs, sessionId, sessionReady]);

  useEffect(() => {
    const onBeforeUnload = () => {
      void persistSnapshots({ silent: true, force: true });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [persistSnapshots]);

  useEffect(() => {
    const flushPendingChanges = () => {
      if (!dirtyRef.current) return;
      void persistSnapshotsRef.current?.({ silent: true, force: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingChanges();
      }
    };
    window.addEventListener("pagehide", flushPendingChanges);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPendingChanges);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [dirtyRef, persistSnapshotsRef]);

  useEffect(() => {
    if (!sessionId || !sessionReady) return;
    const intervalId = window.setInterval(() => {
      if (!dirtyRef.current) return;
      void persistSnapshots({ force: true });
    }, autosaveIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [autosaveIntervalMs, dirtyRef, persistSnapshots, sessionId, sessionReady]);

  useEffect(
    () => () => {
      if (dirtyRef.current) {
        void persistSnapshots({ silent: true, force: true });
      }
    },
    [dirtyRef, persistSnapshots]
  );
};
