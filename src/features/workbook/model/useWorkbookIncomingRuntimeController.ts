import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  clampWorkbookObjectToPageFrame,
  normalizeWorkbookPageFrameWidth,
  resolveWorkbookPageFrameBounds,
} from "./pageFrame";
import { mergeBoardObjectWithPatch } from "./runtime";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";

export type WorkbookStrokePreviewEntry = {
  stroke: WorkbookStroke;
  previewVersion: number;
  updatedAt: number;
};

export type WorkbookIncomingEraserPreviewEntry = {
  id: string;
  authorUserId: string;
  gestureId: string;
  layer: WorkbookLayer;
  page: number;
  radius: number;
  points: WorkbookPoint[];
  updatedAt: number;
};

type UseWorkbookIncomingRuntimeControllerParams = {
  pageFrameWidth: number;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  setBoardObjects: Dispatch<SetStateAction<WorkbookBoardObject[]>>;
  setIncomingStrokePreviews: Dispatch<
    SetStateAction<Record<string, WorkbookStrokePreviewEntry>>
  >;
  setIncomingEraserPreviews: Dispatch<
    SetStateAction<Record<string, WorkbookIncomingEraserPreviewEntry>>
  >;
  objectUpdateQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectUpdateHistoryBeforeRef: MutableRefObject<Map<string, WorkbookBoardObject>>;
  objectUpdateTimersRef: MutableRefObject<Map<string, number>>;
  objectUpdateInFlightRef: MutableRefObject<Set<string>>;
  objectUpdateDispatchOptionsRef: MutableRefObject<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >;
  objectPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectPreviewVersionRef: MutableRefObject<Map<string, number>>;
  incomingPreviewQueuedPatchRef: MutableRefObject<
    Map<string, Partial<WorkbookBoardObject>[]>
  >;
  incomingPreviewVersionByAuthorObjectRef: MutableRefObject<Map<string, number>>;
  objectLastCommittedEventAtRef: MutableRefObject<Map<string, number>>;
  incomingPreviewFrameRef: MutableRefObject<number | null>;
  incomingEraserPreviewTimersRef: MutableRefObject<Map<string, number>>;
  eraserPreviewQueuedByGestureRef: MutableRefObject<
    Map<
      string,
      {
        gestureId: string;
        layer: WorkbookLayer;
        page: number;
        radius: number;
        points: WorkbookPoint[];
        ended?: boolean;
      }
    >
  >;
  strokePreviewQueuedByIdRef: MutableRefObject<
    Map<string, { stroke: WorkbookStroke; previewVersion: number }>
  >;
  incomingStrokePreviewQueuedRef: MutableRefObject<
    Map<string, WorkbookStrokePreviewEntry | null>
  >;
  incomingStrokePreviewFrameRef: MutableRefObject<number | null>;
  incomingStrokePreviewVersionRef: MutableRefObject<Map<string, number>>;
  finalizedStrokePreviewIdsRef: MutableRefObject<Set<string>>;
  maxIncomingPreviewPatchesPerObject: number;
};

export const useWorkbookIncomingRuntimeController = (
  params: UseWorkbookIncomingRuntimeControllerParams
) => {
  const pageFrameBoundsRef = useRef(
    resolveWorkbookPageFrameBounds(normalizeWorkbookPageFrameWidth(params.pageFrameWidth))
  );
  const {
    pageFrameWidth,
    boardObjectsRef,
    setBoardObjects,
    setIncomingStrokePreviews,
    setIncomingEraserPreviews,
    objectUpdateQueuedPatchRef,
    objectUpdateHistoryBeforeRef,
    objectUpdateTimersRef,
    objectUpdateInFlightRef,
    objectUpdateDispatchOptionsRef,
    objectPreviewQueuedPatchRef,
    objectPreviewVersionRef,
    incomingPreviewQueuedPatchRef,
    incomingPreviewVersionByAuthorObjectRef,
    objectLastCommittedEventAtRef,
    incomingPreviewFrameRef,
    incomingEraserPreviewTimersRef,
    eraserPreviewQueuedByGestureRef,
    strokePreviewQueuedByIdRef,
    incomingStrokePreviewQueuedRef,
    incomingStrokePreviewFrameRef,
    incomingStrokePreviewVersionRef,
    finalizedStrokePreviewIdsRef,
    maxIncomingPreviewPatchesPerObject,
  } = params;

  useEffect(() => {
    pageFrameBoundsRef.current = resolveWorkbookPageFrameBounds(
      normalizeWorkbookPageFrameWidth(pageFrameWidth)
    );
  }, [pageFrameWidth]);

  const queuedBoardObjectsRef = useRef<WorkbookBoardObject[] | null>(null);
  const boardObjectsFrameRef = useRef<number | null>(null);

  const flushQueuedBoardObjectsCommit = useCallback(() => {
    boardObjectsFrameRef.current = null;
    const queued = queuedBoardObjectsRef.current;
    if (!queued) return;
    queuedBoardObjectsRef.current = null;
    setBoardObjects(queued);
  }, [setBoardObjects]);

  const scheduleBoardObjectsCommit = useCallback(
    (next: WorkbookBoardObject[], mode: "defer" | "sync") => {
      boardObjectsRef.current = next;
      queuedBoardObjectsRef.current = next;
      if (mode === "sync" || typeof window === "undefined") {
        if (
          boardObjectsFrameRef.current !== null &&
          typeof window !== "undefined"
        ) {
          window.cancelAnimationFrame(boardObjectsFrameRef.current);
          boardObjectsFrameRef.current = null;
        }
        flushQueuedBoardObjectsCommit();
        return;
      }
      if (boardObjectsFrameRef.current !== null) return;
      boardObjectsFrameRef.current = window.requestAnimationFrame(() => {
        flushQueuedBoardObjectsCommit();
      });
    },
    [boardObjectsRef, flushQueuedBoardObjectsCommit]
  );

  useEffect(
    () => () => {
      if (
        boardObjectsFrameRef.current !== null &&
        typeof window !== "undefined"
      ) {
        window.cancelAnimationFrame(boardObjectsFrameRef.current);
        boardObjectsFrameRef.current = null;
      }
      queuedBoardObjectsRef.current = null;
    },
    []
  );

  const clearObjectSyncRuntime = useCallback((options?: { cancelIncomingFrame?: boolean }) => {
    objectUpdateQueuedPatchRef.current.clear();
    objectUpdateHistoryBeforeRef.current.clear();
    objectUpdateTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    objectUpdateTimersRef.current.clear();
    objectUpdateInFlightRef.current.clear();
    objectUpdateDispatchOptionsRef.current.clear();
    objectPreviewQueuedPatchRef.current.clear();
    objectPreviewVersionRef.current.clear();
    incomingPreviewQueuedPatchRef.current.clear();
    incomingPreviewVersionByAuthorObjectRef.current.clear();
    objectLastCommittedEventAtRef.current.clear();
    if (options?.cancelIncomingFrame !== false && incomingPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(incomingPreviewFrameRef.current);
      incomingPreviewFrameRef.current = null;
    }
  }, [
    incomingPreviewFrameRef,
    incomingPreviewQueuedPatchRef,
    incomingPreviewVersionByAuthorObjectRef,
    objectLastCommittedEventAtRef,
    objectPreviewQueuedPatchRef,
    objectPreviewVersionRef,
    objectUpdateDispatchOptionsRef,
    objectUpdateHistoryBeforeRef,
    objectUpdateInFlightRef,
    objectUpdateQueuedPatchRef,
    objectUpdateTimersRef,
  ]);

  const clearIncomingEraserPreviewRuntime = useCallback(() => {
    incomingEraserPreviewTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    incomingEraserPreviewTimersRef.current.clear();
    eraserPreviewQueuedByGestureRef.current.clear();
    setIncomingEraserPreviews({});
  }, [eraserPreviewQueuedByGestureRef, incomingEraserPreviewTimersRef, setIncomingEraserPreviews]);

  const scheduleIncomingEraserPreviewExpiry = useCallback(
    (previewId: string, delay: number) => {
      const currentTimer = incomingEraserPreviewTimersRef.current.get(previewId);
      if (currentTimer !== undefined) {
        window.clearTimeout(currentTimer);
      }
      const timerId = window.setTimeout(() => {
        incomingEraserPreviewTimersRef.current.delete(previewId);
        setIncomingEraserPreviews((current) => {
          if (!(previewId in current)) return current;
          const next = { ...current };
          delete next[previewId];
          return next;
        });
      }, Math.max(60, delay));
      incomingEraserPreviewTimersRef.current.set(previewId, timerId);
    },
    [incomingEraserPreviewTimersRef, setIncomingEraserPreviews]
  );

  const flushIncomingStrokePreviewQueue = useCallback(() => {
    incomingStrokePreviewFrameRef.current = null;
    const queued = new Map(incomingStrokePreviewQueuedRef.current);
    incomingStrokePreviewQueuedRef.current.clear();
    if (queued.size === 0) return;
    setIncomingStrokePreviews((current) => {
      let changed = false;
      const next: Record<string, WorkbookStrokePreviewEntry> = { ...current };
      queued.forEach((entry, strokeId) => {
        if (entry === null) {
          if (next[strokeId]) {
            delete next[strokeId];
            changed = true;
          }
          return;
        }
        const existing = next[strokeId];
        if (existing && existing.previewVersion >= entry.previewVersion) return;
        next[strokeId] = entry;
        changed = true;
      });
      return changed ? next : current;
    });
  }, [
    incomingStrokePreviewFrameRef,
    incomingStrokePreviewQueuedRef,
    setIncomingStrokePreviews,
  ]);

  const scheduleIncomingStrokePreviewFlush = useCallback(() => {
    if (incomingStrokePreviewFrameRef.current !== null) return;
    if (typeof window === "undefined") {
      flushIncomingStrokePreviewQueue();
      return;
    }
    incomingStrokePreviewFrameRef.current = window.requestAnimationFrame(() => {
      flushIncomingStrokePreviewQueue();
    });
  }, [flushIncomingStrokePreviewQueue, incomingStrokePreviewFrameRef]);

  const queueIncomingStrokePreview = useCallback(
    (entry: WorkbookStrokePreviewEntry | null, strokeId: string) => {
      incomingStrokePreviewQueuedRef.current.set(strokeId, entry);
      scheduleIncomingStrokePreviewFlush();
    },
    [incomingStrokePreviewQueuedRef, scheduleIncomingStrokePreviewFlush]
  );

  const finalizeStrokePreview = useCallback(
    (strokeId: string) => {
      if (!strokeId) return;
      finalizedStrokePreviewIdsRef.current.add(strokeId);
      strokePreviewQueuedByIdRef.current.delete(strokeId);
      incomingStrokePreviewVersionRef.current.delete(strokeId);
      queueIncomingStrokePreview(null, strokeId);
    },
    [
      finalizedStrokePreviewIdsRef,
      incomingStrokePreviewVersionRef,
      queueIncomingStrokePreview,
      strokePreviewQueuedByIdRef,
    ]
  );

  const clearStrokePreviewRuntime = useCallback(
    (options?: { clearFinalized?: boolean; cancelIncomingFrame?: boolean }) => {
      strokePreviewQueuedByIdRef.current.clear();
      incomingStrokePreviewQueuedRef.current.clear();
      incomingStrokePreviewVersionRef.current.clear();
      if (options?.clearFinalized !== false) {
        finalizedStrokePreviewIdsRef.current.clear();
      }
      if (
        options?.cancelIncomingFrame !== false &&
        incomingStrokePreviewFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(incomingStrokePreviewFrameRef.current);
        incomingStrokePreviewFrameRef.current = null;
      }
      setIncomingStrokePreviews({});
    },
    [
      finalizedStrokePreviewIdsRef,
      incomingStrokePreviewFrameRef,
      incomingStrokePreviewQueuedRef,
      incomingStrokePreviewVersionRef,
      setIncomingStrokePreviews,
      strokePreviewQueuedByIdRef,
    ]
  );

  const applyLocalBoardObjects = useCallback(
    (updater: (current: WorkbookBoardObject[]) => WorkbookBoardObject[]) => {
      const next = updater(boardObjectsRef.current);
      if (next === boardObjectsRef.current) return;
      scheduleBoardObjectsCommit(next, "defer");
    },
    [boardObjectsRef, scheduleBoardObjectsCommit]
  );

  const commitInteractiveBoardObjects = useCallback(
    (next: WorkbookBoardObject[]) => {
      if (next === boardObjectsRef.current) return;
      scheduleBoardObjectsCommit(next, "sync");
    },
    [boardObjectsRef, scheduleBoardObjectsCommit]
  );

  const flushIncomingPreviewQueue = useCallback(() => {
    incomingPreviewFrameRef.current = null;
    const queue = incomingPreviewQueuedPatchRef.current;
    if (queue.size === 0) return;
    const patches = new Map<string, Partial<WorkbookBoardObject>[]>();
    queue.forEach((pendingQueue, objectId) => {
      if (pendingQueue.length === 0) {
        queue.delete(objectId);
        return;
      }
      patches.set(objectId, pendingQueue.slice());
      queue.delete(objectId);
    });
    if (patches.size === 0) return;
    applyLocalBoardObjects((current) => {
      if (current.length === 0) return current;
      let changed = false;
      const next = current.map((item) => {
        const pendingPatches = patches.get(item.id);
        if (!pendingPatches || pendingPatches.length === 0) return item;
        changed = true;
        return pendingPatches.reduce<WorkbookBoardObject>(
          (previewObject, patch) =>
            clampWorkbookObjectToPageFrame(
              mergeBoardObjectWithPatch(previewObject, patch),
              pageFrameBoundsRef.current
            ),
          item
        );
      });
      return changed ? next : current;
    });
  }, [applyLocalBoardObjects, incomingPreviewFrameRef, incomingPreviewQueuedPatchRef]);

  const queueIncomingPreviewPatch = useCallback(
    (objectId: string, patch: Partial<WorkbookBoardObject>) => {
      const pendingQueue = incomingPreviewQueuedPatchRef.current.get(objectId) ?? [];
      pendingQueue.push(patch);
      if (pendingQueue.length > maxIncomingPreviewPatchesPerObject) {
        pendingQueue.splice(0, pendingQueue.length - maxIncomingPreviewPatchesPerObject);
      }
      incomingPreviewQueuedPatchRef.current.set(objectId, pendingQueue);
      if (incomingPreviewFrameRef.current !== null) return;
      if (typeof window === "undefined") {
        flushIncomingPreviewQueue();
        return;
      }
      incomingPreviewFrameRef.current = window.requestAnimationFrame(() => {
        flushIncomingPreviewQueue();
      });
    },
    [
      flushIncomingPreviewQueue,
      incomingPreviewFrameRef,
      incomingPreviewQueuedPatchRef,
      maxIncomingPreviewPatchesPerObject,
    ]
  );

  return {
    clearObjectSyncRuntime,
    clearIncomingEraserPreviewRuntime,
    scheduleIncomingEraserPreviewExpiry,
    queueIncomingStrokePreview,
    finalizeStrokePreview,
    clearStrokePreviewRuntime,
    applyLocalBoardObjects,
    commitInteractiveBoardObjects,
    queueIncomingPreviewPatch,
  };
};
