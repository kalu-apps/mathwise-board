import { useCallback, useRef } from "react";

const SNAPSHOT_SYNC_WARNING_FAILURE_WINDOW_MS = 45_000;
const SNAPSHOT_SYNC_WARNING_MIN_FAILURES = 3;
const SNAPSHOT_SYNC_WARNING_COOLDOWN_MS = 90_000;
const SNAPSHOT_SYNC_WARNING_MESSAGE =
  "Резервное сохранение доски заметно задерживается. Проверьте сеть или VPN. Работа на доске продолжается.";

export const useWorkbookSnapshotRecoverableWarning = (
  setSaveSyncWarning: (message: string | null) => void
) => {
  const recoverableSnapshotIssueRef = useRef({
    firstFailureAtMs: 0,
    failureCount: 0,
    lastWarningAtMs: 0,
  });

  const clearRecoverableSnapshotIssue = useCallback(() => {
    recoverableSnapshotIssueRef.current.firstFailureAtMs = 0;
    recoverableSnapshotIssueRef.current.failureCount = 0;
  }, []);

  const noteRecoverableSnapshotIssue = useCallback(() => {
    const now = Date.now();
    const state = recoverableSnapshotIssueRef.current;
    if (
      state.firstFailureAtMs <= 0 ||
      now - state.firstFailureAtMs > SNAPSHOT_SYNC_WARNING_FAILURE_WINDOW_MS
    ) {
      state.firstFailureAtMs = now;
      state.failureCount = 1;
      return;
    }
    state.failureCount += 1;
    if (
      state.failureCount >= SNAPSHOT_SYNC_WARNING_MIN_FAILURES &&
      now - state.lastWarningAtMs >= SNAPSHOT_SYNC_WARNING_COOLDOWN_MS
    ) {
      state.lastWarningAtMs = now;
      setSaveSyncWarning(SNAPSHOT_SYNC_WARNING_MESSAGE);
    }
  }, [setSaveSyncWarning]);

  return { clearRecoverableSnapshotIssue, noteRecoverableSnapshotIssue };
};
