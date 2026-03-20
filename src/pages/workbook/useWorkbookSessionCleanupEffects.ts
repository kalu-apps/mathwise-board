import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { WorkbookPoint } from "@/features/workbook/model/types";
import type { WorkbookStrokePreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";

type UseWorkbookSessionCleanupEffectsParams = {
  focusResetTimersByUserRef: MutableRefObject<Map<string, number>>;
  autosaveDebounceRef: MutableRefObject<number | null>;
  smartInkDebounceRef: MutableRefObject<number | null>;
  volatileSyncTimerRef: MutableRefObject<number | null>;
  viewportSyncQueuedOffsetRef: MutableRefObject<WorkbookPoint | null>;
  eraserPreviewQueuedByGestureRef: MutableRefObject<Map<string, unknown>>;
  eraserPreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
  clearLocalPreviewPatchRuntime: () => void;
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: () => void;
  clearIncomingEraserPreviewRuntime: () => void;
  setIncomingStrokePreviews: Dispatch<
    SetStateAction<Record<string, WorkbookStrokePreviewEntry>>
  >;
  smartInkOptionsRef: MutableRefObject<unknown>;
  smartInkConfigVersionRef: MutableRefObject<number>;
  smartInkStrokeBufferRef: MutableRefObject<unknown[]>;
  smartInkOptions: unknown;
  strokePreviewExpiryMs: number;
};

export const useWorkbookSessionCleanupEffects = ({
  focusResetTimersByUserRef,
  autosaveDebounceRef,
  smartInkDebounceRef,
  volatileSyncTimerRef,
  viewportSyncQueuedOffsetRef,
  eraserPreviewQueuedByGestureRef,
  eraserPreviewQueuedAtRef,
  clearLocalPreviewPatchRuntime,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  setIncomingStrokePreviews,
  smartInkOptionsRef,
  smartInkConfigVersionRef,
  smartInkStrokeBufferRef,
  smartInkOptions,
  strokePreviewExpiryMs,
}: UseWorkbookSessionCleanupEffectsParams) => {
  const clearLocalPreviewPatchRuntimeRef = useRef(clearLocalPreviewPatchRuntime);
  const clearObjectSyncRuntimeRef = useRef(clearObjectSyncRuntime);
  const clearStrokePreviewRuntimeRef = useRef(clearStrokePreviewRuntime);
  const clearIncomingEraserPreviewRuntimeRef = useRef(clearIncomingEraserPreviewRuntime);

  useEffect(() => {
    clearLocalPreviewPatchRuntimeRef.current = clearLocalPreviewPatchRuntime;
  }, [clearLocalPreviewPatchRuntime]);

  useEffect(() => {
    clearObjectSyncRuntimeRef.current = clearObjectSyncRuntime;
  }, [clearObjectSyncRuntime]);

  useEffect(() => {
    clearStrokePreviewRuntimeRef.current = clearStrokePreviewRuntime;
  }, [clearStrokePreviewRuntime]);

  useEffect(() => {
    clearIncomingEraserPreviewRuntimeRef.current = clearIncomingEraserPreviewRuntime;
  }, [clearIncomingEraserPreviewRuntime]);

  useEffect(
    () => () => {
      focusResetTimersByUserRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      focusResetTimersByUserRef.current.clear();
    },
    []
  );

  useEffect(
    () => () => {
      if (autosaveDebounceRef.current !== null) {
        window.clearTimeout(autosaveDebounceRef.current);
        autosaveDebounceRef.current = null;
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (smartInkDebounceRef.current !== null) {
        window.clearTimeout(smartInkDebounceRef.current);
        smartInkDebounceRef.current = null;
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (volatileSyncTimerRef.current !== null) {
        window.clearTimeout(volatileSyncTimerRef.current);
        volatileSyncTimerRef.current = null;
      }
      viewportSyncQueuedOffsetRef.current = null;
      eraserPreviewQueuedByGestureRef.current.clear();
      eraserPreviewQueuedAtRef.current.clear();
    },
    []
  );

  useEffect(
    () => () => {
      clearLocalPreviewPatchRuntimeRef.current();
    },
    []
  );

  useEffect(
    () => () => {
      clearObjectSyncRuntimeRef.current();
    },
    []
  );

  useEffect(
    () => () => {
      clearStrokePreviewRuntimeRef.current();
    },
    []
  );

  useEffect(
    () => () => {
      clearIncomingEraserPreviewRuntimeRef.current();
    },
    []
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const cutoff = Date.now() - strokePreviewExpiryMs;
      setIncomingStrokePreviews((current) => {
        let changed = false;
        const next: Record<string, WorkbookStrokePreviewEntry> = {};
        Object.entries(current).forEach(([strokeId, entry]) => {
          if (entry.updatedAt < cutoff) {
            changed = true;
            return;
          }
          next[strokeId] = entry;
        });
        return changed ? next : current;
      });
    }, 1_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [setIncomingStrokePreviews, strokePreviewExpiryMs]);

  useEffect(() => {
    smartInkOptionsRef.current = smartInkOptions;
    smartInkConfigVersionRef.current += 1;
    smartInkStrokeBufferRef.current = [];
    if (smartInkDebounceRef.current !== null) {
      window.clearTimeout(smartInkDebounceRef.current);
      smartInkDebounceRef.current = null;
    }
  }, [smartInkOptions]);
};
