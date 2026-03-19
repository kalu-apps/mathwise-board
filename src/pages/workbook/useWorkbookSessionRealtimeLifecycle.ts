import { startTransition, useCallback, useEffect } from "react";
import type { WorkbookSessionParticipant } from "@/features/workbook/model/types";
import { useWorkbookRealtimeApplyQueue } from "@/features/workbook/model/useWorkbookRealtimeApplyQueue";
import {
  dropWorkbookPersistenceTasksForSession,
  flushWorkbookPersistenceQueue,
} from "@/features/workbook/model/persistenceQueue";
import { useWorkbookSessionLoadAndAuth } from "./useWorkbookSessionLoadAndAuth";
import { useWorkbookRealtimeTransport } from "./useWorkbookRealtimeTransport";
import { useWorkbookSessionTabLock } from "./useWorkbookSessionTabLock";
import { useWorkbookPersonalBoardSettingsPersistence } from "./useWorkbookPersonalBoardSettingsPersistence";
import { useWorkbookPresenceLifecycle } from "./useWorkbookPresenceLifecycle";
import { useWorkbookSessionChatUiEffects } from "./useWorkbookSessionChatUiEffects";
import { useWorkbookPersistSnapshots } from "./useWorkbookPersistSnapshots";
import { useWorkbookPersistenceLifecycle } from "./useWorkbookPersistenceLifecycle";

type RealtimeApplyQueueParams = Parameters<typeof useWorkbookRealtimeApplyQueue>[0];
type LoadAndAuthParams = Omit<
  Parameters<typeof useWorkbookSessionLoadAndAuth>[0],
  "clearIncomingRealtimeApplyQueue"
>;
type RealtimeTransportParams = Omit<
  Parameters<typeof useWorkbookRealtimeTransport>[0],
  "sessionId" | "loadSession" | "clearIncomingRealtimeApplyQueue" | "enqueueIncomingRealtimeApply" | "onAuthRequired"
>;
type SessionTabLockParams = Omit<
  Parameters<typeof useWorkbookSessionTabLock>[0],
  "onBecomePassive"
>;
type PersonalBoardSettingsParams = Parameters<
  typeof useWorkbookPersonalBoardSettingsPersistence
>[0];
type PresenceLifecycleParams = Omit<
  Parameters<typeof useWorkbookPresenceLifecycle>[0],
  "onHeartbeatParticipants"
>;
type SessionChatUiEffectsParams = Parameters<typeof useWorkbookSessionChatUiEffects>[0];
type PersistSnapshotsParams = Omit<
  Parameters<typeof useWorkbookPersistSnapshots>[0],
  "handleRealtimeAuthRequired"
>;
type PersistenceLifecycleParams = Omit<
  Parameters<typeof useWorkbookPersistenceLifecycle>[0],
  "persistSnapshots"
>;

interface UseWorkbookSessionRealtimeLifecycleParams {
  realtimeApplyQueueParams: RealtimeApplyQueueParams;
  loadAndAuthParams: LoadAndAuthParams;
  clearLocalPreviewPatchRuntime: () => void;
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: () => void;
  clearIncomingEraserPreviewRuntime: () => void;
  realtimeTransportParams: RealtimeTransportParams;
  sessionTabLockParams: SessionTabLockParams;
  personalBoardSettingsParams: PersonalBoardSettingsParams;
  presenceLifecycleParams: PresenceLifecycleParams;
  areParticipantsEqual: (
    current: WorkbookSessionParticipant[],
    next: WorkbookSessionParticipant[]
  ) => boolean;
  sessionChatUiEffectsParams: SessionChatUiEffectsParams;
  persistSnapshotsParams: PersistSnapshotsParams;
  persistenceLifecycleParams: PersistenceLifecycleParams;
}

export const useWorkbookSessionRealtimeLifecycle = ({
  realtimeApplyQueueParams,
  loadAndAuthParams,
  clearLocalPreviewPatchRuntime,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  realtimeTransportParams,
  sessionTabLockParams,
  personalBoardSettingsParams,
  presenceLifecycleParams,
  areParticipantsEqual,
  sessionChatUiEffectsParams,
  persistSnapshotsParams,
  persistenceLifecycleParams,
}: UseWorkbookSessionRealtimeLifecycleParams) => {
  const {
    enqueueIncomingRealtimeApply,
    clearIncomingRealtimeApplyQueue,
  } = useWorkbookRealtimeApplyQueue(realtimeApplyQueueParams);

  const {
    loadSession,
    handleRealtimeAuthRequired,
    handleRealtimeConflict,
  } = useWorkbookSessionLoadAndAuth({
    ...loadAndAuthParams,
    clearIncomingRealtimeApplyQueue,
  });

  const {
    sessionId,
    isWorkbookSessionAuthLost,
    authRequiredRef,
    sessionResyncInFlightRef,
    setBootstrapReady,
    setLoading,
    setSaveState,
    setSaveSyncWarning,
    setSession,
  } = loadAndAuthParams;

  const {
    setRealtimeSyncWarning,
    setIsWorkbookStreamConnected,
    setIsWorkbookLiveConnected,
  } = realtimeTransportParams;

  useEffect(() => {
    if (!sessionId || !isWorkbookSessionAuthLost) return;
    authRequiredRef.current = true;
    sessionResyncInFlightRef.current = false;
    dropWorkbookPersistenceTasksForSession(sessionId);
    clearIncomingRealtimeApplyQueue();
    clearLocalPreviewPatchRuntime();
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    setIsWorkbookStreamConnected(false);
    setIsWorkbookLiveConnected(false);
    setRealtimeSyncWarning(null);
    setBootstrapReady(false);
    setSaveState("error");
    setSaveSyncWarning("Сессия недоступна: требуется повторная авторизация.");
    setSession(null);
    setLoading(false);
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [
    authRequiredRef,
    clearIncomingEraserPreviewRuntime,
    clearIncomingRealtimeApplyQueue,
    clearLocalPreviewPatchRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    isWorkbookSessionAuthLost,
    sessionId,
    sessionResyncInFlightRef,
    setBootstrapReady,
    setIsWorkbookLiveConnected,
    setIsWorkbookStreamConnected,
    setLoading,
    setRealtimeSyncWarning,
    setSaveState,
    setSaveSyncWarning,
    setSession,
  ]);

  useWorkbookRealtimeTransport({
    ...realtimeTransportParams,
    sessionId,
    loadSession,
    clearIncomingRealtimeApplyQueue,
    enqueueIncomingRealtimeApply,
    onAuthRequired: handleRealtimeAuthRequired,
  });

  const handleSessionTabBecomePassive = useCallback(() => {
    void persistenceLifecycleParams.persistSnapshotsRef.current?.({
      silent: true,
      force: true,
    });
    void flushWorkbookPersistenceQueue();
  }, [persistenceLifecycleParams.persistSnapshotsRef]);

  useWorkbookSessionTabLock({
    ...sessionTabLockParams,
    onBecomePassive: handleSessionTabBecomePassive,
  });

  useWorkbookPersonalBoardSettingsPersistence(personalBoardSettingsParams);

  const handlePresenceParticipantsHeartbeat = useCallback(
    (participants: WorkbookSessionParticipant[]) => {
      startTransition(() => {
        setSession((current) =>
          current
            ? areParticipantsEqual(current.participants, participants)
              ? current
              : { ...current, participants }
            : current
        );
      });
    },
    [areParticipantsEqual, setSession]
  );

  useWorkbookPresenceLifecycle({
    ...presenceLifecycleParams,
    onHeartbeatParticipants: handlePresenceParticipantsHeartbeat,
  });

  useWorkbookSessionChatUiEffects(sessionChatUiEffectsParams);

  const persistSnapshots = useWorkbookPersistSnapshots({
    ...persistSnapshotsParams,
    handleRealtimeAuthRequired,
  });

  useWorkbookPersistenceLifecycle({
    ...persistenceLifecycleParams,
    persistSnapshots,
  });

  return {
    persistSnapshots,
    handleRealtimeAuthRequired,
    handleRealtimeConflict,
    enqueueIncomingRealtimeApply,
  };
};
