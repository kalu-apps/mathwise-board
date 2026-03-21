import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookEvent,
  WorkbookLibraryState,
  WorkbookPoint,
  WorkbookSession,
  WorkbookStroke,
  WorkbookTimerState,
} from "@/features/workbook/model/types";
import type { WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

export type SetState<T> = Dispatch<SetStateAction<T>>;

export type WorkbookSessionLoadAndAuthParams = {
  sessionId: string;
  isWorkbookSessionAuthLost: boolean;
  clearIncomingRealtimeApplyQueue: () => void;
  clearLocalPreviewPatchRuntime: () => void;
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: () => void;
  clearIncomingEraserPreviewRuntime: () => void;
  recoverChatMessagesFromEvents: (events: WorkbookEvent[]) => WorkbookChatMessage[];
  setSaveState: SetState<"saved" | "unsaved" | "saving" | "error">;
  setError: SetState<string | null>;
  setSaveSyncWarning: SetState<string | null>;
  setBootstrapReady: SetState<boolean>;
  setLoading: SetState<boolean>;
  setSession: SetState<WorkbookSession | null>;
  setBoardStrokes: SetState<WorkbookStroke[]>;
  setBoardObjects: SetState<WorkbookBoardObject[]>;
  setConstraints: SetState<WorkbookConstraint[]>;
  setBoardSettings: SetState<WorkbookBoardSettings>;
  setAnnotationStrokes: SetState<WorkbookStroke[]>;
  setLatestSeq: SetState<number>;
  setUndoDepth: SetState<number>;
  setRedoDepth: SetState<number>;
  setFocusPoint: SetState<WorkbookPoint | null>;
  setPointerPoint: SetState<WorkbookPoint | null>;
  setFocusPointsByUser: SetState<Record<string, WorkbookPoint>>;
  setPointerPointsByUser: SetState<Record<string, WorkbookPoint>>;
  setChatMessages: SetState<WorkbookChatMessage[]>;
  setComments: SetState<WorkbookComment[]>;
  setTimerState: SetState<WorkbookTimerState | null>;
  setLibraryState: SetState<WorkbookLibraryState>;
  setDocumentState: SetState<WorkbookDocumentState>;
  setRealtimeSyncWarning: SetState<string | null>;
  authRequiredRef: MutableRefObject<boolean>;
  loadSessionRequestIdRef: MutableRefObject<number>;
  firstInteractiveMetricReportedRef: MutableRefObject<boolean>;
  queuedBoardSettingsCommitRef: MutableRefObject<WorkbookBoardSettings | null>;
  queuedBoardSettingsHistoryBeforeRef: MutableRefObject<WorkbookBoardSettings | null>;
  boardSettingsCommitTimerRef: MutableRefObject<number | null>;
  latestSeqRef: MutableRefObject<number>;
  processedEventIdsRef: MutableRefObject<Set<string>>;
  dirtyRef: MutableRefObject<boolean>;
  undoStackRef: MutableRefObject<WorkbookHistoryEntry[]>;
  redoStackRef: MutableRefObject<WorkbookHistoryEntry[]>;
  focusResetTimersByUserRef: MutableRefObject<Map<string, number>>;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardObjectIndexByIdRef: MutableRefObject<Map<string, number>>;
  sessionResyncInFlightRef: MutableRefObject<boolean>;
  lastForcedResyncAtRef: MutableRefObject<number>;
};

export type WorkbookSessionLoadParams = Omit<
  WorkbookSessionLoadAndAuthParams,
  "setRealtimeSyncWarning" | "sessionResyncInFlightRef" | "lastForcedResyncAtRef"
>;
