import { compactWorkbookObjectUpdateEvents } from "@/features/workbook/model/runtime";
import { applyWorkbookIncomingRealtimeEvent } from "@/features/workbook/model/incomingRealtime";
import { applyWorkbookIncomingSessionMetaEvent } from "@/features/workbook/model/incomingSessionMeta";
import type { WorkbookEvent } from "@/features/workbook/model/types";
import type { WorkbookSessionStoreActions } from "@/features/workbook/model/workbookSessionStoreTypes";
import { generateId } from "@/shared/lib/id";
import type { useWorkbookIncomingRuntimeController } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { useWorkbookSessionRefs } from "./workbookSessionRefs";
import type { useWorkbookSessionHistoryRuntime } from "./useWorkbookSessionHistoryRuntime";
import type { useWorkbookSessionLocalRuntime } from "./useWorkbookSessionLocalRuntime";
import type { WorkbookHistoryOperation } from "./WorkbookSessionPage.geometry";
import { normalizeSceneLayersForBoard } from "./WorkbookSessionPage.geometry";
import { normalizeSmartInkOptions } from "./workbookBoardSettingsModel";
import {
  ERASER_PREVIEW_END_EXPIRY_MS,
  ERASER_PREVIEW_EXPIRY_MS,
  ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX,
  VIEWPORT_SYNC_EPSILON,
} from "./WorkbookSessionPage.core";

type IncomingRuntimeControllerResult = ReturnType<typeof useWorkbookIncomingRuntimeController>;
type WorkbookSessionRefs = ReturnType<typeof useWorkbookSessionRefs>;
type RestoreSceneSnapshot = ReturnType<typeof useWorkbookSessionHistoryRuntime>["restoreSceneSnapshot"];
type AreParticipantsEqual = ReturnType<typeof useWorkbookSessionLocalRuntime>["areParticipantsEqual"];

type ApplyWorkbookIncomingEventsBatchParams = {
  events: WorkbookEvent[];
  userId: string | undefined;
  selectedObjectId: string | null;
  awaitingClearRequest: unknown;
  refs: WorkbookSessionRefs;
  actions: WorkbookSessionStoreActions;
  areParticipantsEqual: AreParticipantsEqual;
  restoreSceneSnapshot: RestoreSceneSnapshot;
  clearObjectSyncRuntime: (options?: { cancelIncomingFrame?: boolean }) => void;
  clearStrokePreviewRuntime: (options?: {
    clearFinalized?: boolean;
    cancelIncomingFrame?: boolean;
  }) => void;
  clearIncomingEraserPreviewRuntime: () => void;
  scheduleIncomingEraserPreviewExpiry: IncomingRuntimeControllerResult["scheduleIncomingEraserPreviewExpiry"];
  queueIncomingStrokePreview: IncomingRuntimeControllerResult["queueIncomingStrokePreview"];
  finalizeStrokePreview: (strokeId: string) => void;
  queueIncomingPreviewPatch: IncomingRuntimeControllerResult["queueIncomingPreviewPatch"];
  applyLocalBoardObjects: IncomingRuntimeControllerResult["applyLocalBoardObjects"];
};

export const applyWorkbookIncomingEventsBatch = ({
  events,
  userId,
  selectedObjectId,
  awaitingClearRequest,
  refs,
  actions,
  areParticipantsEqual,
  restoreSceneSnapshot,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  scheduleIncomingEraserPreviewExpiry,
  queueIncomingStrokePreview,
  finalizeStrokePreview,
  queueIncomingPreviewPatch,
  applyLocalBoardObjects,
}: ApplyWorkbookIncomingEventsBatchParams): void => {
  if (events.length === 0) return;
  const compactedEvents = compactWorkbookObjectUpdateEvents(events);
  compactedEvents.forEach((event) => {
    try {
      const parsedEventTs = Date.parse(event.createdAt);
      const eventTimestamp = Number.isFinite(parsedEventTs) ? parsedEventTs : Date.now();
      if (
        applyWorkbookIncomingRealtimeEvent({
          event,
          eventTimestamp,
          userId,
          selectedObjectId,
          selectedTextDraftDirty: refs.selectedTextDraftDirtyRef.current,
          selectedTextDraftObjectId: refs.selectedTextDraftObjectIdRef.current,
          awaitingClearRequest,
          areParticipantsEqual,
          applyHistoryOperations: (operations) =>
            refs.applyHistoryOperationsRef.current(operations as WorkbookHistoryOperation[]),
          restoreSceneSnapshot,
          clearObjectSyncRuntime,
          clearStrokePreviewRuntime,
          clearIncomingEraserPreviewRuntime,
          scheduleIncomingEraserPreviewExpiry,
          queueIncomingStrokePreview,
          finalizeStrokePreview,
          queueIncomingPreviewPatch,
          applyLocalBoardObjects,
          setSession: actions.setSession,
          setCanvasViewport: actions.setCanvasViewport,
          setIncomingEraserPreviews: actions.setIncomingEraserPreviews,
          setBoardStrokes: actions.setBoardStrokes,
          setAnnotationStrokes: actions.setAnnotationStrokes,
          setConstraints: actions.setConstraints,
          setSelectedObjectId: actions.setSelectedObjectId,
          setSelectedConstraintId: actions.setSelectedConstraintId,
          setPendingClearRequest: actions.setPendingClearRequest,
          setAwaitingClearRequest: actions.setAwaitingClearRequest,
          setConfirmedClearRequest: actions.setConfirmedClearRequest,
          setFocusPoint: actions.setFocusPoint,
          setPointerPoint: actions.setPointerPoint,
          setFocusPointsByUser: actions.setFocusPointsByUser,
          setPointerPointsByUser: actions.setPointerPointsByUser,
          viewportLastReceivedAtRef: refs.viewportLastReceivedAtRef,
          finalizedStrokePreviewIdsRef: refs.finalizedStrokePreviewIdsRef,
          incomingStrokePreviewVersionRef: refs.incomingStrokePreviewVersionRef,
          objectLastCommittedEventAtRef: refs.objectLastCommittedEventAtRef,
          incomingPreviewQueuedPatchRef: refs.incomingPreviewQueuedPatchRef,
          incomingPreviewVersionByAuthorObjectRef: refs.incomingPreviewVersionByAuthorObjectRef,
          objectUpdateQueuedPatchRef: refs.objectUpdateQueuedPatchRef,
          objectUpdateDispatchOptionsRef: refs.objectUpdateDispatchOptionsRef,
          objectUpdateHistoryBeforeRef: refs.objectUpdateHistoryBeforeRef,
          objectPreviewQueuedPatchRef: refs.objectPreviewQueuedPatchRef,
          objectUpdateInFlightRef: refs.objectUpdateInFlightRef,
          objectPreviewVersionRef: refs.objectPreviewVersionRef,
          objectUpdateTimersRef: refs.objectUpdateTimersRef,
          focusResetTimersByUserRef: refs.focusResetTimersByUserRef,
          generateId,
          eraserPreviewPointMergeMinDistancePx: ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX,
          eraserPreviewExpiryMs: ERASER_PREVIEW_EXPIRY_MS,
          eraserPreviewEndExpiryMs: ERASER_PREVIEW_END_EXPIRY_MS,
          viewportSyncEpsilon: VIEWPORT_SYNC_EPSILON,
        })
      ) {
        return;
      }
      if (
        applyWorkbookIncomingSessionMetaEvent({
          event,
          normalizeSceneLayersForBoard,
          normalizeSmartInkOptions,
          setDocumentState: actions.setDocumentState,
          setConstraints: actions.setConstraints,
          setSelectedConstraintId: actions.setSelectedConstraintId,
          setBoardSettings: actions.setBoardSettings,
          setLibraryState: actions.setLibraryState,
          setComments: actions.setComments,
          setTimerState: actions.setTimerState,
          setSession: actions.setSession,
          setChatMessages: actions.setChatMessages,
        })
      ) {
        return;
      }
    } catch (error) {
      console.warn("Workbook event apply failed", event.type, error);
    }
  });
};
