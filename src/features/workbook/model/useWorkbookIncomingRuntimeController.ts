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

const INCOMING_STROKE_PREVIEW_RETAIN_MS = 5_000;

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
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
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
    boardStrokesRef,
    annotationStrokesRef,
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
  const incomingStrokePreviewRetentionTimerRef = useRef<number | null>(null);

  const clearIncomingStrokePreviewRetentionTimer = useCallback(() => {
    if (incomingStrokePreviewRetentionTimerRef.current === null) return;
    window.clearTimeout(incomingStrokePreviewRetentionTimerRef.current);
    incomingStrokePreviewRetentionTimerRef.current = null;
  }, []);

  const buildConfirmedStrokeIds = useCallback((extraIds?: ReadonlySet<string>) => {
    const confirmed = new Set<string>();
    boardStrokesRef.current.forEach((stroke) => {
      if (stroke.id) confirmed.add(stroke.id);
    });
    annotationStrokesRef.current.forEach((stroke) => {
      if (stroke.id) confirmed.add(stroke.id);
    });
    extraIds?.forEach((strokeId) => {
      if (strokeId) confirmed.add(strokeId);
    });
    return confirmed;
  }, [annotationStrokesRef, boardStrokesRef]);

  const filterRecentUnconfirmedStrokePreviews = useCallback(
    (
      current: Record<string, WorkbookStrokePreviewEntry>,
      queued: Map<string, WorkbookStrokePreviewEntry | null>,
      options?: { confirmedStrokeIds?: ReadonlySet<string> }
    ) => {
      const now = Date.now();
      const confirmedStrokeIds = buildConfirmedStrokeIds(options?.confirmedStrokeIds);
      const next: Record<string, WorkbookStrokePreviewEntry> = {};
      const applyCandidate = (strokeId: string, entry: WorkbookStrokePreviewEntry | null) => {
        if (!entry) return;
        const stroke = entry.stroke;
        if (stroke.tool !== "pen" && stroke.tool !== "highlighter") return;
        if (finalizedStrokePreviewIdsRef.current.has(strokeId)) return;
        if (confirmedStrokeIds.has(strokeId)) return;
        if (now - entry.updatedAt > INCOMING_STROKE_PREVIEW_RETAIN_MS) return;
        const existing = next[strokeId];
        if (existing && existing.previewVersion >= entry.previewVersion) return;
        next[strokeId] = entry;
      };
      Object.entries(current).forEach(([strokeId, entry]) => applyCandidate(strokeId, entry));
      queued.forEach((entry, strokeId) => applyCandidate(strokeId, entry));
      return next;
    },
    [buildConfirmedStrokeIds, finalizedStrokePreviewIdsRef]
  );

  const scheduleIncomingStrokePreviewRetentionPrune = useCallback(
    (options?: { confirmedStrokeIds?: ReadonlySet<string> }) => {
      clearIncomingStrokePreviewRetentionTimer();
      incomingStrokePreviewRetentionTimerRef.current = window.setTimeout(() => {
        incomingStrokePreviewRetentionTimerRef.current = null;
        setIncomingStrokePreviews((latest) => {
          const next = filterRecentUnconfirmedStrokePreviews(latest, new Map(), options);
          const nextKeys = Object.keys(next);
          if (nextKeys.length !== Object.keys(latest).length) return next;
          return nextKeys.some((strokeId) => latest[strokeId] !== next[strokeId]) ? next : latest;
        });
      }, INCOMING_STROKE_PREVIEW_RETAIN_MS);
    },
    [
      clearIncomingStrokePreviewRetentionTimer,
      filterRecentUnconfirmedStrokePreviews,
      setIncomingStrokePreviews,
    ]
  );

  const retainRecentUnconfirmedStrokePreviews = useCallback(
    (
      current: Record<string, WorkbookStrokePreviewEntry>,
      queued: Map<string, WorkbookStrokePreviewEntry | null>,
      options?: { confirmedStrokeIds?: ReadonlySet<string> }
    ) => {
      const next = filterRecentUnconfirmedStrokePreviews(current, queued, options);
      const nextKeys = Object.keys(next);
      let changed = false;
      if (nextKeys.length !== Object.keys(current).length) {
        changed = true;
      } else {
        changed = nextKeys.some((strokeId) => current[strokeId] !== next[strokeId]);
      }
      if (nextKeys.length > 0) {
        scheduleIncomingStrokePreviewRetentionPrune(options);
      } else {
        clearIncomingStrokePreviewRetentionTimer();
      }
      return changed ? next : current;
    },
    [
      clearIncomingStrokePreviewRetentionTimer,
      filterRecentUnconfirmedStrokePreviews,
      scheduleIncomingStrokePreviewRetentionPrune,
    ]
  );

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
      clearIncomingStrokePreviewRetentionTimer();
    },
    [clearIncomingStrokePreviewRetentionTimer]
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
    if (boardObjectsFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(boardObjectsFrameRef.current);
      boardObjectsFrameRef.current = null;
    }
    queuedBoardObjectsRef.current = null;
  }, [
    boardObjectsFrameRef,
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
    queuedBoardObjectsRef,
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
      queueIncomingStrokePreview(null, strokeId);
    },
    [
      finalizedStrokePreviewIdsRef,
      queueIncomingStrokePreview,
      strokePreviewQueuedByIdRef,
    ]
  );

  const clearStrokePreviewRuntime = useCallback(
    (options?: {
      clearFinalized?: boolean;
      cancelIncomingFrame?: boolean;
      retainUnconfirmedRecent?: boolean;
      confirmedStrokeIds?: ReadonlySet<string>;
    }) => {
      strokePreviewQueuedByIdRef.current.clear();
      const queuedIncomingPreviews = options?.retainUnconfirmedRecent
        ? new Map(incomingStrokePreviewQueuedRef.current)
        : new Map<string, WorkbookStrokePreviewEntry | null>();
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
      if (options?.retainUnconfirmedRecent) {
        setIncomingStrokePreviews((current) =>
          retainRecentUnconfirmedStrokePreviews(current, queuedIncomingPreviews, {
            confirmedStrokeIds: options.confirmedStrokeIds,
          })
        );
        return;
      }
      clearIncomingStrokePreviewRetentionTimer();
      setIncomingStrokePreviews({});
    },
    [
      clearIncomingStrokePreviewRetentionTimer,
      finalizedStrokePreviewIdsRef,
      incomingStrokePreviewFrameRef,
      incomingStrokePreviewQueuedRef,
      incomingStrokePreviewVersionRef,
      retainRecentUnconfirmedStrokePreviews,
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
