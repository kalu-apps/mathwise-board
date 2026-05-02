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
  WORKBOOK_PAGE_FRAME_WIDTH,
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
import {
  type WorkbookAreaSelectionDraft,
} from "../model/sceneSelection";
import {
  buildGraphPanState,
  buildMovingCurrentPoint,
  buildMovingState,
  buildResizeState,
  buildSolid3dGestureState,
  type PanState,
  type Solid3dGestureState,
  type WorkbookAreaSelectionResizeState,
} from "../model/sceneInteraction";
import {
  getStrokeRect,
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
import {
  WORKBOOK_BOARD_BACKGROUND_COLOR,
  WORKBOOK_BOARD_GRID_COLOR,
  WORKBOOK_BOARD_PRIMARY_COLOR,
  WORKBOOK_SYSTEM_COLORS,
} from "../model/workbookVisualColors";
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
  ROUND_SOLID_PRESETS,
  type ShapeDraft,
  STROKE_PREVIEW_SEND_INTERVAL_MS,
  type WorkbookCanvasProps,
} from "./WorkbookCanvas.types";
import { useWorkbookCanvasSceneRuntime } from "./useWorkbookCanvasSceneRuntime";
import { useWorkbookCanvasDomHandlers } from "./useWorkbookCanvasDomHandlers";
import {
  buildWorkbookStrokeSelectionKey,
  resolveWorkbookStrokeMoveProxySelection,
  translateWorkbookStrokePoints,
  type WorkbookStrokeSelection,
} from "../model/strokeSelection";
import {
  createAreaSelectionResizePointMapper,
  hasMeaningfulAreaSelectionResizeChange,
  remapAreaSelectionObject,
  remapAreaSelectionStroke,
  resolveBoundedAreaSelectionResizeRect,
} from "../model/areaSelectionResize";
import {
  buildRealtimeObjectPatch,
  REALTIME_PREVIEW_REPEAT_GUARD_MS,
  toStableSignature,
} from "../model/realtimePreview";

export type { WorkbookEraserCommitPayload } from "./WorkbookCanvas.types";

type ActiveStrokeDraft = ReturnType<typeof buildWorkbookActiveStrokeDraft>;

type AreaSelectionDraft = WorkbookAreaSelectionDraft;
type AreaSelectionResizeState = WorkbookAreaSelectionResizeState;
type PinchGestureState = {
  initialDistance: number;
  initialViewportZoom: number;
  initialSafeZoom: number;
  anchorWorld: WorkbookPoint;
};

const EMPTY_STROKE_REPLACEMENT_BY_SELECTION_KEY = new Map<string, WorkbookStroke>();
const MIN_VIEWPORT_ZOOM = 0.3;
const MAX_VIEWPORT_ZOOM = 3;
const MIN_PINCH_DISTANCE_PX = 8;

const resolvePinchCenterAndDistance = (points: Array<{ x: number; y: number }>) => {
  if (points.length < 2) return null;
  const [pointA, pointB] = points;
  if (!pointA || !pointB) return null;
  return {
    center: {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2,
    },
    distance: Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y),
  };
};

const replaceRenderedStrokesBySelection = (params: {
  baseStrokes: WorkbookStroke[];
  selections: WorkbookStrokeSelection[];
  replacementBySelectionKey: Map<string, WorkbookStroke>;
}) => {
  if (params.selections.length === 0) {
    return params.baseStrokes;
  }
  const replacedSelectionKeys = new Set<string>();
  const nextStrokes: WorkbookStroke[] = [];
  params.baseStrokes.forEach((stroke) => {
    const matchingSelection = params.selections.find(
      (selection) =>
        stroke.layer === selection.layer &&
        (stroke.id === selection.id || stroke.id.startsWith(`${selection.id}::preview-`))
    );
    if (!matchingSelection) {
      nextStrokes.push(stroke);
      return;
    }
    const selectionKey = buildWorkbookStrokeSelectionKey(matchingSelection);
    if (replacedSelectionKeys.has(selectionKey)) {
      return;
    }
    replacedSelectionKeys.add(selectionKey);
    const replacementStroke = params.replacementBySelectionKey.get(selectionKey);
    if (replacementStroke) {
      nextStrokes.push(replacementStroke);
    }
  });

  params.replacementBySelectionKey.forEach((replacementStroke, selectionKey) => {
    if (replacedSelectionKeys.has(selectionKey)) return;
    nextStrokes.push(replacementStroke);
  });
  return nextStrokes;
};

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
  dividerLineStyle = "dashed",
  snapToGrid = false,
  gridSize = 22,
  viewportZoom = 1,
  pageFrameWidth = WORKBOOK_PAGE_FRAME_WIDTH,
  visibilityMode = "viewport",
  showGrid = true,
  gridColor = WORKBOOK_BOARD_GRID_COLOR,
  backgroundColor = WORKBOOK_BOARD_BACKGROUND_COLOR,
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
  onViewportZoomChange,
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
  onObjectPinToggle,
  onObjectDelete,
  onObjectContextMenu,
  onObjectDoubleClick,
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
  onTeacherCursorPoint,
  onTeacherCursorClear,
  solid3dInsertPreset = null,
  onSolid3dInsertConsumed,
}: WorkbookCanvasProps) {
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const activeTouchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchGestureRef = useRef<PinchGestureState | null>(null);
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
  const liveObjectPreviewSentAtRef = useRef<Map<string, number>>(new Map());
  const liveObjectPreviewSignatureRef = useRef<Map<string, string>>(new Map());
  const liveStrokePreviewVersionRef = useRef<Map<string, number>>(new Map());
  const liveStrokePreviewSentAtRef = useRef<Map<string, number>>(new Map());
  const liveStrokePreviewSignatureRef = useRef<Map<string, string>>(new Map());
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
  const [selectedStrokeSelection, setSelectedStrokeSelection] =
    useState<WorkbookStrokeSelection | null>(null);
  const inlineTextLastInputAtRef = useRef(0);
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
    allowHorizontalPan,
    pageFrameBounds,
    resolvedViewportOffset,
    displayBias,
    effectiveFocusPoints,
    effectivePointerPoints,
    autoDividerLines,
  } = useWorkbookCanvasViewport({
    containerNode,
    viewportZoom,
    pageFrameWidth,
    viewportOffset,
    onViewportOffsetChange,
    focusPoint,
    pointerPoint,
    focusPoints,
    pointerPoints,
    autoDividerStep,
    autoDividersEnabled,
  });
  const normalizeViewportZoom = useCallback((value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.max(
      MIN_VIEWPORT_ZOOM,
      Math.min(MAX_VIEWPORT_ZOOM, Number(value.toFixed(2)))
    );
  }, []);
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

  const selectedStrokeKey = useMemo(
    () => buildWorkbookStrokeSelectionKey(selectedStrokeSelection),
    [selectedStrokeSelection]
  );

  const selectedStrokeBase = useMemo(
    () => (selectedStrokeKey ? strokeByKey.get(selectedStrokeKey) ?? null : null),
    [selectedStrokeKey, strokeByKey]
  );

  const movingStrokeSelection = useMemo(
    () => (moving ? resolveWorkbookStrokeMoveProxySelection(moving.object) : null),
    [moving]
  );

  const movingStrokeSelections = useMemo(() => {
    if (!moving) return [] as WorkbookStrokeSelection[];
    if (movingStrokeSelection) return [movingStrokeSelection];
    return moving.groupStrokeSelections.map((entry) => ({
      id: entry.id,
      layer: entry.layer,
    }));
  }, [moving, movingStrokeSelection]);

  const movingStrokeKeys = useMemo(
    () =>
      new Set(
        movingStrokeSelections.map((selection) =>
          buildWorkbookStrokeSelectionKey(selection)
        )
      ),
    [movingStrokeSelections]
  );

  const selectedStroke = useMemo(() => {
    if (!selectedStrokeBase) return null;
    if (!moving) return selectedStrokeBase;
    const selectedStrokeMoveKey = buildWorkbookStrokeSelectionKey({
      id: selectedStrokeBase.id,
      layer: selectedStrokeBase.layer,
    });
    if (!movingStrokeKeys.has(selectedStrokeMoveKey)) {
      return selectedStrokeBase;
    }
    const deltaX = moving.current.x - moving.start.x;
    const deltaY = moving.current.y - moving.start.y;
    if (Math.abs(deltaX) <= 0.01 && Math.abs(deltaY) <= 0.01) {
      return selectedStrokeBase;
    }
    return {
      ...selectedStrokeBase,
      points: translateWorkbookStrokePoints(selectedStrokeBase.points, deltaX, deltaY),
    };
  }, [moving, movingStrokeKeys, selectedStrokeBase]);

  const selectedStrokeRect = useMemo(
    () => (selectedStroke ? getStrokeRect(selectedStroke) : null),
    [selectedStroke]
  );

  const incomingPreviewStrokeSelections = useMemo(() => {
    if (previewStrokes.length === 0) return [] as WorkbookStrokeSelection[];
    const uniqueSelections = new Map<string, WorkbookStrokeSelection>();
    previewStrokes.forEach((stroke) => {
      const selection: WorkbookStrokeSelection = {
        id: stroke.id,
        layer: stroke.layer,
      };
      const selectionKey = buildWorkbookStrokeSelectionKey(selection);
      if (!selectionKey || uniqueSelections.has(selectionKey)) return;
      uniqueSelections.set(selectionKey, selection);
    });
    return Array.from(uniqueSelections.values());
  }, [previewStrokes]);

  const areaSelectionOverlay = useMemo(() => {
    if (!areaSelection) return null;
    const nextRect = areaSelectionResize
      ? resolveBoundedAreaSelectionResizeRect({
          resize: areaSelectionResize,
          bounds: pageFrameBounds,
        })
      : areaSelection.rect;
    const hasResizeDelta = Boolean(
      areaSelectionResize &&
        hasMeaningfulAreaSelectionResizeChange(areaSelectionResize.initialRect, nextRect)
    );

    const baseRect = hasResizeDelta ? nextRect : areaSelection.rect;
    if (!moving || moving.object.id !== "__area-selection__") {
      return {
        ...areaSelection,
        rect: baseRect,
      };
    }
    const deltaX = moving.current.x - moving.start.x;
    const deltaY = moving.current.y - moving.start.y;
    if (Math.abs(deltaX) <= 0.01 && Math.abs(deltaY) <= 0.01) {
      return {
        ...areaSelection,
        rect: baseRect,
      };
    }
    return {
      ...areaSelection,
      rect: {
        x: baseRect.x + deltaX,
        y: baseRect.y + deltaY,
        width: baseRect.width,
        height: baseRect.height,
      },
    };
  }, [areaSelection, areaSelectionResize, moving, pageFrameBounds]);

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

  useEffect(() => {
    if (!inlineTextEdit) return;
    const target = objectById.get(inlineTextEdit.objectId);
    if (!target || target.type !== "text") return;
    const nextText = typeof target.text === "string" ? target.text : "";
    if (nextText === inlineTextEdit.value) return;
    if (Date.now() - inlineTextLastInputAtRef.current < 220) return;
    setInlineTextEdit((current) =>
      current && current.objectId === target.id
        ? {
            ...current,
            value: nextText,
          }
        : current
    );
  }, [inlineTextEdit, objectById]);

  useEffect(() => {
    if (tool === "select") return;
    setSelectedStrokeSelection((current) => (current ? null : current));
  }, [tool]);

  useEffect(() => {
    if (!selectedObjectId) return;
    setSelectedStrokeSelection((current) => (current ? null : current));
  }, [selectedObjectId]);

  useEffect(() => {
    if (!selectedStrokeKey) return;
    if (strokeByKey.has(selectedStrokeKey)) return;
    setSelectedStrokeSelection(null);
  }, [selectedStrokeKey, strokeByKey]);

  const handleInlineTextDraftChange = useCallback(
    (objectId: string, text: string) => {
      inlineTextLastInputAtRef.current = Date.now();
      onInlineTextDraftChange?.(objectId, text);
    },
    [onInlineTextDraftChange]
  );

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
      const rawX =
        (clientX - rect.left - displayBias.x) / safeZoom + resolvedViewportOffset.x;
      const rawY =
        (clientY - rect.top - displayBias.y) / safeZoom + resolvedViewportOffset.y;
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

  const resolveBoundedMoveDelta = useCallback(
    (movingStateValue: MovingState, rawDeltaX: number, rawDeltaY: number) => {
      if (!Number.isFinite(rawDeltaX) || !Number.isFinite(rawDeltaY)) {
        return { x: 0, y: 0 };
      }

      const moveBounds = {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
        hasTargets: false,
      };

      const includeRect = (rect: { x: number; y: number; width: number; height: number }) => {
        moveBounds.minX = Math.min(moveBounds.minX, rect.x);
        moveBounds.maxX = Math.max(moveBounds.maxX, rect.x + rect.width);
        moveBounds.minY = Math.min(moveBounds.minY, rect.y);
        moveBounds.maxY = Math.max(moveBounds.maxY, rect.y + rect.height);
        moveBounds.hasTargets = true;
      };

      const objectTargets =
        movingStateValue.groupObjects.length > 0
          ? movingStateValue.groupObjects
          : movingStateValue.object.id === "__area-selection__"
            ? []
            : [movingStateValue.object];
      objectTargets.forEach((target) => includeRect(getObjectRect(target)));

      const strokeSelections = [...movingStateValue.groupStrokeSelections];
      const singleStrokeSelection = resolveWorkbookStrokeMoveProxySelection(movingStateValue.object);
      if (
        singleStrokeSelection &&
        !strokeSelections.some(
          (entry) =>
            entry.id === singleStrokeSelection.id && entry.layer === singleStrokeSelection.layer
        )
      ) {
        strokeSelections.push(singleStrokeSelection);
      }

      strokeSelections.forEach((selection) => {
        const sourceStroke = strokeByKey.get(buildWorkbookStrokeSelectionKey(selection));
        if (!sourceStroke) return;
        const rect = getStrokeRect(sourceStroke);
        if (!rect) return;
        includeRect(rect);
      });

      if (!moveBounds.hasTargets) {
        return {
          x: rawDeltaX,
          y: rawDeltaY,
        };
      }

      const minDeltaX = pageFrameBounds.minX - moveBounds.minX;
      const maxDeltaX = pageFrameBounds.maxX - moveBounds.maxX;
      const minDeltaY = pageFrameBounds.minY - moveBounds.minY;
      const maxDeltaY = pageFrameBounds.maxY - moveBounds.maxY;

      const boundedDeltaX =
        minDeltaX <= maxDeltaX
          ? Math.max(minDeltaX, Math.min(maxDeltaX, rawDeltaX))
          : 0;
      const boundedDeltaY =
        minDeltaY <= maxDeltaY
          ? Math.max(minDeltaY, Math.min(maxDeltaY, rawDeltaY))
          : 0;

      return {
        x: boundedDeltaX,
        y: boundedDeltaY,
      };
    },
    [pageFrameBounds.maxX, pageFrameBounds.maxY, pageFrameBounds.minX, pageFrameBounds.minY, strokeByKey]
  );

  const resolveBoundedMovingCurrentPoint = useCallback(
    (movingStateValue: MovingState, clientX: number, clientY: number, zoom: number) => {
      const nextCurrent = buildMovingCurrentPoint(
        movingStateValue,
        clientX,
        clientY,
        zoom
      );
      const rawDeltaX = nextCurrent.x - movingStateValue.start.x;
      const rawDeltaY = nextCurrent.y - movingStateValue.start.y;
      const boundedDelta = resolveBoundedMoveDelta(movingStateValue, rawDeltaX, rawDeltaY);
      return {
        x: movingStateValue.start.x + boundedDelta.x,
        y: movingStateValue.start.y + boundedDelta.y,
      };
    },
    [resolveBoundedMoveDelta]
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

  const areaSelectionResizePreview = useMemo(() => {
    if (!areaSelectionResize || !areaSelection) return null;
    const nextRect = resolveBoundedAreaSelectionResizeRect({
      resize: areaSelectionResize,
      bounds: pageFrameBounds,
    });
    if (
      !hasMeaningfulAreaSelectionResizeChange(areaSelectionResize.initialRect, nextRect)
    ) {
      return null;
    }
    const remapPoint = createAreaSelectionResizePointMapper({
      initialRect: areaSelectionResize.initialRect,
      nextRect,
    });
    const resizedObjectsById = new Map<string, WorkbookBoardObject>();
    areaSelection.objectIds.forEach((objectId) => {
      const sourceObject = objectById.get(objectId);
      if (!sourceObject) return;
      resizedObjectsById.set(
        objectId,
        remapAreaSelectionObject(sourceObject, remapPoint)
      );
    });
    const resizedStrokesBySelectionKey = new Map<string, WorkbookStroke>();
    areaSelection.strokeIds.forEach((selection) => {
      const selectionKey = buildWorkbookStrokeSelectionKey(selection);
      const sourceStroke = strokeByKey.get(selectionKey) ?? null;
      if (!sourceStroke) return;
      resizedStrokesBySelectionKey.set(
        selectionKey,
        remapAreaSelectionStroke(sourceStroke, remapPoint)
      );
    });
    return {
      resizedObjectsById,
      resizedStrokesBySelectionKey,
    };
  }, [areaSelectionResize, areaSelection, pageFrameBounds, objectById, strokeByKey]);

  const emitLiveObjectPreviewPatch = useCallback(
    (objectId: string, patch: Partial<WorkbookBoardObject>) => {
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const signature = toStableSignature(patch);
      const previousTs = liveObjectPreviewSentAtRef.current.get(objectId) ?? 0;
      const previousSignature = liveObjectPreviewSignatureRef.current.get(objectId) ?? "";
      if (
        signature === previousSignature &&
        now - previousTs < REALTIME_PREVIEW_REPEAT_GUARD_MS
      ) {
        return;
      }
      liveObjectPreviewSentAtRef.current.set(objectId, now);
      liveObjectPreviewSignatureRef.current.set(objectId, signature);
      onObjectUpdate(objectId, patch, {
        trackHistory: false,
        markDirty: false,
      });
    },
    [onObjectUpdate]
  );

  const emitLiveStrokePreview = useCallback(
    (stroke: WorkbookStroke) => {
      if (!onStrokePreview) return;
      const strokeId = stroke.id;
      if (!strokeId) return;
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const signature = toStableSignature(stroke.points);
      const previousTs = liveStrokePreviewSentAtRef.current.get(strokeId) ?? 0;
      const previousSignature = liveStrokePreviewSignatureRef.current.get(strokeId) ?? "";
      if (
        signature === previousSignature &&
        now - previousTs < REALTIME_PREVIEW_REPEAT_GUARD_MS
      ) {
        return;
      }
      const nextPreviewVersion = (liveStrokePreviewVersionRef.current.get(strokeId) ?? 0) + 1;
      liveStrokePreviewVersionRef.current.set(strokeId, nextPreviewVersion);
      liveStrokePreviewSentAtRef.current.set(strokeId, now);
      liveStrokePreviewSignatureRef.current.set(strokeId, signature);
      onStrokePreview({
        stroke,
        previewVersion: nextPreviewVersion,
      });
    },
    [onStrokePreview]
  );

  useEffect(() => {
    if (!moving) return;
    const deltaX = moving.current.x - moving.start.x;
    const deltaY = moving.current.y - moving.start.y;
    const hasMeaningfulMove = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
    const movingAreaSelection = moving.object.id === "__area-selection__";

    if (hasMeaningfulMove && (movingAreaSelection || moving.groupObjects.length > 1)) {
      const { objectPatches } = buildMoveCommitResult({
        moving,
        areaSelection,
      });
      const selectedObjectHandledBySinglePreview =
        !movingAreaSelection &&
        Boolean(selectedObjectId) &&
        moving.object.id === selectedObjectId;
      objectPatches.forEach(({ id, patch }) => {
        if (!objectById.has(id)) return;
        if (selectedObjectHandledBySinglePreview && id === selectedObjectId) return;
        emitLiveObjectPreviewPatch(id, patch);
      });
    }

    if (!hasMeaningfulMove || movingStrokeSelections.length === 0) return;
    movingStrokeSelections.forEach((selection) => {
      const selectionKey = buildWorkbookStrokeSelectionKey(selection);
      const sourceStroke = strokeByKey.get(selectionKey) ?? null;
      if (!sourceStroke) return;
      const translatedPoints = translateWorkbookStrokePoints(sourceStroke.points, deltaX, deltaY);
      if (translatedPoints.length === 0) return;
      emitLiveStrokePreview({
        ...sourceStroke,
        points: translatedPoints,
      });
    });
  }, [
    areaSelection,
    emitLiveObjectPreviewPatch,
    emitLiveStrokePreview,
    moving,
    movingStrokeSelections,
    objectById,
    selectedObjectId,
    strokeByKey,
  ]);

  useEffect(() => {
    if (!areaSelection || !areaSelectionResizePreview) return;
    areaSelection.objectIds.forEach((objectId) => {
      const sourceObject = objectById.get(objectId);
      const previewObject = areaSelectionResizePreview.resizedObjectsById.get(objectId);
      if (!sourceObject || !previewObject) return;
      const patch = buildRealtimeObjectPatch(sourceObject, previewObject);
      if (!patch) return;
      emitLiveObjectPreviewPatch(objectId, patch);
    });
    areaSelection.strokeIds.forEach((selection) => {
      const selectionKey = buildWorkbookStrokeSelectionKey(selection);
      const previewStroke =
        areaSelectionResizePreview.resizedStrokesBySelectionKey.get(selectionKey) ?? null;
      if (!previewStroke || previewStroke.points.length === 0) return;
      emitLiveStrokePreview(previewStroke);
    });
  }, [
    areaSelection,
    areaSelectionResizePreview,
    emitLiveObjectPreviewPatch,
    emitLiveStrokePreview,
    objectById,
  ]);

  useEffect(() => {
    if (moving || areaSelectionResizePreview) return;
    liveObjectPreviewSentAtRef.current.clear();
    liveObjectPreviewSignatureRef.current.clear();
    liveStrokePreviewSentAtRef.current.clear();
    liveStrokePreviewSignatureRef.current.clear();
  }, [areaSelectionResizePreview, moving]);

  const visibleBoardObjectsForDisplay = useMemo(() => {
    if (!areaSelectionResizePreview || areaSelectionResizePreview.resizedObjectsById.size === 0) {
      return visibleBoardObjects;
    }
    return visibleBoardObjects.map(
      (object) => areaSelectionResizePreview.resizedObjectsById.get(object.id) ?? object
    );
  }, [areaSelectionResizePreview, visibleBoardObjects]);

  const renderedStrokesForDisplay = useMemo(() => {
    let nextStrokes = renderedStrokes;
    if (incomingPreviewStrokeSelections.length > 0) {
      // Hide committed copies while volatile preview exists for the same stroke selection.
      nextStrokes = replaceRenderedStrokesBySelection({
        baseStrokes: nextStrokes,
        selections: incomingPreviewStrokeSelections,
        replacementBySelectionKey: EMPTY_STROKE_REPLACEMENT_BY_SELECTION_KEY,
      });
    }

    if (moving && movingStrokeSelections.length > 0) {
      const deltaX = moving.current.x - moving.start.x;
      const deltaY = moving.current.y - moving.start.y;
      if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
        const translatedBySelectionKey = new Map<string, WorkbookStroke>();
        movingStrokeSelections.forEach((selection) => {
          const sourceStrokeKey = buildWorkbookStrokeSelectionKey(selection);
          const sourceStroke = strokeByKey.get(sourceStrokeKey) ?? null;
          if (!sourceStroke) return;
          translatedBySelectionKey.set(sourceStrokeKey, {
            ...sourceStroke,
            points: translateWorkbookStrokePoints(sourceStroke.points, deltaX, deltaY),
          });
        });
        nextStrokes = replaceRenderedStrokesBySelection({
          baseStrokes: nextStrokes,
          selections: movingStrokeSelections,
          replacementBySelectionKey: translatedBySelectionKey,
        });
      }
    }

    if (areaSelectionResizePreview && areaSelection?.strokeIds.length) {
      nextStrokes = replaceRenderedStrokesBySelection({
        baseStrokes: nextStrokes,
        selections: areaSelection.strokeIds,
        replacementBySelectionKey: areaSelectionResizePreview.resizedStrokesBySelectionKey,
      });
    }

    return nextStrokes;
  }, [
    incomingPreviewStrokeSelections,
    moving,
    movingStrokeSelections,
    renderedStrokes,
    strokeByKey,
    areaSelectionResizePreview,
    areaSelection,
  ]);

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
    visibleBoardObjects: visibleBoardObjectsForDisplay,
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
    onInlineTextDraftChange: handleInlineTextDraftChange,
    commitInlineTextEdit,
    setInlineTextEdit,
    cancelInlineTextEdit,
    eraserPreviewActive,
    activeEraserPreviewObjectCuts,
    activeEraserPreviewObjectPaths,
    constraints,
    selectedConstraintId,
    renderViewportRect,
    pageFrameBounds,
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
    groupOverride?: WorkbookBoardObject[],
    groupStrokeSelectionsOverride?: WorkbookStrokeSelection[]
  ) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY, false, false);
    const groupObjects = groupOverride ?? resolveMovingGroup(object);
    const groupStrokeSelections = groupStrokeSelectionsOverride ?? [];
    setMoving(
      buildMovingState({
        object,
        groupObjects,
        groupStrokeSelections,
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
        previewVersion: finalized.previewStroke.previewVersion, flush: "immediate",
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
      dividerLineStyle,
      solid3dInsertPreset,
    });
    const createdObject =
      result.created.type === "section_divider"
        ? {
            ...result.created,
            x: pageFrameBounds.minX,
            width: pageFrameBounds.width,
            y: Math.max(
              pageFrameBounds.minY,
              Math.min(pageFrameBounds.maxY - result.created.height, result.created.y)
            ),
          }
        : result.created;
    onObjectCreate(createdObject);
    onSelectedObjectChange(createdObject.id);
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
    const rawDeltaX = nextMoving.current.x - nextMoving.start.x;
    const rawDeltaY = nextMoving.current.y - nextMoving.start.y;
    const boundedDelta = resolveBoundedMoveDelta(nextMoving, rawDeltaX, rawDeltaY);
    const deltaX = boundedDelta.x;
    const deltaY = boundedDelta.y;
    const hasMeaningfulMove = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
    const normalizedMoving =
      Math.abs(rawDeltaX - deltaX) <= 1e-6 && Math.abs(rawDeltaY - deltaY) <= 1e-6
        ? nextMoving
        : {
            ...nextMoving,
            current: {
              x: nextMoving.start.x + deltaX,
              y: nextMoving.start.y + deltaY,
            },
          };
    const movingStrokeSelection = resolveWorkbookStrokeMoveProxySelection(nextMoving.object);
    if (movingStrokeSelection) {
      const sourceStrokeKey = buildWorkbookStrokeSelectionKey(movingStrokeSelection);
      const sourceStroke = sourceStrokeKey ? strokeByKey.get(sourceStrokeKey) ?? null : null;
      if (
        sourceStroke &&
        (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5)
      ) {
        const translatedPoints = translateWorkbookStrokePoints(
          sourceStroke.points,
          deltaX,
          deltaY
        );
        if (translatedPoints.length > 0) {
          onStrokeReplace({
            stroke: sourceStroke,
            fragments: [translatedPoints],
            preserveSourceId: true,
          });
          setSelectedStrokeSelection({
            id: sourceStroke.id,
            layer: sourceStroke.layer,
          });
        }
      }
      setMoving(null);
      return;
    }

    const movedStrokeReplacements = !hasMeaningfulMove
      ? []
      : nextMoving.groupStrokeSelections
      .map((selection) => {
        const sourceStrokeKey = buildWorkbookStrokeSelectionKey(selection);
        const sourceStroke = strokeByKey.get(sourceStrokeKey) ?? null;
        if (!sourceStroke) return null;
        const translatedPoints = translateWorkbookStrokePoints(
          sourceStroke.points,
          deltaX,
          deltaY
        );
        if (translatedPoints.length === 0) return null;
        return {
          stroke: sourceStroke,
          fragments: [translatedPoints],
          preserveSourceId: true,
        };
      })
      .filter(
        (
          entry
        ): entry is {
          stroke: WorkbookStroke;
          fragments: WorkbookPoint[][];
          preserveSourceId: true;
        } => entry !== null
      );

    const { objectPatches, nextAreaSelection } = buildMoveCommitResult({
      moving: normalizedMoving,
      areaSelection,
    });

    if (hasMeaningfulMove && movedStrokeReplacements.length > 0 && onEraserCommit) {
      onEraserCommit({
        strokeDeletes: [],
        strokeReplacements: movedStrokeReplacements,
        objectUpdates: objectPatches.map(({ id, patch }) => ({ objectId: id, patch })),
      });
    } else {
      movedStrokeReplacements.forEach((entry) => onStrokeReplace(entry));
      objectPatches.forEach(({ id, patch }) => onObjectUpdate(id, patch));
    }
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

  const finishAreaSelectionResize = (
    nextAreaSelectionResize = areaSelectionResizeState.ref.current
  ) => {
    if (!nextAreaSelectionResize || !areaSelection) return;

    const nextRect = resolveBoundedAreaSelectionResizeRect({
      resize: nextAreaSelectionResize,
      bounds: pageFrameBounds,
    });
    if (
      !hasMeaningfulAreaSelectionResizeChange(nextAreaSelectionResize.initialRect, nextRect)
    ) {
      return;
    }
    const remapPoint = createAreaSelectionResizePointMapper({
      initialRect: nextAreaSelectionResize.initialRect,
      nextRect,
    });

    const objectUpdates: Array<{ objectId: string; patch: Partial<WorkbookBoardObject> }> = [];
    const persistedObjectIds: string[] = [];
    areaSelection.objectIds.forEach((objectId) => {
      const object = objectById.get(objectId);
      if (!object) return;
      persistedObjectIds.push(object.id);
      const nextObject = remapAreaSelectionObject(object, remapPoint);
      const patch: Partial<WorkbookBoardObject> = {
        x: nextObject.x,
        y: nextObject.y,
        width: nextObject.width,
        height: nextObject.height,
      };
      if (Array.isArray(nextObject.points) && nextObject.points.length > 0) {
        patch.points = nextObject.points;
      }
      objectUpdates.push({
        objectId: object.id,
        patch,
      });
    });

    const strokeReplacements: Array<{
      stroke: WorkbookStroke;
      fragments: WorkbookPoint[][];
      preserveSourceId: true;
    }> = [];
    const persistedStrokeSelections: Array<{ id: string; layer: WorkbookStroke["layer"] }> = [];
    areaSelection.strokeIds.forEach((selection) => {
      const sourceStroke = strokeByKey.get(buildWorkbookStrokeSelectionKey(selection));
      if (!sourceStroke) return;
      persistedStrokeSelections.push({
        id: sourceStroke.id,
        layer: sourceStroke.layer,
      });
      const nextStroke = remapAreaSelectionStroke(sourceStroke, remapPoint);
      if (nextStroke.points.length === 0) return;
      strokeReplacements.push({
        stroke: sourceStroke,
        fragments: [nextStroke.points],
        preserveSourceId: true,
      });
    });

    if (persistedObjectIds.length === 0 && persistedStrokeSelections.length === 0) {
      onAreaSelectionChange?.(null);
      return;
    }

    if (strokeReplacements.length > 0 && onEraserCommit) {
      onEraserCommit({
        strokeDeletes: [],
        strokeReplacements,
        objectUpdates,
      });
    } else {
      objectUpdates.forEach((entry) => onObjectUpdate(entry.objectId, entry.patch));
      strokeReplacements.forEach((entry) => onStrokeReplace(entry));
    }

    onAreaSelectionChange?.({
      objectIds: persistedObjectIds,
      strokeIds: persistedStrokeSelections,
      rect: nextRect,
      resizeEnabled: areaSelection.resizeEnabled,
    });
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
        toggleObjectPin: onObjectPinToggle,
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
        finishAreaSelectionResize,
        releasePointerCapture,
        resolveBoundedMovingCurrentPoint,
        boardObjectCandidatesInRect,
        strokeCandidatesInRect,
        getObjectSceneLayerId,
      },
      api: {
        onSelectedConstraintChange,
        onSelectedObjectChange,
        onSelectedStrokeChange: setSelectedStrokeSelection,
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
        allowHorizontalPan,
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

  const cancelCurrentInteractionForPinch = useCallback(
    (svg: SVGSVGElement | null) => {
      pointerIdRef.current = null;
      setPanning(null);
      setGraphPan(null);
      setSolid3dGesture(null);
      setSolid3dResize(null);
      setAreaSelectionDraft(null);
      setAreaSelectionResize(null);
      setMoving(null);
      setResizing(null);
      setShapeDraft(null);
      setErasing(false);
      setEraserCursorPoint(null);
      clearEraserPreviewRuntime();
      erasedStrokeIdsRef.current.clear();
      eraserGestureIdRef.current = null;
      eraserLastAppliedPointRef.current = null;
      eraserLastPreviewPointRef.current = null;
      strokePointsRef.current = [];
      activeStrokeRef.current = null;
      if (draftStrokePathRef.current) {
        draftStrokePathRef.current.setAttribute("d", "");
      }
      if (!svg) return;
      activeTouchPointsRef.current.forEach((_point, pointerId) => {
        if (svg.hasPointerCapture(pointerId)) {
          svg.releasePointerCapture(pointerId);
        }
      });
    },
    [
      clearEraserPreviewRuntime,
      setAreaSelectionDraft,
      setAreaSelectionResize,
      setEraserCursorPoint,
      setErasing,
      setGraphPan,
      setMoving,
      setPanning,
      setResizing,
      setShapeDraft,
      setSolid3dGesture,
      setSolid3dResize,
    ]
  );
  const startPinchGesture = useCallback(
    (svg: SVGSVGElement) => {
      const pinchData = resolvePinchCenterAndDistance(
        Array.from(activeTouchPointsRef.current.values())
      );
      if (!pinchData) return false;
      if (pinchData.distance < MIN_PINCH_DISTANCE_PX) return false;
      const bounds = svg.getBoundingClientRect();
      const localX = pinchData.center.x - bounds.left - displayBias.x;
      const localY = pinchData.center.y - bounds.top - displayBias.y;
      const normalizedSafeZoom = Math.max(0.0001, safeZoom);
      pinchGestureRef.current = {
        initialDistance: pinchData.distance,
        initialViewportZoom: viewportZoom,
        initialSafeZoom: normalizedSafeZoom,
        anchorWorld: {
          x: resolvedViewportOffset.x + localX / normalizedSafeZoom,
          y: resolvedViewportOffset.y + localY / normalizedSafeZoom,
        },
      };
      return true;
    },
    [displayBias.x, displayBias.y, resolvedViewportOffset.x, resolvedViewportOffset.y, safeZoom, viewportZoom]
  );
  const applyPinchGesture = useCallback(
    (svg: SVGSVGElement) => {
      const pinchState = pinchGestureRef.current;
      if (!pinchState || !onViewportZoomChange) return false;
      const pinchData = resolvePinchCenterAndDistance(
        Array.from(activeTouchPointsRef.current.values())
      );
      if (!pinchData) return false;
      const normalizedInitialDistance = Math.max(MIN_PINCH_DISTANCE_PX, pinchState.initialDistance);
      const rawZoom =
        pinchState.initialViewportZoom * (pinchData.distance / normalizedInitialDistance);
      const nextViewportZoom = normalizeViewportZoom(rawZoom);
      onViewportZoomChange(nextViewportZoom);
      if (onViewportOffsetChange) {
        const bounds = svg.getBoundingClientRect();
        const localX = pinchData.center.x - bounds.left - displayBias.x;
        const localY = pinchData.center.y - bounds.top - displayBias.y;
        const zoomRatio = nextViewportZoom / Math.max(0.0001, pinchState.initialViewportZoom);
        const nextSafeZoom = Math.max(0.0001, pinchState.initialSafeZoom * zoomRatio);
        onViewportOffsetChange({
          x: pinchState.anchorWorld.x - localX / nextSafeZoom,
          y: pinchState.anchorWorld.y - localY / nextSafeZoom,
        });
      }
      return true;
    },
    [displayBias.x, displayBias.y, normalizeViewportZoom, onViewportOffsetChange, onViewportZoomChange]
  );

  const touchTapStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const lastTouchTapRef = useRef<{
    objectId: string;
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const handlePointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "touch") {
        activeTouchPointsRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (activeTouchPointsRef.current.size >= 2) {
          const svg = event.currentTarget ?? null;
          touchTapStartRef.current = null;
          lastTouchTapRef.current = null;
          if (svg && onViewportZoomChange) {
            if (event.cancelable) {
              event.preventDefault();
            }
            cancelCurrentInteractionForPinch(svg);
            startPinchGesture(svg);
            applyPinchGesture(svg);
          }
          return;
        }
      }
      if (event.pointerType !== "mouse" && event.button === 0) {
        touchTapStartRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          time: Date.now(),
        };
      } else {
        touchTapStartRef.current = null;
      }
      if (!disabled && onTeacherCursorPoint) {
        const isPrimaryPointer =
          event.pointerType !== "mouse" || event.button === 0;
        if (isPrimaryPointer) {
          const svg = event.currentTarget ?? null;
          if (svg) {
            onTeacherCursorPoint(mapPointer(svg, event.clientX, event.clientY));
          }
        }
      }
      startInteraction(event);
    },
    [
      applyPinchGesture,
      cancelCurrentInteractionForPinch,
      disabled,
      mapPointer,
      onTeacherCursorPoint,
      onViewportZoomChange,
      startInteraction,
      startPinchGesture,
    ]
  );
  const isClientPointInsideSvg = useCallback(
    (svg: SVGSVGElement, clientX: number, clientY: number) => {
      const rect = svg.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    },
    []
  );
  const handlePointerEnter = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (disabled || !onTeacherCursorPoint) return;
      const isPrimaryPointer =
        event.pointerType === "mouse" ? event.isPrimary : true;
      if (!isPrimaryPointer) return;
      const svg = event.currentTarget ?? null;
      if (!svg) return;
      onTeacherCursorPoint(mapPointer(svg, event.clientX, event.clientY));
    },
    [disabled, mapPointer, onTeacherCursorPoint]
  );
  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "touch" && activeTouchPointsRef.current.has(event.pointerId)) {
        activeTouchPointsRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }
      if (pinchGestureRef.current || activeTouchPointsRef.current.size >= 2) {
        const svg = event.currentTarget ?? null;
        touchTapStartRef.current = null;
        if (svg && onViewportZoomChange) {
          if (event.cancelable) {
            event.preventDefault();
          }
          if (!pinchGestureRef.current) {
            cancelCurrentInteractionForPinch(svg);
            startPinchGesture(svg);
          }
          applyPinchGesture(svg);
        }
        return;
      }
      const touchStart = touchTapStartRef.current;
      if (touchStart && touchStart.pointerId === event.pointerId) {
        const distance = Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y);
        if (distance > 10) {
          touchTapStartRef.current = null;
        }
      }
      if (!disabled && onTeacherCursorPoint) {
        const isPrimaryPointer =
          event.pointerType === "mouse"
            ? event.isPrimary
            : pointerIdRef.current === event.pointerId;
        if (isPrimaryPointer) {
          const svg = event.currentTarget ?? null;
          if (svg) {
            onTeacherCursorPoint(mapPointer(svg, event.clientX, event.clientY));
          }
        }
      }
      continueInteraction(event);
    },
    [
      applyPinchGesture,
      cancelCurrentInteractionForPinch,
      continueInteraction,
      disabled,
      mapPointer,
      onTeacherCursorPoint,
      onViewportZoomChange,
      startPinchGesture,
    ]
  );
  const handlePointerUp = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "touch") {
        activeTouchPointsRef.current.delete(event.pointerId);
      }
      if (pinchGestureRef.current) {
        if (event.cancelable) {
          event.preventDefault();
        }
        if (activeTouchPointsRef.current.size >= 2) {
          const svg = event.currentTarget ?? null;
          if (svg) {
            startPinchGesture(svg);
            applyPinchGesture(svg);
          }
        } else {
          pinchGestureRef.current = null;
          activeTouchPointsRef.current.clear();
          touchTapStartRef.current = null;
        }
        onTeacherCursorClear?.();
        return;
      }
      const touchStart = touchTapStartRef.current;
      const isTouchTap =
        event.pointerType !== "mouse" &&
        Boolean(touchStart) &&
        touchStart?.pointerId === event.pointerId &&
        Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) <= 10 &&
        Date.now() - touchStart.time <= 500;
      if (touchStart?.pointerId === event.pointerId) {
        touchTapStartRef.current = null;
      }

      finishInteraction(event);
      const svg = event.currentTarget ?? null;
      const shouldClearTeacherCursor =
        event.pointerType !== "mouse" &&
        event.pointerType !== "pen"
          ? true
          : !svg || !isClientPointInsideSvg(svg, event.clientX, event.clientY);
      if (shouldClearTeacherCursor) {
        onTeacherCursorClear?.();
      }

      if (!isTouchTap || !onObjectDoubleClick || disabled || tool !== "select") {
        return;
      }
      if (!svg) return;
      const point = mapPointer(svg, event.clientX, event.clientY, true);
      const target = resolveTopObject(point);
      if (!target) {
        lastTouchTapRef.current = null;
        return;
      }
      const now = Date.now();
      const previousTap = lastTouchTapRef.current;
      const isDoubleTap =
        previousTap &&
        previousTap.objectId === target.id &&
        now - previousTap.time <= 360 &&
        Math.hypot(previousTap.x - point.x, previousTap.y - point.y) <= 18;
      if (isDoubleTap) {
        lastTouchTapRef.current = null;
        onObjectDoubleClick(target);
        return;
      }
      lastTouchTapRef.current = {
        objectId: target.id,
        x: point.x,
        y: point.y,
        time: now,
      };
    },
    [
      applyPinchGesture,
      disabled,
      finishInteraction,
      isClientPointInsideSvg,
      mapPointer,
      onObjectDoubleClick,
      onTeacherCursorClear,
      resolveTopObject,
      startPinchGesture,
      tool,
    ]
  );

  useWorkbookCanvasToolLifecycle({
    selectedObjectId,
    disabled,
    objectById,
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
    onObjectDoubleClick,
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
    viewportOffset: resolvedViewportOffset,
    safeZoom,
    displayBias,
    allowHorizontalPan,
    pageFrameBounds,
    onViewportOffsetChange,
  });
  const handlePointerCancel = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "touch") {
        activeTouchPointsRef.current.delete(event.pointerId);
      }
      if (pinchGestureRef.current) {
        if (activeTouchPointsRef.current.size >= 2) {
          const svg = event.currentTarget ?? null;
          if (svg) {
            startPinchGesture(svg);
            applyPinchGesture(svg);
          }
        } else {
          pinchGestureRef.current = null;
          activeTouchPointsRef.current.clear();
          touchTapStartRef.current = null;
        }
        onTeacherCursorClear?.();
        return;
      }
      finishInteraction(event);
      onTeacherCursorClear?.();
    },
    [applyPinchGesture, finishInteraction, onTeacherCursorClear, startPinchGesture]
  );
  const handleCanvasPointerLeave = useCallback(() => {
    handlePointerLeave();
    if (pointerIdRef.current !== null) return;
    onTeacherCursorClear?.();
  }, [handlePointerLeave, onTeacherCursorClear]);

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
      <div className="workbook-session__canvas-page-surface" aria-hidden="true" />
      {newRendererEnabled ? (
        <WorkbookCommittedCanvasLayer
          strokes={renderedStrokesForDisplay}
          viewportOffset={resolvedViewportOffset}
          displayBias={displayBias}
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
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onPointerLeave={handleCanvasPointerLeave}
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
            <stop offset="0%" stopColor={WORKBOOK_SYSTEM_COLORS.white} stopOpacity="0.9" />
            <stop offset="35%" stopColor={WORKBOOK_SYSTEM_COLORS.tertiary} stopOpacity="0.88" />
            <stop offset="100%" stopColor={WORKBOOK_BOARD_PRIMARY_COLOR} stopOpacity="0.96" />
          </radialGradient>
        </defs>

        <g transform={`translate(${displayBias.x} ${displayBias.y}) scale(${safeZoom})`}>
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
            <WorkbookStrokeLayer strokes={renderedStrokesForDisplay} />
          </g>
        ) : (
          <WorkbookStrokeLayer strokes={renderedStrokesForDisplay} />
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
          areaSelection={areaSelectionOverlay}
          selectedRect={selectedRect}
          selectedLineControls={selectedLineControls}
          selectedPreviewObject={selectedPreviewObject}
          selectedStroke={selectedStroke}
          selectedStrokeRect={selectedStrokeRect}
          isStrokeDragging={movingStrokeSelections.length > 0}
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
