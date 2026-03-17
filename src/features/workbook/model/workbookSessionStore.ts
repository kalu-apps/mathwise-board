import { create } from "zustand";
import type { WorkbookPoint } from "./types";

export type StateUpdater<T> = T | ((current: T) => T);

const resolveStateUpdater = <T>(updater: StateUpdater<T>, current: T): T =>
  typeof updater === "function"
    ? (updater as (current: T) => T)(current)
    : updater;

type WorkbookSessionUiSlice = {
  isSessionChatOpen: boolean;
  isSessionChatMinimized: boolean;
  isSessionChatMaximized: boolean;
  isParticipantsCollapsed: boolean;
  sessionChatPosition: WorkbookPoint;
  contextbarPosition: WorkbookPoint;
  floatingPanelsTop: number;
};

type WorkbookSessionCollabSlice = {
  latestSeq: number;
  realtimeSyncWarning: string | null;
  isWorkbookStreamConnected: boolean;
  isWorkbookLiveConnected: boolean;
};

type WorkbookSessionSceneSlice = {
  selectedObjectId: string | null;
  selectedConstraintId: string | null;
  canvasViewport: WorkbookPoint;
  viewportZoom: number;
};

type WorkbookSessionRuntimeSlice = {
  focusPoint: WorkbookPoint | null;
  pointerPoint: WorkbookPoint | null;
  focusPointsByUser: Record<string, WorkbookPoint>;
  pointerPointsByUser: Record<string, WorkbookPoint>;
};

type WorkbookSessionMediaSlice = {
  micEnabled: boolean;
};

const initialUiSlice = (): WorkbookSessionUiSlice => ({
  isSessionChatOpen: false,
  isSessionChatMinimized: false,
  isSessionChatMaximized: false,
  isParticipantsCollapsed: false,
  sessionChatPosition: { x: 24, y: 96 },
  contextbarPosition: { x: 24, y: 18 },
  floatingPanelsTop: 86,
});

const initialCollabSlice = (): WorkbookSessionCollabSlice => ({
  latestSeq: 0,
  realtimeSyncWarning: null,
  isWorkbookStreamConnected: false,
  isWorkbookLiveConnected: false,
});

const initialSceneSlice = (): WorkbookSessionSceneSlice => ({
  selectedObjectId: null,
  selectedConstraintId: null,
  canvasViewport: { x: 0, y: 0 },
  viewportZoom: 1,
});

const initialRuntimeSlice = (): WorkbookSessionRuntimeSlice => ({
  focusPoint: null,
  pointerPoint: null,
  focusPointsByUser: {},
  pointerPointsByUser: {},
});

const initialMediaSlice = (): WorkbookSessionMediaSlice => ({
  micEnabled: true,
});

type WorkbookSessionStoreActions = {
  setLatestSeq: (updater: StateUpdater<number>) => void;
  setRealtimeSyncWarning: (updater: StateUpdater<string | null>) => void;
  setIsWorkbookStreamConnected: (updater: StateUpdater<boolean>) => void;
  setIsWorkbookLiveConnected: (updater: StateUpdater<boolean>) => void;
  setIsSessionChatOpen: (updater: StateUpdater<boolean>) => void;
  setIsSessionChatMinimized: (updater: StateUpdater<boolean>) => void;
  setIsSessionChatMaximized: (updater: StateUpdater<boolean>) => void;
  setIsParticipantsCollapsed: (updater: StateUpdater<boolean>) => void;
  setSessionChatPosition: (updater: StateUpdater<WorkbookPoint>) => void;
  setContextbarPosition: (updater: StateUpdater<WorkbookPoint>) => void;
  setFloatingPanelsTop: (updater: StateUpdater<number>) => void;
  setSelectedObjectId: (updater: StateUpdater<string | null>) => void;
  setSelectedConstraintId: (updater: StateUpdater<string | null>) => void;
  setCanvasViewport: (updater: StateUpdater<WorkbookPoint>) => void;
  setViewportZoom: (updater: StateUpdater<number>) => void;
  setFocusPoint: (updater: StateUpdater<WorkbookPoint | null>) => void;
  setPointerPoint: (updater: StateUpdater<WorkbookPoint | null>) => void;
  setFocusPointsByUser: (updater: StateUpdater<Record<string, WorkbookPoint>>) => void;
  setPointerPointsByUser: (updater: StateUpdater<Record<string, WorkbookPoint>>) => void;
  setMicEnabled: (updater: StateUpdater<boolean>) => void;
  resetForSession: () => void;
};

type WorkbookSessionStoreState = {
  ui: WorkbookSessionUiSlice;
  collab: WorkbookSessionCollabSlice;
  scene: WorkbookSessionSceneSlice;
  runtime: WorkbookSessionRuntimeSlice;
  media: WorkbookSessionMediaSlice;
  actions: WorkbookSessionStoreActions;
};

export const useWorkbookSessionStore = create<WorkbookSessionStoreState>()((set) => ({
  ui: initialUiSlice(),
  collab: initialCollabSlice(),
  scene: initialSceneSlice(),
  runtime: initialRuntimeSlice(),
  media: initialMediaSlice(),
  actions: {
    setLatestSeq: (updater) => {
      set((state) => ({
        collab: {
          ...state.collab,
          latestSeq: resolveStateUpdater(updater, state.collab.latestSeq),
        },
      }));
    },
    setRealtimeSyncWarning: (updater) => {
      set((state) => ({
        collab: {
          ...state.collab,
          realtimeSyncWarning: resolveStateUpdater(updater, state.collab.realtimeSyncWarning),
        },
      }));
    },
    setIsWorkbookStreamConnected: (updater) => {
      set((state) => ({
        collab: {
          ...state.collab,
          isWorkbookStreamConnected: resolveStateUpdater(
            updater,
            state.collab.isWorkbookStreamConnected
          ),
        },
      }));
    },
    setIsWorkbookLiveConnected: (updater) => {
      set((state) => ({
        collab: {
          ...state.collab,
          isWorkbookLiveConnected: resolveStateUpdater(
            updater,
            state.collab.isWorkbookLiveConnected
          ),
        },
      }));
    },
    setIsSessionChatOpen: (updater) => {
      set((state) => ({
        ui: {
          ...state.ui,
          isSessionChatOpen: resolveStateUpdater(updater, state.ui.isSessionChatOpen),
        },
      }));
    },
    setIsSessionChatMinimized: (updater) => {
      set((state) => ({
        ui: {
          ...state.ui,
          isSessionChatMinimized: resolveStateUpdater(updater, state.ui.isSessionChatMinimized),
        },
      }));
    },
    setIsSessionChatMaximized: (updater) => {
      set((state) => ({
        ui: {
          ...state.ui,
          isSessionChatMaximized: resolveStateUpdater(updater, state.ui.isSessionChatMaximized),
        },
      }));
    },
    setIsParticipantsCollapsed: (updater) => {
      set((state) => ({
        ui: {
          ...state.ui,
          isParticipantsCollapsed: resolveStateUpdater(
            updater,
            state.ui.isParticipantsCollapsed
          ),
        },
      }));
    },
    setSessionChatPosition: (updater) => {
      set((state) => ({
        ui: {
          ...state.ui,
          sessionChatPosition: resolveStateUpdater(updater, state.ui.sessionChatPosition),
        },
      }));
    },
    setContextbarPosition: (updater) => {
      set((state) => ({
        ui: {
          ...state.ui,
          contextbarPosition: resolveStateUpdater(updater, state.ui.contextbarPosition),
        },
      }));
    },
    setFloatingPanelsTop: (updater) => {
      set((state) => ({
        ui: {
          ...state.ui,
          floatingPanelsTop: resolveStateUpdater(updater, state.ui.floatingPanelsTop),
        },
      }));
    },
    setSelectedObjectId: (updater) => {
      set((state) => ({
        scene: {
          ...state.scene,
          selectedObjectId: resolveStateUpdater(updater, state.scene.selectedObjectId),
        },
      }));
    },
    setSelectedConstraintId: (updater) => {
      set((state) => ({
        scene: {
          ...state.scene,
          selectedConstraintId: resolveStateUpdater(updater, state.scene.selectedConstraintId),
        },
      }));
    },
    setCanvasViewport: (updater) => {
      set((state) => ({
        scene: {
          ...state.scene,
          canvasViewport: resolveStateUpdater(updater, state.scene.canvasViewport),
        },
      }));
    },
    setViewportZoom: (updater) => {
      set((state) => ({
        scene: {
          ...state.scene,
          viewportZoom: resolveStateUpdater(updater, state.scene.viewportZoom),
        },
      }));
    },
    setFocusPoint: (updater) => {
      set((state) => ({
        runtime: {
          ...state.runtime,
          focusPoint: resolveStateUpdater(updater, state.runtime.focusPoint),
        },
      }));
    },
    setPointerPoint: (updater) => {
      set((state) => ({
        runtime: {
          ...state.runtime,
          pointerPoint: resolveStateUpdater(updater, state.runtime.pointerPoint),
        },
      }));
    },
    setFocusPointsByUser: (updater) => {
      set((state) => ({
        runtime: {
          ...state.runtime,
          focusPointsByUser: resolveStateUpdater(updater, state.runtime.focusPointsByUser),
        },
      }));
    },
    setPointerPointsByUser: (updater) => {
      set((state) => ({
        runtime: {
          ...state.runtime,
          pointerPointsByUser: resolveStateUpdater(updater, state.runtime.pointerPointsByUser),
        },
      }));
    },
    setMicEnabled: (updater) => {
      set((state) => ({
        media: {
          ...state.media,
          micEnabled: resolveStateUpdater(updater, state.media.micEnabled),
        },
      }));
    },
    resetForSession: () => {
      set({
        ui: initialUiSlice(),
        collab: initialCollabSlice(),
        scene: initialSceneSlice(),
        runtime: initialRuntimeSlice(),
        media: initialMediaSlice(),
      });
    },
  },
}));

