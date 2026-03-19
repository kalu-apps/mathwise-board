import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent } from "react";
import type {
  WorkbookBoardObject,
  WorkbookPoint,
  WorkbookStroke,
} from "../model/types";
import {
  buildWorkbookShapeCommitResult,
  buildWorkbookPolygonObjectFromPoints,
} from "../model/sceneCreation";
import {
  clampWorkbookPointToPageFrame,
} from "../model/pageFrame";
import {
  buildForcedVisibleObjectIdSet,
  resolveWorkbookObjectSceneLayerId,
  resolveTopVisibleBoardObject,
  resolveTopVisibleStroke,
} from "../model/sceneVisibility";
import { useWorkbookSceneAccess } from "./useWorkbookSceneAccess";
import {
  getObjectRect,
} from "../model/sceneGeometry";
import {
  isWorkbookObjectHit,
  isWorkbookStrokeHit,
} from "../model/sceneHitTesting";
import type {
  WorkbookAreaSelectionDraft,
} from "../model/sceneSelection";
import {
  buildGraphPanState,
  buildMovingState,
  buildResizeState,
  buildSolid3dGestureState,
  type PanState,
  type Solid3dGestureState,
  type WorkbookAreaSelectionResizeState,
} from "../model/sceneInteraction";
import {
  toPath,
} from "../model/stroke";
import {
  resolveWorkbookStrokeSvgBlendMode,
} from "../model/strokeRenderStyle";
import {
  buildWorkbookActiveStrokeDraft,
  finalizeWorkbookStrokeDraft,
} from "../model/sceneStroke";
import {
  type ObjectEraserCut,
  type ObjectEraserPreviewPath,
} from "../model/eraser";
import {
  createRemoteEraserPreviewState,
  type RemoteEraserPreviewState,
} from "../model/remoteEraserPreview";
import {
  buildMoveCommitResult,
  buildResizeCommitPatch,
  type GraphPanState,
  type MovingState,
  type ResizeState,
  type Solid3dResizeState,
} from "../model/sceneRuntime";
import {
  resolveSolid3dPointAtPointer,
  resolveSolid3dResizeHandleHit,
} from "../model/sceneSolid3d";
import {
  resolveWorkbookCanvasModeFlags,
  resolveWorkbookStrokeVisual,
} from "../model/sceneTools";
import { useAnimationFrameState } from "@/shared/lib/useAnimationFrameState";
import { isWorkbookNewRendererEnabled } from "../model/featureFlags";
import {
  WorkbookAutoDividerLayer,
  WorkbookConstraintLayer,
  WorkbookDraftOverlayLayer,
  WorkbookObjectSceneLayer,
  WorkbookPresenceLayer,
  WorkbookPreviewStrokeRuntimeLayer,
  WorkbookSelectionOverlayLayer,
  WorkbookStrokeLayer,
} from "./WorkbookCanvasLayers";
import { WorkbookCommittedCanvasLayer } from "./WorkbookCommittedCanvasLayer";
import { useWorkbookCanvasInteractions } from "./useWorkbookCanvasInteractions";
import { useWorkbookCanvasViewport } from "./useWorkbookCanvasViewport";
import { useWorkbookCanvasStrokePreviewBridge } from "./useWorkbookCanvasStrokePreviewBridge";
import { useWorkbookCanvasEraserRuntime } from "./useWorkbookCanvasEraserRuntime";
import { useWorkbookCanvasToolLifecycle } from "./useWorkbookCanvasToolLifecycle";
import {
  COMMITTED_STROKE_BRIDGE_TIMEOUT_MS,
  type InlineTextEditDraft,
  type PendingCommittedStrokeBridge,
  type ShapeDraft,
  STROKE_PREVIEW_SEND_INTERVAL_MS,
  type WorkbookCanvasProps,
} from "./WorkbookCanvas.types";
import { useWorkbookCanvasSceneRuntime } from "./useWorkbookCanvasSceneRuntime";
import { useWorkbookCanvasDomHandlers } from "./useWorkbookCanvasDomHandlers";

export type { WorkbookEraserCommitPayload } from "./WorkbookCanvas.types";

type ActiveStrokeDraft = ReturnType<typeof buildWorkbookActiveStrokeDraft>;

type AreaSelectionDraft = WorkbookAreaSelectionDraft;
type AreaSelectionResizeState = WorkbookAreaSelectionResizeState;

export const WorkbookCanvas = memo(function WorkbookCanvas({
  boardStrokes,
  annotationStrokes,
  previewStrokes = [],
  boardObjects,
  constraints,
  layer,
  tool,
  color,
  width,
  authorUserId,
  polygonSides,
  polygonMode,
  polygonPreset = "regular",
  textPreset,
  formulaLatex = "",
  formulaMathMl = "",
  graphFunctions = [],
  stickerText = "",
  commentText = "",
  lineStyle = "solid",
  snapToGrid = false,
  gridSize = 22,
  viewportZoom = 1,
  visibilityMode = "viewport",
  showGrid = true,
  gridColor = "rgba(92, 129, 192, 0.32)",
  backgroundColor = "#ffffff",
  imageAssetUrls = {},
  incomingEraserPreviews = [],
  showPageNumbers = false,
  currentPage = 1,
  disabled = false,
  selectedObjectId,
  selectedConstraintId,
  focusPoint,
  pointerPoint,
  focusPoints = [],
  pointerPoints = [],
  viewportOffset = { x: 0, y: 0 },
  onViewportOffsetChange,
  forcePanMode = false,
  autoDividerStep = 960,
  autoDividersEnabled = false,
  areaSelection = null,
  solid3dDraftPointCollectionObjectId = null,
  solid3dSectionMarkers = null,
  onSelectedObjectChange,
  onSelectedConstraintChange,
  onStrokeCommit,
  onStrokePreview,
  onEraserPreview,
  onEraserCommit,
  onStrokeDelete,
  onStrokeReplace,
  onObjectCreate,
  getLatestBoardObject,
  onObjectUpdate,
  onObjectDelete,
  onObjectContextMenu,
  onShapeVertexContextMenu,
  onLineEndpointContextMenu,
  onSolid3dVertexContextMenu,
  onSolid3dSectionVertexContextMenu,
  onSolid3dSectionContextMenu,
  onSolid3dDraftPointAdd,
  onAreaSelectionChange,
  onAreaSelectionContextMenu,
  onInlineTextDraftChange,
  onRequestSelectTool,
  onLaserPoint,
  onLaserClear,
  solid3dInsertPreset = null,
  onSolid3dInsertConsumed,
}: WorkbookCanvasProps) {
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const strokePointsRef = useRef<WorkbookPoint[]>([]);
  const activeStrokeRef = useRef<ActiveStrokeDraft | null>(null);
  const draftStrokePathRef = useRef<SVGPathElement | null>(null);
  const committedStrokeBridgePathRef = useRef<SVGPathElement | null>(null);
  const pendingCommittedStrokeBridgeRef = useRef<PendingCommittedStrokeBridge | null>(null);
  const committedStrokeBridgeTimeoutRef = useRef<number | null>(null);
  const strokeFlushFrameRef = useRef<number | null>(null);
  const strokePreviewTimerRef = useRef<number | null>(null);
  const eraserStrokeFragmentsRef = useRef<Map<string, WorkbookPoint[][]>>(new Map());
  const eraserObjectPreviewPathsRef = useRef<Map<string, ObjectEraserPreviewPath[]>>(new Map());
  const eraserPreviewFrameRef = useRef<number | null>(null);
  const remoteEraserPreviewFrameRef = useRef<number | null>(null);
  const remoteEraserPreviewStateRef = useRef<RemoteEraserPreviewState>(
    createRemoteEraserPreviewState([], [], 1)
  );
  const [eraserPreviewStrokeFragments, setEraserPreviewStrokeFragments] = useState<
    Record<string, WorkbookPoint[][]>
  >({});
  const [eraserPreviewObjectCuts, setEraserPreviewObjectCuts] = useState<
    Record<string, ObjectEraserCut[]>
  >({});
  const [eraserPreviewObjectPaths, setEraserPreviewObjectPaths] = useState<
    Record<string, ObjectEraserPreviewPath[]>
  >({});
  const [remoteEraserPreviewStrokeFragments, setRemoteEraserPreviewStrokeFragments] = useState<
    Record<string, WorkbookPoint[][]>
  >({});
  const [remoteEraserPreviewObjectCuts, setRemoteEraserPreviewObjectCuts] = useState<
    Record<string, ObjectEraserCut[]>
  >({});
  const [remoteEraserPreviewObjectPaths, setRemoteEraserPreviewObjectPaths] = useState<
    Record<string, ObjectEraserPreviewPath[]>
  >({});
  const shapeDraftState = useAnimationFrameState<ShapeDraft | null>(null);
  const shapeDraft = shapeDraftState.value;
  const setShapeDraft = shapeDraftState.setImmediate;
  const scheduleShapeDraft = shapeDraftState.schedule;
  const flushShapeDraft = shapeDraftState.flush;
  const [polygonPointDraft, setPolygonPointDraft] = useState<WorkbookPoint[]>([]);
  const polygonHoverPointState = useAnimationFrameState<WorkbookPoint | null>(null);
  const polygonHoverPoint = polygonHoverPointState.value;
  const setPolygonHoverPoint = polygonHoverPointState.setImmediate;
  const schedulePolygonHoverPoint = polygonHoverPointState.schedule;
  const clearPolygonHoverPointPending = polygonHoverPointState.clearPending;
  const movingState = useAnimationFrameState<MovingState | null>(null);
  const moving = movingState.value;
  const setMoving = movingState.setImmediate;
  const scheduleMoving = movingState.schedule;
  const flushMoving = movingState.flush;
  const resizingState = useAnimationFrameState<ResizeState | null>(null);
  const resizing = resizingState.value;
  const setResizing = resizingState.setImmediate;
  const scheduleResizing = resizingState.schedule;
  const flushResizing = resizingState.flush;
  const [panning, setPanning] = useState<PanState | null>(null);
  const graphPanState = useAnimationFrameState<GraphPanState | null>(null);
  const graphPan = graphPanState.value;
  const setGraphPan = graphPanState.setImmediate;
  const scheduleGraphPan = graphPanState.schedule;
  const flushGraphPan = graphPanState.flush;
  const [solid3dGesture, setSolid3dGesture] = useState<Solid3dGestureState | null>(null);
  const solid3dResizeState = useAnimationFrameState<Solid3dResizeState | null>(null);
  const solid3dResize = solid3dResizeState.value;
  const setSolid3dResize = solid3dResizeState.setImmediate;
  const scheduleSolid3dResize = solid3dResizeState.schedule;
  const flushSolid3dResize = solid3dResizeState.flush;
  const areaSelectionDraftState = useAnimationFrameState<AreaSelectionDraft | null>(null);
  const areaSelectionDraft = areaSelectionDraftState.value;
  const setAreaSelectionDraft = areaSelectionDraftState.setImmediate;
  const scheduleAreaSelectionDraft = areaSelectionDraftState.schedule;
  const flushAreaSelectionDraft = areaSelectionDraftState.flush;
  const areaSelectionResizeState = useAnimationFrameState<AreaSelectionResizeState | null>(null);
  const areaSelectionResize = areaSelectionResizeState.value;
  const setAreaSelectionResize = areaSelectionResizeState.setImmediate;
  const scheduleAreaSelectionResize = areaSelectionResizeState.schedule;
  const flushAreaSelectionResize = areaSelectionResizeState.flush;
  const [erasing, setErasing] = useState(false);
  const eraserCursorPointState = useAnimationFrameState<WorkbookPoint | null>(null);
  const eraserCursorPoint = eraserCursorPointState.value;
  const setEraserCursorPoint = eraserCursorPointState.setImmediate;
  const scheduleEraserCursorPoint = eraserCursorPointState.schedule;
  const clearEraserCursorPointPending = eraserCursorPointState.clearPending;
  const erasedStrokeIdsRef = useRef<Set<string>>(new Set());
  const eraserObjectCutsRef = useRef<Map<string, ObjectEraserCut[]>>(new Map());
  const eraserTouchedObjectIdsRef = useRef<Set<string>>(new Set());
  const eraserGestureIdRef = useRef<string | null>(null);
  const eraserLastAppliedPointRef = useRef<WorkbookPoint | null>(null);
  const eraserLastPreviewPointRef = useRef<WorkbookPoint | null>(null);
  const [inlineTextEdit, setInlineTextEdit] = useState<InlineTextEditDraft | null>(null);
  const [pendingCommittedBridgeStrokeId, setPendingCommittedBridgeStrokeId] = useState<
    string | null
  >(null);
  const inlineTextEditInputRef = useRef<HTMLTextAreaElement | null>(null);
  const solid3dPreviewMetaByIdState = useAnimationFrameState<
    Record<string, Record<string, unknown>>
  >({});
  const solid3dPreviewMetaById = solid3dPreviewMetaByIdState.value;
  const setSolid3dPreviewMetaById = solid3dPreviewMetaByIdState.setImmediate;
  const scheduleSolid3dPreviewMetaById = solid3dPreviewMetaByIdState.schedule;
  const flushSolid3dPreviewMetaById = solid3dPreviewMetaByIdState.flush;
  const {
    size,
    safeZoom,
    pageFrameBounds,
    resolvedViewportOffset,
    effectiveFocusPoints,
    effectivePointerPoints,
    autoDividerLines,
  } = useWorkbookCanvasViewport({
    containerNode,
    viewportZoom,
    viewportOffset,
    onViewportOffsetChange,
    focusPoint,
    pointerPoint,
    focusPoints,
    pointerPoints,
    autoDividerStep,
    autoDividersEnabled,
  });
  const newRendererEnabled = useMemo(() => isWorkbookNewRendererEnabled(), []);

  const {
    clearCommittedStrokeBridge,
    scheduleEraserPreviewRender,
    clearEraserPreviewRuntime,
    scheduleRemoteEraserPreviewRender,
    emitEraserPreviewPoints,
    showCommittedStrokeBridge,
    handlePendingBridgeStrokeDrawn,
    scheduleStrokePreview,
    enqueueStrokePoints,
  } = useWorkbookCanvasStrokePreviewBridge({
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
    strokePreviewSendIntervalMs: STROKE_PREVIEW_SEND_INTERVAL_MS,
    committedStrokeBridgeTimeoutMs: COMMITTED_STROKE_BRIDGE_TIMEOUT_MS,
  });

  const snapPoint = useCallback(
    (point: WorkbookPoint) => {
      if (!snapToGrid) return point;
      const safeGrid = Math.max(8, Math.min(96, Math.floor(gridSize || 22)));
      return {
        x: Math.round(point.x / safeGrid) * safeGrid,
        y: Math.round(point.y / safeGrid) * safeGrid,
      };
    },
    [gridSize, snapToGrid]
  );

  const allStrokes = useMemo(
    () => [...boardStrokes, ...annotationStrokes],
    [boardStrokes, annotationStrokes]
  );
  const forcedVisibleObjectIds = useMemo(() => {
    const movingIds = moving ? moving.groupObjects.map((object) => object.id) : [];
    return buildForcedVisibleObjectIdSet([
      selectedObjectId,
      inlineTextEdit?.objectId,
      solid3dSectionMarkers?.objectId,
      resizing?.object.id,
      graphPan?.object.id,
      solid3dResize?.object.id,
      solid3dGesture?.object.id,
      ...movingIds,
    ]);
  }, [
    graphPan,
    inlineTextEdit?.objectId,
    moving,
    resizing,
    selectedObjectId,
    solid3dGesture,
    solid3dResize,
    solid3dSectionMarkers?.objectId,
  ]);
  const sceneAccess = useWorkbookSceneAccess({
    boardObjects,
    strokes: allStrokes,
    viewportOffset: resolvedViewportOffset,
    width: size.width,
    height: size.height,
    zoom: safeZoom,
    visibilityMode,
    renderPadding: 360,
    hitPadding: 96,
    forcedVisibleObjectIds,
    getObjectRect,
  });
  const {
    boardObjectCandidatesInRect,
    objectById,
    strokeByKey,
    strokeCandidatesInRect,
    unpinnedSceneLayerObjectsById,
    renderViewportRect,
    visibleBoardObjects,
    visibleHitObjects,
    visibleHitObjectCandidatesAtPoint,
    visibleHitObjectCandidatesInRect,
    visibleStrokes,
    visibleHitStrokes,
    visibleHitStrokeCandidatesAtPoint,
    visibleHitStrokeCandidatesInRect,
  } = sceneAccess;

  const getObjectSceneLayerId = resolveWorkbookObjectSceneLayerId;

  const startInlineTextEdit = useCallback(
    (objectId: string) => {
      const target = objectById.get(objectId);
      if (!target || target.type !== "text") return;
      onSelectedConstraintChange(null);
      onSelectedObjectChange(objectId);
      setInlineTextEdit({
        objectId,
        value: typeof target.text === "string" ? target.text : "",
      });
    },
    [objectById, onSelectedConstraintChange, onSelectedObjectChange]
  );

  const commitInlineTextEdit = useCallback(() => {
    if (!inlineTextEdit) return;
    const target = objectById.get(inlineTextEdit.objectId);
    if (!target || target.type !== "text") {
      setInlineTextEdit(null);
      return;
    }
    const nextText = inlineTextEdit.value.replace(/\r\n/g, "\n");
    const previousText = typeof target.text === "string" ? target.text : "";
    if (nextText !== previousText) {
      onObjectUpdate(target.id, {
        text: nextText,
      });
    }
    setInlineTextEdit(null);
  }, [inlineTextEdit, objectById, onObjectUpdate]);

  const cancelInlineTextEdit = useCallback(() => {
    setInlineTextEdit(null);
  }, []);

  useEffect(() => {
    if (!inlineTextEditInputRef.current) return;
    inlineTextEditInputRef.current.focus();
    inlineTextEditInputRef.current.select();
  }, [inlineTextEdit?.objectId]);

  const resolveMovingGroup = useCallback(
    (object: WorkbookBoardObject) => {
      const layerId = getObjectSceneLayerId(object);
      if (layerId === "main") return [object];
      const group = unpinnedSceneLayerObjectsById.get(layerId) ?? [];
      return group.length > 0 ? group : [object];
    },
    [getObjectSceneLayerId, unpinnedSceneLayerObjectsById]
  );

  const mapPointer = (
    svg: SVGSVGElement | null,
    clientX: number,
    clientY: number,
    useSnap = false,
    clampToViewport = true
  ): WorkbookPoint => {
    if (!svg || typeof svg.getBoundingClientRect !== "function") {
      return { x: 0, y: 0 };
    }
    try {
      const rect = svg.getBoundingClientRect();
      const rawX = (clientX - rect.left) / safeZoom + resolvedViewportOffset.x;
      const rawY = (clientY - rect.top) / safeZoom + resolvedViewportOffset.y;
      const x = clampToViewport
        ? Math.max(
            0 + resolvedViewportOffset.x,
            Math.min(rect.width / safeZoom + resolvedViewportOffset.x, rawX)
          )
        : rawX;
      const y = clampToViewport
        ? Math.max(
            0 + resolvedViewportOffset.y,
            Math.min(rect.height / safeZoom + resolvedViewportOffset.y, rawY)
          )
        : rawY;
      const point = clampWorkbookPointToPageFrame({ x, y }, pageFrameBounds);
      return useSnap ? snapPoint(point) : point;
    } catch {
      return { x: 0, y: 0 };
    }
  };

  const resolveTopObject = useCallback(
    (point: WorkbookPoint) => {
      const indexedCandidates = visibleHitObjectCandidatesAtPoint(point);
      const resolveTarget = (candidates: WorkbookBoardObject[]) =>
        resolveTopVisibleBoardObject(candidates, (object) => isWorkbookObjectHit(object, point));
      const indexedTarget = resolveTarget(indexedCandidates);
      if (indexedTarget) return indexedTarget;
      const visibleTarget = resolveTarget(visibleHitObjects);
      if (visibleTarget) return visibleTarget;
      return resolveTarget(boardObjects);
    },
    [boardObjects, visibleHitObjectCandidatesAtPoint, visibleHitObjects]
  );

  const resolveTopStroke = useCallback(
    (point: WorkbookPoint) => {
      const indexedCandidates = visibleHitStrokeCandidatesAtPoint(point);
      const resolveTarget = (candidates: WorkbookStroke[]) =>
        resolveTopVisibleStroke(candidates, (stroke) => isWorkbookStrokeHit(stroke, point));
      const indexedTarget = resolveTarget(indexedCandidates);
      if (indexedTarget) return indexedTarget;
      const visibleTarget = resolveTarget(visibleHitStrokes);
      if (visibleTarget) return visibleTarget;
      return resolveTarget(allStrokes);
    },
    [allStrokes, visibleHitStrokeCandidatesAtPoint, visibleHitStrokes]
  );

  const {
    renderedStrokes,
    eraserPreviewActive,
    activeEraserPreviewObjectCuts,
    activeEraserPreviewObjectPaths,
    eraseAtPoint,
    eraseAlongSegment,
    commitEraserGesture,
  } = useWorkbookCanvasEraserRuntime({
    currentPage,
    width,
    erasing,
    incomingEraserPreviews,
    allStrokes,
    visibleStrokes,
    boardObjects,
    objectById,
    strokeByKey,
    getLatestBoardObject,
    getObjectRect,
    getStrokeCandidatesInRect: visibleHitStrokeCandidatesInRect,
    getObjectCandidatesInRect: visibleHitObjectCandidatesInRect,
    eraserStrokeFragmentsRef,
    eraserObjectCutsRef,
    eraserObjectPreviewPathsRef,
    erasedStrokeIdsRef,
    eraserTouchedObjectIdsRef,
    remoteEraserPreviewStateRef,
    eraserPreviewStrokeFragments,
    eraserPreviewObjectCuts,
    eraserPreviewObjectPaths,
    remoteEraserPreviewStrokeFragments,
    remoteEraserPreviewObjectCuts,
    remoteEraserPreviewObjectPaths,
    scheduleRemoteEraserPreviewRender,
    scheduleEraserPreviewRender,
    onEraserCommit,
    onStrokeDelete,
    onStrokeReplace,
    onObjectUpdate,
  });

  const {
    selectedPreviewObject,
    resolveGraphFunctionHit,
    objectSceneEntries,
    selectedRect,
    selectedLineControls,
    selectedSolidResizeHandles,
    constraintRenderSegments,
    solid3dMarkerNodes,
    areaSelectionDraftRect,
    areaSelectionResizeRect,
  } = useWorkbookCanvasSceneRuntime({
    visibleBoardObjects,
    objectById,
    selectedObjectId,
    moving,
    resizing,
    graphPan,
    solid3dResize,
    solid3dGesture,
    gridSize,
    imageAssetUrls,
    inlineTextEdit,
    inlineTextEditInputRef,
    onInlineTextDraftChange,
    commitInlineTextEdit,
    setInlineTextEdit,
    cancelInlineTextEdit,
    eraserPreviewActive,
    activeEraserPreviewObjectCuts,
    activeEraserPreviewObjectPaths,
    constraints,
    selectedConstraintId,
    renderViewportRect,
    solid3dSectionMarkers,
    solid3dPreviewMetaById,
    areaSelectionDraft,
    areaSelectionResize,
    onObjectUpdate,
  });

  const startStroke = (event: PointerEvent<SVGSVGElement>, svg: SVGSVGElement) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY);
    const strokeVisual = resolveWorkbookStrokeVisual(tool, color, width);
    if (strokeFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(strokeFlushFrameRef.current);
      strokeFlushFrameRef.current = null;
    }
    if (strokePreviewTimerRef.current !== null) {
      window.clearTimeout(strokePreviewTimerRef.current);
      strokePreviewTimerRef.current = null;
    }
    activeStrokeRef.current = buildWorkbookActiveStrokeDraft({
      layer,
      color: strokeVisual.color,
      width: strokeVisual.width,
      tool: strokeVisual.committedTool,
      page: currentPage,
      authorUserId,
    });
    strokePointsRef.current = [start];
    draftStrokePathRef.current?.setAttribute("d", toPath(strokePointsRef.current));
    scheduleStrokePreview(true);
    svg.setPointerCapture(event.pointerId);
  };

  const startShape = (
    nextTool: ShapeDraft["tool"],
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY, true);
    setShapeDraft({ tool: nextTool, start, current: start });
    svg.setPointerCapture(event.pointerId);
  };

  const startMoving = (
    object: WorkbookBoardObject,
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement,
    groupOverride?: WorkbookBoardObject[]
  ) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY, false, false);
    const groupObjects = groupOverride ?? resolveMovingGroup(object);
    setMoving(
      buildMovingState({
        object,
        groupObjects,
        start,
        startClientX: event.clientX,
        startClientY: event.clientY,
      })
    );
    svg.setPointerCapture(event.pointerId);
  };

  const startResizing = (
    object: WorkbookBoardObject,
    mode: ResizeState["mode"],
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY);
    setResizing(buildResizeState(object, mode, start));
    svg.setPointerCapture(event.pointerId);
  };

  const startSolid3dGesture = (
    object: WorkbookBoardObject,
    mode: "rotate" | "pan",
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY);
    setSolid3dGesture(buildSolid3dGestureState(object, mode, start));
    svg.setPointerCapture(event.pointerId);
  };

  const startGraphPan = (
    object: WorkbookBoardObject,
    targetFunctionId: string,
    start: WorkbookPoint,
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => {
    pointerIdRef.current = event.pointerId;
    const nextState = buildGraphPanState({
      object,
      targetFunctionId,
      start,
      gridSize,
    });
    if (!nextState) return;
    setGraphPan(nextState);
    svg.setPointerCapture(event.pointerId);
  };

  const commitPolygonByPoints = useCallback((sourcePoints: WorkbookPoint[]) => {
    const created = buildWorkbookPolygonObjectFromPoints({
      sourcePoints,
      layer,
      color,
      width,
      authorUserId,
    });
    if (!created) return;
    onObjectCreate(created);
    onSelectedObjectChange(created.id);
  }, [authorUserId, color, layer, onObjectCreate, onSelectedObjectChange, width]);

  const releasePointerCapture = (
    svg: SVGSVGElement,
    pointerId: number
  ) => {
    if (svg.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }
  };

  const finishStroke = (
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => {
    if (strokeFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(strokeFlushFrameRef.current);
      strokeFlushFrameRef.current = null;
    }
    if (strokePreviewTimerRef.current !== null) {
      window.clearTimeout(strokePreviewTimerRef.current);
      strokePreviewTimerRef.current = null;
    }
    const fallbackPoint = mapPointer(svg, event.clientX, event.clientY);
    const strokeVisual = resolveWorkbookStrokeVisual(tool, color, width);
    const finalized = finalizeWorkbookStrokeDraft({
      activeStroke: activeStrokeRef.current,
      bufferedPoints: strokePointsRef.current,
      fallbackPoint,
      fallback: {
        layer,
        color: strokeVisual.color,
        width: strokeVisual.width,
        tool: strokeVisual.committedTool,
        page: currentPage,
        authorUserId,
      },
    });
    if (!finalized) return;
    if (finalized.previewStroke && onStrokePreview) {
      onStrokePreview({
        stroke: finalized.previewStroke,
        previewVersion: finalized.previewStroke.previewVersion,
      });
    }
    showCommittedStrokeBridge(finalized.committedStroke, finalized.pathD);
    onStrokeCommit(finalized.committedStroke);
    activeStrokeRef.current = null;
    strokePointsRef.current = [];
    draftStrokePathRef.current?.setAttribute("d", "");
  };

  const finishShape = (draft = shapeDraftState.ref.current) => {
    if (!draft) return;
    const result = buildWorkbookShapeCommitResult({
      draft,
      layer,
      color,
      width,
      authorUserId,
      polygonSides,
      polygonMode,
      polygonPreset,
      textPreset,
      formulaLatex,
      formulaMathMl,
      graphFunctions,
      stickerText,
      commentText,
      lineStyle,
      solid3dInsertPreset,
    });
    onObjectCreate(result.created);
    onSelectedObjectChange(result.created.id);
    if (result.inlineTextEdit) {
      setInlineTextEdit(result.inlineTextEdit);
    }
    if (result.shouldConsumeSolid3dInsert) {
      onSolid3dInsertConsumed?.();
      onRequestSelectTool?.();
    }
    setShapeDraft(null);
  };

  const finishMoving = (nextMoving = movingState.ref.current) => {
    if (!nextMoving) return;
    const { objectPatches, nextAreaSelection } = buildMoveCommitResult({
      moving: nextMoving,
      areaSelection,
    });
    objectPatches.forEach(({ id, patch }) => onObjectUpdate(id, patch));
    if (nextAreaSelection) {
      onAreaSelectionChange?.(nextAreaSelection);
    }
    setMoving(null);
  };

  const finishResizing = (nextResizing = resizingState.ref.current) => {
    if (!nextResizing) return;
    const patch = buildResizeCommitPatch(nextResizing);
    if (patch) {
      onObjectUpdate(nextResizing.object.id, patch);
    }
    setResizing(null);
  };

  const { startInteraction, continueInteraction, finishInteraction } =
    useWorkbookCanvasInteractions({
      refs: {
        pointerIdRef,
        strokePointsRef,
        erasedStrokeIdsRef,
        eraserGestureIdRef,
        eraserLastAppliedPointRef,
        eraserLastPreviewPointRef,
        shapeDraftRef: shapeDraftState.ref,
        movingRef: movingState.ref,
        resizingRef: resizingState.ref,
        graphPanRef: graphPanState.ref,
        solid3dResizeRef: solid3dResizeState.ref,
        areaSelectionDraftRef: areaSelectionDraftState.ref,
        areaSelectionResizeRef: areaSelectionResizeState.ref,
      },
      setters: {
        setPanning,
        setPolygonPointDraft,
        setPolygonHoverPoint,
        schedulePolygonHoverPoint,
        setAreaSelectionResize,
        setAreaSelectionDraft,
        setSolid3dResize,
        setSolid3dGesture,
        setErasing,
        setEraserCursorPoint,
        scheduleEraserCursorPoint,
        setGraphPan,
        scheduleGraphPan,
        setShapeDraft,
        scheduleShapeDraft,
        scheduleSolid3dPreviewMetaById,
        scheduleSolid3dResize,
        scheduleAreaSelectionResize,
        scheduleAreaSelectionDraft,
        scheduleResizing,
        scheduleMoving,
        setSolid3dPreviewMetaById,
      },
      callbacks: {
        mapPointer,
        snapPoint,
        resolveTopObject,
        resolveTopStroke,
        resolveGraphFunctionHit,
        resolveSolid3dPointAtPointer,
        resolveSolid3dResizeHandleHit,
        startStroke,
        startShape,
        startMoving,
        startResizing,
        startSolid3dGesture,
        startGraphPan,
        commitPolygonByPoints,
        eraseAtPoint,
        eraseAlongSegment,
        emitEraserPreviewPoints,
        commitEraserGesture,
        clearEraserPreviewRuntime,
        enqueueStrokePoints,
        finishStroke,
        finishShape,
        finishMoving,
        finishResizing,
        releasePointerCapture,
        boardObjectCandidatesInRect,
        strokeCandidatesInRect,
        getObjectSceneLayerId,
      },
      api: {
        onSelectedConstraintChange,
        onSelectedObjectChange,
        onStrokeDelete,
        onObjectDelete,
        onObjectCreate,
        onObjectUpdate,
        onRequestSelectTool,
        onAreaSelectionChange,
        onLaserClear,
        onLaserPoint,
        onSolid3dDraftPointAdd,
        onSolid3dInsertConsumed,
        onViewportOffsetChange,
      },
      data: {
        disabled,
        tool,
        polygonMode,
        solid3dInsertPreset,
        forcePanMode,
        viewportOffset: resolvedViewportOffset,
        safeZoom,
        selectedObjectId,
        objectById,
        areaSelection,
        solid3dDraftPointCollectionObjectId,
        panning,
        graphPan,
        solid3dGesture,
        solid3dResize,
        areaSelectionResize,
        areaSelectionDraft,
        erasing,
        shapeDraft,
        resizing,
        moving,
        polygonPointDraft,
        pointerPoint,
        layer,
        color,
        width,
        authorUserId,
        currentPage,
        latestSolid3dPreviewMetaById: solid3dPreviewMetaById,
      },
      flushers: {
        flushShapeDraft,
        flushMoving,
        flushResizing,
        flushGraphPan,
        flushSolid3dResize,
        flushAreaSelectionDraft,
        flushAreaSelectionResize,
        flushSolid3dPreviewMetaById,
      },
    });

  useWorkbookCanvasToolLifecycle({
    selectedObjectId,
    disabled,
    objectById,
    unpinnedSceneLayerObjectsById,
    getObjectSceneLayerId,
    onObjectDelete,
    onSelectedObjectChange,
    tool,
    polygonMode,
    clearCommittedStrokeBridge,
    clearEraserCursorPointPending,
    setEraserCursorPoint,
    erasedStrokeIdsRef,
    eraserStrokeFragmentsRef,
    eraserObjectCutsRef,
    eraserObjectPreviewPathsRef,
    eraserTouchedObjectIdsRef,
    eraserGestureIdRef,
    eraserLastAppliedPointRef,
    eraserLastPreviewPointRef,
    clearPolygonHoverPointPending,
    setPolygonHoverPoint,
    setPolygonPointDraft,
    commitPolygonByPoints,
    polygonPointDraft,
    strokeFlushFrameRef,
    strokePreviewTimerRef,
    activeStrokeRef,
    strokePointsRef,
    draftStrokePathRef,
  });

  const {
    handleSelectConstraint,
    canvasStyle,
    handleWheel,
    handleDoubleClick,
    handleContextMenu,
    handlePointerLeave,
  } = useWorkbookCanvasDomHandlers({
    disabled,
    selectedObjectId,
    objectById,
    mapPointer,
    resolveTopObject,
    tool,
    onObjectUpdate,
    onSelectedObjectChange,
    onSelectedConstraintChange,
    startInlineTextEdit,
    areaSelection,
    solid3dPreviewMetaById,
    roundSolidPresets: ROUND_SOLID_PRESETS,
    onLaserClear,
    onObjectContextMenu,
    onShapeVertexContextMenu,
    onLineEndpointContextMenu,
    onSolid3dVertexContextMenu,
    onSolid3dSectionVertexContextMenu,
    onSolid3dSectionContextMenu,
    onAreaSelectionContextMenu,
    gridSize,
    showGrid,
    gridColor,
    backgroundColor,
    polygonMode,
    setPolygonHoverPoint,
    setEraserCursorPoint,
  });

  const { panModeEnabled, graphModeEnabled, eraserModeEnabled } =
    resolveWorkbookCanvasModeFlags(tool, forcePanMode);
  const strokeVisual = resolveWorkbookStrokeVisual(tool, color, width);

  return (
    <div
      className={`workbook-session__canvas ${panModeEnabled ? "is-pan-mode" : ""} ${
        graphModeEnabled ? "is-graph-mode" : ""
      } ${eraserModeEnabled ? "is-eraser-mode" : ""}`}
      ref={setContainerNode}
      style={canvasStyle}
    >
      {newRendererEnabled ? (
        <WorkbookCommittedCanvasLayer
          strokes={renderedStrokes}
          viewportOffset={resolvedViewportOffset}
          zoom={safeZoom}
          width={size.width}
          height={size.height}
          currentPage={currentPage}
          pendingBridgeStrokeId={pendingCommittedBridgeStrokeId}
          onPendingBridgeStrokeDrawn={handlePendingBridgeStrokeDrawn}
        />
      ) : null}
      <svg
        className="workbook-session__canvas-svg"
        viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
        preserveAspectRatio="none"
        style={{
          textRendering: "geometricPrecision",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: eraserModeEnabled ? "none" : undefined,
        }}
        onPointerDown={startInteraction}
        onPointerMove={continueInteraction}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <marker
            id="workbook-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,7 L8,3.5 z" fill={color} />
          </marker>
          <radialGradient id="workbook-sphere-gradient" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#a8b7ff" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#4f63ff" stopOpacity="0.96" />
          </radialGradient>
        </defs>

        <g transform={`scale(${safeZoom})`}>
        <g transform={`translate(${-resolvedViewportOffset.x} ${-resolvedViewportOffset.y})`}>
        <WorkbookAutoDividerLayer lines={autoDividerLines} />
        <WorkbookObjectSceneLayer entries={objectSceneEntries} />
        {solid3dMarkerNodes}
        <WorkbookConstraintLayer
          segments={constraintRenderSegments}
          selectedConstraintId={selectedConstraintId}
          tool={tool}
          onSelectConstraint={handleSelectConstraint}
        />
        {newRendererEnabled ? (
          <g
            data-workbook-export-only="true"
            style={{ display: "none" }}
            aria-hidden="true"
          >
            <WorkbookStrokeLayer strokes={renderedStrokes} />
          </g>
        ) : (
          <WorkbookStrokeLayer strokes={renderedStrokes} />
        )}
        <WorkbookPreviewStrokeRuntimeLayer strokes={previewStrokes} />
        <WorkbookDraftOverlayLayer
          shapeDraft={shapeDraft}
          tool={tool}
          color={color}
          width={width}
          polygonMode={polygonMode}
          polygonPointDraft={polygonPointDraft}
          polygonHoverPoint={polygonHoverPoint}
          polygonSides={polygonSides}
          polygonPreset={polygonPreset}
          eraserCursorPoint={eraserCursorPoint}
          areaSelectionDraftRect={areaSelectionDraftRect}
          areaSelectionResizeRect={areaSelectionResizeRect}
        />

        <path
          ref={committedStrokeBridgePathRef}
          stroke={color}
          strokeWidth={Math.max(1, width)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={1}
          style={{ mixBlendMode: "normal" }}
          pointerEvents="none"
        />

        <path
          ref={draftStrokePathRef}
          stroke={strokeVisual.color}
          strokeWidth={strokeVisual.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={strokeVisual.opacity}
          style={{ mixBlendMode: resolveWorkbookStrokeSvgBlendMode(strokeVisual.committedTool) }}
          pointerEvents="none"
        />
        <WorkbookSelectionOverlayLayer
          areaSelection={areaSelection}
          selectedRect={selectedRect}
          selectedPreviewObject={selectedPreviewObject}
          selectedLineControls={selectedLineControls}
          selectedSolidResizeHandles={selectedSolidResizeHandles}
          tool={tool}
        />
        <WorkbookPresenceLayer
          focusPoints={effectiveFocusPoints}
          pointerPoints={effectivePointerPoints}
        />
        </g>
        </g>
      </svg>
      {showPageNumbers ? (
        <div className="workbook-session__canvas-page">Страница {Math.max(1, currentPage)}</div>
      ) : null}
    </div>
  );
});
