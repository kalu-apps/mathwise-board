import { useMemo, useRef } from "react";
import type {
  WorkbookBoardSettings,
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookPoint,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookStrokePreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { WorkbookAreaSelectionClipboard } from "@/features/workbook/model/workbookSessionUiTypes";
import type { WorkbookRecoveryMode } from "@/features/workbook/model/workbookPerformance";
import { generateId } from "@/shared/lib/id";
import { DEFAULT_BOARD_SETTINGS } from "./WorkbookSessionPage.core";
import type { WorkbookHistoryEntry, WorkbookHistoryOperation } from "./WorkbookSessionPage.geometry";

export const useWorkbookSessionRefs = () => {
  const selectedTextDraftValueRef = useRef("");
  const selectedTextDraftObjectIdRef = useRef<string | null>(null);
  const selectedTextDraftDirtyRef = useRef(false);
  const selectedTextDraftCommitTimerRef = useRef<number | null>(null);
  const shapeAngleDraftValuesRef = useRef<Map<number, string>>(new Map());
  const shapeAngleDraftCommitTimersRef = useRef<Map<number, number>>(new Map());
  const shapeAngleDraftObjectIdRef = useRef<string | null>(null);
  const shapeSegmentDraftValuesRef = useRef<Map<number, string>>(new Map());
  const shapeSegmentDraftCommitTimersRef = useRef<Map<number, number>>(new Map());
  const shapeSegmentDraftObjectIdRef = useRef<string | null>(null);
  const lineDraftObjectIdRef = useRef<string | null>(null);
  const shapeDraftObjectIdRef = useRef<string | null>(null);
  const dividerDraftObjectIdRef = useRef<string | null>(null);
  const graphDraftObjectIdRef = useRef<string | null>(null);
  const graphCatalogCursorTimeoutRef = useRef<number | null>(null);
  const suppressAutoPanelSelectionRef = useRef<string | null>(null);
  const areaSelectionClipboardRef = useRef<WorkbookAreaSelectionClipboard | null>(null);
  const sessionRootRef = useRef<HTMLElement | null>(null);
  const sessionHeadRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const utilityPanelRef = useRef<HTMLDivElement | null>(null);
  const boardFileInputRef = useRef<HTMLInputElement | null>(null);
  const docsInputRef = useRef<HTMLInputElement | null>(null);
  const focusResetTimersByUserRef = useRef<Map<string, number>>(new Map());
  const dirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const laserClearInFlightRef = useRef(false);
  const autosaveDebounceRef = useRef<number | null>(null);
  const dirtyRevisionRef = useRef(0);
  const pendingAutosaveAfterSaveRef = useRef(false);
  const persistSnapshotsRef = useRef<
    ((options?: { silent?: boolean; force?: boolean }) => Promise<boolean>) | null
  >(null);
  const authRequiredRef = useRef(false);
  const undoStackRef = useRef<WorkbookHistoryEntry[]>([]);
  const redoStackRef = useRef<WorkbookHistoryEntry[]>([]);
  const latestSeqRef = useRef(0);
  const lastAppliedSeqRef = useRef(0);
  const recoveryModeRef = useRef<WorkbookRecoveryMode>("bootstrapping");
  const lastAppliedBoardSettingsSeqRef = useRef(0);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const applyHistoryOperationsRef = useRef<(operations: WorkbookHistoryOperation[]) => void>(
    () => {}
  );
  const sessionChatListRef = useRef<HTMLDivElement | null>(null);
  const sessionChatRef = useRef<HTMLDivElement | null>(null);
  const contextbarRef = useRef<HTMLDivElement | null>(null);
  const sessionChatShouldScrollToUnreadRef = useRef(false);
  const sessionChatDragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const contextbarDragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const presenceLeaveSentRef = useRef(false);
  const presenceTabIdRef = useRef(`tab_${generateId()}`);
  const sessionResyncInFlightRef = useRef(false);
  const realtimeDisconnectSinceRef = useRef<number | null>(null);
  const lastForcedResyncAtRef = useRef<number>(0);
  const loadSessionRequestIdRef = useRef(0);
  const firstInteractiveMetricReportedRef = useRef(false);
  const boardObjectsRef = useRef<WorkbookBoardObject[]>([]);
  const boardObjectIndexByIdRef = useRef<Map<string, number>>(new Map());
  const boardStrokesRef = useRef<WorkbookStroke[]>([]);
  const annotationStrokesRef = useRef<WorkbookStroke[]>([]);
  const constraintsRef = useRef<WorkbookConstraint[]>([]);
  const boardSettingsRef = useRef<WorkbookBoardSettings>(DEFAULT_BOARD_SETTINGS);
  const documentStateRef = useRef<WorkbookDocumentState>({
    assets: [],
    activeAssetId: null,
    page: 1,
    zoom: 1,
    annotations: [],
  });
  const queuedBoardSettingsCommitRef = useRef<WorkbookBoardSettings | null>(null);
  const queuedBoardSettingsHistoryBeforeRef = useRef<WorkbookBoardSettings | null>(null);
  const boardSettingsCommitTimerRef = useRef<number | null>(null);
  const boardSettingsCommitInFlightRef = useRef(false);
  const personalBoardSettingsReadyRef = useRef(false);
  const skipNextPersonalBoardSettingsPersistRef = useRef(false);
  const objectUpdateQueuedPatchRef = useRef<Map<string, Partial<WorkbookBoardObject>>>(new Map());
  const objectUpdateTimersRef = useRef<Map<string, number>>(new Map());
  const objectUpdateInFlightRef = useRef<Set<string>>(new Set());
  const objectUpdateDispatchOptionsRef = useRef<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >(new Map());
  const objectUpdateHistoryBeforeRef = useRef<Map<string, WorkbookBoardObject>>(new Map());
  const objectPreviewQueuedPatchRef = useRef<Map<string, Partial<WorkbookBoardObject>>>(new Map());
  const objectPreviewQueuedAtRef = useRef<Map<string, number>>(new Map());
  const objectPreviewVersionRef = useRef<Map<string, number>>(new Map());
  const incomingPreviewQueuedPatchRef = useRef<Map<string, Partial<WorkbookBoardObject>[]>>(
    new Map()
  );
  const incomingPreviewVersionByAuthorObjectRef = useRef<Map<string, number>>(new Map());
  const strokePreviewQueuedByIdRef = useRef<
    Map<string, { stroke: WorkbookStroke; previewVersion: number }>
  >(new Map());
  const strokePreviewQueuedAtRef = useRef<Map<string, number>>(new Map());
  const eraserPreviewQueuedByGestureRef = useRef<
    Map<
      string,
      {
        gestureId: string;
        layer: "board" | "annotation";
        page: number;
        radius: number;
        points: WorkbookPoint[];
        ended?: boolean;
      }
    >
  >(new Map());
  const eraserPreviewQueuedAtRef = useRef<Map<string, number>>(new Map());
  const incomingStrokePreviewQueuedRef = useRef<Map<string, WorkbookStrokePreviewEntry | null>>(
    new Map()
  );
  const incomingStrokePreviewFrameRef = useRef<number | null>(null);
  const incomingStrokePreviewVersionRef = useRef<Map<string, number>>(new Map());
  const incomingEraserPreviewTimersRef = useRef<Map<string, number>>(new Map());
  const finalizedStrokePreviewIdsRef = useRef<Set<string>>(new Set());
  const objectLastCommittedEventAtRef = useRef<Map<string, number>>(new Map());
  const incomingPreviewFrameRef = useRef<number | null>(null);
  const localPreviewQueuedPatchRef = useRef<Map<string, Partial<WorkbookBoardObject>>>(new Map());
  const localPreviewFrameRef = useRef<number | null>(null);
  const workbookLiveSendRef = useRef<((events: WorkbookClientEventInput[]) => boolean) | null>(
    null
  );
  const volatileSyncTimerRef = useRef<number | null>(null);
  const viewportSyncLastSentAtRef = useRef(0);
  const viewportSyncQueuedOffsetRef = useRef<WorkbookPoint | null>(null);
  const viewportLastReceivedAtRef = useRef(0);

  return useMemo(
    () => ({
      selectedTextDraftValueRef,
      selectedTextDraftObjectIdRef,
      selectedTextDraftDirtyRef,
      selectedTextDraftCommitTimerRef,
      shapeAngleDraftValuesRef,
      shapeAngleDraftCommitTimersRef,
      shapeAngleDraftObjectIdRef,
      shapeSegmentDraftValuesRef,
      shapeSegmentDraftCommitTimersRef,
      shapeSegmentDraftObjectIdRef,
      lineDraftObjectIdRef,
      shapeDraftObjectIdRef,
      dividerDraftObjectIdRef,
      graphDraftObjectIdRef,
      graphCatalogCursorTimeoutRef,
      suppressAutoPanelSelectionRef,
      areaSelectionClipboardRef,
      sessionRootRef,
      sessionHeadRef,
      workspaceRef,
      utilityPanelRef,
      boardFileInputRef,
      docsInputRef,
      focusResetTimersByUserRef,
      dirtyRef,
      isSavingRef,
      laserClearInFlightRef,
      autosaveDebounceRef,
      dirtyRevisionRef,
      pendingAutosaveAfterSaveRef,
      persistSnapshotsRef,
      authRequiredRef,
      undoStackRef,
      redoStackRef,
      latestSeqRef,
      lastAppliedSeqRef,
      recoveryModeRef,
      lastAppliedBoardSettingsSeqRef,
      processedEventIdsRef,
      applyHistoryOperationsRef,
      sessionChatListRef,
      sessionChatRef,
      contextbarRef,
      sessionChatShouldScrollToUnreadRef,
      sessionChatDragStateRef,
      contextbarDragStateRef,
      presenceLeaveSentRef,
      presenceTabIdRef,
      sessionResyncInFlightRef,
      realtimeDisconnectSinceRef,
      lastForcedResyncAtRef,
      loadSessionRequestIdRef,
      firstInteractiveMetricReportedRef,
      boardObjectsRef,
      boardObjectIndexByIdRef,
      boardStrokesRef,
      annotationStrokesRef,
      constraintsRef,
      boardSettingsRef,
      documentStateRef,
      queuedBoardSettingsCommitRef,
      queuedBoardSettingsHistoryBeforeRef,
      boardSettingsCommitTimerRef,
      boardSettingsCommitInFlightRef,
      personalBoardSettingsReadyRef,
      skipNextPersonalBoardSettingsPersistRef,
      objectUpdateQueuedPatchRef,
      objectUpdateTimersRef,
      objectUpdateInFlightRef,
      objectUpdateDispatchOptionsRef,
      objectUpdateHistoryBeforeRef,
      objectPreviewQueuedPatchRef,
      objectPreviewQueuedAtRef,
      objectPreviewVersionRef,
      incomingPreviewQueuedPatchRef,
      incomingPreviewVersionByAuthorObjectRef,
      strokePreviewQueuedByIdRef,
      strokePreviewQueuedAtRef,
      eraserPreviewQueuedByGestureRef,
      eraserPreviewQueuedAtRef,
      incomingStrokePreviewQueuedRef,
      incomingStrokePreviewFrameRef,
      incomingStrokePreviewVersionRef,
      incomingEraserPreviewTimersRef,
      finalizedStrokePreviewIdsRef,
      objectLastCommittedEventAtRef,
      incomingPreviewFrameRef,
      localPreviewQueuedPatchRef,
      localPreviewFrameRef,
      workbookLiveSendRef,
      volatileSyncTimerRef,
      viewportSyncLastSentAtRef,
      viewportSyncQueuedOffsetRef,
      viewportLastReceivedAtRef,
    }),
    []
  );
};
