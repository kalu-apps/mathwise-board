import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";
import { generateId } from "@/shared/lib/id";
import type {
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTool,
} from "../model/types";
import {
  buildWorkbookPointObject,
  buildWorkbookShapeObject,
} from "../model/sceneCreation";
import { resolveSolid3dPresetId } from "../model/solid3d";
import {
  readSolid3dState,
  writeSolid3dState,
} from "../model/solid3dState";
import type { Solid3dSectionPoint } from "../model/solid3dState";
import {
  computeSectionMetrics,
  computeSectionPolygon,
  getSolid3dMesh,
  projectSolidPointForObject,
  projectSolidVerticesForObject,
} from "../model/solid3dGeometry";
import type { ProjectedSolidVertex } from "../model/solid3dGeometry";
import { resolveBoardObjectImageAssetId } from "../model/scene";
import {
  buildForcedVisibleObjectIdSet,
  buildWorkbookSceneAccess,
  resolveWorkbookObjectSceneLayerId,
  resolveTopVisibleBoardObject,
  resolveTopVisibleStroke,
} from "../model/sceneVisibility";
import {
  type GraphFunctionDraft,
} from "../model/functionGraph";
import type { WorkbookPolygonPreset } from "../model/shapeGeometry";
import {
  normalizeShapeAngleMarks,
  resolveRenderedShapeAngleMarkStyle,
} from "../model/shapeAngleMarks";
import {
  buildAngleArcPath,
  buildRightAngleMarkerPath,
  clampUnitDot,
  clipPolygonByHalfPlane,
  createPolygonPath,
  getLineBasis,
  getLineControlPoints,
  getLinePathD,
  getObjectCenter,
  getObjectRect,
  getPointsCentroid,
  getPointObjectCenter,
  is2dFigureClosed,
  isInsideRect,
  normalizeRect,
  resolve2dFigureVertexLabels,
  resolve2dFigureVertices,
  resolveOutsideVertexLabelPlacement,
  get2dFigureSegments,
} from "../model/sceneGeometry";
import {
  isWorkbookObjectErasedByCircle,
  isWorkbookObjectHit,
  isWorkbookStrokeErasedByCircle,
  isWorkbookStrokeHit,
  resolveFunctionGraphPlotHit,
  resolveWorkbook2dFigureVertexAtPoint,
  resolveWorkbookLineEndpointAtPoint,
} from "../model/sceneHitTesting";
import {
  getAreaSelectionDraftRect,
  resizeAreaSelectionRect,
  resolveAreaSelectionResizeMode,
  type WorkbookAreaSelection,
} from "../model/sceneSelection";
import type {
  WorkbookAreaSelectionDraft,
} from "../model/sceneSelection";
import {
  buildAreaSelectionDraftState,
  buildAreaSelectionResizeState,
  buildGraphPanCommitPatch,
  buildGraphPanState,
  buildMovingState,
  buildMovingCurrentPoint,
  buildPanningOffset,
  buildPanState,
  buildResizeState,
  buildSolid3dGesturePreviewMeta,
  buildSolid3dGestureState,
  finalizeAreaSelectionDraft,
  finalizeAreaSelectionResize,
  resolveObjectResizeMode,
  shouldKeepObjectSelectedInsideArea,
  type PanState,
  type Solid3dGestureState,
  type WorkbookAreaSelectionResizeState,
} from "../model/sceneInteraction";
import {
  buildStrokePreviewPoints,
  toPath,
} from "../model/stroke";
import {
  applyEraserPointToCollections,
  buildEraserSegmentPoints,
  convertObjectEraserCutToStoredPath,
  normalizeObjectEraserPreviewPath,
  type ObjectEraserCut,
  type ObjectEraserPreviewPath,
  type ObjectEraserStoredPath,
} from "../model/eraser";
import {
  buildRealtimeObjectPatch,
  toStableSignature,
  REALTIME_PREVIEW_REPEAT_GUARD_MS,
} from "../model/realtimePreview";
import {
  createRemoteEraserPreviewState,
  snapshotRemoteEraserPreviewState,
  syncRemoteEraserPreviewState,
  type WorkbookIncomingEraserPreview,
  type RemoteEraserPreviewState,
} from "../model/remoteEraserPreview";
import {
  buildMoveCommitResult,
  buildResizeCommitPatch,
  collectMappedInteractionPoints,
  collectSegmentPreviewPoints,
  computeSolid3dResizePatch,
  filterPreviewPointsByDistance,
  resolveRealtimePatchBaseObject,
  resolveSelectedPreviewObject,
  type GraphPanState,
  type MovingState,
  type ResizeState,
  type Solid3dResizeState,
} from "../model/sceneRuntime";
import {
  buildMaskedObjectSceneEntry,
  buildConstraintRenderSegments,
  buildFunctionGraphRenderStateMap,
  buildRenderedWorkbookStrokes,
  prepareWorkbookRenderObject,
  resolveAreaSelectionPreviewRects,
  resolveSelectedObjectRect,
  type WorkbookMaskedObjectSceneEntry,
  type WorkbookConstraintRenderSegment,
} from "../model/sceneRender";
import {
  resolveSolid3dPointAtPointer,
  resolveSolid3dResizeHandles,
  resolveSolid3dPickMarkersForObject,
  resolveSolid3dVertexAtPointer,
  resolveSolid3dSectionVertexAtPointer,
  resolveSolid3dSectionAtPointer,
  type Solid3dResizeHandle,
} from "../model/sceneSolid3d";
import { useAnimationFrameState } from "@/shared/lib/useAnimationFrameState";
import {
  WorkbookAutoDividerLayer,
  WorkbookConstraintLayer,
  WorkbookDraftOverlayLayer,
  WorkbookObjectSceneLayer,
  WorkbookPresenceLayer,
  WorkbookSelectionOverlayLayer,
  WorkbookStrokeLayer,
} from "./WorkbookCanvasLayers";

type WorkbookCanvasProps = {
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  previewStrokes?: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  layer: WorkbookLayer;
  tool: WorkbookTool;
  color: string;
  width: number;
  authorUserId: string;
  polygonSides: number;
  polygonMode: "regular" | "points";
  polygonPreset?: WorkbookPolygonPreset;
  textPreset: string;
  formulaLatex?: string;
  formulaMathMl?: string;
  graphFunctions?: GraphFunctionDraft[];
  stickerText?: string;
  commentText?: string;
  lineStyle?: "solid" | "dashed";
  snapToGrid?: boolean;
  gridSize?: number;
  viewportZoom?: number;
  showGrid?: boolean;
  gridColor?: string;
  backgroundColor?: string;
  imageAssetUrls?: Record<string, string>;
  incomingEraserPreviews?: WorkbookIncomingEraserPreview[];
  showPageNumbers?: boolean;
  currentPage?: number;
  disabled?: boolean;
  selectedObjectId: string | null;
  selectedConstraintId: string | null;
  focusPoint?: WorkbookPoint | null;
  pointerPoint?: WorkbookPoint | null;
  focusPoints?: WorkbookPoint[];
  pointerPoints?: WorkbookPoint[];
  viewportOffset?: WorkbookPoint;
  onViewportOffsetChange?: (offset: WorkbookPoint) => void;
  forcePanMode?: boolean;
  autoDividerStep?: number;
  autoDividersEnabled?: boolean;
  areaSelection?: WorkbookCanvasAreaSelection | null;
  solid3dDraftPointCollectionObjectId?: string | null;
  solid3dSectionMarkers?: {
    objectId: string;
    sectionId: string;
    selectedPoints: Solid3dSectionPoint[];
  } | null;
  onSelectedObjectChange: (objectId: string | null) => void;
  onSelectedConstraintChange: (constraintId: string | null) => void;
  onStrokeCommit: (stroke: WorkbookStroke) => void;
  onStrokePreview?: (payload: { stroke: WorkbookStroke; previewVersion: number }) => void;
  onEraserPreview?: (payload: {
    gestureId: string;
    layer: WorkbookLayer;
    page: number;
    radius: number;
    points: WorkbookPoint[];
    ended?: boolean;
  }) => void;
  onStrokeDelete: (strokeId: string, layer: WorkbookLayer) => void;
  onStrokeReplace: (payload: {
    stroke: WorkbookStroke;
    fragments: WorkbookPoint[][];
  }) => void;
  onObjectCreate: (object: WorkbookBoardObject) => void;
  onObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void;
  onObjectDelete: (objectId: string) => void;
  onObjectContextMenu?: (objectId: string, anchor: { x: number; y: number }) => void;
  onShapeVertexContextMenu?: (payload: {
    objectId: string;
    vertexIndex: number;
    label: string;
    anchor: { x: number; y: number };
  }) => void;
  onLineEndpointContextMenu?: (payload: {
    objectId: string;
    endpoint: "start" | "end";
    label: string;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dVertexContextMenu?: (payload: {
    objectId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dSectionVertexContextMenu?: (payload: {
    objectId: string;
    sectionId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dSectionContextMenu?: (payload: {
    objectId: string;
    sectionId: string;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dDraftPointAdd?: (payload: {
    objectId: string;
    point: Solid3dSectionPoint;
  }) => void;
  onAreaSelectionChange?: (selection: WorkbookCanvasAreaSelection | null) => void;
  onAreaSelectionContextMenu?: (payload: {
    objectIds: string[];
    strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
    rect: { x: number; y: number; width: number; height: number };
    anchor: { x: number; y: number };
  }) => void;
  onInlineTextDraftChange?: (objectId: string, value: string) => void;
  onRequestSelectTool?: () => void;
  onLaserPoint: (point: WorkbookPoint) => void;
  onLaserClear?: () => void;
  onEraserRadiusChange?: (nextRadius: number) => void;
  solid3dInsertPreset?: {
    presetId: string;
    presetTitle?: string;
  } | null;
  onSolid3dInsertConsumed?: () => void;
};

type WorkbookCanvasAreaSelection = WorkbookAreaSelection;

type ShapeDraft = {
  tool:
    | "line"
    | "arrow"
    | "rectangle"
    | "ellipse"
    | "triangle"
    | "polygon"
    | "text"
    | "compass"
    | "formula"
    | "function_graph"
    | "frame"
    | "divider"
    | "sticker"
    | "comment"
    | "solid3d";
  start: WorkbookPoint;
  current: WorkbookPoint;
};

type ActiveStrokeDraft = Omit<WorkbookStroke, "points"> & {
  previewVersion: number;
};

type PendingCommittedStrokeBridge = {
  id: string;
  layer: WorkbookLayer;
  page: number;
  color: string;
  width: number;
  tool: WorkbookTool;
  path: string;
};

type AreaSelectionDraft = WorkbookAreaSelectionDraft;
type AreaSelectionResizeState = WorkbookAreaSelectionResizeState;

const STROKE_PREVIEW_SEND_INTERVAL_MS = 32;

const ROUND_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);

const summarizeProjectedVertices = (
  projectedVertexByIndex: Map<number, ProjectedSolidVertex>,
  indices: number[]
) => {
  const points = indices
    .map((index) => projectedVertexByIndex.get(index))
    .filter((point): point is ProjectedSolidVertex => Boolean(point));
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return {
    points,
    center: {
      x: center.x / points.length,
      y: center.y / points.length,
    },
    minX,
    maxX,
    minY,
    maxY,
    rx: Math.max(2, (maxX - minX) / 2),
    ry: Math.max(2, (maxY - minY) / 2),
  };
};

const getSectionVertexLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length)}`;
};
const useElementSize = (element: HTMLDivElement | null) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(1, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(1, Math.floor(entry.contentRect.height));
      setSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return size;
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
  snapToGrid = false,
  gridSize = 22,
  viewportZoom = 1,
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
  onStrokeDelete,
  onStrokeReplace,
  onObjectCreate,
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
  const lastRealtimeUpdateAtRef = useRef<Map<string, number>>(new Map());
  const lastRealtimePatchSignatureRef = useRef<Map<string, string>>(new Map());
  const strokePointsRef = useRef<WorkbookPoint[]>([]);
  const activeStrokeRef = useRef<ActiveStrokeDraft | null>(null);
  const draftStrokePathRef = useRef<SVGPathElement | null>(null);
  const committedStrokeBridgePathRef = useRef<SVGPathElement | null>(null);
  const pendingCommittedStrokeBridgeRef = useRef<PendingCommittedStrokeBridge | null>(null);
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
  const [inlineTextEdit, setInlineTextEdit] = useState<{
    objectId: string;
    value: string;
  } | null>(null);
  const inlineTextEditInputRef = useRef<HTMLTextAreaElement | null>(null);
  const solid3dPreviewMetaByIdState = useAnimationFrameState<
    Record<string, Record<string, unknown>>
  >({});
  const solid3dPreviewMetaById = solid3dPreviewMetaByIdState.value;
  const setSolid3dPreviewMetaById = solid3dPreviewMetaByIdState.setImmediate;
  const scheduleSolid3dPreviewMetaById = solid3dPreviewMetaByIdState.schedule;
  const flushSolid3dPreviewMetaById = solid3dPreviewMetaByIdState.flush;
  const size = useElementSize(containerNode);
  const safeZoom = Math.max(
    0.3,
    Math.min(3, Number.isFinite(viewportZoom) ? viewportZoom : 1)
  );
  const effectiveFocusPoints = useMemo(() => {
    const base = focusPoints.length > 0 ? focusPoints : focusPoint ? [focusPoint] : [];
    if (base.length <= 1) return base;
    const seen = new Set<string>();
    return base.filter((point) => {
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [focusPoint, focusPoints]);
  const effectivePointerPoints = useMemo(() => {
    const base =
      pointerPoints.length > 0 ? pointerPoints : pointerPoint ? [pointerPoint] : [];
    if (base.length <= 1) return base;
    const seen = new Set<string>();
    return base.filter((point) => {
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pointerPoint, pointerPoints]);
  const autoDividerLines = (() => {
    if (!autoDividersEnabled) return [];
    const step = Math.max(320, Math.floor(autoDividerStep || 960));
    const visibleWidth = Math.max(1, size.width / safeZoom);
    const visibleHeight = Math.max(1, size.height / safeZoom);
    const visibleLeft = Math.max(0, viewportOffset.x);
    const visibleTop = Math.max(0, viewportOffset.y);
    const visibleRight = visibleLeft + visibleWidth;
    const visibleBottom = visibleTop + visibleHeight;
    const startY = Math.max(0, Math.floor(visibleTop / step) * step);
    const lines: Array<{
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }> = [];
    for (let y = startY; y <= visibleBottom + step; y += step) {
      lines.push({
        key: `auto-divider-${y}`,
        x1: visibleLeft - 2000,
        y1: y,
        x2: visibleRight + 2000,
        y2: y,
      });
    }
    return lines;
  })();

  const flushStrokeDraftPath = useCallback(() => {
    strokeFlushFrameRef.current = null;
    draftStrokePathRef.current?.setAttribute("d", toPath(strokePointsRef.current));
  }, []);

  const clearCommittedStrokeBridge = useCallback(() => {
    pendingCommittedStrokeBridgeRef.current = null;
    const bridgeNode = committedStrokeBridgePathRef.current;
    if (!bridgeNode) return;
    bridgeNode.setAttribute("d", "");
  }, []);

  const scheduleEraserPreviewRender = useCallback(() => {
    if (eraserPreviewFrameRef.current !== null) return;
    eraserPreviewFrameRef.current = window.requestAnimationFrame(() => {
      eraserPreviewFrameRef.current = null;
      setEraserPreviewStrokeFragments(
        Object.fromEntries(eraserStrokeFragmentsRef.current.entries())
      );
      setEraserPreviewObjectCuts(
        Object.fromEntries(eraserObjectCutsRef.current.entries())
      );
      setEraserPreviewObjectPaths(
        Object.fromEntries(eraserObjectPreviewPathsRef.current.entries())
      );
    });
  }, []);

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
  }, []);

  const scheduleRemoteEraserPreviewRender = useCallback(() => {
    if (remoteEraserPreviewFrameRef.current !== null) return;
    remoteEraserPreviewFrameRef.current = window.requestAnimationFrame(() => {
      remoteEraserPreviewFrameRef.current = null;
      const snapshot = snapshotRemoteEraserPreviewState(
        remoteEraserPreviewStateRef.current
      );
      setRemoteEraserPreviewStrokeFragments(snapshot.strokeFragments);
      setRemoteEraserPreviewObjectCuts(snapshot.objectCuts);
      setRemoteEraserPreviewObjectPaths(snapshot.objectPaths);
    });
  }, []);

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
    [currentPage, layer, onEraserPreview, width]
  );

  const showCommittedStrokeBridge = useCallback(
    (stroke: WorkbookStroke, path: string) => {
      pendingCommittedStrokeBridgeRef.current = {
        id: stroke.id,
        layer: stroke.layer,
        page: Math.max(1, stroke.page ?? currentPage),
        color: stroke.color,
        width: Math.max(1, stroke.width),
        tool: stroke.tool,
        path,
      };
      const bridgeNode = committedStrokeBridgePathRef.current;
      if (!bridgeNode) return;
      bridgeNode.setAttribute("d", path);
      bridgeNode.setAttribute("stroke", stroke.color);
      bridgeNode.setAttribute("stroke-width", String(Math.max(1, stroke.width)));
      bridgeNode.setAttribute("opacity", stroke.tool === "highlighter" ? "0.5" : "1");
    },
    [currentPage]
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
    if (currentLayerStrokes.some((stroke) => stroke.id === pendingStroke.id)) {
      clearCommittedStrokeBridge();
    }
  }, [annotationStrokes, boardStrokes, clearCommittedStrokeBridge, currentPage]);

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
  }, [onStrokePreview]);

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
      }, STROKE_PREVIEW_SEND_INTERVAL_MS);
    },
    [emitStrokePreview, onStrokePreview]
  );

  const enqueueStrokePoints = useCallback(
    (nextPoints: WorkbookPoint[]) => {
      if (nextPoints.length === 0) return;
      strokePointsRef.current.push(...nextPoints);
      scheduleStrokePreview();
      if (strokeFlushFrameRef.current !== null) return;
      strokeFlushFrameRef.current = window.requestAnimationFrame(flushStrokeDraftPath);
    },
    [flushStrokeDraftPath, scheduleStrokePreview]
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
    },
    []
  );

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
  const sceneAccess = useMemo(
    () =>
      buildWorkbookSceneAccess({
        boardObjects,
        strokes: allStrokes,
        viewportOffset,
        width: size.width,
        height: size.height,
        zoom: safeZoom,
        renderPadding: 360,
        hitPadding: 96,
        forcedVisibleObjectIds,
        getObjectRect,
      }),
    [allStrokes, boardObjects, forcedVisibleObjectIds, safeZoom, size.height, size.width, viewportOffset]
  );
  const {
    boardObjectCandidatesInRect,
    objectById,
    strokeByKey,
    strokeCandidatesInRect,
    unpinnedSceneLayerObjectsById,
    renderViewportRect,
    visibleBoardObjects,
    visibleHitObjectCandidatesAtPoint,
    visibleHitObjectCandidatesInRect,
    visibleStrokes,
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

  const activeMoveRect = useMemo(() => {
    if (!moving) return null;
    const deltaX = moving.current.x - moving.start.x;
    const deltaY = moving.current.y - moving.start.y;
    const baseRect = getObjectRect(moving.object);
    return {
      id: moving.object.id,
      x: baseRect.x + deltaX,
      y: baseRect.y + deltaY,
      width: baseRect.width,
      height: baseRect.height,
    };
  }, [moving]);

  const selectedObject = selectedObjectId ? objectById.get(selectedObjectId) ?? null : null;
  const selectedPreviewObject = useMemo(
    () =>
      resolveSelectedPreviewObject({
        selectedObject,
        moving,
        resizing,
        graphPan,
        solid3dResize,
        solid3dPreviewMetaById,
      }),
    [graphPan, moving, resizing, selectedObject, solid3dPreviewMetaById, solid3dResize]
  );

  const functionGraphRenderStateById = useMemo(
    () =>
      buildFunctionGraphRenderStateMap({
        visibleBoardObjects,
        selectedPreviewObject,
        graphPan,
        gridSize,
      }),
    [graphPan, gridSize, selectedPreviewObject, visibleBoardObjects]
  );

  const resolveGraphFunctionHit = useCallback(
    (object: WorkbookBoardObject, point: WorkbookPoint) => {
      if (object.type !== "function_graph") return null;
      const renderState = functionGraphRenderStateById.get(object.id);
      if (!renderState) return null;
      return resolveFunctionGraphPlotHit(renderState.plots, point);
    },
    [functionGraphRenderStateById]
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
      const rawX = (clientX - rect.left) / safeZoom + viewportOffset.x;
      const rawY = (clientY - rect.top) / safeZoom + viewportOffset.y;
      const x = clampToViewport
        ? Math.max(
            0 + viewportOffset.x,
            Math.min(rect.width / safeZoom + viewportOffset.x, rawX)
          )
        : rawX;
      const y = clampToViewport
        ? Math.max(
            0 + viewportOffset.y,
            Math.min(rect.height / safeZoom + viewportOffset.y, rawY)
          )
        : rawY;
      const point = { x, y };
      return useSnap ? snapPoint(point) : point;
    } catch {
      return { x: 0, y: 0 };
    }
  };

  const resolve2dFigureVertexAtPointer = useCallback(
    (object: WorkbookBoardObject, point: WorkbookPoint) =>
      resolveWorkbook2dFigureVertexAtPoint(object, point),
    []
  );

  const resolveLineEndpointAtPointer = useCallback(
    (object: WorkbookBoardObject, point: WorkbookPoint) =>
      resolveWorkbookLineEndpointAtPoint(object, point),
    []
  );

  const resolveTopObject = useCallback(
    (point: WorkbookPoint) => {
      return resolveTopVisibleBoardObject(visibleHitObjectCandidatesAtPoint(point), (object) =>
        isWorkbookObjectHit(object, point)
      );
    },
    [visibleHitObjectCandidatesAtPoint]
  );

  const resolveTopStroke = useCallback(
    (point: WorkbookPoint) => {
      return resolveTopVisibleStroke(visibleHitStrokeCandidatesAtPoint(point), (stroke) =>
        isWorkbookStrokeHit(stroke, point)
      );
    },
    [visibleHitStrokeCandidatesAtPoint]
  );

  const isStrokeErasedByCircle = useCallback(
    (stroke: WorkbookStroke, center: WorkbookPoint, radius: number) =>
      isWorkbookStrokeErasedByCircle(stroke, center, radius),
    []
  );

  const isObjectErasedByCircle = useCallback(
    (object: WorkbookBoardObject, center: WorkbookPoint, radius: number) =>
      isWorkbookObjectErasedByCircle(object, center, radius),
    []
  );

  useEffect(() => {
    const safePage = Math.max(1, currentPage);
    const nextRemoteState = syncRemoteEraserPreviewState({
      state: remoteEraserPreviewStateRef.current,
      previews: incomingEraserPreviews,
      strokes: allStrokes,
      objects: boardObjects,
      page: safePage,
      getStrokeCandidatesInRect: visibleHitStrokeCandidatesInRect,
      getObjectCandidatesInRect: visibleHitObjectCandidatesInRect,
      getObjectRect,
      isStrokeErasedByCircle,
      isObjectErasedByCircle,
    });
    remoteEraserPreviewStateRef.current = nextRemoteState.state;
    const { changed } = nextRemoteState;
    if (!changed) return;
    scheduleRemoteEraserPreviewRender();
  }, [
    allStrokes,
    boardObjects,
    currentPage,
    incomingEraserPreviews,
    isObjectErasedByCircle,
    isStrokeErasedByCircle,
    scheduleRemoteEraserPreviewRender,
    visibleHitObjectCandidatesInRect,
    visibleHitStrokeCandidatesInRect,
  ]);

  const activeEraserPreviewStrokeFragments = erasing
    ? eraserPreviewStrokeFragments
    : remoteEraserPreviewStrokeFragments;
  const activeEraserPreviewObjectCuts = erasing ? eraserPreviewObjectCuts : remoteEraserPreviewObjectCuts;
  const activeEraserPreviewObjectPaths = erasing
    ? eraserPreviewObjectPaths
    : remoteEraserPreviewObjectPaths;
  const eraserPreviewActive = erasing || incomingEraserPreviews.length > 0;
  const renderedStrokes = useMemo(() => {
    return buildRenderedWorkbookStrokes({
      visibleStrokes,
      eraserPreviewActive,
      previewStrokeFragments: activeEraserPreviewStrokeFragments,
    });
  }, [activeEraserPreviewStrokeFragments, eraserPreviewActive, visibleStrokes]);

  const eraseAtPoint = useCallback(
    (center: WorkbookPoint) => {
      const radius = Math.max(4, width);
      const queryRect = {
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2,
      };
      applyEraserPointToCollections({
        center,
        radius,
        strokes: visibleHitStrokeCandidatesInRect(queryRect),
        objects: visibleHitObjectCandidatesInRect(queryRect),
        strokeFragmentsMap: eraserStrokeFragmentsRef.current,
        objectCutsMap: eraserObjectCutsRef.current,
        objectPreviewPathsMap: eraserObjectPreviewPathsRef.current,
        touchedStrokeIds: erasedStrokeIdsRef.current,
        touchedObjectIds: eraserTouchedObjectIdsRef.current,
        getObjectRect,
        isStrokeErasedByCircle,
        isObjectErasedByCircle,
      });
      scheduleEraserPreviewRender();
    },
    [
      isObjectErasedByCircle,
      isStrokeErasedByCircle,
      scheduleEraserPreviewRender,
      visibleHitObjectCandidatesInRect,
      visibleHitStrokeCandidatesInRect,
      width,
    ]
  );

  const eraseAlongSegment = useCallback(
    (from: WorkbookPoint, to: WorkbookPoint) => {
      const radius = Math.max(4, width);
      const sampledPoints = buildEraserSegmentPoints(from, to, radius);
      sampledPoints.forEach((point) => {
        eraseAtPoint(point);
      });
      return sampledPoints;
    },
    [eraseAtPoint, width]
  );

  const commitEraserGesture = useCallback(() => {
    erasedStrokeIdsRef.current.forEach((key) => {
      const [targetLayer, strokeId] = key.split(":");
      if (!strokeId) return;
      const sourceStroke = strokeByKey.get(key) ?? null;
      if (!sourceStroke) return;
      const fragments = eraserStrokeFragmentsRef.current.get(key) ?? [];
      if (fragments.length === 0) {
        onStrokeDelete(
          strokeId,
          targetLayer === "annotations" ? "annotations" : "board"
        );
        return;
      }
      onStrokeReplace({
        stroke: sourceStroke,
        fragments,
      });
    });
    if (eraserTouchedObjectIdsRef.current.size === 0) return;
    const touchedIds = Array.from(eraserTouchedObjectIdsRef.current);
    touchedIds.forEach((objectId) => {
      const sourceObject = objectById.get(objectId) ?? null;
      const cuts = eraserObjectCutsRef.current.get(objectId);
      if (!cuts || cuts.length === 0) return;
      const nextStoredPaths = (
        eraserObjectPreviewPathsRef.current.get(objectId) ?? []
      ).reduce<ObjectEraserStoredPath[]>((acc, path) => {
        const normalized = sourceObject
          ? normalizeObjectEraserPreviewPath(sourceObject, path, getObjectRect)
          : null;
        if (normalized) {
          acc.push(normalized);
        }
        return acc;
      }, []);
      const existingStoredPaths = sourceObject
        ? sanitizeObjectEraserPaths(sourceObject, getObjectRect)
        : [];
      const fallbackStoredPaths =
        existingStoredPaths.length > 0
          ? existingStoredPaths
          : sourceObject
            ? sanitizeObjectEraserCuts(sourceObject, getObjectRect).map((cut) =>
                convertObjectEraserCutToStoredPath(cut)
              )
            : [];
      const persistedPaths = [...fallbackStoredPaths, ...nextStoredPaths];
      onObjectUpdate(
        objectId,
        {
          meta: {
            eraserCuts: cuts,
            eraserPaths: persistedPaths,
          },
        },
        {
          trackHistory: true,
          markDirty: true,
        }
      );
    });
  }, [objectById, onObjectUpdate, onStrokeDelete, onStrokeReplace, strokeByKey]);

  const startStroke = (event: PointerEvent<SVGSVGElement>, svg: SVGSVGElement) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY);
    const createdAt = new Date().toISOString();
    const strokeTool = tool === "eraser" ? "pen" : tool;
    if (strokeFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(strokeFlushFrameRef.current);
      strokeFlushFrameRef.current = null;
    }
    if (strokePreviewTimerRef.current !== null) {
      window.clearTimeout(strokePreviewTimerRef.current);
      strokePreviewTimerRef.current = null;
    }
    activeStrokeRef.current = {
      id: generateId(),
      layer,
      color: tool === "eraser" ? "var(--surface-soft)" : color,
      width: tool === "eraser" ? Math.max(8, width * 1.6) : width,
      tool: strokeTool,
      page: currentPage,
      authorUserId,
      createdAt,
      previewVersion: 0,
    };
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
    if (sourcePoints.length < 3) return;
    const xs = sourcePoints.map((point) => point.x);
    const ys = sourcePoints.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const created: WorkbookBoardObject = {
      id: generateId(),
      type: "polygon",
      layer,
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      color,
      fill: "transparent",
      strokeWidth: width,
      opacity: 1,
      points: sourcePoints,
      sides: sourcePoints.length,
      authorUserId,
      createdAt: new Date().toISOString(),
    };
    onObjectCreate(created);
    onSelectedObjectChange(created.id);
  }, [authorUserId, color, layer, onObjectCreate, onSelectedObjectChange, width]);

  const startInteraction = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    const svg = event.currentTarget ?? null;
    if (!svg) return;
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    if (event.button !== 0) {
      if (tool === "laser" && event.button === 2) {
        onLaserClear?.();
      }
      return;
    }
    const shouldSnapPoint =
      Boolean(solid3dInsertPreset) ||
      tool === "line" ||
      tool === "arrow" ||
      tool === "point" ||
      tool === "rectangle" ||
      tool === "ellipse" ||
      tool === "triangle" ||
      tool === "polygon" ||
      tool === "text" ||
      tool === "compass" ||
      tool === "formula" ||
      tool === "function_graph" ||
      tool === "frame" ||
      tool === "divider" ||
      tool === "sticker" ||
      tool === "comment";
    const point = mapPointer(svg, event.clientX, event.clientY, shouldSnapPoint);
    if (solid3dInsertPreset) {
      onSelectedConstraintChange(null);
      onSelectedObjectChange(null);
      startShape("solid3d", event, svg);
      return;
    }
    if (forcePanMode) {
      pointerIdRef.current = event.pointerId;
      setPanning(
        buildPanState(
          { x: event.clientX, y: event.clientY },
          viewportOffset
        )
      );
      svg.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "pan") {
      const target = resolveTopObject(point);
      if (target && target.type === "solid3d" && !target.pinned) {
        onSelectedConstraintChange(null);
        onSelectedObjectChange(target.id);
        startSolid3dGesture(target, "rotate", event, svg);
        return;
      }
      if (target && target.type === "function_graph" && !target.pinned) {
        onSelectedConstraintChange(null);
        onSelectedObjectChange(target.id);
        const targetFunctionId = resolveGraphFunctionHit(target, point);
        if (targetFunctionId) {
          startGraphPan(target, targetFunctionId, point, event, svg);
        } else {
          startMoving(target, event, svg);
        }
        return;
      }
      if (target && !target.pinned) {
        onSelectedConstraintChange(null);
        onSelectedObjectChange(target.id);
        startMoving(target, event, svg);
        return;
      }
      onSelectedConstraintChange(null);
      onSelectedObjectChange(null);
      pointerIdRef.current = event.pointerId;
      setPanning(
        buildPanState(
          { x: event.clientX, y: event.clientY },
          viewportOffset
        )
      );
      svg.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "polygon" && polygonMode === "points") {
      onSelectedConstraintChange(null);
      if (event.detail >= 2) {
        commitPolygonByPoints(polygonPointDraft);
        setPolygonPointDraft([]);
        setPolygonHoverPoint(null);
        return;
      }
      setPolygonPointDraft((current) => [...current, snapPoint(point)]);
      setPolygonHoverPoint(point);
      return;
    }

    if (tool === "laser") {
      onSelectedConstraintChange(null);
      if (pointerPoint && Math.hypot(point.x - pointerPoint.x, point.y - pointerPoint.y) <= 18) {
        onLaserClear?.();
        return;
      }
      onLaserPoint(point);
      return;
    }

    if (tool === "sweep") {
      const strokeTarget = resolveTopStroke(point);
      if (strokeTarget) {
        onSelectedConstraintChange(null);
        onStrokeDelete(strokeTarget.id, strokeTarget.layer);
        return;
      }
      const target = resolveTopObject(point);
      if (target && !target.pinned) {
        onSelectedConstraintChange(null);
        const layerId = getObjectSceneLayerId(target);
        if (layerId !== "main") {
          (unpinnedSceneLayerObjectsById.get(layerId) ?? []).forEach((item) =>
            onObjectDelete(item.id)
          );
        } else {
          onObjectDelete(target.id);
        }
        if (selectedObjectId === target.id || layerId !== "main") {
          onSelectedObjectChange(null);
        }
      } else {
        onSelectedObjectChange(null);
        onRequestSelectTool?.();
      }
      return;
    }

    if (tool === "area_select") {
      if (areaSelection) {
        const resizeMode = resolveAreaSelectionResizeMode(areaSelection.rect, point);
        if (resizeMode) {
          pointerIdRef.current = event.pointerId;
          onSelectedConstraintChange(null);
          onSelectedObjectChange(null);
          setAreaSelectionResize(
            buildAreaSelectionResizeState(areaSelection.rect, resizeMode, point)
          );
          svg.setPointerCapture(event.pointerId);
          return;
        }
      }
      pointerIdRef.current = event.pointerId;
      onSelectedConstraintChange(null);
      onSelectedObjectChange(null);
      setAreaSelectionDraft(buildAreaSelectionDraftState(point));
      svg.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "point") {
      onSelectedConstraintChange(null);
      const created = buildWorkbookPointObject({
        point,
        layer,
        color,
        width,
        authorUserId,
      });
      onObjectCreate(created);
      onSelectedObjectChange(created.id);
      onRequestSelectTool?.();
      return;
    }

    if (solid3dDraftPointCollectionObjectId) {
      const target = resolveTopObject(point);
      if (
        target &&
        target.type === "solid3d" &&
        target.id === solid3dDraftPointCollectionObjectId &&
        !target.pinned &&
        onSolid3dDraftPointAdd
      ) {
        const picked = resolveSolid3dPointAtPointer(target, point);
        if (picked && Number.isInteger(picked.faceIndex)) {
          onSelectedConstraintChange(null);
          onSelectedObjectChange(target.id);
          onSolid3dDraftPointAdd({
            objectId: target.id,
            point: {
              x: picked.point.x,
              y: picked.point.y,
              z: picked.point.z,
              faceIndex: picked.faceIndex,
              triangleVertexIndices: picked.triangleVertexIndices,
              barycentric: picked.barycentric,
            },
          });
          return;
        }
      }
    }

    if (tool === "select") {
      const selected = selectedObjectId ? objectById.get(selectedObjectId) ?? null : null;
      if (tool === "select" && selected && !selected.pinned) {
        if (selected.type === "solid3d") {
          const handles = resolveSolid3dResizeHandles(selected);
          const hit = handles.find(
            (handle) => Math.hypot(handle.x - point.x, handle.y - point.y) <= 8.5
          );
          if (hit) {
            pointerIdRef.current = event.pointerId;
            const center = {
              x: selected.x + selected.width / 2,
              y: selected.y + selected.height / 2,
            };
            setSolid3dResize({
              object: selected,
              mode: hit.mode,
              start: point,
              current: point,
              center,
              startLocal: hit,
            });
            onAreaSelectionChange?.(null);
            svg.setPointerCapture(event.pointerId);
            return;
          }
        }
        if (selected.type !== "solid3d") {
          const resizeMode = resolveObjectResizeMode(selected, point);
          if (resizeMode) {
            onAreaSelectionChange?.(null);
            startResizing(selected, resizeMode, event, svg);
            return;
          }
        }
      }
      if (shouldKeepObjectSelectedInsideArea(point, areaSelection)) {
        const groupedTargets = areaSelection.objectIds.reduce<WorkbookBoardObject[]>(
          (acc, objectId) => {
            const object = objectById.get(objectId);
            if (object) {
              acc.push(object);
            }
            return acc;
          },
          []
        );
        if (groupedTargets.length > 0) {
          const proxyObject: WorkbookBoardObject = {
            id: "__area-selection__",
            type: "frame",
            layer,
            x: areaSelection.rect.x,
            y: areaSelection.rect.y,
            width: areaSelection.rect.width,
            height: areaSelection.rect.height,
            color: "#4f63ff",
            fill: "transparent",
            strokeWidth: 1,
            opacity: 1,
            authorUserId,
            createdAt: new Date().toISOString(),
          };
          onSelectedConstraintChange(null);
          startMoving(proxyObject, event, svg, groupedTargets);
          return;
        }
      }
      const target = resolveTopObject(point);
      onSelectedConstraintChange(null);
      if (target && !target.pinned) {
        onAreaSelectionChange?.(null);
        onSelectedObjectChange(target.id);
        startMoving(target, event, svg);
      } else {
        onSelectedObjectChange(null);
        onAreaSelectionChange?.(null);
        pointerIdRef.current = event.pointerId;
        setAreaSelectionDraft(buildAreaSelectionDraftState(point));
        svg.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (tool === "eraser") {
      pointerIdRef.current = event.pointerId;
      clearEraserPreviewRuntime();
      erasedStrokeIdsRef.current.clear();
      eraserGestureIdRef.current = generateId();
      eraserLastAppliedPointRef.current = point;
      eraserLastPreviewPointRef.current = point;
      setErasing(true);
      setEraserCursorPoint(point);
      eraseAtPoint(point);
      emitEraserPreviewPoints([point]);
      svg.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      startStroke(event, svg);
      return;
    }

    if (
      tool === "line" ||
      tool === "arrow" ||
      tool === "rectangle" ||
      tool === "ellipse" ||
      tool === "triangle" ||
      (tool === "polygon" && polygonMode === "regular") ||
      tool === "text" ||
      tool === "compass" ||
      tool === "formula" ||
      tool === "function_graph" ||
      tool === "frame" ||
      tool === "divider" ||
      tool === "sticker" ||
      tool === "comment"
    ) {
      const target = resolveTopObject(point);
      if (target && target.id !== selectedObjectId) {
        onSelectedConstraintChange(null);
        onSelectedObjectChange(target.id);
        onRequestSelectTool?.();
        return;
      }
      if (!target && selectedObjectId) {
        onSelectedConstraintChange(null);
        onSelectedObjectChange(null);
        onRequestSelectTool?.();
        return;
      }
      onSelectedConstraintChange(null);
      startShape(tool, event, svg);
    }
  };

  const continueInteraction = (event: PointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget ?? null;
    if (!svg) return;

    if (tool === "eraser") {
      const hoverPoint = mapPointer(svg, event.clientX, event.clientY, false, false);
      scheduleEraserCursorPoint(hoverPoint);
    }

    if (tool === "polygon" && polygonMode === "points" && !panning && !forcePanMode) {
      schedulePolygonHoverPoint(mapPointer(svg, event.clientX, event.clientY, true));
      return;
    }
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    if (panning) {
      const nextOffset = buildPanningOffset(
        panning,
        event.clientX,
        event.clientY,
        safeZoom
      );
      onViewportOffsetChange?.(nextOffset);
      return;
    }
    if (graphPan) {
      const point = mapPointer(svg, event.clientX, event.clientY, false, false);
      scheduleGraphPan((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }
    const requiresUnclampedPointer = Boolean(solid3dGesture || solid3dResize || moving);
    const point = mapPointer(
      svg,
      event.clientX,
      event.clientY,
      Boolean(shapeDraft),
      !requiresUnclampedPointer
    );

    if (solid3dGesture) {
      const nextMeta = buildSolid3dGesturePreviewMeta(solid3dGesture, point);
      scheduleSolid3dPreviewMetaById((current) => ({
        ...current,
        [solid3dGesture.object.id]: nextMeta,
      }));
      return;
    }

    if (solid3dResize) {
      scheduleSolid3dResize((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (areaSelectionResize) {
      scheduleAreaSelectionResize((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (areaSelectionDraft) {
      scheduleAreaSelectionDraft((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (erasing && tool === "eraser") {
      const nativeEvent = event.nativeEvent;
      const coalesced =
        typeof nativeEvent.getCoalescedEvents === "function"
          ? nativeEvent.getCoalescedEvents()
          : [];
      const sourceEvents =
        coalesced.length > 0
          ? coalesced
          : [{ clientX: event.clientX, clientY: event.clientY }];
      const eraserSegmentResult = collectSegmentPreviewPoints({
        sourceEvents,
        mapPoint: (sourceEvent) =>
          mapPointer(svg, sourceEvent.clientX, sourceEvent.clientY, false, false),
        lastAppliedPoint: eraserLastAppliedPointRef.current ?? point,
        sampleSegment: eraseAlongSegment,
      });
      eraserLastAppliedPointRef.current = eraserSegmentResult.lastAppliedPoint;
      const filteredPoints = filterPreviewPointsByDistance({
        previewPoints: eraserSegmentResult.previewPoints,
        lastPreviewPoint: eraserLastPreviewPointRef.current,
        minDistance: Math.max(1.2, Math.max(4, width) * 0.22),
      });
      if (filteredPoints.length > 0) {
        eraserLastPreviewPointRef.current =
          filteredPoints[filteredPoints.length - 1];
        emitEraserPreviewPoints(filteredPoints);
      }
      return;
    }

    if (strokePointsRef.current.length > 0) {
      const nativeEvent = event.nativeEvent;
      const coalesced =
        typeof nativeEvent.getCoalescedEvents === "function"
          ? nativeEvent.getCoalescedEvents()
          : [];
      const sourceEvents =
        coalesced.length > 0
          ? coalesced
          : [nativeEvent as globalThis.PointerEvent];
      const nextPoints = collectMappedInteractionPoints({
        sourceEvents,
        mapPoint: (pointerEvent) => mapPointer(svg, pointerEvent.clientX, pointerEvent.clientY),
        lastPoint: strokePointsRef.current[strokePointsRef.current.length - 1] ?? null,
        minDistance: 0.18,
      });
      enqueueStrokePoints(nextPoints);
      return;
    }

    if (shapeDraft) {
      scheduleShapeDraft((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (resizing) {
      scheduleResizing((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (moving) {
      const nextCurrent = buildMovingCurrentPoint(
        moving,
        event.clientX,
        event.clientY,
        safeZoom
      );
      scheduleMoving((prev) =>
        prev
          ? {
              ...prev,
              current: nextCurrent,
            }
          : prev
      );
    }
  };

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
    const bufferedPoints = strokePointsRef.current.length > 0 ? strokePointsRef.current : [fallbackPoint];
    const lastPoint = bufferedPoints[bufferedPoints.length - 1];
    const finalPoints =
      !lastPoint || Math.hypot(fallbackPoint.x - lastPoint.x, fallbackPoint.y - lastPoint.y) > 0.12
        ? [...bufferedPoints, fallbackPoint]
        : [...bufferedPoints];
    if (finalPoints.length === 0) return;
    const activeStroke = activeStrokeRef.current;
    if (activeStroke && onStrokePreview) {
      activeStroke.previewVersion += 1;
      onStrokePreview({
        stroke: {
          ...activeStroke,
          points: buildStrokePreviewPoints(finalPoints),
        },
        previewVersion: activeStroke.previewVersion,
      });
    }
    const committedStroke: WorkbookStroke = {
      id: activeStroke?.id ?? generateId(),
      layer: activeStroke?.layer ?? layer,
      color: activeStroke?.color ?? (tool === "eraser" ? "var(--surface-soft)" : color),
      width: activeStroke?.width ?? (tool === "eraser" ? Math.max(8, width * 1.6) : width),
      tool: activeStroke?.tool ?? (tool === "eraser" ? "pen" : tool),
      points: finalPoints,
      page: activeStroke?.page ?? currentPage,
      authorUserId: activeStroke?.authorUserId ?? authorUserId,
      createdAt: activeStroke?.createdAt ?? new Date().toISOString(),
    };
    showCommittedStrokeBridge(committedStroke, toPath(finalPoints));
    onStrokeCommit(committedStroke);
    activeStrokeRef.current = null;
    strokePointsRef.current = [];
    draftStrokePathRef.current?.setAttribute("d", "");
  };

  const finishShape = (draft = shapeDraftState.ref.current) => {
    if (!draft) return;
    const created = buildWorkbookShapeObject({
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
    onObjectCreate(created);
    onSelectedObjectChange(created.id);
    if (draft.tool === "text") {
      setInlineTextEdit({
        objectId: created.id,
        value: typeof created.text === "string" ? created.text : "",
      });
    }
    if (draft.tool === "solid3d") {
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

  const finishInteraction = (event: PointerEvent<SVGSVGElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const svg = event.currentTarget ?? null;
    if (!svg) {
      pointerIdRef.current = null;
      return;
    }
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    const latestShapeDraft = flushShapeDraft();
    const latestMoving = flushMoving();
    const latestResizing = flushResizing();
    const latestGraphPan = flushGraphPan();
    const latestSolid3dResize = flushSolid3dResize();
    const latestAreaSelectionDraft = flushAreaSelectionDraft();
    const latestAreaSelectionResize = flushAreaSelectionResize();
    const latestSolid3dPreviewMetaById = flushSolid3dPreviewMetaById();
    if (erasing) {
      const point = mapPointer(svg, event.clientX, event.clientY, false, false);
      const lastAppliedPoint = eraserLastAppliedPointRef.current ?? point;
      const sampledPoints = eraseAlongSegment(lastAppliedPoint, point);
      eraserLastAppliedPointRef.current =
        sampledPoints[sampledPoints.length - 1] ?? point;
      emitEraserPreviewPoints(
        sampledPoints.length > 0 ? sampledPoints : [point],
        true
      );
      commitEraserGesture();
      setErasing(false);
      erasedStrokeIdsRef.current.clear();
      eraserGestureIdRef.current = null;
      eraserLastAppliedPointRef.current = null;
      eraserLastPreviewPointRef.current = null;
      clearEraserPreviewRuntime();
    } else if (strokePointsRef.current.length > 0) {
      finishStroke(event, svg);
    } else if (latestShapeDraft) {
      finishShape(latestShapeDraft);
    } else if (latestAreaSelectionResize) {
      const selectionRect = resizeAreaSelectionRect(
        latestAreaSelectionResize.initialRect,
        latestAreaSelectionResize.mode,
        latestAreaSelectionResize.current
      );
      onAreaSelectionChange?.(
        finalizeAreaSelectionResize({
          resize: latestAreaSelectionResize,
          boardObjects: boardObjectCandidatesInRect(selectionRect),
          strokes: strokeCandidatesInRect(selectionRect),
        })
      );
      setAreaSelectionResize(null);
    } else if (latestAreaSelectionDraft) {
      const selectionRect = getAreaSelectionDraftRect(latestAreaSelectionDraft);
      onAreaSelectionChange?.(
        finalizeAreaSelectionDraft({
          draft: latestAreaSelectionDraft,
          boardObjects: boardObjectCandidatesInRect(selectionRect),
          strokes: strokeCandidatesInRect(selectionRect),
        })
      );
      setAreaSelectionDraft(null);
    } else if (panning) {
      setPanning(null);
    } else if (latestGraphPan) {
      onObjectUpdate(
        latestGraphPan.object.id,
        buildGraphPanCommitPatch(latestGraphPan)
      );
      setGraphPan(null);
    } else if (solid3dGesture) {
      const previewMeta = latestSolid3dPreviewMetaById[solid3dGesture.object.id];
      if (previewMeta) {
        onObjectUpdate(solid3dGesture.object.id, { meta: previewMeta });
      }
      setSolid3dGesture(null);
      setSolid3dPreviewMetaById((current) => {
        const next = { ...current };
        delete next[solid3dGesture.object.id];
        return next;
      });
    } else if (latestSolid3dResize) {
      const patch = computeSolid3dResizePatch(latestSolid3dResize);
      onObjectUpdate(latestSolid3dResize.object.id, patch);
      setSolid3dResize(null);
    } else if (latestResizing) {
      finishResizing(latestResizing);
    } else if (latestMoving) {
      finishMoving(latestMoving);
    }
    pointerIdRef.current = null;
    releasePointerCapture(svg, event.pointerId);
  };

  useEffect(() => {
    if (!selectedObjectId) return;
    const onDelete = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
      );
      if (isTypingTarget) return;
      if (disabled) return;
      const selected = objectById.get(selectedObjectId);
      if (selected?.pinned) return;
      event.preventDefault();
      const layerId = selected ? getObjectSceneLayerId(selected) : "main";
      if (layerId !== "main") {
        (unpinnedSceneLayerObjectsById.get(layerId) ?? []).forEach((item) =>
          onObjectDelete(item.id)
        );
      } else {
        onObjectDelete(selectedObjectId);
      }
      onSelectedObjectChange(null);
    };
    window.addEventListener("keydown", onDelete);
    return () => window.removeEventListener("keydown", onDelete);
  }, [
    disabled,
    getObjectSceneLayerId,
    objectById,
    onObjectDelete,
    onSelectedObjectChange,
    selectedObjectId,
    unpinnedSceneLayerObjectsById,
  ]);

  useEffect(() => {
    if (tool !== "pen" && tool !== "highlighter") {
      if (strokeFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(strokeFlushFrameRef.current);
        strokeFlushFrameRef.current = null;
      }
      if (strokePreviewTimerRef.current !== null) {
        window.clearTimeout(strokePreviewTimerRef.current);
        strokePreviewTimerRef.current = null;
      }
      activeStrokeRef.current = null;
      strokePointsRef.current = [];
      draftStrokePathRef.current?.setAttribute("d", "");
    }
    if (tool !== "eraser") {
      clearEraserCursorPointPending();
      setEraserCursorPoint(null);
      erasedStrokeIdsRef.current.clear();
      eraserStrokeFragmentsRef.current.clear();
      eraserObjectCutsRef.current.clear();
      eraserObjectPreviewPathsRef.current.clear();
      eraserTouchedObjectIdsRef.current.clear();
      eraserGestureIdRef.current = null;
      eraserLastAppliedPointRef.current = null;
      eraserLastPreviewPointRef.current = null;
    }
    if (tool !== "polygon" || polygonMode !== "points") {
      clearPolygonHoverPointPending();
      setPolygonHoverPoint(null);
    }
  }, [
    clearEraserCursorPointPending,
    clearPolygonHoverPointPending,
    polygonMode,
    setEraserCursorPoint,
    setPolygonHoverPoint,
    tool,
  ]);

  useEffect(() => {
    if (tool !== "polygon" || polygonMode !== "points") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPolygonPointDraft([]);
        setPolygonHoverPoint(null);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        commitPolygonByPoints(polygonPointDraft);
        setPolygonPointDraft([]);
        setPolygonHoverPoint(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitPolygonByPoints, polygonMode, polygonPointDraft, setPolygonHoverPoint, tool]);

  const renderObject = (objectSource: WorkbookBoardObject) => {
    const prepared = prepareWorkbookRenderObject({
      objectSource,
      moving,
      activeMoveRect,
      solid3dPreviewMetaById,
    });
    const { object, normalized, transform } = prepared;
    const commonProps = {
      stroke: object.color ?? "#4f63ff",
      strokeWidth: object.strokeWidth ?? 2,
      fill: object.fill ?? "transparent",
      opacity: object.opacity ?? 1,
      "data-object-id": object.id,
    };

    const render2dFigureOverlay = (vertices: WorkbookPoint[]) => {
      if (vertices.length < 2) return null;
      const labels = resolve2dFigureVertexLabels(object, vertices.length);
      const showLabels = object.meta?.showLabels !== false;
      const showAngles = Boolean(object.meta?.showAngles);
      const isClosed = is2dFigureClosed(object);
      const segments = get2dFigureSegments(vertices, isClosed);
      const figureCenter = getPointsCentroid(vertices);
      const labelPlacements = vertices.map((vertex) =>
        resolveOutsideVertexLabelPlacement({
          vertex,
          center: figureCenter,
          polygon: isClosed ? vertices : [],
          baseOffset: 14,
        })
      );
      const angleMarks = normalizeShapeAngleMarks(
        object,
        vertices.length,
        object.color ?? "#4f63ff"
      );
      const vertexColorsRaw = Array.isArray(object.meta?.vertexColors)
        ? object.meta.vertexColors
        : [];
      const segmentNotesRaw = Array.isArray(object.meta?.segmentNotes)
        ? object.meta.segmentNotes
        : [];
      const segmentColorsRaw = Array.isArray(object.meta?.segmentColors)
        ? object.meta.segmentColors
        : [];
      const segmentDash =
        object.meta?.lineStyle === "dashed" ? `${Math.max(4, (object.strokeWidth ?? 2) * 2.2)} ${Math.max(3, (object.strokeWidth ?? 2) * 1.8)}` : undefined;
      return (
        <>
          {segments.map((segment, index) => {
            const segmentColor =
              typeof segmentColorsRaw[index] === "string" && segmentColorsRaw[index]
                ? segmentColorsRaw[index]
                : object.color ?? "#4f63ff";
            return (
              <line
                key={`${object.id}-segment-color-${index}`}
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke={segmentColor}
                strokeWidth={Math.max(1, (object.strokeWidth ?? 2) * 0.92)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={segmentDash}
                opacity={0.98}
              />
            );
          })}
          {vertices.map((vertex, index) => (
            <g key={`${object.id}-vertex-label-${index}`}>
              {(() => {
                const vertexColor =
                  typeof vertexColorsRaw[index] === "string" && vertexColorsRaw[index]
                    ? vertexColorsRaw[index]
                    : object.color ?? "#4f63ff";
                return (
                  <>
              <circle
                cx={vertex.x}
                cy={vertex.y}
                r={1.9}
                fill="#ffffff"
                stroke={vertexColor}
                strokeWidth={1}
              />
              {showLabels ? (
                <text
                  x={labelPlacements[index]?.x ?? vertex.x + 4}
                  y={labelPlacements[index]?.y ?? vertex.y - 4}
                  fill={vertexColor}
                  fontSize={12}
                  fontWeight={700}
                  textAnchor={labelPlacements[index]?.textAnchor ?? "start"}
                  dominantBaseline="central"
                  paintOrder="stroke"
                  stroke="rgba(245, 247, 255, 0.94)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                >
                  {labels[index]}
                </text>
              ) : null}
                  </>
                );
              })()}
            </g>
          ))}
          {segments.map((segment, index) => {
            const note =
              typeof segmentNotesRaw[index] === "string" ? segmentNotesRaw[index].trim() : "";
            if (!note) return null;
            const dx = segment.end.x - segment.start.x;
            const dy = segment.end.y - segment.start.y;
            const length = Math.hypot(dx, dy);
            if (length < 1e-6) return null;
            const normal = { x: -dy / length, y: dx / length };
            const midpoint = {
              x: (segment.start.x + segment.end.x) / 2,
              y: (segment.start.y + segment.end.y) / 2,
            };
            const segmentColor =
              typeof segmentColorsRaw[index] === "string" && segmentColorsRaw[index]
                ? segmentColorsRaw[index]
                : object.color ?? "#24315f";
            return (
              <text
                key={`${object.id}-segment-note-${index}`}
                x={midpoint.x + normal.x * 10}
                y={midpoint.y + normal.y * 10}
                fill={segmentColor}
                fontSize={10}
                fontWeight={600}
                textAnchor="middle"
              >
                {note}
              </text>
            );
          })}
          {showAngles && isClosed && vertices.length >= 3
            ? vertices.map((vertex, index) => {
                const previous = vertices[(index + vertices.length - 1) % vertices.length];
                const next = vertices[(index + 1) % vertices.length];
                const vecA = { x: previous.x - vertex.x, y: previous.y - vertex.y };
                const vecB = { x: next.x - vertex.x, y: next.y - vertex.y };
                const lenA = Math.hypot(vecA.x, vecA.y);
                const lenB = Math.hypot(vecB.x, vecB.y);
                if (lenA < 1e-6 || lenB < 1e-6) return null;
                const unitA = { x: vecA.x / lenA, y: vecA.y / lenA };
                const unitB = { x: vecB.x / lenB, y: vecB.y / lenB };
                const radius = Math.max(8, Math.min(22, Math.min(lenA, lenB) * 0.22));
                const sweep: 0 | 1 =
                  unitA.x * unitB.y - unitA.y * unitB.x > 0 ? 1 : 0;
                const dot = clampUnitDot(unitA.x * unitB.x + unitA.y * unitB.y);
                const angleDeg = (Math.acos(dot) * 180) / Math.PI;
                const angleMark = angleMarks[index] ?? {
                  valueText: "",
                  color: object.color ?? "#4f63ff",
                  style: "auto" as const,
                };
                const renderedStyle = resolveRenderedShapeAngleMarkStyle(
                  angleMark.style,
                  angleDeg
                );
                const note = angleMark.valueText.trim();
                const angleColor = angleMark.color || object.color || "#4f63ff";
                const bisector = { x: unitA.x + unitB.x, y: unitA.y + unitB.y };
                const bisectorLength = Math.hypot(bisector.x, bisector.y);
                const labelDirection =
                  bisectorLength > 1e-6
                    ? { x: bisector.x / bisectorLength, y: bisector.y / bisectorLength }
                    : { x: -(unitA.y + unitB.y) * 0.5, y: (unitA.x + unitB.x) * 0.5 };
                const arcCount =
                  renderedStyle === "arc_double"
                    ? 2
                    : renderedStyle === "arc_triple"
                      ? 3
                      : renderedStyle === "arc_single"
                        ? 1
                        : 0;
                const rightSquareSize = Math.max(7, Math.min(15, radius * 0.72));
                const markerDepth =
                  renderedStyle === "right_square"
                    ? rightSquareSize + 2
                    : radius + Math.max(0, arcCount - 1) * 4;
                const noteAnchor = {
                  x: vertex.x + labelDirection.x * (markerDepth + 11),
                  y: vertex.y + labelDirection.y * (markerDepth + 11),
                };
                return (
                  <g key={`${object.id}-angle-${index}`}>
                    {renderedStyle === "right_square" ? (
                      <path
                        d={buildRightAngleMarkerPath(
                          vertex,
                          unitA,
                          unitB,
                          rightSquareSize
                        )}
                        fill="none"
                        stroke={angleColor}
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        opacity={0.9}
                      />
                    ) : (
                      Array.from({ length: arcCount }, (_, arcIndex) => {
                        const arcRadius = radius + arcIndex * 4;
                        return (
                          <path
                            key={`${object.id}-angle-${index}-arc-${arcRadius}`}
                            d={buildAngleArcPath(vertex, unitA, unitB, arcRadius, sweep)}
                            fill="none"
                            stroke={angleColor}
                            strokeWidth={1.2}
                            opacity={0.88}
                          />
                        );
                      })
                    )}
                    {note ? (
                      <text
                        x={noteAnchor.x}
                        y={noteAnchor.y}
                        fill={angleColor}
                        fontSize={10}
                        fontWeight={600}
                        textAnchor="middle"
                      >
                        {(() => {
                          const normalized = note.replace("°", "").replace(",", ".").trim();
                          const isNumeric = /^-?\d+(\.\d+)?$/.test(normalized);
                          if (!isNumeric) return note;
                          return (
                            <>
                              <tspan>{normalized}</tspan>
                              <tspan baselineShift="super" fontSize="8">
                                °
                              </tspan>
                            </>
                          );
                        })()}
                      </text>
                    ) : null}
                  </g>
                );
              })
            : null}
        </>
      );
    };

    if (object.type === "line" || object.type === "arrow") {
      const lineStyleMeta =
        typeof object.meta?.lineStyle === "string" ? object.meta.lineStyle : "solid";
      const lineKind = object.meta?.lineKind === "segment" ? "segment" : "line";
      const showLabels = object.meta?.showLabels !== false;
      const startLabel =
        typeof object.meta?.startLabel === "string" ? object.meta.startLabel.trim() : "";
      const endLabel =
        typeof object.meta?.endLabel === "string" ? object.meta.endLabel.trim() : "";
      const basis = getLineBasis(object);
      const labelOffset = 14;
      return (
        <g>
          <path
            {...commonProps}
            d={getLinePathD(object)}
            markerEnd={object.type === "arrow" ? "url(#workbook-arrow)" : undefined}
            strokeDasharray={lineStyleMeta === "dashed" ? "8 6" : undefined}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {lineKind === "segment" && showLabels && startLabel ? (
            <text
              x={basis.start.x + basis.normal.x * labelOffset}
              y={basis.start.y + basis.normal.y * labelOffset}
              fill={object.color ?? "#1f2d66"}
              fontSize={13}
              fontWeight={600}
              paintOrder="stroke"
              stroke="rgba(245, 247, 255, 0.94)"
              strokeWidth={2}
              strokeLinejoin="round"
            >
              {startLabel}
            </text>
          ) : null}
          {lineKind === "segment" && showLabels && endLabel ? (
            <text
              x={basis.end.x + basis.normal.x * labelOffset}
              y={basis.end.y + basis.normal.y * labelOffset}
              fill={object.color ?? "#1f2d66"}
              fontSize={13}
              fontWeight={600}
              paintOrder="stroke"
              stroke="rgba(245, 247, 255, 0.94)"
              strokeWidth={2}
              strokeLinejoin="round"
            >
              {endLabel}
            </text>
          ) : null}
        </g>
      );
    }

    if (object.type === "point") {
      const center = getPointObjectCenter(object);
      const label =
        typeof object.meta?.label === "string" ? object.meta.label.trim() : "";
      const showLabels = object.meta?.showLabels !== false;
      return (
        <g>
          <circle
            cx={center.x}
            cy={center.y}
            r={Math.max(2.8, Math.min(7, Math.abs(object.width) * 0.33))}
            fill={object.fill ?? "#ffffff"}
            stroke={object.color ?? "#4f63ff"}
            strokeWidth={Math.max(1, object.strokeWidth ?? 2)}
          />
          {showLabels && label ? (
            <text
              x={center.x + 6}
              y={center.y - 6}
              fill={object.color ?? "#2a376d"}
              fontSize={10}
              fontWeight={700}
              paintOrder="stroke"
              stroke="rgba(245, 247, 255, 0.94)"
              strokeWidth={2}
              strokeLinejoin="round"
            >
              {label}
            </text>
          ) : null}
        </g>
      );
    }

    if (object.type === "section_divider") {
      const isAuto = object.meta?.dividerType === "auto";
      const dividerLineStyle =
        object.meta?.lineStyle === "solid" ? "solid" : "dashed";
      const label =
        typeof object.meta?.sectionLabel === "string" ? object.meta.sectionLabel : "";
      const y = normalized.y + normalized.height / 2;
      return (
        <g>
          <line
            x1={object.x}
            y1={y}
            x2={object.x + object.width}
            y2={y}
            stroke={isAuto ? "#a1a9c8" : (object.color ?? "#4f63ff")}
            strokeWidth={isAuto ? 1.1 : (object.strokeWidth ?? 1.6)}
            strokeDasharray={isAuto ? "5 5" : dividerLineStyle === "dashed" ? "9 6" : undefined}
            opacity={0.8}
          />
          {label ? (
            <text
              x={object.x + 10}
              y={y - 8}
              fill="#5a6486"
              fontSize={11}
              fontWeight={600}
            >
              {label}
            </text>
          ) : null}
        </g>
      );
    }

    if (object.type === "rectangle") {
      const vertices = resolve2dFigureVertices(object, normalized);
      return (
        <g transform={transform}>
          <rect
            {...commonProps}
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            rx={0}
            ry={0}
          />
          {render2dFigureOverlay(vertices)}
        </g>
      );
    }

    if (object.type === "ellipse") {
      return (
        <ellipse
          {...commonProps}
          cx={normalized.x + normalized.width / 2}
          cy={normalized.y + normalized.height / 2}
          rx={normalized.width / 2}
          ry={normalized.height / 2}
          transform={transform}
        />
      );
    }

    if (object.type === "triangle") {
      const vertices = resolve2dFigureVertices(object, normalized);
      const path = `M ${normalized.x + normalized.width / 2} ${normalized.y} L ${
        normalized.x
      } ${normalized.y + normalized.height} L ${normalized.x + normalized.width} ${
        normalized.y + normalized.height
      } Z`;
      return (
        <g transform={transform}>
          <path {...commonProps} d={path} />
          {render2dFigureOverlay(vertices)}
        </g>
      );
    }

    if (object.type === "polygon") {
      const vertices = resolve2dFigureVertices(object, normalized);
      const isClosed = is2dFigureClosed(object);
      const objectPreset =
        object.meta?.polygonPreset === "trapezoid" ||
        object.meta?.polygonPreset === "trapezoid_right" ||
        object.meta?.polygonPreset === "trapezoid_scalene" ||
        object.meta?.polygonPreset === "rhombus"
          ? object.meta.polygonPreset
          : "regular";
      if (Array.isArray(object.points) && object.points.length >= 2) {
        return (
          <g transform={transform}>
            <path {...commonProps} d={`${toPath(object.points)}${isClosed ? " Z" : ""}`} />
            {render2dFigureOverlay(vertices)}
          </g>
        );
      }
      return (
        <g transform={transform}>
          <path
            {...commonProps}
            d={createPolygonPath(normalized, object.sides ?? 5, objectPreset)}
          />
          {render2dFigureOverlay(vertices)}
        </g>
      );
    }

    if (object.type === "text") {
      const fontSize = Math.max(12, object.fontSize ?? 18);
      const textColor =
        typeof object.meta?.textColor === "string" && object.meta.textColor
          ? object.meta.textColor
          : object.color ?? "#172039";
      const fontFamily =
        typeof object.meta?.textFontFamily === "string" && object.meta.textFontFamily
          ? object.meta.textFontFamily
          : "\"Fira Sans\", \"Segoe UI\", sans-serif";
      const fontWeight = object.meta?.textBold ? 700 : 500;
      const fontStyle = object.meta?.textItalic ? "italic" : "normal";
      const textDecoration = object.meta?.textUnderline ? "underline" : "none";
      const textAlign =
        object.meta?.textAlign === "center" || object.meta?.textAlign === "right"
          ? object.meta.textAlign
          : "left";
      const textContent = typeof object.text === "string" ? object.text : "Текст";
      const backgroundFill =
        typeof object.meta?.textBackground === "string" && object.meta.textBackground
          ? object.meta.textBackground
          : object.fill;
      const isInlineEditing = inlineTextEdit?.objectId === object.id;
      return (
        <g transform={transform}>
          {backgroundFill && backgroundFill !== "transparent" ? (
            <rect
              x={normalized.x}
              y={normalized.y}
              width={normalized.width}
              height={normalized.height}
              rx={6}
              ry={6}
              fill={backgroundFill}
              stroke="none"
            />
          ) : null}
          {isInlineEditing ? (
            <foreignObject
              x={normalized.x}
              y={normalized.y}
              width={Math.max(140, normalized.width)}
              height={Math.max(48, normalized.height)}
              requiredExtensions="http://www.w3.org/1999/xhtml"
            >
              <div
                className="workbook-session__text-editor"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <textarea
                  ref={inlineTextEditInputRef}
                  className="workbook-session__text-editor-input"
                  value={inlineTextEdit?.value ?? ""}
                  onChange={(event) =>
                    {
                      const nextValue = event.target.value;
                      setInlineTextEdit((current) =>
                        current && current.objectId === object.id
                          ? { ...current, value: nextValue }
                          : current
                      );
                      onInlineTextDraftChange?.(object.id, nextValue);
                    }
                  }
                  onBlur={() => commitInlineTextEdit()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelInlineTextEdit();
                      return;
                    }
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      commitInlineTextEdit();
                    }
                  }}
                  style={{
                    color: textColor,
                    fontSize: `${fontSize}px`,
                    fontFamily,
                    fontWeight,
                    fontStyle,
                    textDecoration,
                    textAlign,
                    background:
                      backgroundFill && backgroundFill !== "transparent"
                        ? backgroundFill
                        : "transparent",
                  }}
                />
              </div>
            </foreignObject>
          ) : (
            <foreignObject
              x={normalized.x + 6}
              y={normalized.y + 6}
              width={Math.max(1, normalized.width - 12)}
              height={Math.max(1, normalized.height - 12)}
              requiredExtensions="http://www.w3.org/1999/xhtml"
              pointerEvents="none"
            >
              <div
                className="workbook-session__text-render"
                style={{
                  color: textColor,
                  fontSize: `${fontSize}px`,
                  fontFamily,
                  fontWeight,
                  fontStyle,
                  textDecoration,
                  textAlign,
                }}
              >
                {textContent}
              </div>
            </foreignObject>
          )}
        </g>
      );
    }

    if (object.type === "formula") {
      const latex = typeof object.meta?.latex === "string" ? object.meta.latex : "";
      const mathml = typeof object.meta?.mathml === "string" ? object.meta.mathml : "";
      const shown = latex || mathml || object.text || "f(x)=...";
      return (
        <g>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={Math.max(38, normalized.height)}
            rx={8}
            ry={8}
            fill="rgba(230, 237, 255, 0.9)"
            stroke={object.color ?? "#4f63ff"}
            strokeWidth={object.strokeWidth ?? 2}
          />
          <text
            x={normalized.x + 10}
            y={normalized.y + 24}
            fill={object.color ?? "#22316a"}
            fontSize={Math.max(14, object.fontSize ?? 18)}
            fontWeight={700}
          >
            {shown}
          </text>
        </g>
      );
    }

    if (object.type === "function_graph") {
      const renderState = functionGraphRenderStateById.get(object.id);
      if (!renderState) return null;
      const { axisColor, planeColor, centerX, centerY, ghostPlots, plots } = renderState;
      const lines: ReactNode[] = [];
      const labels: ReactNode[] = [];

      lines.push(
        <line
          key={`fn-axis-x-${object.id}`}
          x1={normalized.x}
          y1={centerY}
          x2={normalized.x + normalized.width}
          y2={centerY}
          stroke={axisColor}
          strokeWidth={1.35}
        />
      );
      lines.push(
        <line
          key={`fn-axis-y-${object.id}`}
          x1={centerX}
          y1={normalized.y}
          x2={centerX}
          y2={normalized.y + normalized.height}
          stroke={axisColor}
          strokeWidth={1.35}
        />
      );
      labels.push(
        <text
          key={`fn-label-axis-x-${object.id}`}
          x={normalized.x + normalized.width - 14}
          y={centerY - 6}
          fill={axisColor}
          fontSize={11}
          fontWeight={700}
        >
          x
        </text>
      );
      labels.push(
        <text
          key={`fn-label-axis-y-${object.id}`}
          x={centerX + 6}
          y={normalized.y + 12}
          fill={axisColor}
          fontSize={11}
          fontWeight={700}
        >
          y
        </text>
      );
      return (
        <g transform={transform}>
          <defs>
            <clipPath id={`fn-clip-${object.id}`}>
              <rect
                x={normalized.x}
                y={normalized.y}
                width={normalized.width}
                height={normalized.height}
              />
            </clipPath>
          </defs>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            fill={planeColor}
            fillOpacity={planeColor === "transparent" ? 0 : 0.14}
            stroke="none"
            strokeWidth={0}
          />
          <g clipPath={`url(#fn-clip-${object.id})`}>
            {lines}
            {labels}
            {ghostPlots.flatMap((plot) =>
              plot.segments.map((segment, segmentIndex) =>
                segment.length > 1 ? (
                  <path
                    key={`${object.id}-graph-ghost-${plot.id}-${segmentIndex}`}
                    d={toPath(segment)}
                    stroke={plot.color}
                    strokeWidth={Math.max(1, plot.width * 0.9)}
                    strokeDasharray="7 5"
                    strokeOpacity={0.24}
                    fill="none"
                  />
                ) : null
              )
            )}
            {plots.flatMap((plot) =>
              plot.segments.map((segment, segmentIndex) =>
                segment.length > 1 ? (
                  <path
                    key={`${object.id}-graph-${plot.id}-${segmentIndex}`}
                    d={toPath(segment)}
                    stroke={plot.color}
                    strokeWidth={plot.width}
                    strokeDasharray={plot.dashed ? "8 6" : undefined}
                    fill="none"
                  />
                ) : null
              )
            )}
          </g>
        </g>
      );
    }

    if (object.type === "frame") {
      const title =
        typeof object.meta?.title === "string" && object.meta.title.trim().length > 0
          ? object.meta.title
          : "Фрейм";
      return (
        <g transform={transform}>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            rx={12}
            ry={12}
            fill={object.fill ?? "rgba(79, 99, 255, 0.04)"}
            stroke={object.color ?? "#4f63ff"}
            strokeWidth={object.strokeWidth ?? 2}
            strokeDasharray="10 6"
          />
          <rect
            x={normalized.x + 8}
            y={normalized.y + 8}
            width={Math.min(normalized.width - 16, 180)}
            height={24}
            rx={8}
            ry={8}
            fill="rgba(79, 99, 255, 0.14)"
            stroke="none"
          />
          <text
            x={normalized.x + 16}
            y={normalized.y + 24}
            fill="#1c2f78"
            fontSize={12}
            fontWeight={700}
          >
            {title}
          </text>
        </g>
      );
    }

    if (object.type === "sticker") {
      const text =
        typeof object.text === "string" && object.text.trim().length > 0
          ? object.text
          : "Стикер";
      return (
        <g transform={transform}>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            rx={10}
            ry={10}
            fill={object.fill ?? "rgba(255, 244, 163, 0.92)"}
            stroke={object.color ?? "#e6af2e"}
            strokeWidth={object.strokeWidth ?? 1.8}
          />
          <text
            x={normalized.x + 10}
            y={normalized.y + 24}
            fill="#5f4300"
            fontSize={13}
            fontWeight={600}
          >
            {text}
          </text>
        </g>
      );
    }

    if (object.type === "comment") {
      const text =
        typeof object.text === "string" && object.text.trim().length > 0
          ? object.text
          : "Комментарий";
      return (
        <g transform={transform}>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            rx={12}
            ry={12}
            fill={object.fill ?? "rgba(228, 241, 255, 0.95)"}
            stroke={object.color ?? "#5f71ff"}
            strokeWidth={object.strokeWidth ?? 1.8}
          />
          <path
            d={`M ${normalized.x + 24} ${normalized.y + normalized.height} L ${
              normalized.x + 36
            } ${normalized.y + normalized.height + 14} L ${normalized.x + 48} ${
              normalized.y + normalized.height
            } Z`}
            fill={object.fill ?? "rgba(228, 241, 255, 0.95)"}
            stroke={object.color ?? "#5f71ff"}
            strokeWidth={object.strokeWidth ?? 1.4}
          />
          <text
            x={normalized.x + 10}
            y={normalized.y + 22}
            fill="#22316a"
            fontSize={13}
            fontWeight={600}
          >
            {text}
          </text>
        </g>
      );
    }

    const imageSource =
      object.type === "image"
        ? object.imageUrl ?? (() => {
            const assetId = resolveBoardObjectImageAssetId(object);
            return assetId ? imageAssetUrls[assetId] : undefined;
          })()
        : undefined;
    if (object.type === "image" && imageSource) {
      return (
        <image
          href={imageSource}
          x={normalized.x}
          y={normalized.y}
          width={normalized.width}
          height={normalized.height}
          preserveAspectRatio="xMidYMid meet"
          opacity={object.opacity ?? 1}
          transform={transform}
        />
      );
    }

    if (object.type === "coordinate_grid") {
      const step =
        typeof object.meta?.step === "number" && Number.isFinite(object.meta.step)
          ? Math.max(12, Math.min(64, object.meta.step))
          : 24;
      const lines: ReactNode[] = [];
      for (let x = normalized.x; x <= normalized.x + normalized.width; x += step) {
        lines.push(
          <line
            key={`grid-x-${object.id}-${x}`}
            x1={x}
            y1={normalized.y}
            x2={x}
            y2={normalized.y + normalized.height}
            stroke={object.color ?? "#6d78ac"}
            strokeWidth={0.8}
            opacity={0.45}
          />
        );
      }
      for (let y = normalized.y; y <= normalized.y + normalized.height; y += step) {
        lines.push(
          <line
            key={`grid-y-${object.id}-${y}`}
            x1={normalized.x}
            y1={y}
            x2={normalized.x + normalized.width}
            y2={y}
            stroke={object.color ?? "#6d78ac"}
            strokeWidth={0.8}
            opacity={0.45}
          />
        );
      }
      lines.push(
        <line
          key={`grid-axis-x-${object.id}`}
          x1={normalized.x}
          y1={normalized.y + normalized.height / 2}
          x2={normalized.x + normalized.width}
          y2={normalized.y + normalized.height / 2}
          stroke="#ff8e3c"
          strokeWidth={1.2}
          opacity={0.95}
        />
      );
      lines.push(
        <line
          key={`grid-axis-y-${object.id}`}
          x1={normalized.x + normalized.width / 2}
          y1={normalized.y}
          x2={normalized.x + normalized.width / 2}
          y2={normalized.y + normalized.height}
          stroke="#ff8e3c"
          strokeWidth={1.2}
          opacity={0.95}
        />
      );
      return <g transform={transform}>{lines}</g>;
    }

    if (object.type === "measurement_length" || object.type === "measurement_angle") {
      const label = typeof object.text === "string" ? object.text : "";
      const padding = 8;
      const approxTextWidth = Math.max(70, label.length * 8.5);
      return (
        <g transform={transform}>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={approxTextWidth + padding * 2}
            height={30}
            rx={10}
            ry={10}
            fill="rgba(255, 248, 225, 0.95)"
            stroke="#ffb703"
            strokeWidth={1.1}
          />
          <text
            x={normalized.x + padding}
            y={normalized.y + 20}
            fill="#7a4f00"
            fontSize={13}
            fontWeight={700}
          >
            {label}
          </text>
        </g>
      );
    }

    if (object.type === "solid3d") {
      const presetIdRaw =
        typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
      const presetId = resolveSolid3dPresetId(presetIdRaw);
      const isRoundPreset = ROUND_SOLID_PRESETS.has(presetId);
      const color = object.color ?? "#4f63ff";
      const strokeWidth = object.strokeWidth ?? 2;
      const solidState = readSolid3dState(object.meta);
      const hiddenFaceSet = new Set(solidState.hiddenFaceIds);
      const clipScale =
        solidState.clippingPreset === "small"
          ? 0.82
          : solidState.clippingPreset === "medium"
            ? 0.68
            : solidState.clippingPreset === "large"
              ? 0.54
              : 1;
      const hideHiddenEdges = solidState.hiddenFaceIds.includes("hidden_edges");
      const faceColors = solidState.faceColors ?? {};
      const edgeColors = solidState.edgeColors ?? {};
      const angleMarks = Array.isArray(solidState.angleMarks)
        ? solidState.angleMarks.filter((mark) => mark.visible !== false)
        : [];
      const pad = Math.max(6, Math.min(normalized.width, normalized.height) * 0.08);
      const contentX = normalized.x + pad;
      const contentY = normalized.y + pad;
      const contentWidth = Math.max(1, normalized.width - pad * 2);
      const contentHeight = Math.max(1, normalized.height - pad * 2);
      const view = solidState.view;
      const mesh = getSolid3dMesh(presetId, normalized.width, normalized.height);
      const projectedVertices = mesh
        ? projectSolidVerticesForObject({
            mesh,
            view,
            objectRect: normalized,
          })
        : [];
      const projectedBounds =
        projectedVertices.length > 0
          ? projectedVertices.reduce(
              (acc, vertex) => ({
                minX: Math.min(acc.minX, vertex.x),
                maxX: Math.max(acc.maxX, vertex.x),
                minY: Math.min(acc.minY, vertex.y),
                maxY: Math.max(acc.maxY, vertex.y),
              }),
              {
                minX: projectedVertices[0].x,
                maxX: projectedVertices[0].x,
                minY: projectedVertices[0].y,
                maxY: projectedVertices[0].y,
              }
            )
          : null;

      type SolidFaceRender = {
        index: number;
        points: ProjectedSolidVertex[];
        depth: number;
        isFront: boolean;
      };

      const faceRenderData: SolidFaceRender[] = mesh
        ? mesh.faces.reduce<SolidFaceRender[]>((acc, face, index) => {
            if (face.length < 3) return acc;
            if (hiddenFaceSet.has(`face-${index}`)) return acc;
            const points = face
              .map((vertexIndex) => projectedVertices[vertexIndex])
              .filter((vertex): vertex is ProjectedSolidVertex => Boolean(vertex));
            if (points.length < 3) return acc;
            const depth =
              points.reduce((sum, point) => sum + point.depth, 0) / points.length;
            const signedArea = points.reduce((sum, point, pointIndex) => {
              const next = points[(pointIndex + 1) % points.length];
              return sum + point.x * next.y - next.x * point.y;
            }, 0);
            acc.push({
              index,
              points,
              depth,
              isFront: signedArea <= 0,
            });
            return acc;
          }, [])
        : [];
      faceRenderData.sort((left, right) => right.depth - left.depth);

      const visibleFaceIds = new Set(
        faceRenderData
          .filter((face) => face.isFront)
          .map((face) => face.index)
      );

      type SolidEdgeRender = {
        key: string;
        from: ProjectedSolidVertex;
        to: ProjectedSolidVertex;
        depth: number;
        dashed: boolean;
      };

      const edgeRenderData: SolidEdgeRender[] =
        mesh && projectedVertices.length > 0
          ? (() => {
              const edgeFaces = new Map<string, number[]>();
              mesh.faces.forEach((face, faceIndex) => {
                if (hiddenFaceSet.has(`face-${faceIndex}`) || face.length < 2) return;
                face.forEach((fromIndex, localIndex) => {
                  const toIndex = face[(localIndex + 1) % face.length];
                  const min = Math.min(fromIndex, toIndex);
                  const max = Math.max(fromIndex, toIndex);
                  const key = `${min}:${max}`;
                  const bucket = edgeFaces.get(key);
                  if (!bucket) {
                    edgeFaces.set(key, [faceIndex]);
                  } else if (!bucket.includes(faceIndex)) {
                    bucket.push(faceIndex);
                  }
                });
              });

              const edges = [...edgeFaces.entries()].reduce<SolidEdgeRender[]>(
                (acc, [key, faces]) => {
                  const [fromRaw, toRaw] = key.split(":");
                  const fromIndex = Number(fromRaw);
                  const toIndex = Number(toRaw);
                  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
                    return acc;
                  }
                  const from = projectedVertices[fromIndex];
                  const to = projectedVertices[toIndex];
                  if (!from || !to) return acc;
                  const isFront = faces.some((faceIndex) => visibleFaceIds.has(faceIndex));
                  if (!isFront && hideHiddenEdges) return acc;
                  acc.push({
                    key,
                    from,
                    to,
                    depth: (from.depth + to.depth) / 2,
                    dashed: !isFront,
                  });
                  return acc;
                },
                []
              );
              edges.sort((left, right) => right.depth - left.depth);
              return edges;
            })()
          : [];

      const sectionPolygons = mesh
        ? solidState.sections
            .filter((section) => section.visible)
            .map((section) => {
              const sectionData = computeSectionPolygon(mesh, section);
              const metrics = computeSectionMetrics(sectionData.polygon);
              const points = sectionData.polygon.map((point) =>
                projectSolidPointForObject({
                  point,
                  view,
                  objectRect: normalized,
                })
              );
              return {
                section,
                points,
                metrics,
              };
            })
            .filter((item) => item.points.length >= 2)
        : [];

      const sectionPolygonsById = new Map(
        sectionPolygons.map((polygon) => [polygon.section.id, polygon])
      );

      const visibleSectionMarkers = !isRoundPreset
        ? sectionPolygons.flatMap((polygon) => {
            if (polygon.points.length < 3) return [];
            const polygon2d = polygon.points.map((point) => ({ x: point.x, y: point.y }));
            const sectionCenter = getPointsCentroid(polygon2d);
            return polygon.points.map((point, index) => ({
              sectionId: polygon.section.id,
              index,
              x: point.x,
              y: point.y,
              color: polygon.section.color,
              label:
                polygon.section.vertexLabels[index]?.trim() || getSectionVertexLabel(index),
              placement: resolveOutsideVertexLabelPlacement({
                vertex: { x: point.x, y: point.y },
                center: sectionCenter,
                polygon: polygon2d,
                baseOffset: 14,
              }),
            }));
          })
        : [];

      const sectionLines = solidState.sections
        .filter((section) => section.visible)
        .map((section) => {
          const polygon = sectionPolygonsById.get(section.id);
          if (polygon && polygon.points.length >= 2) {
            const center = polygon.points.reduce(
              (acc, point) => ({
                x: acc.x + point.x,
                y: acc.y + point.y,
              }),
              { x: 0, y: 0 }
            );
            center.x /= polygon.points.length;
            center.y /= polygon.points.length;
            const first = polygon.points[0];
            const second = polygon.points[1];
            const tangentRaw = {
              x: second.x - first.x,
              y: second.y - first.y,
            };
            const tangentLength = Math.hypot(tangentRaw.x, tangentRaw.y) || 1;
            const tangent = {
              x: tangentRaw.x / tangentLength,
              y: tangentRaw.y / tangentLength,
            };
            const normal = {
              x: -tangent.y,
              y: tangent.x,
            };
            const half = Math.max(contentWidth, contentHeight) * 0.78;
            return {
              section,
              center,
              normal,
              from: {
                x: center.x - tangent.x * half,
                y: center.y - tangent.y * half,
              },
              to: {
                x: center.x + tangent.x * half,
                y: center.y + tangent.y * half,
              },
              hasPolygon: polygon.points.length >= 3,
            };
          }

          const tiltRad = ((section.tiltY + view.rotationY) * Math.PI) / 180;
          const normal = {
            x: Math.cos(tiltRad),
            y: Math.sin(tiltRad),
          };
          const center = {
            x: contentX + contentWidth * (0.5 + view.panX * 0.25 + section.offset * 0.5),
            y: contentY + contentHeight * (0.5 + view.panY * 0.25),
          };
          const tangent = { x: -normal.y, y: normal.x };
          const half = Math.max(contentWidth, contentHeight) * 0.78;
          return {
            section,
            normal,
            center,
            from: {
              x: center.x - tangent.x * half,
              y: center.y - tangent.y * half,
            },
            to: {
              x: center.x + tangent.x * half,
              y: center.y + tangent.y * half,
            },
            hasPolygon: false,
          };
        });

      const keepSection = sectionLines.find((item) => item.section.keepSide !== "both");
      const keepPolygon =
        keepSection && keepSection.section.keepSide !== "both"
          ? clipPolygonByHalfPlane(
              [
                { x: contentX, y: contentY },
                { x: contentX + contentWidth, y: contentY },
                { x: contentX + contentWidth, y: contentY + contentHeight },
                { x: contentX, y: contentY + contentHeight },
              ],
              keepSection.center,
              keepSection.normal,
              keepSection.section.keepSide === "negative"
            )
          : null;
      const clipRect =
        clipScale < 1
          ? {
              x: contentX + (contentWidth * (1 - clipScale)) / 2,
              y: contentY + (contentHeight * (1 - clipScale)) / 2,
              width: contentWidth * clipScale,
              height: contentHeight * clipScale,
            }
          : null;
      const clipPathId = `workbook-solid-clip-${object.id}`;
      const keepPolygonPoints =
        keepPolygon && keepPolygon.length >= 3
          ? keepPolygon.map((point) => `${point.x},${point.y}`).join(" ")
          : "";
      const shouldUseClipPath = Boolean(clipRect || keepPolygonPoints);
      const measurementLabels = solidState.measurements.filter((measurement) => measurement.visible);
      const faceFill = object.fill ?? "rgba(95, 106, 160, 0.16)";
      const vertexLabels = solidState.vertexLabels ?? [];
      const showVertexLabels =
        object.meta?.showLabels !== false && (!isRoundPreset || presetId === "cone");
      const solidLabelCenter = projectedBounds
        ? {
            x: (projectedBounds.minX + projectedBounds.maxX) / 2,
            y: (projectedBounds.minY + projectedBounds.maxY) / 2,
          }
        : {
            x: contentX + contentWidth / 2,
            y: contentY + contentHeight / 2,
          };
      const vertexAdjacency = mesh
        ? mesh.edges.reduce<Map<number, number[]>>((acc, [a, b]) => {
            const neighboursA = acc.get(a) ?? [];
            if (!neighboursA.includes(b)) {
              neighboursA.push(b);
              acc.set(a, neighboursA);
            }
            const neighboursB = acc.get(b) ?? [];
            if (!neighboursB.includes(a)) {
              neighboursB.push(a);
              acc.set(b, neighboursB);
            }
            return acc;
          }, new Map<number, number[]>())
        : new Map<number, number[]>();
      const projectedVertexByIndex = new Map(
        projectedVertices.map((vertex) => [vertex.index, vertex] as const)
      );
      const roundRingVertexCount =
        isRoundPreset && mesh
          ? presetId === "cone"
            ? Math.max(0, mesh.vertices.length - 1)
            : presetId === "cylinder" || presetId === "truncated_cone"
              ? Math.max(0, Math.floor(mesh.vertices.length / 2))
              : 0
          : 0;
      const roundBottomStats =
        roundRingVertexCount > 0
          ? summarizeProjectedVertices(
              projectedVertexByIndex,
              Array.from({ length: roundRingVertexCount }, (_, index) => index)
            )
          : null;
      const roundTopStats =
        roundRingVertexCount > 0 &&
        mesh &&
        (presetId === "cylinder" || presetId === "truncated_cone")
          ? summarizeProjectedVertices(
              projectedVertexByIndex,
              Array.from({ length: roundRingVertexCount }, (_, index) => index + roundRingVertexCount)
            )
          : null;
      const roundConeApex =
        presetId === "cone" && mesh ? projectedVertexByIndex.get(mesh.vertices.length - 1) ?? null : null;
      const visibleVertexIndices = (() => {
        if (!projectedVertices.length) return [] as number[];
        if (isRoundPreset) {
          if (presetId === "cone" && mesh && mesh.vertices.length > 0) {
            return [mesh.vertices.length - 1];
          }
          return [] as number[];
        }
        return projectedVertices.map((vertex) => vertex.index);
      })();

      const vertexLabelPlacements = new Map(
        visibleVertexIndices
          .map((vertexIndex) => {
            const vertex = projectedVertexByIndex.get(vertexIndex);
            if (!vertex) return null;
            return [
              vertexIndex,
              resolveOutsideVertexLabelPlacement({
                vertex: { x: vertex.x, y: vertex.y },
                center: solidLabelCenter,
                baseOffset: 14,
              }),
            ] as const;
          })
          .filter(
            (
              entry
            ): entry is readonly [
              number,
              ReturnType<typeof resolveOutsideVertexLabelPlacement>,
            ] => Boolean(entry)
          )
      );

      const angleMarkRenderData = angleMarks
        .map((mark) => {
          const center = projectedVertexByIndex.get(mark.vertexIndex);
          if (!center) return null;
          const activeFaceIndex =
            typeof mark.faceIndex === "number" &&
            Number.isInteger(mark.faceIndex) &&
            mark.faceIndex >= 0 &&
            mesh?.faces[mark.faceIndex]
              ? mark.faceIndex
              : null;
          const faceVertices =
            activeFaceIndex !== null && mesh ? mesh.faces[activeFaceIndex] : null;
          const faceVertexIndex =
            faceVertices?.findIndex((vertexIndex: number) => vertexIndex === mark.vertexIndex) ??
            -1;
          const neighbours =
            faceVertices && faceVertexIndex >= 0 && faceVertices.length >= 3
              ? [
                  faceVertices[
                    (faceVertexIndex - 1 + faceVertices.length) % faceVertices.length
                  ],
                  faceVertices[(faceVertexIndex + 1) % faceVertices.length],
                ]
              : vertexAdjacency.get(mark.vertexIndex) ?? [];
          if (neighbours.length < 2) return null;
          const first = projectedVertexByIndex.get(neighbours[0]);
          const second = projectedVertexByIndex.get(neighbours[1]);
          if (!first || !second) return null;
          const toUnit = (from: ProjectedSolidVertex, to: ProjectedSolidVertex) => {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-6) return null;
            return { x: dx / len, y: dy / len };
          };
          const dirA = toUnit(center, first);
          const dirB = toUnit(center, second);
          if (!dirA || !dirB) return null;
          const radius = 11;
          const dot = clampUnitDot(dirA.x * dirB.x + dirA.y * dirB.y);
          const angleDeg = (Math.acos(dot) * 180) / Math.PI;
          const renderedStyle = resolveRenderedShapeAngleMarkStyle(
            mark.style ?? "arc_single",
            angleDeg
          );
          const sweep = dirA.x * dirB.y - dirA.y * dirB.x > 0 ? 1 : 0;
          const bisector = {
            x: dirA.x + dirB.x,
            y: dirA.y + dirB.y,
          };
          const bisectorLength = Math.hypot(bisector.x, bisector.y);
          const labelVector =
            bisectorLength > 1e-6
              ? {
                  x: bisector.x / bisectorLength,
                  y: bisector.y / bisectorLength,
                }
              : { x: 0.7, y: -0.7 };
          const label = mark.label?.trim() || "";
          const arcCount =
            renderedStyle === "arc_double"
              ? 2
              : renderedStyle === "arc_triple"
                ? 3
                : renderedStyle === "arc_single"
                  ? 1
                  : 0;
          const rightSquareSize = Math.max(7, Math.min(15, radius * 0.72));
          const markerDepth =
            renderedStyle === "right_square"
              ? rightSquareSize + 2
              : radius + Math.max(0, arcCount - 1) * 4;
          return {
            id: mark.id,
            color: mark.color || "#ff8e3c",
            center,
            dirA,
            dirB,
            sweep: sweep as 0 | 1,
            arcCount,
            radius,
            renderedStyle,
            rightSquareSize,
            label,
            labelX: center.x + labelVector.x * (markerDepth + 10),
            labelY: center.y + labelVector.y * (markerDepth + 10),
          };
        })
        .filter(
          (entry): entry is {
            id: string;
            color: string;
            center: ProjectedSolidVertex;
            dirA: { x: number; y: number };
            dirB: { x: number; y: number };
            sweep: 0 | 1;
            arcCount: number;
            radius: number;
            renderedStyle: "right_square" | "arc_single" | "arc_double" | "arc_triple";
            rightSquareSize: number;
            label: string;
            labelX: number;
            labelY: number;
          } => Boolean(entry)
        );

      const roundBodyNode = (() => {
        if (!isRoundPreset) return null;
        const center = projectedBounds
          ? {
              x: (projectedBounds.minX + projectedBounds.maxX) / 2,
              y: (projectedBounds.minY + projectedBounds.maxY) / 2,
            }
          : {
              x: contentX + contentWidth / 2,
              y: contentY + contentHeight / 2,
            };
        const baseRx = Math.max(
          12,
          projectedBounds ? (projectedBounds.maxX - projectedBounds.minX) / 2 : contentWidth * 0.34
        );
        const baseRy = Math.max(
          12,
          projectedBounds ? (projectedBounds.maxY - projectedBounds.minY) / 2 : contentHeight * 0.34
        );
        const ellipseDepth = Math.max(
          4,
          baseRy * (0.14 + Math.abs(Math.sin((view.rotationX * Math.PI) / 180)) * 0.1)
        );
        const lineColor = color;
        const fillColor = object.fill ?? "rgba(95, 106, 160, 0.16)";
        const frontDash = hideHiddenEdges ? undefined : "7 5";

        const ellipseFrontPath = (cx: number, cy: number, rx: number, ry: number) =>
          `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
        const ellipseBackPath = (cx: number, cy: number, rx: number, ry: number) =>
          `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;

        if (presetId === "sphere") {
          const sphereRx = baseRx;
          const sphereRy = baseRy;
          const equatorRy = Math.max(
            4,
            sphereRy * (0.22 + Math.abs(Math.sin((view.rotationX * Math.PI) / 180)) * 0.1)
          );
          return (
            <g>
              <ellipse
                cx={center.x}
                cy={center.y}
                rx={sphereRx}
                ry={sphereRy}
                fill={fillColor}
                fillOpacity={0.86}
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              {!hideHiddenEdges ? (
                <path
                  d={ellipseBackPath(center.x, center.y, sphereRx, equatorRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.8)}
                  strokeDasharray="6 5"
                  opacity={0.58}
                />
              ) : null}
              <path
                d={ellipseFrontPath(center.x, center.y, sphereRx, equatorRy)}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.82)}
                opacity={0.9}
              />
            </g>
          );
        }

        if (presetId === "hemisphere") {
          const radius = Math.min(baseRx, baseRy);
          const domeTop = center.y - radius;
          const baseY = center.y + radius * 0.36;
          const baseEllipseRy = Math.max(4, ellipseDepth);
          return (
            <g>
              <path
                d={`M ${center.x - radius} ${baseY} A ${radius} ${radius} 0 0 1 ${center.x + radius} ${baseY} L ${center.x + radius} ${baseY} L ${center.x - radius} ${baseY} Z`}
                fill={fillColor}
                fillOpacity={0.86}
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              <path
                d={`M ${center.x - radius} ${baseY} A ${radius} ${radius} 0 0 1 ${center.x + radius} ${baseY}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              {!hideHiddenEdges ? (
                <path
                  d={ellipseBackPath(center.x, baseY, radius, baseEllipseRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.8)}
                  strokeDasharray="6 5"
                  opacity={0.58}
                />
              ) : null}
              <path
                d={ellipseFrontPath(center.x, baseY, radius, baseEllipseRy)}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.82)}
                opacity={0.9}
              />
              <line
                x1={center.x}
                y1={domeTop}
                x2={center.x}
                y2={baseY}
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.74)}
                strokeDasharray={hideHiddenEdges ? undefined : "4 4"}
                opacity={hideHiddenEdges ? 0.28 : 0.56}
              />
            </g>
          );
        }

        if (presetId === "cylinder") {
          const topEllipse = roundTopStats;
          const bottomEllipse = roundBottomStats;
          const topCenter = topEllipse?.center ?? { x: center.x, y: center.y - baseRy * 0.68 };
          const bottomCenter = bottomEllipse?.center ?? { x: center.x, y: center.y + baseRy * 0.68 };
          const topRx = topEllipse?.rx ?? baseRx;
          const bottomRx = bottomEllipse?.rx ?? baseRx;
          const topRy = topEllipse?.ry ?? ellipseDepth;
          const bottomRy = bottomEllipse?.ry ?? ellipseDepth;
          return (
            <g>
              <path
                d={`M ${topCenter.x - topRx} ${topCenter.y} L ${bottomCenter.x - bottomRx} ${bottomCenter.y} L ${bottomCenter.x + bottomRx} ${bottomCenter.y} L ${topCenter.x + topRx} ${topCenter.y} Z`}
                fill={fillColor}
                fillOpacity={0.86}
                stroke="none"
              />
              <ellipse
                cx={topCenter.x}
                cy={topCenter.y}
                rx={topRx}
                ry={topRy}
                fill="none"
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              <line
                x1={topCenter.x - topRx}
                y1={topCenter.y}
                x2={bottomCenter.x - bottomRx}
                y2={bottomCenter.y}
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              <line
                x1={topCenter.x + topRx}
                y1={topCenter.y}
                x2={bottomCenter.x + bottomRx}
                y2={bottomCenter.y}
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              {!hideHiddenEdges ? (
                <path
                  d={ellipseBackPath(bottomCenter.x, bottomCenter.y, bottomRx, bottomRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.8)}
                  strokeDasharray="6 5"
                  opacity={0.58}
                />
              ) : null}
              <path
                d={ellipseFrontPath(bottomCenter.x, bottomCenter.y, bottomRx, bottomRy)}
                fill="none"
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
            </g>
          );
        }

        if (presetId === "cone" || presetId === "truncated_cone") {
          const bottomEllipse = roundBottomStats;
          const topEllipse = roundTopStats;
          const bottomCenter = bottomEllipse?.center ?? { x: center.x, y: center.y + baseRy * 0.68 };
          const bottomRx = bottomEllipse?.rx ?? baseRx;
          const bottomRy = bottomEllipse?.ry ?? ellipseDepth;
          const coneTopCenter =
            presetId === "cone"
              ? roundConeApex
                ? { x: roundConeApex.x, y: roundConeApex.y }
                : { x: center.x, y: center.y - baseRy * 0.78 }
              : topEllipse?.center ?? { x: center.x, y: center.y - baseRy * 0.78 };
          const topRx =
            presetId === "cone" ? 0 : topEllipse?.rx ?? Math.max(9, baseRx * 0.44);
          const topRy =
            presetId === "cone" ? 0 : topEllipse?.ry ?? Math.max(3, ellipseDepth * 0.74);
          const apexXLeft = coneTopCenter.x - topRx;
          const apexXRight = coneTopCenter.x + topRx;
          return (
            <g>
              <path
                d={`M ${bottomCenter.x - bottomRx} ${bottomCenter.y} L ${apexXLeft} ${coneTopCenter.y} L ${apexXRight} ${coneTopCenter.y} L ${bottomCenter.x + bottomRx} ${bottomCenter.y} Z`}
                fill={fillColor}
                fillOpacity={0.86}
                stroke="none"
              />
              {topRx > 0 ? (
                <ellipse
                  cx={coneTopCenter.x}
                  cy={coneTopCenter.y}
                  rx={topRx}
                  ry={topRy}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.94)}
                />
              ) : null}
              <line
                x1={apexXLeft}
                y1={coneTopCenter.y}
                x2={bottomCenter.x - bottomRx}
                y2={bottomCenter.y}
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              <line
                x1={apexXRight}
                y1={coneTopCenter.y}
                x2={bottomCenter.x + bottomRx}
                y2={bottomCenter.y}
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              {!hideHiddenEdges ? (
                <path
                  d={ellipseBackPath(bottomCenter.x, bottomCenter.y, bottomRx, bottomRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.8)}
                  strokeDasharray={frontDash}
                  opacity={0.58}
                />
              ) : null}
              <path
                d={ellipseFrontPath(bottomCenter.x, bottomCenter.y, bottomRx, bottomRy)}
                fill="none"
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
            </g>
          );
        }

        if (presetId === "torus") {
          const innerRx = Math.max(8, baseRx * 0.45);
          const innerRy = Math.max(4, ellipseDepth * 0.92);
          return (
            <g>
              <ellipse
                cx={center.x}
                cy={center.y}
                rx={baseRx}
                ry={baseRy * 0.82}
                fill={fillColor}
                fillOpacity={0.76}
                stroke={lineColor}
                strokeWidth={strokeWidth}
              />
              <ellipse
                cx={center.x}
                cy={center.y}
                rx={innerRx}
                ry={Math.max(5, baseRy * 0.38)}
                fill={backgroundColor ?? "#f5f7ff"}
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.84)}
              />
              {!hideHiddenEdges ? (
                <path
                  d={ellipseBackPath(center.x, center.y, innerRx, innerRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.7)}
                  strokeDasharray="6 5"
                  opacity={0.5}
                />
              ) : null}
              <path
                d={ellipseFrontPath(center.x, center.y, innerRx, innerRy)}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.7)}
              />
            </g>
          );
        }

        return null;
      })();

      return (
        <g transform={transform}>
          <defs>
            {shouldUseClipPath ? (
              <clipPath id={clipPathId}>
                {clipRect ? (
                  <rect
                    x={clipRect.x}
                    y={clipRect.y}
                    width={clipRect.width}
                    height={clipRect.height}
                  />
                ) : null}
                {keepPolygonPoints ? <polygon points={keepPolygonPoints} /> : null}
              </clipPath>
            ) : null}
          </defs>
          {view.showGrid ? (
            <g opacity={0.4}>
              {Array.from({ length: 7 }, (_, index) => {
                const t = index / 6;
                return (
                  <line
                    key={`${object.id}-solid-grid-h-${index}`}
                    x1={contentX}
                    y1={contentY + contentHeight * t}
                    x2={contentX + contentWidth}
                    y2={contentY + contentHeight * t}
                    stroke="#8b95b8"
                    strokeWidth={0.8}
                  />
                );
              })}
              {Array.from({ length: 7 }, (_, index) => {
                const t = index / 6;
                return (
                  <line
                    key={`${object.id}-solid-grid-v-${index}`}
                    x1={contentX + contentWidth * t}
                    y1={contentY}
                    x2={contentX + contentWidth * t}
                    y2={contentY + contentHeight}
                    stroke="#8b95b8"
                    strokeWidth={0.8}
                  />
                );
              })}
            </g>
          ) : null}
          {view.showAxes ? (
            <g opacity={0.8}>
              <line
                x1={contentX + contentWidth * 0.08}
                y1={contentY + contentHeight * 0.92}
                x2={contentX + contentWidth * 0.34}
                y2={contentY + contentHeight * 0.92}
                stroke="#ff8e3c"
                strokeWidth={1.4}
              />
              <line
                x1={contentX + contentWidth * 0.08}
                y1={contentY + contentHeight * 0.92}
                x2={contentX + contentWidth * 0.08}
                y2={contentY + contentHeight * 0.66}
                stroke="#2a9d8f"
                strokeWidth={1.4}
              />
              <line
                x1={contentX + contentWidth * 0.08}
                y1={contentY + contentHeight * 0.92}
                x2={contentX + contentWidth * 0.2}
                y2={contentY + contentHeight * 0.78}
                stroke="#4f63ff"
                strokeWidth={1.4}
              />
            </g>
          ) : null}
          <g clipPath={shouldUseClipPath ? `url(#${clipPathId})` : undefined}>
            {isRoundPreset ? roundBodyNode : null}
            {!isRoundPreset
              ? faceRenderData.map((face) => (
                  <polygon
                    key={`${object.id}-solid-face-${face.index}`}
                    points={face.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill={faceColors[String(face.index)] || faceFill}
                    fillOpacity={face.isFront ? 0.95 : 0.7}
                    stroke="none"
                  />
                ))
              : null}
            {!isRoundPreset
              ? edgeRenderData.map((edge) => (
                  <line
                    key={`${object.id}-solid-edge-${edge.key}`}
                    x1={edge.from.x}
                    y1={edge.from.y}
                    x2={edge.to.x}
                    y2={edge.to.y}
                    stroke={edgeColors[edge.key] || color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={edge.dashed ? "7 6" : undefined}
                    strokeOpacity={edge.dashed ? 0.55 : 1}
                    strokeLinecap="round"
                  />
                ))
              : null}
            {angleMarkRenderData.map((mark) => {
              const normalized = mark.label.replace("°", "").replace(",", ".").trim();
              const hasLabel = normalized.length > 0;
              if (!hasLabel) return null;
              const isNumeric = /^-?\d+(\.\d+)?$/.test(normalized);
              return (
                <g key={`${object.id}-angle-mark-${mark.id}`}>
                  {mark.renderedStyle === "right_square" ? (
                    <path
                      d={buildRightAngleMarkerPath(
                        { x: mark.center.x, y: mark.center.y },
                        mark.dirA,
                        mark.dirB,
                        mark.rightSquareSize
                      )}
                      fill="none"
                      stroke={mark.color}
                      strokeWidth={1.8}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ) : (
                    Array.from({ length: mark.arcCount }, (_, arcIndex) => {
                      const arcRadius = mark.radius + arcIndex * 4;
                      return (
                        <path
                          key={`${object.id}-angle-mark-${mark.id}-${arcRadius}`}
                          d={buildAngleArcPath(
                            { x: mark.center.x, y: mark.center.y },
                            mark.dirA,
                            mark.dirB,
                            arcRadius,
                            mark.sweep
                          )}
                          fill="none"
                          stroke={mark.color}
                          strokeWidth={1.8}
                          strokeLinecap="round"
                        />
                      );
                    })
                  )}
                  <text
                    x={mark.labelX}
                    y={mark.labelY}
                    fill={mark.color}
                    fontSize={10}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {isNumeric ? (
                      <>
                        <tspan>{normalized}</tspan>
                        <tspan baselineShift="super" fontSize="8">
                          °
                        </tspan>
                      </>
                    ) : (
                      mark.label
                    )}
                  </text>
                </g>
              );
            })}
            {sectionLines.map((line) => {
              const polygon = sectionPolygonsById.get(line.section.id);
              if (polygon && polygon.points.length >= 3) {
                const path = `${toPath(
                  polygon.points.map((point) => ({ x: point.x, y: point.y }))
                )} Z`;
                return (
                  <g key={`${object.id}-section-${line.section.id}`}>
                    {line.section.fillEnabled ? (
                      <path
                        d={path}
                        fill={line.section.color}
                        fillOpacity={line.section.fillOpacity}
                        stroke="none"
                      />
                    ) : null}
                    <path
                      d={path}
                      fill="none"
                      stroke={line.section.color}
                      strokeWidth={line.section.thickness}
                      strokeDasharray="7 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {line.section.showMetrics ? (
                      <g>
                        {polygon.metrics.sideLengths.map((sideLength, index) => {
                          const a = polygon.points[index];
                          const b = polygon.points[(index + 1) % polygon.points.length];
                          const center = {
                            x: (a.x + b.x) / 2,
                            y: (a.y + b.y) / 2,
                          };
                          return (
                            <text
                              key={`${line.section.id}-side-${index}`}
                              x={center.x + 4}
                              y={center.y - 3}
                              fill={line.section.color}
                              fontSize={10}
                              fontWeight={700}
                            >
                              {sideLength.toFixed(1)}
                            </text>
                          );
                        })}
                        <text
                          x={polygon.points[0].x + 8}
                          y={polygon.points[0].y + 16}
                          fill={line.section.color}
                          fontSize={10}
                          fontWeight={700}
                        >
                          S={polygon.metrics.area.toFixed(1)}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              }
              return line.hasPolygon ? null : (
                <line
                  key={`${object.id}-section-${line.section.id}`}
                  x1={line.from.x}
                  y1={line.from.y}
                  x2={line.to.x}
                  y2={line.to.y}
                  stroke={line.section.color}
                  strokeWidth={line.section.thickness}
                  strokeDasharray="7 5"
                  strokeLinecap="round"
                />
              );
            })}
            {measurementLabels.length > 0 ? (
              <text
                x={contentX + 4}
                y={contentY + 14}
                fill="#42526f"
                fontSize={11}
                fontWeight={600}
              >
                {measurementLabels.slice(0, 3).map((measurement, index) => (
                  <tspan
                    key={`${object.id}-measurement-${measurement.id}`}
                    x={contentX + 4}
                    dy={index === 0 ? 0 : 13}
                  >
                    {measurement.label}
                  </tspan>
                ))}
              </text>
            ) : null}
          </g>
          {visibleVertexIndices.map((vertexIndex) => {
            const vertex = projectedVertexByIndex.get(vertexIndex);
            if (!vertex) return null;
            const label =
              isRoundPreset && presetId === "cone" && mesh && vertexIndex === mesh.vertices.length - 1
                ? vertexLabels[vertexIndex] || "A"
                : vertexLabels[vertexIndex] || `V${vertexIndex + 1}`;
            const placement = vertexLabelPlacements.get(vertexIndex);
            return (
              <g key={`${object.id}-vertex-${vertex.index}`}>
                <circle
                  cx={vertex.x}
                  cy={vertex.y}
                  r={isRoundPreset ? 2.2 : 2.8}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={1}
                />
                {showVertexLabels ? (
                  <text
                    x={placement?.x ?? vertex.x + 4}
                    y={placement?.y ?? vertex.y - 4}
                    fill={color}
                    fontSize={isRoundPreset ? 8 : 8.5}
                    fontWeight={700}
                    textAnchor={placement?.textAnchor ?? "start"}
                    dominantBaseline="central"
                    paintOrder="stroke"
                    stroke="rgba(245, 247, 255, 0.94)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  >
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}
          {visibleSectionMarkers.map((marker) => (
            <g key={`${object.id}-section-point-${marker.sectionId}-${marker.index}`}>
              <circle
                cx={marker.x}
                cy={marker.y}
                r={2.6}
                fill="#ffffff"
                stroke={marker.color}
                strokeWidth={1}
              />
              {object.meta?.showLabels !== false ? (
                <text
                  x={marker.placement.x}
                  y={marker.placement.y}
                  fill={marker.color}
                  fontSize={8.5}
                  fontWeight={700}
                  textAnchor={marker.placement.textAnchor}
                  dominantBaseline="central"
                  paintOrder="stroke"
                  stroke="rgba(245, 247, 255, 0.94)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                >
                  {marker.label}
                </text>
              ) : null}
            </g>
          ))}
        </g>
      );
    }

    if (object.type === "section3d") {
      const path = `M ${normalized.x + normalized.width * 0.18} ${normalized.y + normalized.height * 0.2}
        L ${normalized.x + normalized.width * 0.82} ${normalized.y + normalized.height * 0.1}
        L ${normalized.x + normalized.width * 0.92} ${normalized.y + normalized.height * 0.58}
        L ${normalized.x + normalized.width * 0.36} ${normalized.y + normalized.height * 0.78}
        Z`;
      return (
        <path
          d={path}
          fill={object.fill ?? "rgba(255, 142, 60, 0.2)"}
          stroke={object.color ?? "#ff8e3c"}
          strokeWidth={object.strokeWidth ?? 2}
          strokeLinejoin="round"
          transform={transform}
        >
          {typeof object.text === "string" && object.text ? (
            <title>{object.text}</title>
          ) : null}
        </path>
      );
    }

    if (object.type === "net3d") {
      const cell = Math.max(24, Math.min(normalized.width / 4, normalized.height / 3));
      const x = normalized.x + normalized.width / 2 - cell / 2;
      const y = normalized.y + normalized.height / 2 - cell / 2;
      const cells = [
        { x: x - cell, y },
        { x, y },
        { x: x + cell, y },
        { x: x + cell * 2, y },
        { x, y: y - cell },
        { x, y: y + cell },
      ];
      return (
        <g transform={transform}>
          {cells.map((cellRect, index) => (
            <rect
              key={`${object.id}-net-${index}`}
              x={cellRect.x}
              y={cellRect.y}
              width={cell}
              height={cell}
              fill={object.fill ?? "rgba(88, 209, 146, 0.14)"}
              stroke={object.color ?? "#2a9d8f"}
              strokeWidth={object.strokeWidth ?? 2}
              rx={3}
              ry={3}
            />
          ))}
          {typeof object.text === "string" && object.text ? (
            <text
              x={normalized.x + 8}
              y={normalized.y + normalized.height + 18}
              fill="#1b6d63"
              fontSize={12}
              fontWeight={600}
            >
              {object.text}
            </text>
          ) : null}
        </g>
      );
    }

    return null;
  };
  const renderObjectRef = useRef(renderObject);
  renderObjectRef.current = renderObject;

  const imageAssetRevision = useMemo(
    () => Object.entries(imageAssetUrls).map(([id, url]) => `${id}:${url}`).join("|"),
    [imageAssetUrls]
  );
  const inlineTextEditRevision = inlineTextEdit
    ? `${inlineTextEdit.objectId}:${inlineTextEdit.value}`
    : "";
  const objectSceneEntries = useMemo<WorkbookMaskedObjectSceneEntry[]>(
    () => {
      const revisionKey = `${imageAssetRevision}::${inlineTextEditRevision}`;
      void revisionKey;
      return visibleBoardObjects.map((object) => {
        const renderSource =
          selectedPreviewObject?.id === object.id ? selectedPreviewObject : object;
        const renderedObject = renderObjectRef.current(renderSource);
        return buildMaskedObjectSceneEntry({
          object,
          renderSource,
          renderedObject,
          eraserPreviewActive,
          previewObjectCuts: activeEraserPreviewObjectCuts,
          previewObjectPaths: activeEraserPreviewObjectPaths,
        });
      });
    },
    [
      activeEraserPreviewObjectCuts,
      activeEraserPreviewObjectPaths,
      eraserPreviewActive,
      imageAssetRevision,
      inlineTextEditRevision,
      selectedPreviewObject,
      visibleBoardObjects,
    ]
  );

  const isLiveInteractionActive = Boolean(
    moving || resizing || graphPan || solid3dGesture || solid3dResize
  );
  const realtimePatchBaseObject = useMemo(
    () =>
      resolveRealtimePatchBaseObject({
        selectedObject,
        moving,
        resizing,
        graphPan,
        solid3dResize,
      }),
    [graphPan, moving, resizing, selectedObject, solid3dResize]
  );

  const emitRealtimeObjectUpdate = useCallback(
    (objectId: string, patch: Partial<WorkbookBoardObject>) => {
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const previousTs = lastRealtimeUpdateAtRef.current.get(objectId) ?? 0;
      const signature = toStableSignature(patch);
      const previousSignature =
        lastRealtimePatchSignatureRef.current.get(objectId) ?? "";
      if (
        signature === previousSignature &&
        now - previousTs < REALTIME_PREVIEW_REPEAT_GUARD_MS
      ) {
        return;
      }
      lastRealtimeUpdateAtRef.current.set(objectId, now);
      lastRealtimePatchSignatureRef.current.set(objectId, signature);
      onObjectUpdate(objectId, patch, {
        trackHistory: false,
        markDirty: false,
      });
    },
    [onObjectUpdate]
  );

  useEffect(() => {
    if (!isLiveInteractionActive || !realtimePatchBaseObject || !selectedPreviewObject) return;
    if (realtimePatchBaseObject.id !== selectedPreviewObject.id) return;
    const patch = buildRealtimeObjectPatch(realtimePatchBaseObject, selectedPreviewObject);
    if (!patch) return;
    emitRealtimeObjectUpdate(realtimePatchBaseObject.id, patch);
  }, [
    emitRealtimeObjectUpdate,
    isLiveInteractionActive,
    realtimePatchBaseObject,
    selectedPreviewObject,
  ]);

  useEffect(() => {
    if (isLiveInteractionActive) return;
    lastRealtimePatchSignatureRef.current.clear();
    lastRealtimeUpdateAtRef.current.clear();
  }, [isLiveInteractionActive]);

  const selectedRect = useMemo(() => {
    return resolveSelectedObjectRect(selectedPreviewObject);
  }, [selectedPreviewObject]);
  const selectedLineControls = useMemo(() => {
    if (!selectedPreviewObject) return null;
    if (selectedPreviewObject.type !== "line" && selectedPreviewObject.type !== "arrow") {
      return null;
    }
    return getLineControlPoints(selectedPreviewObject);
  }, [selectedPreviewObject]);

  const selectedSolidResizeHandles = useMemo(() => {
    if (!selectedPreviewObject || selectedPreviewObject.type !== "solid3d") {
      return [] as Solid3dResizeHandle[];
    }
    return resolveSolid3dResizeHandles(selectedPreviewObject);
  }, [selectedPreviewObject]);

  const constraintRenderSegments = useMemo<WorkbookConstraintRenderSegment[]>(
    () =>
      buildConstraintRenderSegments({
        constraints,
        objectById,
        selectedConstraintId,
        renderViewportRect,
      }),
    [constraints, objectById, renderViewportRect, selectedConstraintId]
  );
  const handleSelectConstraint = useCallback(
    (constraintId: string) => {
      onSelectedObjectChange(null);
      onSelectedConstraintChange(constraintId);
    },
    [onSelectedConstraintChange, onSelectedObjectChange]
  );

  const solid3dPickMarkers = useMemo(() => {
    const markerSource = solid3dSectionMarkers;
    if (!markerSource?.objectId) {
      return [] as Array<{ index: number; x: number; y: number; label: string }>;
    }
    const sourceObject =
      selectedPreviewObject?.id === markerSource.objectId
        ? selectedPreviewObject
        : objectById.get(markerSource.objectId);
    if (!sourceObject) return [] as Array<{ index: number; x: number; y: number; label: string }>;
    return resolveSolid3dPickMarkersForObject(
      sourceObject,
      markerSource.selectedPoints,
      solid3dPreviewMetaById
    );
  }, [
    objectById,
    selectedPreviewObject,
    solid3dPreviewMetaById,
    solid3dSectionMarkers,
  ]);

  const solid3dMarkerNodes = useMemo(() => {
    if (!solid3dSectionMarkers?.objectId) return null;
    return solid3dPickMarkers.map((marker) => {
      const markerObjectId = solid3dSectionMarkers.objectId;
      const markerObject =
        selectedPreviewObject?.id === markerObjectId
          ? selectedPreviewObject
          : objectById.get(markerObjectId);
      const showMarkerLabels = markerObject?.meta?.showLabels !== false;
      const markerCenter = markerObject ? getObjectCenter(markerObject) : marker;
      const markerPlacement = resolveOutsideVertexLabelPlacement({
        vertex: marker,
        center: markerCenter,
        baseOffset: 13,
      });
      return (
        <g key={`solid3d-pick-${markerObjectId}-${marker.index}`}>
          <circle
            cx={marker.x}
            cy={marker.y}
            r={2.8}
            fill="#ff8e3c"
            stroke="#ffffff"
            strokeWidth={1}
          />
          {showMarkerLabels ? (
            <text
              x={markerPlacement.x}
              y={markerPlacement.y}
              fill="#ff8e3c"
              fontSize={8.5}
              fontWeight={700}
              textAnchor={markerPlacement.textAnchor}
              dominantBaseline="central"
            >
              {marker.label}
            </text>
          ) : null}
        </g>
      );
    });
  }, [objectById, selectedPreviewObject, solid3dPickMarkers, solid3dSectionMarkers]);

  const { areaSelectionDraftRect, areaSelectionResizeRect } = useMemo(
    () =>
      resolveAreaSelectionPreviewRects({
        areaSelectionDraft,
        areaSelectionResize,
      }),
    [areaSelectionDraft, areaSelectionResize]
  );

  const canvasStyle: CSSProperties = {
    "--workbook-grid-size": `${Math.max(8, Math.min(96, Math.floor(gridSize || 22)))}px`,
    "--workbook-grid-color": showGrid ? gridColor : "transparent",
    "--workbook-background-color": backgroundColor,
  } as CSSProperties;

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    if (disabled) return;
    if (!event.ctrlKey && !event.metaKey) return;
    if (!selectedObjectId) return;
    const selectedObject = objectById.get(selectedObjectId);
    if (!selectedObject || selectedObject.type !== "solid3d") return;
    const svg = event.currentTarget ?? null;
    if (!svg) return;
    const point = mapPointer(svg, event.clientX, event.clientY);
    if (!isInsideRect(point, getObjectRect(selectedObject))) return;
    event.preventDefault();
    const state = readSolid3dState(selectedObject.meta);
    const step = event.deltaY < 0 ? 0.08 : -0.08;
    const nextZoom = Math.max(0.4, Math.min(2.4, state.view.zoom + step));
    onObjectUpdate(selectedObject.id, {
      meta: writeSolid3dState(
        {
          ...state,
          view: {
            ...state.view,
            zoom: nextZoom,
          },
        },
        selectedObject.meta
      ),
    });
  };

  const handleDoubleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const svg = event.currentTarget ?? null;
    if (!svg) return;
    const point = mapPointer(svg, event.clientX, event.clientY, true);
    const target = resolveTopObject(point);
    if (!target && tool === "select") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!target || target.type !== "text" || target.pinned) return;
    event.preventDefault();
    event.stopPropagation();
    startInlineTextEdit(target.id);
  };

  const panModeEnabled = tool === "pan" || forcePanMode;
  const graphModeEnabled = tool === "function_graph";
  const eraserModeEnabled = tool === "eraser";

  return (
    <div
      className={`workbook-session__canvas ${panModeEnabled ? "is-pan-mode" : ""} ${
        graphModeEnabled ? "is-graph-mode" : ""
      } ${eraserModeEnabled ? "is-eraser-mode" : ""}`}
      ref={setContainerNode}
      style={canvasStyle}
    >
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
        onContextMenu={(event) => {
          if (tool === "laser") {
            event.preventDefault();
            onLaserClear?.();
            return;
          }
          const svg = event.currentTarget ?? null;
          if (!svg) return;
          const point = mapPointer(svg, event.clientX, event.clientY);
          if (tool === "area_select") {
            if (
              areaSelection &&
              (areaSelection.objectIds.length > 0 || areaSelection.strokeIds.length > 0) &&
              isInsideRect(point, areaSelection.rect)
            ) {
              event.preventDefault();
              onAreaSelectionContextMenu?.({
                objectIds: areaSelection.objectIds,
                strokeIds: areaSelection.strokeIds,
                rect: areaSelection.rect,
                anchor: { x: event.clientX, y: event.clientY },
              });
            }
            return;
          }
          const target = resolveTopObject(point);
          if (!target) return;
          if (target.type === "solid3d") {
            const vertexIndex = resolveSolid3dVertexAtPointer(
              target,
              point,
              solid3dPreviewMetaById
            );
            if (vertexIndex !== null && onSolid3dVertexContextMenu) {
              event.preventDefault();
              onSelectedConstraintChange(null);
              onSelectedObjectChange(target.id);
              onSolid3dVertexContextMenu({
                objectId: target.id,
                vertexIndex,
                anchor: { x: event.clientX, y: event.clientY },
              });
              return;
            }

            const sectionVertex = resolveSolid3dSectionVertexAtPointer(
              target,
              point,
              solid3dPreviewMetaById,
              ROUND_SOLID_PRESETS
            );
            if (sectionVertex && onSolid3dSectionVertexContextMenu) {
              event.preventDefault();
              onSelectedConstraintChange(null);
              onSelectedObjectChange(target.id);
              onSolid3dSectionVertexContextMenu({
                objectId: target.id,
                sectionId: sectionVertex.sectionId,
                vertexIndex: sectionVertex.vertexIndex,
                anchor: { x: event.clientX, y: event.clientY },
              });
              return;
            }

            const sectionId = resolveSolid3dSectionAtPointer(
              target,
              point,
              solid3dPreviewMetaById
            );
            if (sectionId && onSolid3dSectionContextMenu) {
              event.preventDefault();
              onSelectedConstraintChange(null);
              onSelectedObjectChange(target.id);
              onSolid3dSectionContextMenu({
                objectId: target.id,
                sectionId,
                anchor: { x: event.clientX, y: event.clientY },
              });
              return;
            }
          }

          if (
            (target.type === "line" || target.type === "arrow") &&
            onLineEndpointContextMenu
          ) {
            const endpoint = resolveLineEndpointAtPointer(target, point);
            if (endpoint) {
              event.preventDefault();
              onSelectedConstraintChange(null);
              onSelectedObjectChange(target.id);
              const labelRaw =
                endpoint === "start" ? target.meta?.startLabel : target.meta?.endLabel;
              const fallback = endpoint === "start" ? "A" : "B";
              const label = typeof labelRaw === "string" && labelRaw.trim()
                ? labelRaw
                : fallback;
              onLineEndpointContextMenu({
                objectId: target.id,
                endpoint,
                label,
                anchor: { x: event.clientX, y: event.clientY },
              });
              return;
            }
          }

          if (
            (target.type === "rectangle" ||
              target.type === "triangle" ||
              target.type === "polygon") &&
            onShapeVertexContextMenu
          ) {
            const vertexIndex = resolve2dFigureVertexAtPointer(target, point);
            if (vertexIndex !== null) {
              const rect = normalizeRect(
                { x: target.x, y: target.y },
                { x: target.x + target.width, y: target.y + target.height }
              );
              const vertices = resolve2dFigureVertices(target, rect);
              const labels = resolve2dFigureVertexLabels(target, vertices.length);
              event.preventDefault();
              onSelectedConstraintChange(null);
              onSelectedObjectChange(target.id);
              onShapeVertexContextMenu({
                objectId: target.id,
                vertexIndex,
                label: labels[vertexIndex] ?? getFigureVertexLabel(vertexIndex),
                anchor: { x: event.clientX, y: event.clientY },
              });
              return;
            }
          }

          if (!onObjectContextMenu) return;
          event.preventDefault();
          onSelectedConstraintChange(null);
          onSelectedObjectChange(target.id);
          onObjectContextMenu(target.id, {
            x: event.clientX,
            y: event.clientY,
          });
        }}
        onPointerLeave={() => {
          if (tool === "polygon" && polygonMode === "points") {
            setPolygonHoverPoint(null);
          }
          if (tool === "eraser") {
            setEraserCursorPoint(null);
          }
        }}
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
        <g transform={`translate(${-viewportOffset.x} ${-viewportOffset.y})`}>
        <WorkbookAutoDividerLayer lines={autoDividerLines} />
        <WorkbookObjectSceneLayer entries={objectSceneEntries} />
        {solid3dMarkerNodes}
        <WorkbookConstraintLayer
          segments={constraintRenderSegments}
          selectedConstraintId={selectedConstraintId}
          tool={tool}
          onSelectConstraint={handleSelectConstraint}
        />
        <WorkbookStrokeLayer strokes={renderedStrokes} />
        <WorkbookStrokeLayer strokes={previewStrokes} preview />
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
          pointerEvents="none"
        />

        <path
          ref={draftStrokePathRef}
          stroke={tool === "eraser" ? "var(--surface-soft)" : color}
          strokeWidth={tool === "eraser" ? Math.max(8, width * 1.6) : width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={tool === "highlighter" ? 0.5 : 1}
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
