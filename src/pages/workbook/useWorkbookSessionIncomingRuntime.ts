import { useCallback } from "react";
import { useWorkbookIncomingRuntimeController } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { WorkbookSessionStoreActions } from "@/features/workbook/model/workbookSessionStoreTypes";
import type { useWorkbookSessionRefs } from "./workbookSessionRefs";
import { MAX_INCOMING_PREVIEW_PATCHES_PER_OBJECT } from "./WorkbookSessionPage.core";

type WorkbookSessionRefs = ReturnType<typeof useWorkbookSessionRefs>;

type UseWorkbookSessionIncomingRuntimeParams = {
  refs: WorkbookSessionRefs;
  pageFrameWidth: number;
  setBoardObjects: WorkbookSessionStoreActions["setBoardObjects"];
  setIncomingStrokePreviews: WorkbookSessionStoreActions["setIncomingStrokePreviews"];
  setIncomingEraserPreviews: WorkbookSessionStoreActions["setIncomingEraserPreviews"];
};

export const useWorkbookSessionIncomingRuntime = ({
  refs,
  pageFrameWidth,
  setBoardObjects,
  setIncomingStrokePreviews,
  setIncomingEraserPreviews,
}: UseWorkbookSessionIncomingRuntimeParams) => {
  const {
    clearObjectSyncRuntime: clearObjectSyncRuntimeRaw,
    clearIncomingEraserPreviewRuntime: clearIncomingEraserPreviewRuntimeRaw,
    scheduleIncomingEraserPreviewExpiry,
    queueIncomingStrokePreview,
    finalizeStrokePreview: finalizeStrokePreviewRaw,
    clearStrokePreviewRuntime: clearStrokePreviewRuntimeRaw,
    applyLocalBoardObjects,
    commitInteractiveBoardObjects,
    queueIncomingPreviewPatch,
  } = useWorkbookIncomingRuntimeController({
    pageFrameWidth,
    boardObjectsRef: refs.boardObjectsRef,
    setBoardObjects,
    setIncomingStrokePreviews,
    setIncomingEraserPreviews,
    objectUpdateQueuedPatchRef: refs.objectUpdateQueuedPatchRef,
    objectUpdateHistoryBeforeRef: refs.objectUpdateHistoryBeforeRef,
    objectUpdateTimersRef: refs.objectUpdateTimersRef,
    objectUpdateInFlightRef: refs.objectUpdateInFlightRef,
    objectUpdateDispatchOptionsRef: refs.objectUpdateDispatchOptionsRef,
    objectPreviewQueuedPatchRef: refs.objectPreviewQueuedPatchRef,
    objectPreviewVersionRef: refs.objectPreviewVersionRef,
    incomingPreviewQueuedPatchRef: refs.incomingPreviewQueuedPatchRef,
    incomingPreviewVersionByAuthorObjectRef: refs.incomingPreviewVersionByAuthorObjectRef,
    objectLastCommittedEventAtRef: refs.objectLastCommittedEventAtRef,
    incomingPreviewFrameRef: refs.incomingPreviewFrameRef,
    incomingEraserPreviewTimersRef: refs.incomingEraserPreviewTimersRef,
    eraserPreviewQueuedByGestureRef: refs.eraserPreviewQueuedByGestureRef,
    strokePreviewQueuedByIdRef: refs.strokePreviewQueuedByIdRef,
    incomingStrokePreviewQueuedRef: refs.incomingStrokePreviewQueuedRef,
    incomingStrokePreviewFrameRef: refs.incomingStrokePreviewFrameRef,
    incomingStrokePreviewVersionRef: refs.incomingStrokePreviewVersionRef,
    finalizedStrokePreviewIdsRef: refs.finalizedStrokePreviewIdsRef,
    maxIncomingPreviewPatchesPerObject: MAX_INCOMING_PREVIEW_PATCHES_PER_OBJECT,
  });

  const clearObjectSyncRuntime = useCallback(
    (options?: { cancelIncomingFrame?: boolean }) => {
      clearObjectSyncRuntimeRaw(options);
      refs.objectPreviewQueuedAtRef.current.clear();
    },
    [clearObjectSyncRuntimeRaw, refs]
  );

  const clearIncomingEraserPreviewRuntime = useCallback(() => {
    clearIncomingEraserPreviewRuntimeRaw();
    refs.eraserPreviewQueuedAtRef.current.clear();
  }, [clearIncomingEraserPreviewRuntimeRaw, refs]);

  const clearStrokePreviewRuntime = useCallback(
    (options?: { clearFinalized?: boolean; cancelIncomingFrame?: boolean }) => {
      clearStrokePreviewRuntimeRaw(options);
      refs.strokePreviewQueuedAtRef.current.clear();
    },
    [clearStrokePreviewRuntimeRaw, refs]
  );

  const finalizeStrokePreview = useCallback(
    (strokeId: string) => {
      refs.strokePreviewQueuedAtRef.current.delete(strokeId);
      finalizeStrokePreviewRaw(strokeId);
    },
    [finalizeStrokePreviewRaw, refs]
  );

  return {
    scheduleIncomingEraserPreviewExpiry,
    queueIncomingStrokePreview,
    queueIncomingPreviewPatch,
    applyLocalBoardObjects,
    commitInteractiveBoardObjects,
    clearObjectSyncRuntime,
    clearIncomingEraserPreviewRuntime,
    clearStrokePreviewRuntime,
    finalizeStrokePreview,
  };
};
