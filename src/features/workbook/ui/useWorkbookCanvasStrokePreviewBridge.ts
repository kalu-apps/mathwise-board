import {
  useCallback,
  useEffect,
  useLayoutEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTool,
} from "../model/types";
import { buildStrokePreviewPoints, toPath } from "../model/stroke";
import type { WorkbookActiveStrokeDraft } from "../model/sceneStroke";
import {
  resolveWorkbookStrokeOpacity,
  resolveWorkbookStrokeSvgBlendMode,
} from "../model/strokeRenderStyle";
import {
  snapshotRemoteEraserPreviewState,
  type RemoteEraserPreviewState,
} from "../model/remoteEraserPreview";
import type {
  ObjectEraserCut,
  ObjectEraserPreviewPath,
} from "../model/eraser";

type SetState<T> = Dispatch<SetStateAction<T>>;

type PendingCommittedStrokeBridge = {
  id: string;
  layer: WorkbookLayer;
  page: number;
  color: string;
  width: number;
  tool: WorkbookTool;
  path: string;
  isPresentInState: boolean;
  isDrawnInCommittedLayer: boolean;
};

interface UseWorkbookCanvasStrokePreviewBridgeParams {
  currentPage: number;
  layer: WorkbookLayer;
  width: number;
  newRendererEnabled: boolean;
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  onStrokePreview?: (payload: {
    stroke: WorkbookStroke;
    previewVersion: number;
    flush?: "immediate";
  }) => void;
  onEraserPreview?: (payload: {
    gestureId: string;
    layer: WorkbookLayer;
    page: number;
    radius: number;
    points: WorkbookPoint[];
    ended?: boolean;
  }) => void;
  strokeFlushFrameRef: MutableRefObject<number | null>;
  strokePointsRef: MutableRefObject<WorkbookPoint[]>;
  draftStrokePathRef: MutableRefObject<SVGPathElement | null>;
  activeStrokeRef: MutableRefObject<WorkbookActiveStrokeDraft | null>;
  strokePreviewTimerRef: MutableRefObject<number | null>;
  committedStrokeBridgePathRef: MutableRefObject<SVGPathElement | null>;
  committedStrokeBridgeTimeoutRef: MutableRefObject<number | null>;
  pendingCommittedStrokeBridgeRef: MutableRefObject<PendingCommittedStrokeBridge | null>;
  setPendingCommittedBridgeStrokeId: SetState<string | null>;
  eraserPreviewFrameRef: MutableRefObject<number | null>;
  eraserStrokeFragmentsRef: MutableRefObject<Map<string, WorkbookPoint[][]>>;
  eraserObjectCutsRef: MutableRefObject<Map<string, ObjectEraserCut[]>>;
  eraserObjectPreviewPathsRef: MutableRefObject<Map<string, ObjectEraserPreviewPath[]>>;
  eraserTouchedObjectIdsRef: MutableRefObject<Set<string>>;
  eraserLastAppliedPointRef: MutableRefObject<WorkbookPoint | null>;
  eraserGestureIdRef: MutableRefObject<string | null>;
  setEraserPreviewStrokeFragments: SetState<Record<string, WorkbookPoint[][]>>;
  setEraserPreviewObjectCuts: SetState<Record<string, ObjectEraserCut[]>>;
  setEraserPreviewObjectPaths: SetState<Record<string, ObjectEraserPreviewPath[]>>;
  remoteEraserPreviewFrameRef: MutableRefObject<number | null>;
  remoteEraserPreviewStateRef: MutableRefObject<RemoteEraserPreviewState>;
  setRemoteEraserPreviewStrokeFragments: SetState<Record<string, WorkbookPoint[][]>>;
  setRemoteEraserPreviewObjectCuts: SetState<Record<string, ObjectEraserCut[]>>;
  setRemoteEraserPreviewObjectPaths: SetState<Record<string, ObjectEraserPreviewPath[]>>;
  strokePreviewSendIntervalMs: number;
  committedStrokeBridgeTimeoutMs: number;
}

export function useWorkbookCanvasStrokePreviewBridge({
  currentPage,
  layer,
  width,
  newRendererEnabled,
  boardStrokes,
  annotationStrokes,
  onStrokePreview,
  onEraserPreview,
  strokeFlushFrameRef,
  strokePointsRef,
  draftStrokePathRef,
  activeStrokeRef,
  strokePreviewTimerRef,
  committedStrokeBridgePathRef,
  committedStrokeBridgeTimeoutRef,
  pendingCommittedStrokeBridgeRef,
  setPendingCommittedBridgeStrokeId,
  eraserPreviewFrameRef,
  eraserStrokeFragmentsRef,
  eraserObjectCutsRef,
  eraserObjectPreviewPathsRef,
  eraserTouchedObjectIdsRef,
  eraserLastAppliedPointRef,
  eraserGestureIdRef,
  setEraserPreviewStrokeFragments,
  setEraserPreviewObjectCuts,
  setEraserPreviewObjectPaths,
  remoteEraserPreviewFrameRef,
  remoteEraserPreviewStateRef,
  setRemoteEraserPreviewStrokeFragments,
  setRemoteEraserPreviewObjectCuts,
  setRemoteEraserPreviewObjectPaths,
  strokePreviewSendIntervalMs,
  committedStrokeBridgeTimeoutMs,
}: UseWorkbookCanvasStrokePreviewBridgeParams) {
  const flushStrokeDraftPath = useCallback(() => {
    strokeFlushFrameRef.current = null;
    draftStrokePathRef.current?.setAttribute("d", toPath(strokePointsRef.current));
  }, [draftStrokePathRef, strokeFlushFrameRef, strokePointsRef]);

  const clearCommittedStrokeBridge = useCallback(() => {
    if (committedStrokeBridgeTimeoutRef.current !== null) {
      window.clearTimeout(committedStrokeBridgeTimeoutRef.current);
      committedStrokeBridgeTimeoutRef.current = null;
    }
    pendingCommittedStrokeBridgeRef.current = null;
    setPendingCommittedBridgeStrokeId(null);
    const bridgeNode = committedStrokeBridgePathRef.current;
    if (!bridgeNode) return;
    bridgeNode.setAttribute("d", "");
  }, [
    committedStrokeBridgePathRef,
    committedStrokeBridgeTimeoutRef,
    pendingCommittedStrokeBridgeRef,
    setPendingCommittedBridgeStrokeId,
  ]);

  const clearCommittedStrokeBridgeIfReady = useCallback(() => {
    const pendingStroke = pendingCommittedStrokeBridgeRef.current;
    if (!pendingStroke) return;
    if (!pendingStroke.isPresentInState || !pendingStroke.isDrawnInCommittedLayer) return;
    clearCommittedStrokeBridge();
  }, [clearCommittedStrokeBridge, pendingCommittedStrokeBridgeRef]);

  const scheduleEraserPreviewRender = useCallback(() => {
    if (eraserPreviewFrameRef.current !== null) return;
    eraserPreviewFrameRef.current = window.requestAnimationFrame(() => {
      eraserPreviewFrameRef.current = null;
      setEraserPreviewStrokeFragments(
        Object.fromEntries(eraserStrokeFragmentsRef.current.entries())
      );
      setEraserPreviewObjectCuts(Object.fromEntries(eraserObjectCutsRef.current.entries()));
      setEraserPreviewObjectPaths(
        Object.fromEntries(eraserObjectPreviewPathsRef.current.entries())
      );
    });
  }, [
    eraserObjectCutsRef,
    eraserObjectPreviewPathsRef,
    eraserPreviewFrameRef,
    eraserStrokeFragmentsRef,
    setEraserPreviewObjectCuts,
    setEraserPreviewObjectPaths,
    setEraserPreviewStrokeFragments,
  ]);

  const clearEraserPreviewRuntime = useCallback(() => {
    eraserStrokeFragmentsRef.current.clear();
    eraserObjectCutsRef.current.clear();
    eraserObjectPreviewPathsRef.current.clear();
    eraserTouchedObjectIdsRef.current.clear();
    eraserLastAppliedPointRef.current = null;
    if (eraserPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(eraserPreviewFrameRef.current);
      eraserPreviewFrameRef.current = null;
    }
    setEraserPreviewStrokeFragments({});
    setEraserPreviewObjectCuts({});
    setEraserPreviewObjectPaths({});
  }, [
    eraserLastAppliedPointRef,
    eraserObjectCutsRef,
    eraserObjectPreviewPathsRef,
    eraserPreviewFrameRef,
    eraserStrokeFragmentsRef,
    eraserTouchedObjectIdsRef,
    setEraserPreviewObjectCuts,
    setEraserPreviewObjectPaths,
    setEraserPreviewStrokeFragments,
  ]);

  const scheduleRemoteEraserPreviewRender = useCallback(() => {
    if (remoteEraserPreviewFrameRef.current !== null) return;
    remoteEraserPreviewFrameRef.current = window.requestAnimationFrame(() => {
      remoteEraserPreviewFrameRef.current = null;
      const snapshot = snapshotRemoteEraserPreviewState(remoteEraserPreviewStateRef.current);
      setRemoteEraserPreviewStrokeFragments(snapshot.strokeFragments);
      setRemoteEraserPreviewObjectCuts(snapshot.objectCuts);
      setRemoteEraserPreviewObjectPaths(snapshot.objectPaths);
    });
  }, [
    remoteEraserPreviewFrameRef,
    remoteEraserPreviewStateRef,
    setRemoteEraserPreviewObjectCuts,
    setRemoteEraserPreviewObjectPaths,
    setRemoteEraserPreviewStrokeFragments,
  ]);

  const emitEraserPreviewPoints = useCallback(
    (points: WorkbookPoint[], ended = false) => {
      if (!onEraserPreview) return;
      const gestureId = eraserGestureIdRef.current;
      if (!gestureId) return;
      if (points.length === 0 && !ended) return;
      onEraserPreview({
        gestureId,
        layer,
        page: Math.max(1, currentPage),
        radius: Math.max(4, width),
        points,
        ...(ended ? { ended: true } : {}),
      });
    },
    [currentPage, eraserGestureIdRef, layer, onEraserPreview, width]
  );

  const showCommittedStrokeBridge = useCallback(
    (stroke: WorkbookStroke, path: string) => {
      if (committedStrokeBridgeTimeoutRef.current !== null) {
        window.clearTimeout(committedStrokeBridgeTimeoutRef.current);
        committedStrokeBridgeTimeoutRef.current = null;
      }
      pendingCommittedStrokeBridgeRef.current = {
        id: stroke.id,
        layer: stroke.layer,
        page: Math.max(1, stroke.page ?? currentPage),
        color: stroke.color,
        width: Math.max(1, stroke.width),
        tool: stroke.tool,
        path,
        isPresentInState: false,
        isDrawnInCommittedLayer: !newRendererEnabled,
      };
      setPendingCommittedBridgeStrokeId(stroke.id);
      committedStrokeBridgeTimeoutRef.current = window.setTimeout(() => {
        clearCommittedStrokeBridge();
      }, committedStrokeBridgeTimeoutMs);
      const bridgeNode = committedStrokeBridgePathRef.current;
      if (!bridgeNode) return;
      bridgeNode.setAttribute("d", path);
      bridgeNode.setAttribute("stroke", stroke.color);
      bridgeNode.setAttribute("stroke-width", String(Math.max(1, stroke.width)));
      bridgeNode.setAttribute("opacity", String(resolveWorkbookStrokeOpacity(stroke.tool)));
      bridgeNode.style.mixBlendMode = resolveWorkbookStrokeSvgBlendMode(stroke.tool);
    },
    [
      clearCommittedStrokeBridge,
      committedStrokeBridgePathRef,
      committedStrokeBridgeTimeoutMs,
      committedStrokeBridgeTimeoutRef,
      currentPage,
      newRendererEnabled,
      pendingCommittedStrokeBridgeRef,
      setPendingCommittedBridgeStrokeId,
    ]
  );

  const handlePendingBridgeStrokeDrawn = useCallback(
    (payload: { strokeId: string }) => {
      const pendingStroke = pendingCommittedStrokeBridgeRef.current;
      if (!pendingStroke) return;
      if (payload.strokeId !== pendingStroke.id) return;
      pendingStroke.isDrawnInCommittedLayer = true;
      clearCommittedStrokeBridgeIfReady();
    },
    [clearCommittedStrokeBridgeIfReady, pendingCommittedStrokeBridgeRef]
  );

  useLayoutEffect(() => {
    const pendingStroke = pendingCommittedStrokeBridgeRef.current;
    if (!pendingStroke) return;
    if (pendingStroke.page !== currentPage) {
      clearCommittedStrokeBridge();
      return;
    }
    const currentLayerStrokes =
      pendingStroke.layer === "annotations" ? annotationStrokes : boardStrokes;
    pendingStroke.isPresentInState = currentLayerStrokes.some(
      (stroke) => stroke.id === pendingStroke.id
    );
    if (!newRendererEnabled && pendingStroke.isPresentInState) {
      pendingStroke.isDrawnInCommittedLayer = true;
    }
    clearCommittedStrokeBridgeIfReady();
  }, [
    annotationStrokes,
    boardStrokes,
    clearCommittedStrokeBridge,
    clearCommittedStrokeBridgeIfReady,
    currentPage,
    newRendererEnabled,
    pendingCommittedStrokeBridgeRef,
  ]);

  const emitStrokePreview = useCallback(() => {
    if (!onStrokePreview) return;
    const activeStroke = activeStrokeRef.current;
    if (!activeStroke || strokePointsRef.current.length === 0) return;
    activeStroke.previewVersion += 1;
    onStrokePreview({
      stroke: {
        ...activeStroke,
        points: buildStrokePreviewPoints(strokePointsRef.current),
      },
      previewVersion: activeStroke.previewVersion,
    });
  }, [activeStrokeRef, onStrokePreview, strokePointsRef]);

  const scheduleStrokePreview = useCallback(
    (force = false) => {
      if (!onStrokePreview) return;
      if (force) {
        if (strokePreviewTimerRef.current !== null) {
          window.clearTimeout(strokePreviewTimerRef.current);
          strokePreviewTimerRef.current = null;
        }
        emitStrokePreview();
        return;
      }
      if (strokePreviewTimerRef.current !== null) return;
      strokePreviewTimerRef.current = window.setTimeout(() => {
        strokePreviewTimerRef.current = null;
        emitStrokePreview();
      }, strokePreviewSendIntervalMs);
    },
    [emitStrokePreview, onStrokePreview, strokePreviewSendIntervalMs, strokePreviewTimerRef]
  );

  const enqueueStrokePoints = useCallback(
    (nextPoints: WorkbookPoint[]) => {
      if (nextPoints.length === 0) return;
      strokePointsRef.current.push(...nextPoints);
      scheduleStrokePreview();
      if (strokeFlushFrameRef.current !== null) return;
      strokeFlushFrameRef.current = window.requestAnimationFrame(flushStrokeDraftPath);
    },
    [flushStrokeDraftPath, scheduleStrokePreview, strokeFlushFrameRef, strokePointsRef]
  );

  useEffect(
    () => () => {
      if (strokeFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(strokeFlushFrameRef.current);
        strokeFlushFrameRef.current = null;
      }
      if (strokePreviewTimerRef.current !== null) {
        window.clearTimeout(strokePreviewTimerRef.current);
        strokePreviewTimerRef.current = null;
      }
      if (committedStrokeBridgeTimeoutRef.current !== null) {
        window.clearTimeout(committedStrokeBridgeTimeoutRef.current);
        committedStrokeBridgeTimeoutRef.current = null;
      }
    },
    [committedStrokeBridgeTimeoutRef, strokeFlushFrameRef, strokePreviewTimerRef]
  );

  return {
    clearCommittedStrokeBridge,
    scheduleEraserPreviewRender,
    clearEraserPreviewRuntime,
    scheduleRemoteEraserPreviewRender,
    emitEraserPreviewPoints,
    showCommittedStrokeBridge,
    handlePendingBridgeStrokeDrawn,
    scheduleStrokePreview,
    enqueueStrokePoints,
  };
}
