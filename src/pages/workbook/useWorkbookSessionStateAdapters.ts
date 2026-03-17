import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  type StateUpdater,
  useWorkbookSessionStore,
} from "@/features/workbook/model/workbookSessionStore";
import { isWorkbookZustandStoreEnabled } from "@/features/workbook/model/featureFlags";
import type { WorkbookPoint } from "@/features/workbook/model/types";

const resolveStateUpdater = <T>(updater: StateUpdater<T>, current: T): T =>
  typeof updater === "function"
    ? (updater as (current: T) => T)(current)
    : updater;

const useDualState = <T>(params: {
  enabled: boolean;
  initialValue: T;
  storeValue: T;
  storeSetter: (updater: StateUpdater<T>) => void;
}) => {
  const { enabled, initialValue, storeValue, storeSetter } = params;
  const [localValue, setLocalValue] = useState(initialValue);
  const setValue = useCallback(
    (updater: StateUpdater<T>) => {
      if (enabled) {
        storeSetter(updater);
        return;
      }
      setLocalValue((current) => resolveStateUpdater(updater, current));
    },
    [enabled, storeSetter]
  );
  return [enabled ? storeValue : localValue, setValue] as const;
};

export const useWorkbookSessionStateAdapters = (sessionId: string) => {
  const zustandStoreEnabled = isWorkbookZustandStoreEnabled();
  const uiStore = useWorkbookSessionStore(useShallow((state) => state.ui));
  const collabStore = useWorkbookSessionStore(useShallow((state) => state.collab));
  const sceneStore = useWorkbookSessionStore(useShallow((state) => state.scene));
  const runtimeStore = useWorkbookSessionStore(useShallow((state) => state.runtime));
  const actions = useWorkbookSessionStore(useShallow((state) => state.actions));

  useEffect(() => {
    if (!zustandStoreEnabled) return;
    actions.resetForSession();
  }, [actions, sessionId, zustandStoreEnabled]);

  const [latestSeq, setLatestSeq] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: 0,
    storeValue: collabStore.latestSeq,
    storeSetter: actions.setLatestSeq,
  });

  const [realtimeSyncWarning, setRealtimeSyncWarning] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: null as string | null,
    storeValue: collabStore.realtimeSyncWarning,
    storeSetter: actions.setRealtimeSyncWarning,
  });

  const [isWorkbookStreamConnected, setIsWorkbookStreamConnected] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: false,
    storeValue: collabStore.isWorkbookStreamConnected,
    storeSetter: actions.setIsWorkbookStreamConnected,
  });

  const [isWorkbookLiveConnected, setIsWorkbookLiveConnected] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: false,
    storeValue: collabStore.isWorkbookLiveConnected,
    storeSetter: actions.setIsWorkbookLiveConnected,
  });

  const [isSessionChatOpen, setIsSessionChatOpen] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: false,
    storeValue: uiStore.isSessionChatOpen,
    storeSetter: actions.setIsSessionChatOpen,
  });

  const [isSessionChatMinimized, setIsSessionChatMinimized] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: false,
    storeValue: uiStore.isSessionChatMinimized,
    storeSetter: actions.setIsSessionChatMinimized,
  });

  const [isSessionChatMaximized, setIsSessionChatMaximized] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: false,
    storeValue: uiStore.isSessionChatMaximized,
    storeSetter: actions.setIsSessionChatMaximized,
  });

  const [isParticipantsCollapsed, setIsParticipantsCollapsed] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: false,
    storeValue: uiStore.isParticipantsCollapsed,
    storeSetter: actions.setIsParticipantsCollapsed,
  });

  const [sessionChatPosition, setSessionChatPosition] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: { x: 24, y: 96 } as WorkbookPoint,
    storeValue: uiStore.sessionChatPosition,
    storeSetter: actions.setSessionChatPosition,
  });

  const [contextbarPosition, setContextbarPosition] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: { x: 24, y: 18 } as WorkbookPoint,
    storeValue: uiStore.contextbarPosition,
    storeSetter: actions.setContextbarPosition,
  });

  const [floatingPanelsTop, setFloatingPanelsTop] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: 86,
    storeValue: uiStore.floatingPanelsTop,
    storeSetter: actions.setFloatingPanelsTop,
  });

  const [selectedObjectId, setSelectedObjectId] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: null as string | null,
    storeValue: sceneStore.selectedObjectId,
    storeSetter: actions.setSelectedObjectId,
  });

  const [selectedConstraintId, setSelectedConstraintId] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: null as string | null,
    storeValue: sceneStore.selectedConstraintId,
    storeSetter: actions.setSelectedConstraintId,
  });

  const [canvasViewport, setCanvasViewport] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: { x: 0, y: 0 } as WorkbookPoint,
    storeValue: sceneStore.canvasViewport,
    storeSetter: actions.setCanvasViewport,
  });

  const [viewportZoom, setViewportZoom] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: 1,
    storeValue: sceneStore.viewportZoom,
    storeSetter: actions.setViewportZoom,
  });

  const [focusPoint, setFocusPoint] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: null as WorkbookPoint | null,
    storeValue: runtimeStore.focusPoint,
    storeSetter: actions.setFocusPoint,
  });

  const [pointerPoint, setPointerPoint] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: null as WorkbookPoint | null,
    storeValue: runtimeStore.pointerPoint,
    storeSetter: actions.setPointerPoint,
  });

  const [focusPointsByUser, setFocusPointsByUser] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: {} as Record<string, WorkbookPoint>,
    storeValue: runtimeStore.focusPointsByUser,
    storeSetter: actions.setFocusPointsByUser,
  });

  const [pointerPointsByUser, setPointerPointsByUser] = useDualState({
    enabled: zustandStoreEnabled,
    initialValue: {} as Record<string, WorkbookPoint>,
    storeValue: runtimeStore.pointerPointsByUser,
    storeSetter: actions.setPointerPointsByUser,
  });

  return {
    zustandStoreEnabled,
    latestSeq,
    setLatestSeq,
    realtimeSyncWarning,
    setRealtimeSyncWarning,
    isWorkbookStreamConnected,
    setIsWorkbookStreamConnected,
    isWorkbookLiveConnected,
    setIsWorkbookLiveConnected,
    isSessionChatOpen,
    setIsSessionChatOpen,
    isSessionChatMinimized,
    setIsSessionChatMinimized,
    isSessionChatMaximized,
    setIsSessionChatMaximized,
    isParticipantsCollapsed,
    setIsParticipantsCollapsed,
    sessionChatPosition,
    setSessionChatPosition,
    contextbarPosition,
    setContextbarPosition,
    floatingPanelsTop,
    setFloatingPanelsTop,
    selectedObjectId,
    setSelectedObjectId,
    selectedConstraintId,
    setSelectedConstraintId,
    canvasViewport,
    setCanvasViewport,
    viewportZoom,
    setViewportZoom,
    focusPoint,
    setFocusPoint,
    pointerPoint,
    setPointerPoint,
    focusPointsByUser,
    setFocusPointsByUser,
    pointerPointsByUser,
    setPointerPointsByUser,
  };
};
