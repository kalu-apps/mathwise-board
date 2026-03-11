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
import { resolveSolid3dPresetId } from "../model/solid3d";
import {
  DEFAULT_SOLID3D_STATE,
  readSolid3dState,
  writeSolid3dState,
} from "../model/solid3dState";
import type { Solid3dSectionPoint } from "../model/solid3dState";
import {
  computeSectionMetrics,
  computeSectionPolygon,
  getSolid3dMesh,
  pickSolidPointOnSurface,
  projectSolidPointForObject,
  projectSolidVerticesForObject,
  resolveSectionPointForMesh,
} from "../model/solid3dGeometry";
import type { ProjectedSolidVertex, SolidSurfacePick } from "../model/solid3dGeometry";
import {
  buildFunctionGraphPlots,
  getAutoGraphGridStep,
  sanitizeFunctionGraphDrafts,
  type GraphFunctionDraft,
} from "../model/functionGraph";
import {
  getWorkbookPolygonPoints,
  type WorkbookPolygonPreset,
} from "../model/shapeGeometry";
import {
  normalizeShapeAngleMarks,
  resolveRenderedShapeAngleMarkStyle,
} from "../model/shapeAngleMarks";

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

type Rect = { x: number; y: number; width: number; height: number };

type WorkbookCanvasAreaSelection = {
  objectIds: string[];
  strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
  rect: { x: number; y: number; width: number; height: number };
};

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

type ObjectEraserCut = {
  u: number;
  v: number;
  radiusRatio: number;
};

type ResolvedObjectEraserCut = {
  x: number;
  y: number;
  radius: number;
};

type MovingState = {
  object: WorkbookBoardObject;
  groupObjects: WorkbookBoardObject[];
  start: WorkbookPoint;
  current: WorkbookPoint;
  startClientX: number;
  startClientY: number;
};

type ResizeState = {
  object: WorkbookBoardObject;
  mode:
    | "n"
    | "s"
    | "w"
    | "e"
    | "nw"
    | "ne"
    | "sw"
    | "se"
    | "line-start"
    | "line-end"
    | "line-curve-c1"
    | "line-curve-c2"
    | "rotate";
  start: WorkbookPoint;
  current: WorkbookPoint;
};

type Solid3dGestureState = {
  object: WorkbookBoardObject;
  mode: "rotate" | "pan";
  start: WorkbookPoint;
  baseRotationX: number;
  baseRotationY: number;
  basePanX: number;
  basePanY: number;
};

type Solid3dResizeState = {
  object: WorkbookBoardObject;
  mode: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";
  start: WorkbookPoint;
  current: WorkbookPoint;
  center: WorkbookPoint;
  startLocal: WorkbookPoint;
};

type Solid3dResizeHandle = {
  mode: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";
  x: number;
  y: number;
};

type PanState = {
  start: WorkbookPoint;
  baseOffset: WorkbookPoint;
};

type GraphPanState = {
  object: WorkbookBoardObject;
  targetFunctionId: string | null;
  start: WorkbookPoint;
  current: WorkbookPoint;
  initialFunctions: GraphFunctionDraft[];
  pxPerUnit: number;
};

type AreaSelectionDraft = {
  start: WorkbookPoint;
  current: WorkbookPoint;
};

type AreaSelectionResizeMode = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";

type AreaSelectionResizeState = {
  initialRect: Rect;
  mode: AreaSelectionResizeMode;
  current: WorkbookPoint;
};

const toPath = (points: WorkbookPoint[]) => {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [single] = points;
    return `M ${single.x} ${single.y} L ${single.x + 0.01} ${single.y + 0.01}`;
  }
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
};

const STROKE_PREVIEW_MAX_POINTS = 96;
const STROKE_PREVIEW_SEND_INTERVAL_MS = 32;

const buildStrokePreviewPoints = (points: WorkbookPoint[]) => {
  if (points.length <= STROKE_PREVIEW_MAX_POINTS) {
    return [...points];
  }
  const output: WorkbookPoint[] = [points[0]];
  const interiorBudget = Math.max(1, STROKE_PREVIEW_MAX_POINTS - 2);
  const stride = Math.max(1, Math.ceil((points.length - 2) / interiorBudget));
  for (let index = stride; index < points.length - 1; index += stride) {
    const point = points[index];
    const previous = output[output.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.18) {
      output.push(point);
    }
  }
  const lastPoint = points[points.length - 1];
  const tail = output[output.length - 1];
  if (!tail || Math.hypot(lastPoint.x - tail.x, lastPoint.y - tail.y) >= 0.01) {
    output.push(lastPoint);
  }
  return output;
};

const normalizeRect = (a: WorkbookPoint, b: WorkbookPoint): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.max(1, Math.abs(a.x - b.x)),
  height: Math.max(1, Math.abs(a.y - b.y)),
});

const getAreaSelectionHandlePoints = (rect: Rect) => {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const midX = left + rect.width / 2;
  const midY = top + rect.height / 2;
  return [
    { mode: "nw" as const, x: left, y: top },
    { mode: "n" as const, x: midX, y: top },
    { mode: "ne" as const, x: right, y: top },
    { mode: "e" as const, x: right, y: midY },
    { mode: "se" as const, x: right, y: bottom },
    { mode: "s" as const, x: midX, y: bottom },
    { mode: "sw" as const, x: left, y: bottom },
    { mode: "w" as const, x: left, y: midY },
  ];
};

const resolveAreaSelectionResizeMode = (
  rect: Rect,
  point: WorkbookPoint
): AreaSelectionResizeMode | null => {
  const nearest = getAreaSelectionHandlePoints(rect).reduce<{
    mode: AreaSelectionResizeMode | null;
    distance: number;
  }>(
    (acc, handle) => {
      const distance = Math.hypot(handle.x - point.x, handle.y - point.y);
      if (distance < acc.distance) {
        return { mode: handle.mode, distance };
      }
      return acc;
    },
    { mode: null, distance: Number.POSITIVE_INFINITY }
  );
  return nearest.mode && nearest.distance <= 12 ? nearest.mode : null;
};

const resizeAreaSelectionRect = (
  rect: Rect,
  mode: AreaSelectionResizeMode,
  point: WorkbookPoint
) => {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const nextLeft = mode.includes("w") ? point.x : left;
  const nextRight = mode.includes("e") ? point.x : right;
  const nextTop = mode.includes("n") ? point.y : top;
  const nextBottom = mode.includes("s") ? point.y : bottom;
  return normalizeRect(
    { x: nextLeft, y: nextTop },
    { x: nextRight, y: nextBottom }
  );
};

const rectIntersects = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width &&
  a.x + a.width >= b.x &&
  a.y <= b.y + b.height &&
  a.y + a.height >= b.y;

const getStrokeRect = (stroke: WorkbookStroke): Rect | null => {
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) return null;
  let minX = stroke.points[0].x;
  let maxX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxY = stroke.points[0].y;
  stroke.points.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });
  const padding = Math.max(3, (stroke.width ?? 2) / 2 + 2);
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX) + padding * 2,
    height: Math.max(1, maxY - minY) + padding * 2,
  };
};

const circleIntersectsRect = (center: WorkbookPoint, radius: number, rect: Rect) => {
  const nearestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  return Math.hypot(center.x - nearestX, center.y - nearestY) <= radius;
};

const ROUND_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);
const getRoundSolidSemanticVertexDefaults = (presetId: string, vertexCount = 0) => {
  if (presetId !== "cone" || vertexCount <= 0) return [];
  return Array.from({ length: vertexCount }, (_, index) =>
    index === vertexCount - 1 ? "A" : ""
  );
};

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

const getSolidVertexLabel = (index: number) => `V${index + 1}`;
const getSectionVertexLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length)}`;
};
const MAX_OBJECT_ERASER_CUTS = 220;
const ERASER_MASK_PADDING = 20;
const ERASER_INTERSECTION_EPSILON = 1e-4;
const OBJECT_ERASER_RATIO_MIN = 0.003;
const OBJECT_ERASER_RATIO_MAX = 2.4;

const pointsAlmostEqual = (
  left: WorkbookPoint,
  right: WorkbookPoint,
  epsilon = 1e-2
) => Math.abs(left.x - right.x) <= epsilon && Math.abs(left.y - right.y) <= epsilon;

const projectPointOnSegment = (
  from: WorkbookPoint,
  to: WorkbookPoint,
  t: number
): WorkbookPoint => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
});

const distanceBetweenPoints = (left: WorkbookPoint, right: WorkbookPoint) =>
  Math.hypot(left.x - right.x, left.y - right.y);

const resolveSegmentCircleIntersections = (
  from: WorkbookPoint,
  to: WorkbookPoint,
  center: WorkbookPoint,
  radius: number
) => {
  const directionX = to.x - from.x;
  const directionY = to.y - from.y;
  const offsetX = from.x - center.x;
  const offsetY = from.y - center.y;
  const a = directionX * directionX + directionY * directionY;
  if (a <= ERASER_INTERSECTION_EPSILON) return [] as number[];
  const b = 2 * (offsetX * directionX + offsetY * directionY);
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < ERASER_INTERSECTION_EPSILON) return [] as number[];
  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  const intersections = [t1, t2]
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > ERASER_INTERSECTION_EPSILON &&
        value < 1 - ERASER_INTERSECTION_EPSILON
    )
    .sort((left, right) => left - right);
  return intersections.reduce<number[]>((acc, value) => {
    if (acc.length === 0 || Math.abs(acc[acc.length - 1] - value) > ERASER_INTERSECTION_EPSILON) {
      acc.push(value);
    }
    return acc;
  }, []);
};

const compactStrokePoints = (points: WorkbookPoint[]) =>
  points.reduce<WorkbookPoint[]>((acc, point) => {
    if (acc.length === 0) {
      acc.push(point);
      return acc;
    }
    const previous = acc[acc.length - 1];
    if (!pointsAlmostEqual(previous, point)) {
      acc.push(point);
    }
    return acc;
  }, []);

const splitStrokeByCircle = (
  stroke: WorkbookStroke,
  center: WorkbookPoint,
  radius: number
) => {
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) {
    return [] as WorkbookPoint[][];
  }
  const threshold = Math.max(2, radius + (stroke.width ?? 2) / 2);
  if (stroke.points.length === 1) {
    return distanceBetweenPoints(stroke.points[0], center) <= threshold
      ? ([] as WorkbookPoint[][])
      : [[stroke.points[0]]];
  }

  const result: WorkbookPoint[][] = [];
  let current: WorkbookPoint[] = [];

  for (let index = 0; index < stroke.points.length - 1; index += 1) {
    const from = stroke.points[index];
    const to = stroke.points[index + 1];
    const intersections = resolveSegmentCircleIntersections(from, to, center, threshold);
    const checkpoints = [0, ...intersections, 1];

    for (let checkpointIndex = 0; checkpointIndex < checkpoints.length - 1; checkpointIndex += 1) {
      const startT = checkpoints[checkpointIndex];
      const endT = checkpoints[checkpointIndex + 1];
      if (endT - startT <= ERASER_INTERSECTION_EPSILON) continue;
      const middle = projectPointOnSegment(from, to, (startT + endT) / 2);
      const keepSegment = distanceBetweenPoints(middle, center) > threshold;
      const segmentStart = projectPointOnSegment(from, to, startT);
      const segmentEnd = projectPointOnSegment(from, to, endT);

      if (keepSegment) {
        if (current.length === 0) {
          current.push(segmentStart);
        } else if (!pointsAlmostEqual(current[current.length - 1], segmentStart)) {
          current.push(segmentStart);
        }
        if (!pointsAlmostEqual(current[current.length - 1], segmentEnd)) {
          current.push(segmentEnd);
        }
      } else if (current.length > 0) {
        const compacted = compactStrokePoints(current);
        if (compacted.length > 0) {
          result.push(compacted);
        }
        current = [];
      }
    }
  }

  if (current.length > 0) {
    const compacted = compactStrokePoints(current);
    if (compacted.length > 0) {
      result.push(compacted);
    }
  }
  return result;
};

const areStrokeFragmentsEquivalent = (
  stroke: WorkbookStroke,
  fragments: WorkbookPoint[][]
) => {
  if (fragments.length !== 1) return false;
  const [fragment] = fragments;
  if (fragment.length !== stroke.points.length) return false;
  return fragment.every((point, index) => pointsAlmostEqual(point, stroke.points[index]));
};

const areFragmentCollectionsEquivalent = (
  left: WorkbookPoint[][],
  right: WorkbookPoint[][]
) => {
  if (left.length !== right.length) return false;
  return left.every((fragment, fragmentIndex) => {
    const target = right[fragmentIndex];
    if (!target || fragment.length !== target.length) return false;
    return fragment.every((point, pointIndex) => pointsAlmostEqual(point, target[pointIndex]));
  });
};

const clampObjectEraserCut = (cut: ObjectEraserCut): ObjectEraserCut => ({
  u: Math.max(-2, Math.min(3, cut.u)),
  v: Math.max(-2, Math.min(3, cut.v)),
  radiusRatio: Math.max(
    OBJECT_ERASER_RATIO_MIN,
    Math.min(OBJECT_ERASER_RATIO_MAX, cut.radiusRatio)
  ),
});

const normalizeObjectEraserCut = (
  object: WorkbookBoardObject,
  center: WorkbookPoint,
  radius: number
): ObjectEraserCut => {
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return clampObjectEraserCut({
    u: (center.x - rect.x) / safeWidth,
    v: (center.y - rect.y) / safeHeight,
    radiusRatio: radius / safeScale,
  });
};

const sanitizeObjectEraserCuts = (object: WorkbookBoardObject): ObjectEraserCut[] => {
  const raw = Array.isArray(object.meta?.eraserCuts) ? object.meta.eraserCuts : [];
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return raw.reduce<ObjectEraserCut[]>((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const typed = item as {
      u?: unknown;
      v?: unknown;
      radiusRatio?: unknown;
      x?: unknown;
      y?: unknown;
      radius?: unknown;
      r?: unknown;
    };
    if (
      typeof typed.u === "number" &&
      Number.isFinite(typed.u) &&
      typeof typed.v === "number" &&
      Number.isFinite(typed.v)
    ) {
      const ratioRaw =
        typeof typed.radiusRatio === "number" && Number.isFinite(typed.radiusRatio)
          ? typed.radiusRatio
          : typeof typed.radius === "number" && Number.isFinite(typed.radius)
            ? typed.radius / safeScale
            : typeof typed.r === "number" && Number.isFinite(typed.r)
              ? typed.r / safeScale
              : null;
      if (ratioRaw === null) return acc;
      return [...acc, clampObjectEraserCut({ u: typed.u, v: typed.v, radiusRatio: ratioRaw })];
    }
    if (
      typeof typed.x === "number" &&
      Number.isFinite(typed.x) &&
      typeof typed.y === "number" &&
      Number.isFinite(typed.y)
    ) {
      const radiusRaw =
        typeof typed.radius === "number" && Number.isFinite(typed.radius)
          ? typed.radius
          : typeof typed.r === "number" && Number.isFinite(typed.r)
            ? typed.r
            : null;
      if (radiusRaw === null) return acc;
      return [
        ...acc,
        clampObjectEraserCut({
          u: (typed.x - rect.x) / safeWidth,
          v: (typed.y - rect.y) / safeHeight,
          radiusRatio: Math.max(1, Math.min(240, radiusRaw)) / safeScale,
        }),
      ];
    }
    return acc;
  }, []);
};

const resolveObjectEraserCutsForRender = (
  object: WorkbookBoardObject,
  cuts: ObjectEraserCut[]
): ResolvedObjectEraserCut[] => {
  if (cuts.length === 0) return [];
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return cuts.map((cut) => ({
    x: rect.x + cut.u * safeWidth,
    y: rect.y + cut.v * safeHeight,
    radius: Math.max(1, Math.min(320, cut.radiusRatio * safeScale)),
  }));
};

const distanceToSegment = (point: WorkbookPoint, a: WorkbookPoint, b: WorkbookPoint) => {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const apX = point.x - a.x;
  const apY = point.y - a.y;
  const denominator = abX * abX + abY * abY;
  if (denominator <= 1e-8) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / denominator));
  const closest = { x: a.x + abX * t, y: a.y + abY * t };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
};

const pointInPolygon = (point: WorkbookPoint, polygon: WorkbookPoint[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x <
        ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + Number.EPSILON) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

type LineCurveMeta = {
  c1t: number;
  c1n: number;
  c2t: number;
  c2n: number;
};

const DEFAULT_LINE_CURVE: LineCurveMeta = {
  c1t: 1 / 3,
  c1n: 0,
  c2t: 2 / 3,
  c2n: 0,
};

const getLineEndpoints = (object: WorkbookBoardObject) => ({
  start: { x: object.x, y: object.y },
  end: { x: object.x + object.width, y: object.y + object.height },
});

const getLineBasis = (object: WorkbookBoardObject) => {
  const { start, end } = getLineEndpoints(object);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.0001) {
    return {
      start,
      end,
      length: 0,
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: -1 },
    };
  }
  return {
    start,
    end,
    length,
    tangent: { x: dx / length, y: dy / length },
    normal: { x: -dy / length, y: dx / length },
  };
};

const readLineCurveMeta = (object: WorkbookBoardObject): LineCurveMeta => {
  const curve = object.meta?.curve;
  if (curve && typeof curve === "object" && !Array.isArray(curve)) {
    const record = curve as Record<string, unknown>;
    const c1t = typeof record.c1t === "number" && Number.isFinite(record.c1t) ? record.c1t : DEFAULT_LINE_CURVE.c1t;
    const c1n = typeof record.c1n === "number" && Number.isFinite(record.c1n) ? record.c1n : DEFAULT_LINE_CURVE.c1n;
    const c2t = typeof record.c2t === "number" && Number.isFinite(record.c2t) ? record.c2t : DEFAULT_LINE_CURVE.c2t;
    const c2n = typeof record.c2n === "number" && Number.isFinite(record.c2n) ? record.c2n : DEFAULT_LINE_CURVE.c2n;
    return { c1t, c1n, c2t, c2n };
  }
  const legacyOffset = object.meta?.curveOffset;
  if (typeof legacyOffset === "number" && Number.isFinite(legacyOffset)) {
    return {
      c1t: DEFAULT_LINE_CURVE.c1t,
      c1n: legacyOffset,
      c2t: DEFAULT_LINE_CURVE.c2t,
      c2n: legacyOffset,
    };
  }
  return { ...DEFAULT_LINE_CURVE };
};

const getLineControlPoints = (object: WorkbookBoardObject) => {
  const basis = getLineBasis(object);
  const curve = readLineCurveMeta(object);
  const project = (t: number, n: number) => ({
    x: basis.start.x + basis.tangent.x * basis.length * t + basis.normal.x * n,
    y: basis.start.y + basis.tangent.y * basis.length * t + basis.normal.y * n,
  });
  return {
    start: basis.start,
    end: basis.end,
    c1: project(curve.c1t, curve.c1n),
    c2: project(curve.c2t, curve.c2n),
    curve,
    basis,
  };
};

const projectPointToLineCurve = (
  object: WorkbookBoardObject,
  point: WorkbookPoint
) => {
  const basis = getLineBasis(object);
  if (basis.length <= 0.0001) {
    return { t: DEFAULT_LINE_CURVE.c1t, n: 0 };
  }
  const dx = point.x - basis.start.x;
  const dy = point.y - basis.start.y;
  return {
    t: (dx * basis.tangent.x + dy * basis.tangent.y) / basis.length,
    n: dx * basis.normal.x + dy * basis.normal.y,
  };
};

const getLinePathD = (object: WorkbookBoardObject) => {
  const controls = getLineControlPoints(object);
  return `M ${controls.start.x} ${controls.start.y} C ${controls.c1.x} ${controls.c1.y} ${controls.c2.x} ${controls.c2.y} ${controls.end.x} ${controls.end.y}`;
};

const getObjectRect = (object: WorkbookBoardObject): Rect => {
  if (object.type === "line" || object.type === "arrow") {
    const controls = getLineControlPoints(object);
    const minX = Math.min(controls.start.x, controls.end.x, controls.c1.x, controls.c2.x);
    const maxX = Math.max(controls.start.x, controls.end.x, controls.c1.x, controls.c2.x);
    const minY = Math.min(controls.start.y, controls.end.y, controls.c1.y, controls.c2.y);
    const maxY = Math.max(controls.start.y, controls.end.y, controls.c1.y, controls.c2.y);
    return {
      x: minX - 8,
      y: minY - 8,
      width: Math.max(1, maxX - minX) + 16,
      height: Math.max(1, maxY - minY) + 16,
    };
  }
  if (Array.isArray(object.points) && object.points.length > 0) {
    let minX = object.points[0].x;
    let minY = object.points[0].y;
    let maxX = object.points[0].x;
    let maxY = object.points[0].y;
    object.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }
  const width = Math.max(1, Math.abs(object.width));
  const height = Math.max(1, Math.abs(object.height));
  return {
    x: Math.min(object.x, object.x + object.width),
    y: Math.min(object.y, object.y + object.height),
    width,
    height,
  };
};

const getObjectCenter = (object: WorkbookBoardObject): WorkbookPoint => {
  const rect = getObjectRect(object);
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

const rotatePointAround = (
  point: WorkbookPoint,
  center: WorkbookPoint,
  angleDeg: number
): WorkbookPoint => {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

const isInsideRect = (point: WorkbookPoint, rect: Rect) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

const createPolygonPath = (
  rect: Rect,
  sides: number,
  preset: WorkbookPolygonPreset = "regular"
) => {
  const points = getWorkbookPolygonPoints(rect, sides, preset);
  return `${toPath(points)} Z`;
};

const resolvePolygonFigureKind = (
  sides: number,
  preset: WorkbookPolygonPreset
): string | undefined => {
  if (preset === "rhombus") return "rhombus";
  if (preset === "trapezoid") return "trapezoid_isosceles";
  if (preset === "trapezoid_right") return "trapezoid_right";
  if (preset === "trapezoid_scalene") return "trapezoid_scalene";
  if (sides === 3) return "triangle";
  if (sides === 5) return "pentagon";
  if (sides === 6) return "hexagon";
  return undefined;
};

const getFigureVertexLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length)}`;
};

const resolve2dFigureVertices = (object: WorkbookBoardObject, normalized: Rect) => {
  if (object.type === "rectangle") {
    return [
      { x: normalized.x, y: normalized.y },
      { x: normalized.x + normalized.width, y: normalized.y },
      { x: normalized.x + normalized.width, y: normalized.y + normalized.height },
      { x: normalized.x, y: normalized.y + normalized.height },
    ];
  }
  if (object.type === "triangle") {
    return [
      { x: normalized.x + normalized.width / 2, y: normalized.y },
      { x: normalized.x, y: normalized.y + normalized.height },
      { x: normalized.x + normalized.width, y: normalized.y + normalized.height },
    ];
  }
  if (object.type === "polygon") {
    if (Array.isArray(object.points) && object.points.length >= 2) {
      return object.points;
    }
    const objectPreset =
      object.meta?.polygonPreset === "trapezoid" ||
      object.meta?.polygonPreset === "trapezoid_right" ||
      object.meta?.polygonPreset === "trapezoid_scalene" ||
      object.meta?.polygonPreset === "rhombus"
        ? object.meta.polygonPreset
        : "regular";
    return getWorkbookPolygonPoints(normalized, object.sides ?? 5, objectPreset);
  }
  return [] as WorkbookPoint[];
};

const is2dFigureClosed = (object: WorkbookBoardObject) => {
  if (object.type !== "polygon") return true;
  if (!Array.isArray(object.points) || object.points.length < 2) return true;
  return object.meta?.closed !== false;
};

const get2dFigureSegments = (vertices: WorkbookPoint[], closed: boolean) => {
  if (vertices.length < 2) return [] as { start: WorkbookPoint; end: WorkbookPoint }[];
  const segmentCount = closed ? vertices.length : Math.max(0, vertices.length - 1);
  return Array.from({ length: segmentCount }, (_, index) => ({
    start: vertices[index],
    end: vertices[(index + 1) % vertices.length],
  }));
};

const resolve2dFigureVertexLabels = (object: WorkbookBoardObject, verticesCount: number) => {
  const source = Array.isArray(object.meta?.vertexLabels) ? object.meta.vertexLabels : [];
  return Array.from({ length: verticesCount }, (_, index) => {
    const raw = typeof source[index] === "string" ? source[index].trim() : "";
    return raw || getFigureVertexLabel(index);
  });
};

const sampleCubicBezier = (
  p0: WorkbookPoint,
  p1: WorkbookPoint,
  p2: WorkbookPoint,
  p3: WorkbookPoint,
  t: number
) => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const x =
    mt2 * mt * p0.x +
    3 * mt2 * t * p1.x +
    3 * mt * t2 * p2.x +
    t2 * t * p3.x;
  const y =
    mt2 * mt * p0.y +
    3 * mt2 * t * p1.y +
    3 * mt * t2 * p2.y +
    t2 * t * p3.y;
  return { x, y };
};

const distanceToCubicBezier = (
  point: WorkbookPoint,
  p0: WorkbookPoint,
  p1: WorkbookPoint,
  p2: WorkbookPoint,
  p3: WorkbookPoint
) => {
  const samples = 30;
  let nearest = Number.POSITIVE_INFINITY;
  let previous = p0;
  for (let index = 1; index <= samples; index += 1) {
    const current = sampleCubicBezier(p0, p1, p2, p3, index / samples);
    nearest = Math.min(nearest, distanceToSegment(point, previous, current));
    previous = current;
  }
  return nearest;
};

const distanceToPolyline = (
  point: WorkbookPoint,
  vertices: WorkbookPoint[],
  closed: boolean
) => {
  if (vertices.length < 2) return Number.POSITIVE_INFINITY;
  let nearest = Number.POSITIVE_INFINITY;
  const segments = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < segments; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    nearest = Math.min(nearest, distanceToSegment(point, start, end));
  }
  return nearest;
};

type CanvasPoint = {
  x: number;
  y: number;
};

const dot2 = (a: CanvasPoint, b: CanvasPoint) => a.x * b.x + a.y * b.y;

const clipPolygonByHalfPlane = (
  polygon: CanvasPoint[],
  origin: CanvasPoint,
  normal: CanvasPoint,
  keepPositive: boolean
) => {
  if (polygon.length === 0) return polygon;
  const sign = keepPositive ? 1 : -1;
  const inside = (point: CanvasPoint) =>
    sign * dot2({ x: point.x - origin.x, y: point.y - origin.y }, normal) >= 0;

  const intersect = (a: CanvasPoint, b: CanvasPoint) => {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const numerator = dot2({ x: origin.x - a.x, y: origin.y - a.y }, normal);
    const denominator = dot2(ab, normal);
    if (Math.abs(denominator) < 1e-6) return b;
    const t = numerator / denominator;
    return {
      x: a.x + ab.x * t,
      y: a.y + ab.y * t,
    };
  };

  const output: CanvasPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside) {
      if (!previousInside) {
        output.push(intersect(previous, current));
      }
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }
  return output;
};

const getPointsBoundsFromPoints = (points: WorkbookPoint[]) => {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const getPointsCentroid = (points: WorkbookPoint[]) => {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length < 3) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    signedArea += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }
  if (Math.abs(signedArea) < 1e-6) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }
  return {
    x: centroidX / (3 * signedArea),
    y: centroidY / (3 * signedArea),
  };
};

const resolveOutsideVertexLabelPlacement = (params: {
  vertex: WorkbookPoint;
  center?: WorkbookPoint | null;
  polygon?: WorkbookPoint[];
  baseOffset?: number;
}) => {
  const { vertex, center = null, polygon = [], baseOffset = 14 } = params;
  const polygonCenter =
    polygon.length >= 2 ? getPointsCentroid(polygon) : center ?? { x: vertex.x, y: vertex.y };
  let dx = vertex.x - polygonCenter.x;
  let dy = vertex.y - polygonCenter.y;
  let length = Math.hypot(dx, dy);
  if (length < 1e-6 && polygon.length >= 2) {
    const bounds = getPointsBoundsFromPoints(polygon);
    dx = vertex.x - (bounds.minX + bounds.width / 2);
    dy = vertex.y - (bounds.minY + bounds.height / 2);
    length = Math.hypot(dx, dy);
  }
  if (length < 1e-6 && center) {
    dx = vertex.x - center.x;
    dy = vertex.y - center.y;
    length = Math.hypot(dx, dy);
  }
  if (length < 1e-6) {
    dx = 0.82;
    dy = -0.58;
    length = 1;
  }
  const direction = {
    x: dx / length,
    y: dy / length,
  };
  const offsets = [baseOffset, baseOffset + 6, baseOffset + 12];
  let target = {
    x: vertex.x + direction.x * offsets[0],
    y: vertex.y + direction.y * offsets[0],
  };
  for (const offset of offsets) {
    const candidate = {
      x: vertex.x + direction.x * offset,
      y: vertex.y + direction.y * offset,
    };
    if (polygon.length < 3 || !pointInPolygon(candidate, polygon)) {
      target = candidate;
      break;
    }
    target = candidate;
  }
  return {
    x: target.x,
    y: target.y,
    textAnchor:
      direction.x > 0.35 ? "start" : direction.x < -0.35 ? "end" : "middle",
  } as const;
};

const clampUnitDot = (value: number) => Math.max(-1, Math.min(1, value));

const buildAngleArcPath = (
  vertex: WorkbookPoint,
  unitA: WorkbookPoint,
  unitB: WorkbookPoint,
  radius: number,
  sweep: 0 | 1
) => {
  const start = {
    x: vertex.x + unitA.x * radius,
    y: vertex.y + unitA.y * radius,
  };
  const end = {
    x: vertex.x + unitB.x * radius,
    y: vertex.y + unitB.y * radius,
  };
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`;
};

const buildRightAngleMarkerPath = (
  vertex: WorkbookPoint,
  unitA: WorkbookPoint,
  unitB: WorkbookPoint,
  size: number
) => {
  const first = {
    x: vertex.x + unitA.x * size,
    y: vertex.y + unitA.y * size,
  };
  const corner = {
    x: first.x + unitB.x * size,
    y: first.y + unitB.y * size,
  };
  const second = {
    x: vertex.x + unitB.x * size,
    y: vertex.y + unitB.y * size,
  };
  return `M ${first.x} ${first.y} L ${corner.x} ${corner.y} L ${second.x} ${second.y}`;
};

const mapConstraintLabel = (type: WorkbookConstraint["type"]) => {
  if (type === "parallel") return "∥";
  if (type === "perpendicular") return "⊥";
  if (type === "equal_length") return "L=";
  if (type === "equal_angle") return "∠=";
  if (type === "point_on_line") return "•—";
  if (type === "point_on_circle") return "•○";
  return "Связь";
};

const clampGraphOffsetValue = (value: number) =>
  Math.max(-999, Math.min(999, Number.isFinite(value) ? value : 0));

const COORD_DELTA_EPSILON = 0.01;
const REALTIME_META_PATCH_MAX_SIGNATURE = 8_192;
const REALTIME_PREVIEW_REPEAT_GUARD_MS = 120;

const hasCoordChanged = (left: number, right: number) =>
  Math.abs(left - right) > COORD_DELTA_EPSILON;

const arePointsEqual = (
  left: WorkbookPoint[] | undefined,
  right: WorkbookPoint[] | undefined
) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (
      hasCoordChanged(left[index].x, right[index].x) ||
      hasCoordChanged(left[index].y, right[index].y)
    ) {
      return false;
    }
  }
  return true;
};

const toStableSignature = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
};

const buildRealtimeObjectPatch = (
  base: WorkbookBoardObject,
  preview: WorkbookBoardObject
): Partial<WorkbookBoardObject> | null => {
  const patch: Partial<WorkbookBoardObject> = {};
  if (hasCoordChanged(base.x, preview.x)) patch.x = preview.x;
  if (hasCoordChanged(base.y, preview.y)) patch.y = preview.y;
  if (hasCoordChanged(base.width, preview.width)) patch.width = preview.width;
  if (hasCoordChanged(base.height, preview.height)) patch.height = preview.height;
  if (hasCoordChanged(base.rotation ?? 0, preview.rotation ?? 0)) {
    patch.rotation = preview.rotation;
  }
  const basePoints = Array.isArray(base.points) ? base.points : undefined;
  const previewPoints = Array.isArray(preview.points) ? preview.points : undefined;
  if (!arePointsEqual(basePoints, previewPoints)) {
    patch.points = previewPoints;
  }
  const baseMetaSignature = toStableSignature(base.meta ?? null);
  const previewMetaSignature = toStableSignature(preview.meta ?? null);
  if (baseMetaSignature !== previewMetaSignature) {
    const previewMeta =
      preview.meta && typeof preview.meta === "object" && !Array.isArray(preview.meta)
        ? (preview.meta as Record<string, unknown>)
        : null;
    const baseMeta =
      base.meta && typeof base.meta === "object" && !Array.isArray(base.meta)
        ? (base.meta as Record<string, unknown>)
        : null;

    // For 3D objects stream only live camera/view deltas; full 3D state is committed on finalize.
    if (preview.type === "solid3d" && previewMeta) {
      const previewView =
        previewMeta.view && typeof previewMeta.view === "object" && !Array.isArray(previewMeta.view)
          ? (previewMeta.view as Record<string, unknown>)
          : null;
      const baseView =
        baseMeta?.view && typeof baseMeta.view === "object" && !Array.isArray(baseMeta.view)
          ? (baseMeta.view as Record<string, unknown>)
          : null;
      if (toStableSignature(baseView ?? null) !== toStableSignature(previewView ?? null)) {
        patch.meta = { view: previewView ?? null };
      }
    } else if (previewMetaSignature.length <= REALTIME_META_PATCH_MAX_SIGNATURE) {
      patch.meta = preview.meta;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
};

const getPointObjectCenter = (object: WorkbookBoardObject) => ({
  x: object.x + object.width / 2,
  y: object.y + object.height / 2,
});

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
  const eraserPreviewFrameRef = useRef<number | null>(null);
  const [eraserPreviewStrokeFragments, setEraserPreviewStrokeFragments] = useState<
    Record<string, WorkbookPoint[][]>
  >({});
  const [eraserPreviewObjectCuts, setEraserPreviewObjectCuts] = useState<
    Record<string, ObjectEraserCut[]>
  >({});
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft | null>(null);
  const [polygonPointDraft, setPolygonPointDraft] = useState<WorkbookPoint[]>([]);
  const [polygonHoverPoint, setPolygonHoverPoint] = useState<WorkbookPoint | null>(null);
  const [moving, setMoving] = useState<MovingState | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [graphPan, setGraphPan] = useState<GraphPanState | null>(null);
  const [solid3dGesture, setSolid3dGesture] = useState<Solid3dGestureState | null>(null);
  const [solid3dResize, setSolid3dResize] = useState<Solid3dResizeState | null>(null);
  const [areaSelectionDraft, setAreaSelectionDraft] = useState<AreaSelectionDraft | null>(null);
  const [areaSelectionResize, setAreaSelectionResize] =
    useState<AreaSelectionResizeState | null>(null);
  const [erasing, setErasing] = useState(false);
  const [eraserCursorPoint, setEraserCursorPoint] = useState<WorkbookPoint | null>(null);
  const erasedStrokeIdsRef = useRef<Set<string>>(new Set());
  const eraserObjectCutsRef = useRef<Map<string, ObjectEraserCut[]>>(new Map());
  const eraserTouchedObjectIdsRef = useRef<Set<string>>(new Set());
  const [inlineTextEdit, setInlineTextEdit] = useState<{
    objectId: string;
    value: string;
  } | null>(null);
  const inlineTextEditInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [solid3dPreviewMetaById, setSolid3dPreviewMetaById] = useState<
    Record<string, Record<string, unknown>>
  >({});
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
    });
  }, []);

  const clearEraserPreviewRuntime = useCallback(() => {
    eraserStrokeFragmentsRef.current.clear();
    eraserObjectCutsRef.current.clear();
    eraserTouchedObjectIdsRef.current.clear();
    if (eraserPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(eraserPreviewFrameRef.current);
      eraserPreviewFrameRef.current = null;
    }
    setEraserPreviewStrokeFragments({});
    setEraserPreviewObjectCuts({});
  }, []);

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
  const renderedStrokes = useMemo(() => {
    return allStrokes.flatMap((stroke) => {
      const key = `${stroke.layer}:${stroke.id}`;
      const previewFragments = erasing ? eraserPreviewStrokeFragments[key] : undefined;
      if (!previewFragments) return [stroke];
      return previewFragments.map((points, index) => ({
        ...stroke,
        id: `${stroke.id}::preview-${index}`,
        points,
      }));
    });
  }, [allStrokes, eraserPreviewStrokeFragments, erasing]);

  const getObjectSceneLayerId = useCallback((object: WorkbookBoardObject) => {
    const layerId =
      object.meta && typeof object.meta === "object" && typeof object.meta.sceneLayerId === "string"
        ? object.meta.sceneLayerId
        : "";
    return layerId.trim() || "main";
  }, []);

  const startInlineTextEdit = useCallback(
    (objectId: string) => {
      const target = boardObjects.find(
        (item): item is WorkbookBoardObject & { type: "text" } =>
          item.id === objectId && item.type === "text"
      );
      if (!target) return;
      onSelectedConstraintChange(null);
      onSelectedObjectChange(objectId);
      setInlineTextEdit({
        objectId,
        value: typeof target.text === "string" ? target.text : "",
      });
    },
    [boardObjects, onSelectedConstraintChange, onSelectedObjectChange]
  );

  const commitInlineTextEdit = useCallback(() => {
    if (!inlineTextEdit) return;
    const target = boardObjects.find((item) => item.id === inlineTextEdit.objectId);
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
  }, [boardObjects, inlineTextEdit, onObjectUpdate]);

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
      const group = boardObjects.filter(
        (item) => !item.pinned && getObjectSceneLayerId(item) === layerId
      );
      return group.length > 0 ? group : [object];
    },
    [boardObjects, getObjectSceneLayerId]
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

  const applyGraphPanToFunctions = useCallback(
    (
      functions: GraphFunctionDraft[],
      deltaX: number,
      deltaY: number,
      pxPerUnit: number,
      targetFunctionId: string | null = null
    ): GraphFunctionDraft[] => {
      if (functions.length === 0 || pxPerUnit <= 0) return functions;
      const offsetXShift = deltaX / pxPerUnit;
      const offsetYShift = -deltaY / pxPerUnit;
      return functions.map((entry) =>
        targetFunctionId && entry.id !== targetFunctionId
          ? entry
          : {
              ...entry,
              offsetX: clampGraphOffsetValue((entry.offsetX ?? 0) + offsetXShift),
              offsetY: clampGraphOffsetValue((entry.offsetY ?? 0) + offsetYShift),
            }
      );
    },
    []
  );

  const resolveFunctionGraphScale = useCallback(
    (object: WorkbookBoardObject) => {
      const autoStep = getAutoGraphGridStep({
        width: Math.max(1, Math.abs(object.width)),
        height: Math.max(1, Math.abs(object.height)),
      });
      const step = Math.max(
        12,
        Math.min(
          64,
          Math.round(Number.isFinite(gridSize) && gridSize > 0 ? gridSize : autoStep)
        )
      );
      return {
        pxPerUnit: Math.max(0.0001, step),
      };
    },
    [gridSize]
  );

  const distancePointToSegment = useCallback(
    (point: WorkbookPoint, start: WorkbookPoint, end: WorkbookPoint) => {
      const vx = end.x - start.x;
      const vy = end.y - start.y;
      const lengthSq = vx * vx + vy * vy;
      if (lengthSq <= 1e-6) {
        return Math.hypot(point.x - start.x, point.y - start.y);
      }
      const px = point.x - start.x;
      const py = point.y - start.y;
      const rawT = (px * vx + py * vy) / lengthSq;
      const t = Math.max(0, Math.min(1, rawT));
      const closestX = start.x + vx * t;
      const closestY = start.y + vy * t;
      return Math.hypot(point.x - closestX, point.y - closestY);
    },
    []
  );

  const resolveGraphFunctionHit = useCallback(
    (object: WorkbookBoardObject, point: WorkbookPoint) => {
      if (object.type !== "function_graph") return null;
      const rawFunctions = Array.isArray(object.meta?.functions)
        ? (object.meta.functions as GraphFunctionDraft[])
        : [];
      const functions = sanitizeFunctionGraphDrafts(rawFunctions, {
        ensureNonEmpty: false,
      }).filter((entry) => entry.visible !== false);
      if (functions.length === 0) return null;
      const { pxPerUnit } = resolveFunctionGraphScale(object);
      const plots = buildFunctionGraphPlots(
        functions,
        {
          x: object.x,
          y: object.y,
          width: object.width,
          height: object.height,
        },
        pxPerUnit
      );
      let bestMatch: { id: string; distance: number } | null = null;
      plots.forEach((plot) => {
        plot.segments.forEach((segment) => {
          for (let index = 0; index < segment.length - 1; index += 1) {
            const current = segment[index];
            const next = segment[index + 1];
            const distance = distancePointToSegment(point, current, next);
            const threshold = Math.max(5.5, Math.min(9.5, plot.width * 2.2));
            if (distance > threshold) continue;
            if (!bestMatch || distance < bestMatch.distance) {
              bestMatch = {
                id: plot.id,
                distance,
              };
            }
          }
        });
      });
      return (bestMatch as { id: string; distance: number } | null)?.id ?? null;
    },
    [distancePointToSegment, resolveFunctionGraphScale]
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
    (object: WorkbookBoardObject, point: WorkbookPoint) => {
      if (object.type !== "rectangle" && object.type !== "triangle" && object.type !== "polygon") {
        return null;
      }
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const vertices = resolve2dFigureVertices(object, rect);
      if (vertices.length === 0) return null;
      const nearest = vertices.reduce(
        (acc, vertex, index) => {
          const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
          if (distance < acc.distance) {
            return { index, distance };
          }
          return acc;
        },
        { index: -1, distance: Number.POSITIVE_INFINITY }
      );
      return nearest.index >= 0 && nearest.distance <= 11 ? nearest.index : null;
    },
    []
  );

  const resolveLineEndpointAtPointer = useCallback(
    (object: WorkbookBoardObject, point: WorkbookPoint) => {
      if (object.type !== "line" && object.type !== "arrow") return null;
      if (object.meta?.lineKind !== "segment") return null;
      const start = { x: object.x, y: object.y };
      const end = { x: object.x + object.width, y: object.y + object.height };
      const startDistance = Math.hypot(point.x - start.x, point.y - start.y);
      const endDistance = Math.hypot(point.x - end.x, point.y - end.y);
      if (startDistance <= 10 || endDistance <= 10) {
        return startDistance <= endDistance ? "start" : "end";
      }
      return null;
    },
    []
  );

  const isObjectHit = useCallback((object: WorkbookBoardObject, point: WorkbookPoint) => {
    if (object.type === "point") {
      const center = getPointObjectCenter(object);
      const radius = Math.max(6, Math.min(14, Math.abs(object.width) * 0.8));
      return Math.hypot(center.x - point.x, center.y - point.y) <= radius;
    }
    if (object.type === "solid3d") {
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const center = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
      const localPoint =
        object.rotation && Number.isFinite(object.rotation)
          ? rotatePointAround(point, center, -(object.rotation ?? 0))
          : point;
      const presetIdRaw =
        typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
      const presetId = resolveSolid3dPresetId(presetIdRaw);
      const mesh = getSolid3dMesh(
        presetId,
        Math.max(1, Math.abs(object.width)),
        Math.max(1, Math.abs(object.height))
      );
      if (!mesh) {
        return isInsideRect(localPoint, rect);
      }
      const solidState = readSolid3dState(object.meta);
      const projected = projectSolidVerticesForObject({
        mesh,
        view: solidState.view,
        objectRect: rect,
      });
      if (!projected.length) {
        return isInsideRect(localPoint, rect);
      }
      const projectedPoints = projected.map((vertex) => ({ x: vertex.x, y: vertex.y }));
      const projectedBounds = getPointsBoundsFromPoints(projectedPoints);
      const expandedBounds: Rect = {
        x: projectedBounds.minX - 8,
        y: projectedBounds.minY - 8,
        width: projectedBounds.width + 16,
        height: projectedBounds.height + 16,
      };
      if (!isInsideRect(localPoint, expandedBounds)) {
        return false;
      }
      const edgeThreshold = Math.max(6, (object.strokeWidth ?? 2) + 4);
      for (const face of mesh.faces) {
        const polygon = face
          .map((vertexIndex) => projected[vertexIndex])
          .filter(Boolean)
          .map((vertex) => ({ x: vertex.x, y: vertex.y }));
        if (polygon.length < 2) continue;
        if (polygon.length >= 3 && pointInPolygon(localPoint, polygon)) return true;
        if (distanceToPolyline(localPoint, polygon, true) <= edgeThreshold) return true;
      }
      return isInsideRect(localPoint, rect);
    }
    if (object.type === "section_divider") {
      const y = object.y + object.height / 2;
      const left = Math.min(object.x, object.x + object.width);
      const right = Math.max(object.x, object.x + object.width);
      const threshold = Math.max(6, (object.strokeWidth ?? 2) + 4);
      return point.x >= left - 8 && point.x <= right + 8 && Math.abs(point.y - y) <= threshold;
    }
    if (object.type === "line" || object.type === "arrow") {
      const controls = getLineControlPoints(object);
      const threshold = Math.max(7, (object.strokeWidth ?? 2) + 5);
      const distance = distanceToCubicBezier(
        point,
        controls.start,
        controls.c1,
        controls.c2,
        controls.end
      );
      return distance <= threshold;
    }
    if (object.type === "rectangle" || object.type === "triangle" || object.type === "polygon") {
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const vertices = resolve2dFigureVertices(object, rect);
      if (vertices.length < 2) return isInsideRect(point, rect);
      const closed = is2dFigureClosed(object);
      const edgeDistance = distanceToPolyline(point, vertices, closed);
      if (edgeDistance <= Math.max(6, (object.strokeWidth ?? 2) + 4)) {
        return true;
      }
      if (closed && pointInPolygon(point, vertices)) return true;
      return false;
    }
    const rect = getObjectRect(object);
    if (object.rotation && Number.isFinite(object.rotation)) {
      const center = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
      const localPoint = rotatePointAround(point, center, -(object.rotation ?? 0));
      return isInsideRect(localPoint, rect);
    }
    return isInsideRect(point, rect);
  }, []);

  const resolveTopObject = useCallback(
    (point: WorkbookPoint) => {
      for (let index = boardObjects.length - 1; index >= 0; index -= 1) {
        const object = boardObjects[index];
        if (object.locked) continue;
        if (isObjectHit(object, point)) {
          return object;
        }
      }
      return null;
    },
    [boardObjects, isObjectHit]
  );

  const resolveTopStroke = useCallback(
    (point: WorkbookPoint) => {
      for (let index = allStrokes.length - 1; index >= 0; index -= 1) {
        const stroke = allStrokes[index];
        if (!stroke.points.length) continue;
        const distance =
          stroke.points.length === 1
            ? Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y)
            : distanceToPolyline(point, stroke.points, false);
        const threshold = Math.max(
          6,
          (stroke.width ?? 2) / 2 + (stroke.tool === "highlighter" ? 6 : 4)
        );
        if (distance <= threshold) {
          return stroke;
        }
      }
      return null;
    },
    [allStrokes]
  );

  const isStrokeErasedByCircle = useCallback(
    (stroke: WorkbookStroke, center: WorkbookPoint, radius: number) => {
      if (!stroke.points.length) return false;
      const strokeRect = getStrokeRect(stroke);
      if (strokeRect && !circleIntersectsRect(center, radius, strokeRect)) {
        return false;
      }
      const threshold = Math.max(2, radius + (stroke.width ?? 2) / 2);
      if (stroke.points.length === 1) {
        return Math.hypot(center.x - stroke.points[0].x, center.y - stroke.points[0].y) <= threshold;
      }
      for (let index = 0; index < stroke.points.length - 1; index += 1) {
        if (distanceToSegment(center, stroke.points[index], stroke.points[index + 1]) <= threshold) {
          return true;
        }
      }
      return false;
    },
    []
  );

  const isObjectErasedByCircle = useCallback(
    (object: WorkbookBoardObject, center: WorkbookPoint, radius: number) => {
      const isNonErasableSolidDomain =
        object.type === "solid3d" ||
        object.type === "section3d" ||
        object.type === "net3d" ||
        (typeof object.meta?.parentSolidId === "string" && object.meta.parentSolidId.trim().length > 0);
      if (isNonErasableSolidDomain) return false;
      if (object.pinned || object.locked) return false;
      const objectRect = getObjectRect(object);
      if (!circleIntersectsRect(center, radius, objectRect)) return false;
      if (isObjectHit(object, center)) return true;
      const sampleCount = 16;
      for (let index = 0; index < sampleCount; index += 1) {
        const angle = (Math.PI * 2 * index) / sampleCount;
        const perimeterPoint = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
        if (isObjectHit(object, perimeterPoint)) {
          return true;
        }
      }
      return false;
    },
    [isObjectHit]
  );

  const eraseAtPoint = useCallback(
    (center: WorkbookPoint) => {
      const radius = Math.max(4, width);
      allStrokes.forEach((stroke) => {
        const key = `${stroke.layer}:${stroke.id}`;
        const currentFragments = eraserStrokeFragmentsRef.current.get(key) ?? [stroke.points];
        if (currentFragments.length === 0) return;
        const nextFragments = currentFragments.reduce<WorkbookPoint[][]>((acc, fragment) => {
          const fragmentStroke: WorkbookStroke = {
            ...stroke,
            points: fragment,
          };
          if (!isStrokeErasedByCircle(fragmentStroke, center, radius)) {
            acc.push(fragment);
            return acc;
          }
          const splitFragments = splitStrokeByCircle(fragmentStroke, center, radius);
          if (areStrokeFragmentsEquivalent(fragmentStroke, splitFragments)) {
            acc.push(fragment);
            return acc;
          }
          acc.push(...splitFragments);
          return acc;
        }, []);
        if (areFragmentCollectionsEquivalent(currentFragments, nextFragments)) return;
        erasedStrokeIdsRef.current.add(key);
        eraserStrokeFragmentsRef.current.set(key, nextFragments);
      });
      boardObjects.forEach((object) => {
        if (!isObjectErasedByCircle(object, center, radius)) return;
        const cachedCuts =
          eraserObjectCutsRef.current.get(object.id) ?? sanitizeObjectEraserCuts(object);
        const nextCuts = [...cachedCuts, normalizeObjectEraserCut(object, center, radius)].slice(
          -MAX_OBJECT_ERASER_CUTS
        );
        eraserObjectCutsRef.current.set(object.id, nextCuts);
        eraserTouchedObjectIdsRef.current.add(object.id);
      });
      scheduleEraserPreviewRender();
    },
    [
      allStrokes,
      boardObjects,
      scheduleEraserPreviewRender,
      isObjectErasedByCircle,
      isStrokeErasedByCircle,
      width,
    ]
  );

  const commitEraserGesture = useCallback(() => {
    erasedStrokeIdsRef.current.forEach((key) => {
      const [targetLayer, strokeId] = key.split(":");
      if (!strokeId) return;
      const sourceStroke =
        allStrokes.find((stroke) => `${stroke.layer}:${stroke.id}` === key) ?? null;
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
      const cuts = eraserObjectCutsRef.current.get(objectId);
      if (!cuts || cuts.length === 0) return;
      onObjectUpdate(
        objectId,
        {
          meta: {
            eraserCuts: cuts,
          },
        },
        {
          trackHistory: true,
          markDirty: true,
        }
      );
    });
  }, [allStrokes, onObjectUpdate, onStrokeDelete, onStrokeReplace]);

  const resolveSolid3dPointAtPointer = useCallback(
    (object: WorkbookBoardObject, point: WorkbookPoint): SolidSurfacePick | null => {
      if (object.type !== "solid3d") return null;
      const presetIdRaw =
        typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
      const presetId = resolveSolid3dPresetId(presetIdRaw);
      const mesh = getSolid3dMesh(
        presetId,
        Math.max(1, Math.abs(object.width)),
        Math.max(1, Math.abs(object.height))
      );
      if (!mesh) return null;
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const solidState = readSolid3dState(object.meta);
      const localPoint =
        object.rotation && Number.isFinite(object.rotation)
          ? rotatePointAround(
              point,
              { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
              -(object.rotation ?? 0)
            )
          : point;

      const projectedVertices = projectSolidVerticesForObject({
        mesh,
        view: solidState.view,
        objectRect: rect,
      });
      const nearestVertex = projectedVertices.reduce(
        (acc, vertex) => {
          const distance = Math.hypot(vertex.x - localPoint.x, vertex.y - localPoint.y);
          if (distance < acc.distance) {
            return { index: vertex.index, distance };
          }
          return acc;
        },
        { index: -1, distance: Number.POSITIVE_INFINITY }
      );
      if (nearestVertex.index >= 0 && nearestVertex.distance <= 20) {
        const faceIndex = mesh.faces.findIndex((face) => face.includes(nearestVertex.index));
        return {
          point: mesh.vertices[nearestVertex.index],
          faceIndex: faceIndex >= 0 ? faceIndex : 0,
          depth: projectedVertices[nearestVertex.index]?.depth ?? 0,
          triangleVertexIndices: [
            nearestVertex.index,
            nearestVertex.index,
            nearestVertex.index,
          ],
          barycentric: [1, 0, 0],
        };
      }

      return pickSolidPointOnSurface({
        mesh,
        view: solidState.view,
        objectRect: rect,
        point: localPoint,
      });
    },
    []
  );

  const resolveSolid3dResizeHandles = useCallback((object: WorkbookBoardObject) => {
    if (object.type !== "solid3d") return [] as Solid3dResizeHandle[];
    const presetIdRaw =
      typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
    const presetId = resolveSolid3dPresetId(presetIdRaw);
    const mesh = getSolid3dMesh(
      presetId,
      Math.max(1, Math.abs(object.width)),
      Math.max(1, Math.abs(object.height))
    );
    if (!mesh) return [] as Solid3dResizeHandle[];
    const rect = normalizeRect(
      { x: object.x, y: object.y },
      { x: object.x + object.width, y: object.y + object.height }
    );
    const solidState = readSolid3dState(object.meta);
    const projected = projectSolidVerticesForObject({
      mesh,
      view: solidState.view,
      objectRect: rect,
    }).map((vertex) => ({ x: vertex.x, y: vertex.y }));
    if (!projected.length) return [] as Solid3dResizeHandle[];
    const bounds = getPointsBoundsFromPoints(projected);
    const left = bounds.minX;
    const right = bounds.maxX;
    const top = bounds.minY;
    const bottom = bounds.maxY;
    const padding = 12;
    const handles: Solid3dResizeHandle[] = [
      { mode: "nw", x: left - padding, y: top - padding },
      { mode: "ne", x: right + padding, y: top - padding },
      { mode: "se", x: right + padding, y: bottom + padding },
      { mode: "sw", x: left - padding, y: bottom + padding },
    ];
    return handles;
  }, []);

  const computeSolid3dResizePatch = useCallback((state: Solid3dResizeState) => {
    const minSize = 24;
    const rect = normalizeRect(
      { x: state.object.x, y: state.object.y },
      { x: state.object.x + state.object.width, y: state.object.y + state.object.height }
    );
    let left = rect.x;
    let right = rect.x + rect.width;
    let top = rect.y;
    let bottom = rect.y + rect.height;
    if (state.mode.includes("w")) {
      left = Math.min(state.current.x, right - minSize);
    }
    if (state.mode.includes("e")) {
      right = Math.max(state.current.x, left + minSize);
    }
    if (state.mode.includes("n")) {
      top = Math.min(state.current.y, bottom - minSize);
    }
    if (state.mode.includes("s")) {
      bottom = Math.max(state.current.y, top + minSize);
    }
    const nextRect = normalizeRect({ x: left, y: top }, { x: right, y: bottom });
    return {
      x: nextRect.x,
      y: nextRect.y,
      width: nextRect.width,
      height: nextRect.height,
    };
  }, []);

  const resolveSolid3dPickMarkersForObject = useCallback(
    (sourceObject: WorkbookBoardObject, selectedPoints: Solid3dSectionPoint[]) => {
      if (sourceObject.type !== "solid3d") {
        return [] as Array<{ index: number; x: number; y: number; label: string }>;
      }
      const object =
        solid3dPreviewMetaById[sourceObject.id] && sourceObject.type === "solid3d"
          ? { ...sourceObject, meta: solid3dPreviewMetaById[sourceObject.id] }
          : sourceObject;
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const presetIdRaw =
        typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
      const presetId = resolveSolid3dPresetId(presetIdRaw);
      const mesh = getSolid3dMesh(
        presetId,
        Math.max(1, Math.abs(object.width)),
        Math.max(1, Math.abs(object.height))
      );
      const solidState = readSolid3dState(object.meta);
      return selectedPoints.map((point3d, index) => {
        const worldPoint =
          mesh && point3d
            ? resolveSectionPointForMesh(point3d, mesh)
            : { x: point3d.x, y: point3d.y, z: point3d.z };
        const projected = projectSolidPointForObject({
          point: worldPoint,
          view: solidState.view,
          objectRect: rect,
        });
        const point = { x: projected.x, y: projected.y };
        return {
          index,
          x: point.x,
          y: point.y,
          label: point3d.label || `P${index + 1}`,
        };
      });
    },
    [solid3dPreviewMetaById]
  );

  const resolveSolid3dVertexAtPointer = useCallback(
    (sourceObject: WorkbookBoardObject, point: WorkbookPoint) => {
      if (sourceObject.type !== "solid3d") return null;
      const object =
        solid3dPreviewMetaById[sourceObject.id] && sourceObject.type === "solid3d"
          ? { ...sourceObject, meta: solid3dPreviewMetaById[sourceObject.id] }
          : sourceObject;
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const presetIdRaw =
        typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
      const presetId = resolveSolid3dPresetId(presetIdRaw);
      const mesh = getSolid3dMesh(
        presetId,
        Math.max(1, Math.abs(object.width)),
        Math.max(1, Math.abs(object.height))
      );
      if (!mesh) return null;
      const solidState = readSolid3dState(object.meta);
      const projected = projectSolidVerticesForObject({
        mesh,
        view: solidState.view,
        objectRect: rect,
      });
      const nearest = projected.reduce(
        (acc, vertex) => {
          const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
          if (distance < acc.distance) {
            return { index: vertex.index, distance };
          }
          return acc;
        },
        { index: -1, distance: Number.POSITIVE_INFINITY }
      );
      if (nearest.index < 0 || nearest.distance > 12) return null;
      return nearest.index;
    },
    [solid3dPreviewMetaById]
  );

  const resolveSolid3dSectionVertexAtPointer = useCallback(
    (sourceObject: WorkbookBoardObject, point: WorkbookPoint) => {
      if (sourceObject.type !== "solid3d") return null;
      const object =
        solid3dPreviewMetaById[sourceObject.id] && sourceObject.type === "solid3d"
          ? { ...sourceObject, meta: solid3dPreviewMetaById[sourceObject.id] }
          : sourceObject;
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const presetIdRaw =
        typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
      const presetId = resolveSolid3dPresetId(presetIdRaw);
      if (ROUND_SOLID_PRESETS.has(presetId)) return null;
      const mesh = getSolid3dMesh(
        presetId,
        Math.max(1, Math.abs(object.width)),
        Math.max(1, Math.abs(object.height))
      );
      if (!mesh) return null;
      const solidState = readSolid3dState(object.meta);
      const view = solidState.view;
      let bestMatch: { sectionId: string; vertexIndex: number; distance: number } | null = null;
      for (const section of solidState.sections) {
        if (!section.visible) continue;
        const polygon3d = computeSectionPolygon(mesh, section).polygon;
        if (polygon3d.length < 3) continue;
        for (let vertexIndex = 0; vertexIndex < polygon3d.length; vertexIndex += 1) {
          const vertex = polygon3d[vertexIndex];
          const projected = projectSolidPointForObject({
            point: vertex,
            view,
            objectRect: rect,
          });
          const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
          if (distance > 11) continue;
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = {
              sectionId: section.id,
              vertexIndex,
              distance,
            };
          }
        }
      }
      const match: { sectionId: string; vertexIndex: number; distance: number } | null =
        bestMatch;
      if (!match) return null;
      return {
        sectionId: match.sectionId,
        vertexIndex: match.vertexIndex,
      };
    },
    [solid3dPreviewMetaById]
  );

  const resolveSolid3dSectionAtPointer = useCallback(
    (sourceObject: WorkbookBoardObject, point: WorkbookPoint) => {
      if (sourceObject.type !== "solid3d") return null;
      const object =
        solid3dPreviewMetaById[sourceObject.id] && sourceObject.type === "solid3d"
          ? { ...sourceObject, meta: solid3dPreviewMetaById[sourceObject.id] }
          : sourceObject;
      const rect = normalizeRect(
        { x: object.x, y: object.y },
        { x: object.x + object.width, y: object.y + object.height }
      );
      const presetIdRaw =
        typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
      const presetId = resolveSolid3dPresetId(presetIdRaw);
      const mesh = getSolid3dMesh(
        presetId,
        Math.max(1, Math.abs(object.width)),
        Math.max(1, Math.abs(object.height))
      );
      if (!mesh) return null;
      const solidState = readSolid3dState(object.meta);
      const view = solidState.view;
      let bestSectionId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      solidState.sections.forEach((section) => {
        if (!section.visible) return;
        const polygon3d = computeSectionPolygon(mesh, section).polygon;
        if (polygon3d.length < 2) return;
        const polygon2d = polygon3d.map((p3d) =>
          projectSolidPointForObject({
            point: p3d,
            view,
            objectRect: rect,
          })
        );
        let distance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < polygon2d.length; index += 1) {
          const a = polygon2d[index];
          const b = polygon2d[(index + 1) % polygon2d.length];
          const edgeDistance = distanceToSegment(point, a, b);
          if (edgeDistance < distance) distance = edgeDistance;
        }
        if (polygon2d.length >= 3 && pointInPolygon(point, polygon2d)) {
          distance = 0;
        }
        if (distance <= 12 && distance < bestDistance) {
          bestDistance = distance;
          bestSectionId = section.id;
        }
      });
      return bestSectionId;
    },
    [solid3dPreviewMetaById]
  );

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
    setMoving({
      object,
      groupObjects,
      start,
      current: start,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
    svg.setPointerCapture(event.pointerId);
  };

  const resolveResizeMode = (object: WorkbookBoardObject, point: WorkbookPoint) => {
    if (object.type === "section_divider") {
      return null;
    }
    if (object.type === "point") {
      return null;
    }
    if (object.type === "line" || object.type === "arrow") {
      const rect = getObjectRect(object);
      const startDistance = Math.hypot(point.x - object.x, point.y - object.y);
      if (startDistance <= 8) return "line-start" as const;
      const endDistance = Math.hypot(
        point.x - (object.x + object.width),
        point.y - (object.y + object.height)
      );
      if (endDistance <= 8) return "line-end" as const;
      const corners = [
        { mode: "nw" as const, x: rect.x, y: rect.y },
        { mode: "ne" as const, x: rect.x + rect.width, y: rect.y },
        { mode: "se" as const, x: rect.x + rect.width, y: rect.y + rect.height },
        { mode: "sw" as const, x: rect.x, y: rect.y + rect.height },
      ];
      const corner = corners.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 8);
      if (corner) return corner.mode;
      const rotateX = rect.x + rect.width / 2;
      const rotateY = rect.y - 18;
      if (Math.hypot(point.x - rotateX, point.y - rotateY) <= 8) {
        return "rotate" as const;
      }
      const controls = getLineControlPoints(object);
      if (Math.hypot(point.x - controls.c1.x, point.y - controls.c1.y) <= 8) {
        return "line-curve-c1" as const;
      }
      if (Math.hypot(point.x - controls.c2.x, point.y - controls.c2.y) <= 8) {
        return "line-curve-c2" as const;
      }
      return null;
    }
    const rect = normalizeRect(
      { x: object.x, y: object.y },
      { x: object.x + object.width, y: object.y + object.height }
    );
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    const localPoint =
      object.rotation && Number.isFinite(object.rotation)
        ? rotatePointAround(point, center, -(object.rotation ?? 0))
        : point;
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    const cx = left + rect.width / 2;
    const hit = 8;
    const rotateHandle = { x: cx, y: top - 18 };
    if (Math.hypot(localPoint.x - rotateHandle.x, localPoint.y - rotateHandle.y) <= hit) {
      return "rotate" as const;
    }
    if (Math.abs(localPoint.x - left) <= hit && Math.abs(localPoint.y - top) <= hit) {
      return "nw" as const;
    }
    if (Math.abs(localPoint.x - right) <= hit && Math.abs(localPoint.y - top) <= hit) {
      return "ne" as const;
    }
    if (Math.abs(localPoint.x - right) <= hit && Math.abs(localPoint.y - bottom) <= hit) {
      return "se" as const;
    }
    if (Math.abs(localPoint.x - left) <= hit && Math.abs(localPoint.y - bottom) <= hit) {
      return "sw" as const;
    }
    if (Math.abs(localPoint.x - cx) <= hit && Math.abs(localPoint.y - top) <= hit) {
      return "n" as const;
    }
    if (Math.abs(localPoint.x - right) <= hit && Math.abs(localPoint.y - (top + bottom) / 2) <= hit) {
      return "e" as const;
    }
    if (Math.abs(localPoint.x - cx) <= hit && Math.abs(localPoint.y - bottom) <= hit) {
      return "s" as const;
    }
    if (Math.abs(localPoint.x - left) <= hit && Math.abs(localPoint.y - (top + bottom) / 2) <= hit) {
      return "w" as const;
    }
    return null;
  };

  const startResizing = (
    object: WorkbookBoardObject,
    mode: ResizeState["mode"],
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => {
    pointerIdRef.current = event.pointerId;
    const start = mapPointer(svg, event.clientX, event.clientY);
    setResizing({
      object,
      mode,
      start,
      current: start,
    });
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
    const state = readSolid3dState(object.meta);
    setSolid3dGesture({
      object,
      mode,
      start,
      baseRotationX: state.view.rotationX,
      baseRotationY: state.view.rotationY,
      basePanX: state.view.panX,
      basePanY: state.view.panY,
    });
    svg.setPointerCapture(event.pointerId);
  };

  const startGraphPan = (
    object: WorkbookBoardObject,
    targetFunctionId: string,
    start: WorkbookPoint,
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => {
    if (object.type !== "function_graph") return;
    pointerIdRef.current = event.pointerId;
    const rawFunctions = Array.isArray(object.meta?.functions)
      ? (object.meta.functions as GraphFunctionDraft[])
      : [];
    const initialFunctions = sanitizeFunctionGraphDrafts(rawFunctions, {
      ensureNonEmpty: false,
    });
    const { pxPerUnit } = resolveFunctionGraphScale(object);
    setGraphPan({
      object,
      targetFunctionId,
      start,
      current: start,
      initialFunctions,
      pxPerUnit,
    });
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
      setPanning({
        start: { x: event.clientX, y: event.clientY },
        baseOffset: viewportOffset,
      });
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
      setPanning({
        start: { x: event.clientX, y: event.clientY },
        baseOffset: viewportOffset,
      });
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
          boardObjects
            .filter((item) => !item.pinned && getObjectSceneLayerId(item) === layerId)
            .forEach((item) => onObjectDelete(item.id));
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
          setAreaSelectionResize({
            initialRect: areaSelection.rect,
            mode: resizeMode,
            current: point,
          });
          svg.setPointerCapture(event.pointerId);
          return;
        }
      }
      pointerIdRef.current = event.pointerId;
      onSelectedConstraintChange(null);
      onSelectedObjectChange(null);
      setAreaSelectionDraft({
        start: point,
        current: point,
      });
      svg.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "point") {
      onSelectedConstraintChange(null);
      const created: WorkbookBoardObject = {
        id: generateId(),
        type: "point",
        layer,
        x: point.x - 4,
        y: point.y - 4,
        width: 8,
        height: 8,
        color,
        fill: "#ffffff",
        strokeWidth: Math.max(1, width),
        opacity: 1,
        authorUserId,
        createdAt: new Date().toISOString(),
        meta: {
          label: "",
        },
      };
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
      const selected = selectedObjectId
        ? boardObjects.find((object) => object.id === selectedObjectId) ?? null
        : null;
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
          const resizeMode = resolveResizeMode(selected, point);
          if (resizeMode) {
            onAreaSelectionChange?.(null);
            startResizing(selected, resizeMode, event, svg);
            return;
          }
        }
      }
      if (
        areaSelection &&
        (areaSelection.objectIds.length > 0 || areaSelection.strokeIds.length > 0) &&
        isInsideRect(point, areaSelection.rect)
      ) {
        const groupedTargets = boardObjects.filter((object) =>
          areaSelection.objectIds.includes(object.id)
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
        setAreaSelectionDraft({
          start: point,
          current: point,
        });
        svg.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (tool === "eraser") {
      pointerIdRef.current = event.pointerId;
      clearEraserPreviewRuntime();
      erasedStrokeIdsRef.current.clear();
      setErasing(true);
      setEraserCursorPoint(point);
      eraseAtPoint(point);
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
      setEraserCursorPoint(hoverPoint);
    }

    if (tool === "polygon" && polygonMode === "points" && !panning && !forcePanMode) {
      setPolygonHoverPoint(mapPointer(svg, event.clientX, event.clientY, true));
      return;
    }
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    if (panning) {
      const dx = event.clientX - panning.start.x;
      const dy = event.clientY - panning.start.y;
      const nextOffset = {
        x: Math.max(0, panning.baseOffset.x - dx / safeZoom),
        y: Math.max(0, panning.baseOffset.y - dy / safeZoom),
      };
      onViewportOffsetChange?.(nextOffset);
      return;
    }
    if (graphPan) {
      const point = mapPointer(svg, event.clientX, event.clientY, false, false);
      setGraphPan((prev) => (prev ? { ...prev, current: point } : prev));
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
      const deltaX = point.x - solid3dGesture.start.x;
      const deltaY = point.y - solid3dGesture.start.y;
      const currentState = readSolid3dState(solid3dGesture.object.meta);
      const nextView =
        solid3dGesture.mode === "rotate"
          ? {
              ...currentState.view,
              rotationY: solid3dGesture.baseRotationY + deltaX * 0.38,
              rotationX: solid3dGesture.baseRotationX + deltaY * 0.32,
            }
          : {
              ...currentState.view,
              panX: solid3dGesture.basePanX + deltaX / 240,
              panY: solid3dGesture.basePanY + deltaY / 240,
            };
      setSolid3dPreviewMetaById((current) => ({
        ...current,
        [solid3dGesture.object.id]: writeSolid3dState(
          { ...currentState, view: nextView },
          solid3dGesture.object.meta
        ),
      }));
      return;
    }

    if (solid3dResize) {
      setSolid3dResize((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (areaSelectionResize) {
      setAreaSelectionResize((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (areaSelectionDraft) {
      setAreaSelectionDraft((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (erasing && tool === "eraser") {
      eraseAtPoint(point);
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
      const nextPoints: WorkbookPoint[] = [];
      sourceEvents.forEach((pointerEvent) => {
        const nextPoint = mapPointer(svg, pointerEvent.clientX, pointerEvent.clientY);
        const last =
          nextPoints.length > 0
            ? nextPoints[nextPoints.length - 1]
            : strokePointsRef.current[strokePointsRef.current.length - 1];
        if (!last || Math.hypot(nextPoint.x - last.x, nextPoint.y - last.y) >= 0.18) {
          nextPoints.push(nextPoint);
        }
      });
      enqueueStrokePoints(nextPoints);
      return;
    }

    if (shapeDraft) {
      setShapeDraft((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (resizing) {
      setResizing((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }

    if (moving) {
      const deltaX = (event.clientX - moving.startClientX) / safeZoom;
      const deltaY = (event.clientY - moving.startClientY) / safeZoom;
      setMoving((prev) =>
        prev
          ? {
              ...prev,
              current: {
                x: prev.start.x + deltaX,
                y: prev.start.y + deltaY,
              },
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

  const finishShape = () => {
    if (!shapeDraft) return;
    const rect = normalizeRect(shapeDraft.start, shapeDraft.current);
    const fromCenterRadius = Math.max(
      1,
      Math.hypot(shapeDraft.current.x - shapeDraft.start.x, shapeDraft.current.y - shapeDraft.start.y)
    );
    const compassRect =
      shapeDraft.tool === "compass"
        ? {
            x: shapeDraft.start.x - fromCenterRadius,
            y: shapeDraft.start.y - fromCenterRadius,
            width: fromCenterRadius * 2,
            height: fromCenterRadius * 2,
          }
        : rect;
    const objectType =
      shapeDraft.tool === "text"
        ? "text"
        : shapeDraft.tool === "formula"
          ? "formula"
          : shapeDraft.tool === "function_graph"
          ? "function_graph"
          : shapeDraft.tool === "solid3d"
            ? "solid3d"
            : shapeDraft.tool === "frame"
              ? "frame"
              : shapeDraft.tool === "divider"
                ? "section_divider"
              : shapeDraft.tool === "sticker"
                ? "sticker"
                : shapeDraft.tool === "comment"
                  ? "comment"
                  : shapeDraft.tool === "compass"
                    ? "ellipse"
                    : shapeDraft.tool;
    const polygonPoints =
      shapeDraft.tool === "polygon" && polygonMode === "regular"
        ? getWorkbookPolygonPoints(compassRect, polygonSides, polygonPreset)
        : undefined;
    const figureVertices =
      shapeDraft.tool === "rectangle"
        ? 4
        : shapeDraft.tool === "triangle"
          ? 3
          : shapeDraft.tool === "polygon"
            ? polygonPoints?.length ?? Math.max(3, Math.floor(polygonSides))
            : 0;
    const defaultFigureMeta =
      figureVertices > 0
        ? {
            vertexLabels: Array.from({ length: figureVertices }, (_, index) =>
              getFigureVertexLabel(index)
            ),
            showAngles: false,
            angleMarks: Array.from({ length: figureVertices }, () => ({
              valueText: "",
              color,
              style: "arc_single" as const,
            })),
          }
        : undefined;
    const isLineTool = shapeDraft.tool === "line" || shapeDraft.tool === "arrow";
    const lineDeltaX = shapeDraft.current.x - shapeDraft.start.x;
    const lineDeltaY = shapeDraft.current.y - shapeDraft.start.y;
    const hasLineLength = Math.hypot(lineDeltaX, lineDeltaY) > 0.25;
    const solid3dPresetId = resolveSolid3dPresetId(solid3dInsertPreset?.presetId ?? "cube");
    const solid3dPresetTitle =
      typeof solid3dInsertPreset?.presetTitle === "string" &&
      solid3dInsertPreset.presetTitle.trim().length > 0
        ? solid3dInsertPreset.presetTitle.trim()
        : null;
    const solid3dWidth = Math.max(140, compassRect.width);
    const solid3dHeight = Math.max(120, compassRect.height);
    const solid3dMesh =
      shapeDraft.tool === "solid3d"
        ? getSolid3dMesh(solid3dPresetId, solid3dWidth, solid3dHeight)
        : null;
    const initialSolid3dState =
      shapeDraft.tool === "solid3d"
        ? {
            ...DEFAULT_SOLID3D_STATE,
            vertexLabels: ROUND_SOLID_PRESETS.has(solid3dPresetId)
              ? getRoundSolidSemanticVertexDefaults(
                  solid3dPresetId,
                  solid3dMesh?.vertices.length ?? 0
                )
              : Array.from(
                  { length: solid3dMesh?.vertices.length ?? 0 },
                  (_, index) => getSolidVertexLabel(index)
                ),
          }
        : null;
    const created: WorkbookBoardObject = {
      id: generateId(),
      type: objectType,
      layer,
      x:
        shapeDraft.tool === "divider"
          ? 0
          : isLineTool
            ? shapeDraft.start.x
            : compassRect.x,
      y:
        shapeDraft.tool === "divider"
          ? Math.min(shapeDraft.start.y, shapeDraft.current.y)
          : isLineTool
            ? shapeDraft.start.y
            : compassRect.y,
      width:
        shapeDraft.tool === "divider"
          ? 10_000
          : isLineTool
            ? hasLineLength
              ? lineDeltaX
              : 1
            : shapeDraft.tool === "solid3d"
              ? solid3dWidth
            : shapeDraft.tool === "text"
              ? Math.max(140, compassRect.width)
              : compassRect.width,
      height:
        shapeDraft.tool === "divider"
          ? 2
          : isLineTool
            ? hasLineLength
              ? lineDeltaY
              : 0
            : shapeDraft.tool === "solid3d"
              ? solid3dHeight
            : shapeDraft.tool === "text"
              ? Math.max(48, compassRect.height)
              : compassRect.height,
      color,
      fill:
        shapeDraft.tool === "sticker"
          ? "rgba(255, 244, 163, 0.92)"
          : shapeDraft.tool === "comment"
            ? "rgba(226, 240, 255, 0.95)"
            : shapeDraft.tool === "frame"
              ? "rgba(77, 105, 255, 0.05)"
              : shapeDraft.tool === "divider"
                ? "transparent"
              : "transparent",
      strokeWidth: width,
      opacity: 1,
      authorUserId,
      createdAt: new Date().toISOString(),
      text:
        shapeDraft.tool === "text"
          ? (textPreset.trim() || "Текст")
          : shapeDraft.tool === "formula"
            ? (formulaLatex.trim() || formulaMathMl.trim() || "f(x)=...")
            : shapeDraft.tool === "sticker"
              ? (stickerText.trim() || "Стикер")
              : shapeDraft.tool === "comment"
                ? (commentText.trim() || "Комментарий")
          : undefined,
      fontSize: shapeDraft.tool === "text" ? Math.max(14, width * 5) : undefined,
      sides: shapeDraft.tool === "polygon" ? polygonSides : undefined,
      points: polygonPoints,
      meta:
        shapeDraft.tool === "text"
          ? {
              textColor: color,
              textBackground: "transparent",
              textBold: false,
              textItalic: false,
              textUnderline: false,
              textAlign: "left",
              textFontFamily: "\"Fira Sans\", \"Segoe UI\", sans-serif",
            }
          : shapeDraft.tool === "formula"
          ? {
              latex: formulaLatex.trim(),
              mathml: formulaMathMl.trim(),
            }
          : shapeDraft.tool === "function_graph"
            ? {
                functions: graphFunctions,
                axisColor: "#ff8e3c",
                planeColor: "transparent",
              }
            : shapeDraft.tool === "line" || shapeDraft.tool === "arrow"
              ? {
                  lineKind: "line",
                  lineStyle,
                  arrowEnd: shapeDraft.tool === "arrow",
                  curve: {
                    c1t: 1 / 3,
                    c1n: 0,
                    c2t: 2 / 3,
                    c2n: 0,
                  },
                  startLabel: "",
                  endLabel: "",
                }
                : shapeDraft.tool === "polygon"
                  ? {
                      polygonMode,
                      polygonPreset,
                      ...(resolvePolygonFigureKind(polygonSides, polygonPreset)
                        ? {
                            figureKind: resolvePolygonFigureKind(
                              polygonSides,
                              polygonPreset
                            ),
                          }
                        : {}),
                      ...(defaultFigureMeta ?? {}),
                    }
                : shapeDraft.tool === "rectangle" || shapeDraft.tool === "triangle"
                  ? defaultFigureMeta
                : shapeDraft.tool === "frame"
                  ? {
                      title: textPreset.trim() || "Фрейм",
                    }
                : shapeDraft.tool === "solid3d"
                  ? {
                      presetId: solid3dPresetId,
                      presetTitle: solid3dPresetTitle,
                      ...writeSolid3dState(
                        initialSolid3dState ?? DEFAULT_SOLID3D_STATE,
                        undefined
                      ),
                    }
                : shapeDraft.tool === "divider"
                    ? { dividerType: "manual", lineStyle: "dashed" }
                : undefined,
    };
    onObjectCreate(created);
    onSelectedObjectChange(created.id);
    if (shapeDraft.tool === "text") {
      setInlineTextEdit({
        objectId: created.id,
        value: typeof created.text === "string" ? created.text : "",
      });
    }
    if (shapeDraft.tool === "solid3d") {
      onSolid3dInsertConsumed?.();
      onRequestSelectTool?.();
    }
    setShapeDraft(null);
  };

  const finishMoving = () => {
    if (!moving) return;
    const deltaX = moving.current.x - moving.start.x;
    const deltaY = moving.current.y - moving.start.y;
    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
      const targets = moving.groupObjects.length > 0 ? moving.groupObjects : [moving.object];
      targets.forEach((target) => {
        const patch: Partial<WorkbookBoardObject> = {
          x: target.type === "section_divider" ? target.x : target.x + deltaX,
          y: target.y + deltaY,
        };
        if (Array.isArray(target.points) && target.points.length > 0) {
          patch.points = target.points.map((point) => ({
            x: point.x + deltaX,
            y: point.y + deltaY,
          }));
        }
        onObjectUpdate(target.id, patch);
      });
      if (moving.object.id === "__area-selection__" && areaSelection) {
        onAreaSelectionChange?.({
          objectIds: targets.map((target) => target.id),
          strokeIds: areaSelection.strokeIds,
          rect: {
            x: areaSelection.rect.x + deltaX,
            y: areaSelection.rect.y + deltaY,
            width: areaSelection.rect.width,
            height: areaSelection.rect.height,
          },
        });
      }
    }
    setMoving(null);
  };

  const finishResizing = () => {
    if (!resizing) return;
    const object = resizing.object;
    const deltaX = resizing.current.x - resizing.start.x;
    const deltaY = resizing.current.y - resizing.start.y;
    if (resizing.mode === "line-start") {
      const nextX = object.x + deltaX;
      const nextY = object.y + deltaY;
      const nextWidth = object.width - deltaX;
      const nextHeight = object.height - deltaY;
      if (Math.hypot(nextWidth, nextHeight) < 1) {
        setResizing(null);
        return;
      }
      onObjectUpdate(object.id, {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      });
      setResizing(null);
      return;
    }
    if (resizing.mode === "line-end") {
      const widthValue = object.width + deltaX;
      const heightValue = object.height + deltaY;
      if (Math.hypot(widthValue, heightValue) < 1) {
        setResizing(null);
        return;
      }
      onObjectUpdate(object.id, { width: widthValue, height: heightValue });
      setResizing(null);
      return;
    }
    if (resizing.mode === "line-curve-c1" || resizing.mode === "line-curve-c2") {
      const projected = projectPointToLineCurve(object, resizing.current);
      const currentCurve = readLineCurveMeta(object);
      const nextCurve =
        resizing.mode === "line-curve-c1"
          ? {
              ...currentCurve,
              c1t: Math.max(-1, Math.min(2, projected.t)),
              c1n: Math.max(-480, Math.min(480, projected.n)),
            }
          : {
              ...currentCurve,
              c2t: Math.max(-1, Math.min(2, projected.t)),
              c2n: Math.max(-480, Math.min(480, projected.n)),
            };
      onObjectUpdate(object.id, {
        meta: {
          ...(object.meta ?? {}),
          curve: nextCurve,
        },
      });
      setResizing(null);
      return;
    }
    if (resizing.mode === "rotate") {
      const rect = getObjectRect(object);
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      if (object.type === "line" || object.type === "arrow") {
        const length = Math.hypot(object.width, object.height) || 1;
        // Use absolute handle angle around the center to support full 360 rotation smoothly.
        const angle =
          Math.atan2(resizing.current.y - centerY, resizing.current.x - centerX) +
          Math.PI / 2;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const half = length / 2;
        const nextStart = {
          x: centerX - dirX * half,
          y: centerY - dirY * half,
        };
        onObjectUpdate(object.id, {
          x: nextStart.x,
          y: nextStart.y,
          width: dirX * length,
          height: dirY * length,
        });
      } else {
        const startAngle = Math.atan2(resizing.start.y - centerY, resizing.start.x - centerX);
        const nextAngle = Math.atan2(resizing.current.y - centerY, resizing.current.x - centerX);
        const deltaDeg = ((nextAngle - startAngle) * 180) / Math.PI;
        onObjectUpdate(object.id, {
          rotation: (object.rotation ?? 0) + deltaDeg,
        });
      }
      setResizing(null);
      return;
    }
    if (
      (resizing.mode === "nw" ||
        resizing.mode === "ne" ||
        resizing.mode === "se" ||
        resizing.mode === "sw") &&
      (object.type === "line" || object.type === "arrow")
    ) {
      const rect = getObjectRect(object);
      const center = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
      const startVector = {
        x: resizing.start.x - center.x,
        y: resizing.start.y - center.y,
      };
      const currentVector = {
        x: resizing.current.x - center.x,
        y: resizing.current.y - center.y,
      };
      const startDistance = Math.hypot(startVector.x, startVector.y);
      const currentDistance = Math.hypot(currentVector.x, currentVector.y);
      if (startDistance < 1e-6 || currentDistance < 1e-6) {
        setResizing(null);
        return;
      }
      const scale = Math.max(0.2, Math.min(8, currentDistance / startDistance));
      const startPoint = { x: object.x, y: object.y };
      const endPoint = { x: object.x + object.width, y: object.y + object.height };
      const nextStart = {
        x: center.x + (startPoint.x - center.x) * scale,
        y: center.y + (startPoint.y - center.y) * scale,
      };
      const nextEnd = {
        x: center.x + (endPoint.x - center.x) * scale,
        y: center.y + (endPoint.y - center.y) * scale,
      };
      const nextWidth = nextEnd.x - nextStart.x;
      const nextHeight = nextEnd.y - nextStart.y;
      if (Math.hypot(nextWidth, nextHeight) < 1) {
        setResizing(null);
        return;
      }
      onObjectUpdate(object.id, {
        x: nextStart.x,
        y: nextStart.y,
        width: nextWidth,
        height: nextHeight,
      });
      setResizing(null);
      return;
    }

    const rect = normalizeRect(
      { x: object.x, y: object.y },
      { x: object.x + object.width, y: object.y + object.height }
    );
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    const localStart =
      object.rotation && Number.isFinite(object.rotation)
        ? rotatePointAround(resizing.start, center, -(object.rotation ?? 0))
        : resizing.start;
    const localCurrent =
      object.rotation && Number.isFinite(object.rotation)
        ? rotatePointAround(resizing.current, center, -(object.rotation ?? 0))
        : resizing.current;
    if (
      resizing.mode === "n" ||
      resizing.mode === "s" ||
      resizing.mode === "e" ||
      resizing.mode === "w"
    ) {
      let nextLeft = rect.x;
      let nextRight = rect.x + rect.width;
      let nextTop = rect.y;
      let nextBottom = rect.y + rect.height;

      if (resizing.mode === "n") {
        nextTop = Math.min(localCurrent.y, nextBottom - 1);
      } else if (resizing.mode === "s") {
        nextBottom = Math.max(localCurrent.y, nextTop + 1);
      } else if (resizing.mode === "e") {
        nextRight = Math.max(localCurrent.x, nextLeft + 1);
      } else if (resizing.mode === "w") {
        nextLeft = Math.min(localCurrent.x, nextRight - 1);
      }

      const nextRect = normalizeRect(
        { x: nextLeft, y: nextTop },
        { x: nextRight, y: nextBottom }
      );

      if (Array.isArray(object.points) && object.points.length > 0) {
        const safeWidth = Math.max(1e-6, rect.width);
        const safeHeight = Math.max(1e-6, rect.height);
        const nextCenter = {
          x: nextRect.x + nextRect.width / 2,
          y: nextRect.y + nextRect.height / 2,
        };
        const rotationDeg =
          object.rotation && Number.isFinite(object.rotation) ? object.rotation : 0;
        const resizedPoints = object.points.map((point) => {
          const localPoint =
            rotationDeg !== 0
              ? rotatePointAround(point, center, -rotationDeg)
              : point;
          const nextLocal = {
            x: nextRect.x + ((localPoint.x - rect.x) / safeWidth) * nextRect.width,
            y: nextRect.y + ((localPoint.y - rect.y) / safeHeight) * nextRect.height,
          };
          return rotationDeg !== 0
            ? rotatePointAround(nextLocal, nextCenter, rotationDeg)
            : nextLocal;
        });
        const nextBounds = getPointsBoundsFromPoints(resizedPoints);
        onObjectUpdate(object.id, {
          x: nextBounds.minX,
          y: nextBounds.minY,
          width: nextBounds.width,
          height: nextBounds.height,
          points: resizedPoints,
        });
        setResizing(null);
        return;
      }

      onObjectUpdate(object.id, {
        x: nextRect.x,
        y: nextRect.y,
        width: nextRect.width,
        height: nextRect.height,
      });
      setResizing(null);
      return;
    }
    const startVector = {
      x: localStart.x - center.x,
      y: localStart.y - center.y,
    };
    const currentVector = {
      x: localCurrent.x - center.x,
      y: localCurrent.y - center.y,
    };
    const scaleX =
      Math.abs(startVector.x) > 2
        ? Math.max(0.2, Math.min(8, Math.abs(currentVector.x) / Math.abs(startVector.x)))
        : 1;
    const scaleY =
      Math.abs(startVector.y) > 2
        ? Math.max(0.2, Math.min(8, Math.abs(currentVector.y) / Math.abs(startVector.y)))
        : 1;
    const uniformScale = Math.max(scaleX, scaleY);
    const nextWidth = Math.max(1, rect.width * uniformScale);
    const nextHeight = Math.max(1, rect.height * uniformScale);
    const nextLeft = center.x - nextWidth / 2;
    const nextTop = center.y - nextHeight / 2;
    if (Array.isArray(object.points) && object.points.length > 0) {
      const resizedPoints = object.points.map((point) => ({
        x: center.x + (point.x - center.x) * uniformScale,
        y: center.y + (point.y - center.y) * uniformScale,
      }));
      const nextBounds = getPointsBoundsFromPoints(resizedPoints);
      onObjectUpdate(object.id, {
        x: nextBounds.minX,
        y: nextBounds.minY,
        width: nextBounds.width,
        height: nextBounds.height,
        points: resizedPoints,
      });
      setResizing(null);
      return;
    }
    onObjectUpdate(object.id, {
      x: nextLeft,
      y: nextTop,
      width: nextWidth,
      height: nextHeight,
    });
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
    if (erasing) {
      const point = mapPointer(svg, event.clientX, event.clientY, false, false);
      eraseAtPoint(point);
      commitEraserGesture();
      setErasing(false);
      erasedStrokeIdsRef.current.clear();
      clearEraserPreviewRuntime();
    } else if (strokePointsRef.current.length > 0) {
      finishStroke(event, svg);
    } else if (shapeDraft) {
      finishShape();
    } else if (areaSelectionResize) {
      const nextRect = resizeAreaSelectionRect(
        areaSelectionResize.initialRect,
        areaSelectionResize.mode,
        areaSelectionResize.current
      );
      const hasMeaningfulArea = nextRect.width > 8 || nextRect.height > 8;
      if (!hasMeaningfulArea) {
        onAreaSelectionChange?.(null);
      } else {
        const objectIds = boardObjects
          .filter((object) => rectIntersects(getObjectRect(object), nextRect))
          .map((object) => object.id);
        const strokeIds = allStrokes
          .filter((stroke) => {
            const strokeRect = getStrokeRect(stroke);
            return strokeRect ? rectIntersects(strokeRect, nextRect) : false;
          })
          .map((stroke) => ({ id: stroke.id, layer: stroke.layer }));
        onAreaSelectionChange?.(
          objectIds.length > 0 || strokeIds.length > 0
            ? {
                objectIds,
                strokeIds,
                rect: nextRect,
              }
            : null
        );
      }
      setAreaSelectionResize(null);
    } else if (areaSelectionDraft) {
      const nextRect = normalizeRect(areaSelectionDraft.start, areaSelectionDraft.current);
      const hasMeaningfulArea = nextRect.width > 8 || nextRect.height > 8;
      if (!hasMeaningfulArea) {
        onAreaSelectionChange?.(null);
      } else {
        const objectIds = boardObjects
          .filter((object) => rectIntersects(getObjectRect(object), nextRect))
          .map((object) => object.id);
        const strokeIds = allStrokes
          .filter((stroke) => {
            const strokeRect = getStrokeRect(stroke);
            return strokeRect ? rectIntersects(strokeRect, nextRect) : false;
          })
          .map((stroke) => ({ id: stroke.id, layer: stroke.layer }));
        onAreaSelectionChange?.(
          objectIds.length > 0 || strokeIds.length > 0
            ? {
                objectIds,
                strokeIds,
                rect: nextRect,
              }
            : null
        );
      }
      setAreaSelectionDraft(null);
    } else if (panning) {
      setPanning(null);
    } else if (graphPan) {
      const deltaX = graphPan.current.x - graphPan.start.x;
      const deltaY = graphPan.current.y - graphPan.start.y;
      const shiftedFunctions = applyGraphPanToFunctions(
        graphPan.initialFunctions,
        deltaX,
        deltaY,
        graphPan.pxPerUnit,
        graphPan.targetFunctionId
      );
      onObjectUpdate(graphPan.object.id, {
        meta: {
          ...(graphPan.object.meta ?? {}),
          functions: shiftedFunctions,
        },
      });
      setGraphPan(null);
    } else if (solid3dGesture) {
      const previewMeta = solid3dPreviewMetaById[solid3dGesture.object.id];
      if (previewMeta) {
        onObjectUpdate(solid3dGesture.object.id, { meta: previewMeta });
      }
      setSolid3dGesture(null);
      setSolid3dPreviewMetaById((current) => {
        const next = { ...current };
        delete next[solid3dGesture.object.id];
        return next;
      });
    } else if (solid3dResize) {
      const patch = computeSolid3dResizePatch(solid3dResize);
      onObjectUpdate(solid3dResize.object.id, patch);
      setSolid3dResize(null);
    } else if (resizing) {
      finishResizing();
    } else if (moving) {
      finishMoving();
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
      const selected = boardObjects.find((item) => item.id === selectedObjectId);
      if (selected?.pinned) return;
      event.preventDefault();
      const layerId = selected ? getObjectSceneLayerId(selected) : "main";
      if (layerId !== "main") {
        boardObjects
          .filter((item) => getObjectSceneLayerId(item) === layerId && !item.pinned)
          .forEach((item) => onObjectDelete(item.id));
      } else {
        onObjectDelete(selectedObjectId);
      }
      onSelectedObjectChange(null);
    };
    window.addEventListener("keydown", onDelete);
    return () => window.removeEventListener("keydown", onDelete);
  }, [
    boardObjects,
    disabled,
    getObjectSceneLayerId,
    onObjectDelete,
    onSelectedObjectChange,
    selectedObjectId,
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
      erasedStrokeIdsRef.current.clear();
      eraserStrokeFragmentsRef.current.clear();
      eraserObjectCutsRef.current.clear();
      eraserTouchedObjectIdsRef.current.clear();
    }
  }, [tool]);

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
  }, [commitPolygonByPoints, polygonMode, polygonPointDraft, tool]);

  const renderObject = (objectSource: WorkbookBoardObject) => {
    const previewMeta = solid3dPreviewMetaById[objectSource.id];
    const movingDelta =
      moving
        ? {
            x: moving.current.x - moving.start.x,
            y: moving.current.y - moving.start.y,
          }
        : null;
    const isInMovingGroup =
      moving?.groupObjects.some((entry) => entry.id === objectSource.id) ?? false;
    const movingBaseObject =
      isInMovingGroup && moving
        ? moving.groupObjects.find((entry) => entry.id === objectSource.id) ??
          (moving.object.id === objectSource.id ? moving.object : null)
        : null;
    let object =
      previewMeta && objectSource.type === "solid3d"
        ? { ...objectSource, meta: previewMeta }
        : objectSource;
    if (movingBaseObject && movingDelta) {
      const sourceForMove =
        previewMeta && movingBaseObject.type === "solid3d"
          ? { ...movingBaseObject, meta: previewMeta }
          : movingBaseObject;
      object = {
        ...sourceForMove,
        x: sourceForMove.x + movingDelta.x,
        y: sourceForMove.y + movingDelta.y,
        points: Array.isArray(sourceForMove.points)
          ? sourceForMove.points.map((point) => ({
              x: point.x + movingDelta.x,
              y: point.y + movingDelta.y,
            }))
          : sourceForMove.points,
      };
    }
    const rect =
      activeMoveRect && activeMoveRect.id === object.id
        ? {
            ...activeMoveRect,
          }
        : {
            id: object.id,
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
          };
    const normalized =
      Array.isArray(object.points) && object.points.length > 0
        ? getObjectRect(object)
        : normalizeRect(
            { x: rect.x, y: rect.y },
            { x: rect.x + rect.width, y: rect.y + rect.height }
          );
    const commonProps = {
      stroke: object.color ?? "#4f63ff",
      strokeWidth: object.strokeWidth ?? 2,
      fill: object.fill ?? "transparent",
      opacity: object.opacity ?? 1,
      "data-object-id": object.id,
    };
    const centerX = normalized.x + normalized.width / 2;
    const centerY = normalized.y + normalized.height / 2;
    const rotation = Number.isFinite(object.rotation) ? (object.rotation as number) : 0;
    const transform = rotation
      ? `rotate(${rotation} ${centerX} ${centerY})`
      : undefined;

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
      const functions = Array.isArray(object.meta?.functions)
        ? (object.meta?.functions as GraphFunctionDraft[])
        : [];
      const graphPanPreviewActive = Boolean(graphPan && graphPan.object.id === object.id);
      const activeGraphPan = graphPanPreviewActive ? graphPan : null;
      const axisColorRaw = object.meta?.axisColor;
      const axisColor =
        typeof axisColorRaw === "string" && axisColorRaw.startsWith("#")
          ? axisColorRaw
          : "#ff8e3c";
      const planeColorRaw = object.meta?.planeColor;
      const planeColor =
        typeof planeColorRaw === "string"
          ? planeColorRaw === "transparent" || planeColorRaw.startsWith("#")
            ? planeColorRaw
            : "#8ea7ff"
          : "#8ea7ff";
      const autoStep = getAutoGraphGridStep({
        width: normalized.width,
        height: normalized.height,
      });
      const step = Math.max(
        12,
        Math.min(64, Math.round(Number.isFinite(gridSize) && gridSize > 0 ? gridSize : autoStep))
      );
      const centerX = normalized.x + normalized.width / 2;
      const centerY = normalized.y + normalized.height / 2;
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

      const plottedFunctions = buildFunctionGraphPlots(
        functions,
        {
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
        },
        step
      );
      const ghostPlots =
        activeGraphPan
          ? buildFunctionGraphPlots(
              activeGraphPan.initialFunctions.filter(
                (entry) =>
                  !activeGraphPan.targetFunctionId || entry.id === activeGraphPan.targetFunctionId
              ),
              {
                x: normalized.x,
                y: normalized.y,
                width: normalized.width,
                height: normalized.height,
              },
              step
            )
          : [];
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
            {plottedFunctions.flatMap((plot) =>
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

    if (object.type === "image" && object.imageUrl) {
      return (
        <image
          href={object.imageUrl}
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

  const selectedObject = selectedObjectId
    ? boardObjects.find((object) => object.id === selectedObjectId) ?? null
    : null;
  const selectedPreviewObject = (() => {
    if (!selectedObject) return null;
    const interactionSource =
      (moving && moving.object.id === selectedObject.id && moving.object) ||
      (resizing && resizing.object.id === selectedObject.id && resizing.object) ||
      (graphPan && graphPan.object.id === selectedObject.id && graphPan.object) ||
      (solid3dResize && solid3dResize.object.id === selectedObject.id && solid3dResize.object) ||
      selectedObject;
    let preview: WorkbookBoardObject = { ...interactionSource };
    if (interactionSource.type === "solid3d" && solid3dPreviewMetaById[interactionSource.id]) {
      preview = {
        ...preview,
        meta: solid3dPreviewMetaById[interactionSource.id],
      };
    }
    if (moving && moving.object.id === selectedObject.id) {
      const deltaX = moving.current.x - moving.start.x;
      const deltaY = moving.current.y - moving.start.y;
      preview = {
        ...preview,
        x: moving.object.x + deltaX,
        y: moving.object.y + deltaY,
        points: Array.isArray(moving.object.points)
          ? moving.object.points.map((point) => ({
              x: point.x + deltaX,
              y: point.y + deltaY,
            }))
          : moving.object.points,
      };
    }
    if (graphPan && graphPan.object.id === selectedObject.id) {
      const deltaX = graphPan.current.x - graphPan.start.x;
      const deltaY = graphPan.current.y - graphPan.start.y;
      preview = {
        ...graphPan.object,
        meta: {
          ...(graphPan.object.meta ?? {}),
          functions: applyGraphPanToFunctions(
            graphPan.initialFunctions,
            deltaX,
            deltaY,
            graphPan.pxPerUnit,
            graphPan.targetFunctionId
          ),
        },
      };
    }
    if (resizing && resizing.object.id === selectedObject.id) {
      if (resizing.mode === "line-start") {
        preview = {
          ...preview,
          x: resizing.object.x + (resizing.current.x - resizing.start.x),
          y: resizing.object.y + (resizing.current.y - resizing.start.y),
          width: resizing.object.width - (resizing.current.x - resizing.start.x),
          height: resizing.object.height - (resizing.current.y - resizing.start.y),
        };
      } else if (resizing.mode === "line-end") {
        preview = {
          ...preview,
          width: resizing.object.width + (resizing.current.x - resizing.start.x),
          height: resizing.object.height + (resizing.current.y - resizing.start.y),
        };
      } else if (
        resizing.mode === "n" ||
        resizing.mode === "s" ||
        resizing.mode === "e" ||
        resizing.mode === "w"
      ) {
        const rect = normalizeRect(
          { x: preview.x, y: preview.y },
          { x: preview.x + preview.width, y: preview.y + preview.height }
        );
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const rotationDeg =
          preview.rotation && Number.isFinite(preview.rotation) ? preview.rotation : 0;
        const localCurrent =
          rotationDeg !== 0
            ? rotatePointAround(resizing.current, center, -rotationDeg)
            : resizing.current;
        let nextLeft = rect.x;
        let nextRight = rect.x + rect.width;
        let nextTop = rect.y;
        let nextBottom = rect.y + rect.height;
        if (resizing.mode === "n") {
          nextTop = Math.min(localCurrent.y, nextBottom - 1);
        } else if (resizing.mode === "s") {
          nextBottom = Math.max(localCurrent.y, nextTop + 1);
        } else if (resizing.mode === "e") {
          nextRight = Math.max(localCurrent.x, nextLeft + 1);
        } else if (resizing.mode === "w") {
          nextLeft = Math.min(localCurrent.x, nextRight - 1);
        }
        const nextRect = normalizeRect(
          { x: nextLeft, y: nextTop },
          { x: nextRight, y: nextBottom }
        );
        const safeWidth = Math.max(1e-6, rect.width);
        const safeHeight = Math.max(1e-6, rect.height);
        const nextCenter = {
          x: nextRect.x + nextRect.width / 2,
          y: nextRect.y + nextRect.height / 2,
        };
        preview = {
          ...preview,
          x: nextRect.x,
          y: nextRect.y,
          width: nextRect.width,
          height: nextRect.height,
          points: Array.isArray(preview.points)
            ? preview.points.map((point) => {
                const localPoint =
                  rotationDeg !== 0
                    ? rotatePointAround(point, center, -rotationDeg)
                    : point;
                const nextLocal = {
                  x: nextRect.x + ((localPoint.x - rect.x) / safeWidth) * nextRect.width,
                  y: nextRect.y + ((localPoint.y - rect.y) / safeHeight) * nextRect.height,
                };
                return rotationDeg !== 0
                  ? rotatePointAround(nextLocal, nextCenter, rotationDeg)
                  : nextLocal;
              })
            : preview.points,
        };
      } else if (
        (resizing.mode === "nw" ||
          resizing.mode === "ne" ||
          resizing.mode === "se" ||
          resizing.mode === "sw") &&
        (preview.type === "line" || preview.type === "arrow")
      ) {
        const rect = getObjectRect(preview);
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const startVector = {
          x: resizing.start.x - center.x,
          y: resizing.start.y - center.y,
        };
        const currentVector = {
          x: resizing.current.x - center.x,
          y: resizing.current.y - center.y,
        };
        const startDistance = Math.hypot(startVector.x, startVector.y);
        const currentDistance = Math.hypot(currentVector.x, currentVector.y);
        const scale =
          startDistance > 1e-6
            ? Math.max(0.2, Math.min(8, currentDistance / startDistance))
            : 1;
        const startPoint = { x: preview.x, y: preview.y };
        const endPoint = { x: preview.x + preview.width, y: preview.y + preview.height };
        const nextStart = {
          x: center.x + (startPoint.x - center.x) * scale,
          y: center.y + (startPoint.y - center.y) * scale,
        };
        const nextEnd = {
          x: center.x + (endPoint.x - center.x) * scale,
          y: center.y + (endPoint.y - center.y) * scale,
        };
        preview = {
          ...preview,
          x: nextStart.x,
          y: nextStart.y,
          width: nextEnd.x - nextStart.x,
          height: nextEnd.y - nextStart.y,
        };
      } else if (
        resizing.mode === "line-curve-c1" ||
        resizing.mode === "line-curve-c2"
      ) {
        const projected = projectPointToLineCurve(preview, resizing.current);
        const currentCurve = readLineCurveMeta(preview);
        const nextCurve =
          resizing.mode === "line-curve-c1"
            ? {
                ...currentCurve,
                c1t: Math.max(-1, Math.min(2, projected.t)),
                c1n: Math.max(-480, Math.min(480, projected.n)),
              }
            : {
                ...currentCurve,
                c2t: Math.max(-1, Math.min(2, projected.t)),
                c2n: Math.max(-480, Math.min(480, projected.n)),
              };
        preview = {
          ...preview,
          meta: {
            ...(preview.meta ?? {}),
            curve: nextCurve,
          },
        };
      } else if (resizing.mode === "rotate") {
        if (preview.type === "line" || preview.type === "arrow") {
          const length = Math.hypot(preview.width, preview.height) || 1;
          const rect = getObjectRect(preview);
          const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          const angle =
            Math.atan2(resizing.current.y - center.y, resizing.current.x - center.x) +
            Math.PI / 2;
          const dirX = Math.cos(angle);
          const dirY = Math.sin(angle);
          const half = length / 2;
          const nextStart = {
            x: center.x - dirX * half,
            y: center.y - dirY * half,
          };
          preview = {
            ...preview,
            x: nextStart.x,
            y: nextStart.y,
            width: dirX * length,
            height: dirY * length,
          };
        } else {
          const rect = normalizeRect(
            { x: preview.x, y: preview.y },
            { x: preview.x + preview.width, y: preview.y + preview.height }
          );
          const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          const startAngle = Math.atan2(resizing.start.y - center.y, resizing.start.x - center.x);
          const nextAngle = Math.atan2(
            resizing.current.y - center.y,
            resizing.current.x - center.x
          );
          preview = {
            ...preview,
            rotation:
              (preview.rotation ?? 0) + ((nextAngle - startAngle) * 180) / Math.PI,
          };
        }
      } else if (preview.type !== "line" && preview.type !== "arrow") {
        const rect = normalizeRect(
          { x: preview.x, y: preview.y },
          { x: preview.x + preview.width, y: preview.y + preview.height }
        );
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const localStart =
          preview.rotation && Number.isFinite(preview.rotation)
            ? rotatePointAround(resizing.start, center, -(preview.rotation ?? 0))
            : resizing.start;
        const localCurrent =
          preview.rotation && Number.isFinite(preview.rotation)
            ? rotatePointAround(resizing.current, center, -(preview.rotation ?? 0))
            : resizing.current;
        const startVector = {
          x: localStart.x - center.x,
          y: localStart.y - center.y,
        };
        const currentVector = {
          x: localCurrent.x - center.x,
          y: localCurrent.y - center.y,
        };
        const scaleX =
          Math.abs(startVector.x) > 2
            ? Math.max(0.2, Math.min(8, Math.abs(currentVector.x) / Math.abs(startVector.x)))
            : 1;
        const scaleY =
          Math.abs(startVector.y) > 2
            ? Math.max(0.2, Math.min(8, Math.abs(currentVector.y) / Math.abs(startVector.y)))
            : 1;
        const uniformScale = Math.max(scaleX, scaleY);
        const nextWidth = Math.max(1, rect.width * uniformScale);
        const nextHeight = Math.max(1, rect.height * uniformScale);
        const nextLeft = center.x - nextWidth / 2;
        const nextTop = center.y - nextHeight / 2;
        preview = {
          ...preview,
          x: nextLeft,
          y: nextTop,
          width: nextWidth,
          height: nextHeight,
          points: Array.isArray(preview.points)
            ? preview.points.map((point) => ({
                x: center.x + (point.x - center.x) * uniformScale,
                y: center.y + (point.y - center.y) * uniformScale,
              }))
            : preview.points,
        };
      }
    }
    if (solid3dResize && solid3dResize.object.id === selectedObject.id) {
      const patch = computeSolid3dResizePatch(solid3dResize);
      preview = {
        ...preview,
        ...patch,
      };
    }
    return preview;
  })();

  const isLiveInteractionActive = Boolean(
    moving || resizing || graphPan || solid3dGesture || solid3dResize
  );
  const realtimePatchBaseObject = useMemo(() => {
    if (!selectedObject) return null;
    if (moving && moving.object.id === selectedObject.id) {
      return moving.object;
    }
    if (resizing && resizing.object.id === selectedObject.id) {
      return resizing.object;
    }
    if (graphPan && graphPan.object.id === selectedObject.id) {
      return graphPan.object;
    }
    if (solid3dResize && solid3dResize.object.id === selectedObject.id) {
      return solid3dResize.object;
    }
    return selectedObject;
  }, [graphPan, moving, resizing, selectedObject, solid3dResize]);

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
    if (!selectedPreviewObject) return null;
    if (
      selectedPreviewObject.type === "line" ||
      selectedPreviewObject.type === "arrow" ||
      (Array.isArray(selectedPreviewObject.points) && selectedPreviewObject.points.length > 0)
    ) {
      return getObjectRect(selectedPreviewObject);
    }
    return normalizeRect(
      { x: selectedPreviewObject.x, y: selectedPreviewObject.y },
      {
        x: selectedPreviewObject.x + selectedPreviewObject.width,
        y: selectedPreviewObject.y + selectedPreviewObject.height,
      }
    );
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
  }, [resolveSolid3dResizeHandles, selectedPreviewObject]);

  const constraintSegments = useMemo(
    () =>
      constraints
        .map((constraint) => {
          const source = boardObjects.find(
            (object) => object.id === constraint.sourceObjectId
          );
          const target = boardObjects.find(
            (object) => object.id === constraint.targetObjectId
          );
          if (!source || !target) return null;
          return {
            constraint,
            source: getObjectCenter(source),
            target: getObjectCenter(target),
          };
        })
        .filter(
          (
            segment
          ): segment is {
            constraint: WorkbookConstraint;
            source: WorkbookPoint;
            target: WorkbookPoint;
          } => Boolean(segment)
        ),
    [boardObjects, constraints]
  );

  const solid3dPickMarkers = useMemo(() => {
    const markerSource = solid3dSectionMarkers;
    if (!markerSource?.objectId) {
      return [] as Array<{ index: number; x: number; y: number; label: string }>;
    }
    const sourceObject =
      selectedPreviewObject?.id === markerSource.objectId
        ? selectedPreviewObject
        : boardObjects.find((item) => item.id === markerSource.objectId);
    if (!sourceObject) return [] as Array<{ index: number; x: number; y: number; label: string }>;
    return resolveSolid3dPickMarkersForObject(sourceObject, markerSource.selectedPoints);
  }, [
    boardObjects,
    resolveSolid3dPickMarkersForObject,
    selectedPreviewObject,
    solid3dSectionMarkers,
  ]);

  const canvasStyle: CSSProperties = {
    "--workbook-grid-size": `${Math.max(8, Math.min(96, Math.floor(gridSize || 22)))}px`,
    "--workbook-grid-color": showGrid ? gridColor : "transparent",
    "--workbook-background-color": backgroundColor,
  } as CSSProperties;

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    if (disabled) return;
    if (!event.ctrlKey && !event.metaKey) return;
    if (!selectedObjectId) return;
    const selectedObject = boardObjects.find((object) => object.id === selectedObjectId);
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
            const vertexIndex = resolveSolid3dVertexAtPointer(target, point);
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

            const sectionVertex = resolveSolid3dSectionVertexAtPointer(target, point);
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

            const sectionId = resolveSolid3dSectionAtPointer(target, point);
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
        {autoDividersEnabled
          ? Array.from(
              {
                length: Math.ceil((size.height / safeZoom) / Math.max(320, autoDividerStep)) + 2,
              },
              (_, index) => {
                const step = Math.max(320, autoDividerStep);
                const startY = Math.floor(viewportOffset.y / step) * step;
                const y = startY + index * step;
                return (
                  <line
                    key={`auto-divider-${y}`}
                    x1={viewportOffset.x - 1200}
                    y1={y}
                    x2={viewportOffset.x + size.width / safeZoom + 1200}
                    y2={y}
                    stroke="#a1a9c8"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    opacity={0.7}
                  />
                );
              }
            )
          : null}
        {boardObjects.map((object) => {
          const renderSource =
            selectedPreviewObject?.id === object.id ? selectedPreviewObject : object;
          const renderedObject = renderObject(renderSource);
          const eraserCuts =
            erasing
              ? (eraserPreviewObjectCuts[renderSource.id] ?? sanitizeObjectEraserCuts(renderSource))
              : sanitizeObjectEraserCuts(renderSource);
          const resolvedEraserCuts = resolveObjectEraserCutsForRender(renderSource, eraserCuts);
          if (resolvedEraserCuts.length === 0) {
            return <g key={object.id}>{renderedObject}</g>;
          }
          const objectRect = getObjectRect(renderSource);
          let minX = objectRect.x - ERASER_MASK_PADDING;
          let minY = objectRect.y - ERASER_MASK_PADDING;
          let maxX = objectRect.x + objectRect.width + ERASER_MASK_PADDING;
          let maxY = objectRect.y + objectRect.height + ERASER_MASK_PADDING;
          resolvedEraserCuts.forEach((cut) => {
            minX = Math.min(minX, cut.x - cut.radius - ERASER_MASK_PADDING);
            minY = Math.min(minY, cut.y - cut.radius - ERASER_MASK_PADDING);
            maxX = Math.max(maxX, cut.x + cut.radius + ERASER_MASK_PADDING);
            maxY = Math.max(maxY, cut.y + cut.radius + ERASER_MASK_PADDING);
          });
          const maskWidth = Math.max(1, maxX - minX);
          const maskHeight = Math.max(1, maxY - minY);
          const safeMaskId = `workbook-object-mask-${renderSource.id.replace(
            /[^a-zA-Z0-9_-]/g,
            "-"
          )}`;
          return (
            <g key={object.id}>
              <defs>
                <mask
                  id={safeMaskId}
                  maskUnits="userSpaceOnUse"
                  x={minX}
                  y={minY}
                  width={maskWidth}
                  height={maskHeight}
                >
                  <rect
                    x={minX}
                    y={minY}
                    width={maskWidth}
                    height={maskHeight}
                    fill="#ffffff"
                  />
                  {resolvedEraserCuts.map((cut, index) => (
                    <circle
                      key={`${renderSource.id}-erase-cut-${index}`}
                      cx={cut.x}
                      cy={cut.y}
                      r={Math.max(1, cut.radius)}
                      fill="#000000"
                    />
                  ))}
                </mask>
              </defs>
              <g mask={`url(#${safeMaskId})`}>{renderedObject}</g>
            </g>
          );
        })}
        {solid3dSectionMarkers?.objectId
          ? solid3dPickMarkers.map((marker) => {
              const markerObjectId = solid3dSectionMarkers.objectId;
              const markerObject =
                selectedPreviewObject?.id === markerObjectId
                  ? selectedPreviewObject
                  : boardObjects.find((item) => item.id === markerObjectId);
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
            })
          : null}

        {constraintSegments.map((segment) => {
          const isActive = segment.constraint.id === selectedConstraintId;
          const midX = (segment.source.x + segment.target.x) / 2;
          const midY = (segment.source.y + segment.target.y) / 2;
          return (
            <g
              key={`constraint-${segment.constraint.id}`}
              className={`workbook-session__constraint-line ${isActive ? "is-active" : ""}`}
              onPointerDown={(event) => {
                if (tool !== "select") return;
                event.stopPropagation();
                onSelectedObjectChange(null);
                onSelectedConstraintChange(segment.constraint.id);
              }}
              style={{ pointerEvents: tool === "select" ? "all" : "none" }}
            >
              <line
                x1={segment.source.x}
                y1={segment.source.y}
                x2={segment.target.x}
                y2={segment.target.y}
              />
              <text x={midX} y={midY}>
                {mapConstraintLabel(segment.constraint.type)}
              </text>
            </g>
          );
        })}

        {renderedStrokes.map((stroke) => (
          <path
            key={stroke.id}
            d={toPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={stroke.tool === "highlighter" ? 0.5 : 1}
          />
        ))}

        {previewStrokes.map((stroke) => (
          <path
            key={`preview-${stroke.id}`}
            d={toPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={stroke.tool === "highlighter" ? 0.5 : 0.94}
            pointerEvents="none"
          />
        ))}

        {shapeDraft ? (
          <g className="workbook-session__draft-shape">
            {shapeDraft.tool === "line" || shapeDraft.tool === "arrow" ? (
              <line
                x1={shapeDraft.start.x}
                y1={shapeDraft.start.y}
                x2={shapeDraft.current.x}
                y2={shapeDraft.current.y}
                stroke={color}
                strokeWidth={Math.max(1, width)}
                strokeDasharray="6 4"
                markerEnd={shapeDraft.tool === "arrow" ? "url(#workbook-arrow)" : undefined}
              />
            ) : shapeDraft.tool === "divider" ? (
              <line
                x1={shapeDraft.start.x - 2000}
                y1={shapeDraft.start.y}
                x2={shapeDraft.start.x + 2000}
                y2={shapeDraft.start.y}
                stroke={color}
                strokeWidth={Math.max(1.2, width)}
                strokeDasharray="8 6"
              />
            ) : shapeDraft.tool === "ellipse" || shapeDraft.tool === "compass" ? (
              <ellipse
                cx={
                  shapeDraft.tool === "compass"
                    ? shapeDraft.start.x
                    : (shapeDraft.start.x + shapeDraft.current.x) / 2
                }
                cy={
                  shapeDraft.tool === "compass"
                    ? shapeDraft.start.y
                    : (shapeDraft.start.y + shapeDraft.current.y) / 2
                }
                rx={
                  shapeDraft.tool === "compass"
                    ? Math.max(
                        1,
                        Math.hypot(
                          shapeDraft.current.x - shapeDraft.start.x,
                          shapeDraft.current.y - shapeDraft.start.y
                        )
                      )
                    : Math.max(1, Math.abs(shapeDraft.start.x - shapeDraft.current.x) / 2)
                }
                ry={
                  shapeDraft.tool === "compass"
                    ? Math.max(
                        1,
                        Math.hypot(
                          shapeDraft.current.x - shapeDraft.start.x,
                          shapeDraft.current.y - shapeDraft.start.y
                        )
                      )
                    : Math.max(1, Math.abs(shapeDraft.start.y - shapeDraft.current.y) / 2)
                }
                stroke={color}
                strokeWidth={Math.max(1, width)}
                strokeDasharray="6 4"
                fill="none"
              />
            ) : shapeDraft.tool === "triangle" ? (
              <path
                d={`M ${(shapeDraft.start.x + shapeDraft.current.x) / 2} ${
                  Math.min(shapeDraft.start.y, shapeDraft.current.y)
                } L ${Math.min(shapeDraft.start.x, shapeDraft.current.x)} ${
                  Math.max(shapeDraft.start.y, shapeDraft.current.y)
                } L ${Math.max(shapeDraft.start.x, shapeDraft.current.x)} ${
                  Math.max(shapeDraft.start.y, shapeDraft.current.y)
                } Z`}
                stroke={color}
                strokeWidth={Math.max(1, width)}
                strokeDasharray="6 4"
                fill="none"
              />
            ) : shapeDraft.tool === "polygon" ? (
              <path
                d={createPolygonPath(
                  normalizeRect(shapeDraft.start, shapeDraft.current),
                  polygonSides,
                  polygonPreset
                )}
                stroke={color}
                strokeWidth={Math.max(1, width)}
                strokeDasharray="6 4"
                fill="none"
              />
            ) : (
              <rect
                x={Math.min(shapeDraft.start.x, shapeDraft.current.x)}
                y={Math.min(shapeDraft.start.y, shapeDraft.current.y)}
                width={Math.max(1, Math.abs(shapeDraft.start.x - shapeDraft.current.x))}
                height={Math.max(1, Math.abs(shapeDraft.start.y - shapeDraft.current.y))}
                rx={shapeDraft.tool === "text" ? 4 : 8}
                ry={shapeDraft.tool === "text" ? 4 : 8}
                stroke={color}
                strokeWidth={Math.max(1, width)}
                strokeDasharray="6 4"
                fill="none"
              />
            )}
          </g>
        ) : null}

        {tool === "polygon" && polygonMode === "points" && polygonPointDraft.length > 0 ? (
          <g className="workbook-session__draft-shape">
            <path
              d={toPath(
                polygonHoverPoint
                  ? [...polygonPointDraft, polygonHoverPoint]
                  : polygonPointDraft
              )}
              stroke={color}
              strokeWidth={Math.max(1, width)}
              strokeDasharray="6 4"
              fill="none"
            />
            {polygonPointDraft.map((point, index) => (
              <circle
                key={`poly-point-${index}-${point.x}-${point.y}`}
                cx={point.x}
                cy={point.y}
                r={2.5}
                fill={color}
              />
            ))}
          </g>
        ) : null}

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

        {tool === "eraser" && eraserCursorPoint ? (
          <g pointerEvents="none">
            <circle
              cx={eraserCursorPoint.x}
              cy={eraserCursorPoint.y}
              r={Math.max(4, width)}
              fill="rgba(79, 99, 255, 0.08)"
              stroke="#4f63ff"
              strokeWidth={1.1}
              strokeDasharray="5 4"
            />
            <circle
              cx={eraserCursorPoint.x}
              cy={eraserCursorPoint.y}
              r={1.5}
              fill="#4f63ff"
            />
          </g>
        ) : null}

        {areaSelection ? (
          <>
            <rect
              x={areaSelection.rect.x}
              y={areaSelection.rect.y}
              width={areaSelection.rect.width}
              height={areaSelection.rect.height}
              fill="none"
              stroke="#4f63ff"
              strokeWidth={1.2}
              strokeDasharray="7 5"
            />
            {tool === "area_select"
              ? getAreaSelectionHandlePoints(areaSelection.rect).map((handle) => (
                  <circle
                    key={`area-selection-handle-${handle.mode}`}
                    cx={handle.x}
                    cy={handle.y}
                    r={4}
                    fill="#4f63ff"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                ))
              : null}
          </>
        ) : null}

        {tool === "area_select" && areaSelectionDraft ? (
          <rect
            x={Math.min(areaSelectionDraft.start.x, areaSelectionDraft.current.x)}
            y={Math.min(areaSelectionDraft.start.y, areaSelectionDraft.current.y)}
            width={Math.max(1, Math.abs(areaSelectionDraft.current.x - areaSelectionDraft.start.x))}
            height={Math.max(1, Math.abs(areaSelectionDraft.current.y - areaSelectionDraft.start.y))}
            fill="none"
            stroke="#4f63ff"
            strokeWidth={1.2}
            strokeDasharray="7 5"
          />
        ) : null}

        {tool === "select" && areaSelectionDraft ? (
          <rect
            x={Math.min(areaSelectionDraft.start.x, areaSelectionDraft.current.x)}
            y={Math.min(areaSelectionDraft.start.y, areaSelectionDraft.current.y)}
            width={Math.max(1, Math.abs(areaSelectionDraft.current.x - areaSelectionDraft.start.x))}
            height={Math.max(1, Math.abs(areaSelectionDraft.current.y - areaSelectionDraft.start.y))}
            fill="none"
            stroke="#4f63ff"
            strokeWidth={1.2}
            strokeDasharray="7 5"
          />
        ) : null}

        {tool === "area_select" && areaSelectionResize ? (
          (() => {
            const nextRect = resizeAreaSelectionRect(
              areaSelectionResize.initialRect,
              areaSelectionResize.mode,
              areaSelectionResize.current
            );
            return (
              <rect
                x={nextRect.x}
                y={nextRect.y}
                width={nextRect.width}
                height={nextRect.height}
                fill="none"
                stroke="#4f63ff"
                strokeWidth={1.2}
                strokeDasharray="7 5"
              />
            );
          })()
        ) : null}

        {tool === "select" && selectedRect ? (
          <>
            {selectedPreviewObject?.type === "solid3d" ? (
              <g>
                {selectedSolidResizeHandles.length >= 2 ? (
                  <path
                    d={`${toPath(
                      selectedSolidResizeHandles.map((handle) => ({ x: handle.x, y: handle.y }))
                    )} Z`}
                    fill="none"
                    stroke="#4f63ff"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    strokeOpacity={0.72}
                  />
                ) : null}
                {selectedSolidResizeHandles.map((handle, index) => (
                  <circle
                    key={`solid3d-resize-handle-${selectedPreviewObject.id}-${handle.mode}-${index}`}
                    cx={handle.x}
                    cy={handle.y}
                    r={3.5}
                    fill="#4f63ff"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                ))}
              </g>
            ) : selectedPreviewObject?.type === "section_divider" ? (
              <line
                x1={selectedPreviewObject.x}
                y1={selectedPreviewObject.y + selectedPreviewObject.height / 2}
                x2={selectedPreviewObject.x + selectedPreviewObject.width}
                y2={selectedPreviewObject.y + selectedPreviewObject.height / 2}
                stroke="#ff8e3c"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            ) : selectedPreviewObject?.type === "point" ? (
              <circle
                cx={selectedPreviewObject.x + selectedPreviewObject.width / 2}
                cy={selectedPreviewObject.y + selectedPreviewObject.height / 2}
                r={8}
                fill="none"
                stroke="#ff8e3c"
                strokeWidth={1.6}
                strokeDasharray="6 4"
              />
            ) : selectedPreviewObject &&
            (selectedPreviewObject.type === "line" ||
              selectedPreviewObject.type === "arrow") ? (
              <>
                {(() => {
                  const lineKind =
                    selectedPreviewObject.meta?.lineKind === "segment" ? "segment" : "line";
                  return (
                    <>
                <line
                  x1={selectedPreviewObject.x}
                  y1={selectedPreviewObject.y}
                  x2={selectedLineControls?.c1.x ?? selectedPreviewObject.x}
                  y2={selectedLineControls?.c1.y ?? selectedPreviewObject.y}
                  stroke="#5f71ff"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <line
                  x1={selectedPreviewObject.x + selectedPreviewObject.width}
                  y1={selectedPreviewObject.y + selectedPreviewObject.height}
                  x2={
                    selectedLineControls?.c2.x ??
                    selectedPreviewObject.x + selectedPreviewObject.width
                  }
                  y2={
                    selectedLineControls?.c2.y ??
                    selectedPreviewObject.y + selectedPreviewObject.height
                  }
                  stroke="#5f71ff"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <rect
                  x={selectedRect.x}
                  y={selectedRect.y}
                  width={selectedRect.width}
                  height={selectedRect.height}
                  fill="none"
                  stroke="#ff8e3c"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                {tool === "select" && !selectedPreviewObject.pinned ? (
                <>
                  {[
                    { key: "nw", x: selectedRect.x, y: selectedRect.y },
                    {
                      key: "ne",
                      x: selectedRect.x + selectedRect.width,
                      y: selectedRect.y,
                    },
                    {
                      key: "se",
                      x: selectedRect.x + selectedRect.width,
                      y: selectedRect.y + selectedRect.height,
                    },
                    {
                      key: "sw",
                      x: selectedRect.x,
                      y: selectedRect.y + selectedRect.height,
                    },
                  ].map((handle) => (
                    <rect
                      key={`line-handle-${selectedPreviewObject.id}-${handle.key}`}
                      x={handle.x - 3}
                      y={handle.y - 3}
                      width={6}
                      height={6}
                      rx={1.5}
                      ry={1.5}
                      fill="#ff8e3c"
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  ))}
                  <circle
                    cx={selectedLineControls?.c1.x ?? selectedPreviewObject.x}
                    cy={selectedLineControls?.c1.y ?? selectedPreviewObject.y}
                    r={3.2}
                    fill="#5f71ff"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  <circle
                    cx={
                      selectedLineControls?.c2.x ??
                      selectedPreviewObject.x + selectedPreviewObject.width
                    }
                    cy={
                      selectedLineControls?.c2.y ??
                      selectedPreviewObject.y + selectedPreviewObject.height
                    }
                    r={3.3}
                    fill="#5f71ff"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  <circle
                    cx={selectedPreviewObject.x}
                    cy={selectedPreviewObject.y}
                    r={3.5}
                    fill={lineKind === "segment" ? "#ffffff" : "#ff8e3c"}
                    stroke="#ff8e3c"
                    strokeWidth={1.2}
                  />
                  <circle
                    cx={selectedPreviewObject.x + selectedPreviewObject.width}
                    cy={selectedPreviewObject.y + selectedPreviewObject.height}
                    r={3.5}
                    fill={lineKind === "segment" ? "#ffffff" : "#ff8e3c"}
                    stroke="#ff8e3c"
                    strokeWidth={1.2}
                  />
                  <circle
                    cx={selectedRect.x + selectedRect.width / 2}
                    cy={selectedRect.y - 18}
                    r={3.5}
                    fill="#5f71ff"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                </>
                ) : null}
                    </>
                  );
                })()}
              </>
            ) : selectedPreviewObject ? (
              <g
                transform={
                  selectedPreviewObject.rotation
                    ? `rotate(${selectedPreviewObject.rotation} ${
                        selectedRect.x + selectedRect.width / 2
                      } ${selectedRect.y + selectedRect.height / 2})`
                    : undefined
                }
              >
                <rect
                  x={selectedRect.x}
                  y={selectedRect.y}
                  width={selectedRect.width}
                  height={selectedRect.height}
                  fill="none"
                  stroke="#ff8e3c"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                {tool === "select" && !selectedPreviewObject.pinned ? (
                <>
                  {[
                    { key: "nw", x: selectedRect.x, y: selectedRect.y },
                    {
                      key: "ne",
                      x: selectedRect.x + selectedRect.width,
                      y: selectedRect.y,
                    },
                    {
                      key: "se",
                      x: selectedRect.x + selectedRect.width,
                      y: selectedRect.y + selectedRect.height,
                    },
                    {
                      key: "sw",
                      x: selectedRect.x,
                      y: selectedRect.y + selectedRect.height,
                    },
                    {
                      key: "n",
                      x: selectedRect.x + selectedRect.width / 2,
                      y: selectedRect.y,
                    },
                    {
                      key: "e",
                      x: selectedRect.x + selectedRect.width,
                      y: selectedRect.y + selectedRect.height / 2,
                    },
                    {
                      key: "s",
                      x: selectedRect.x + selectedRect.width / 2,
                      y: selectedRect.y + selectedRect.height,
                    },
                    {
                      key: "w",
                      x: selectedRect.x,
                      y: selectedRect.y + selectedRect.height / 2,
                    },
                  ].map((handle) => (
                    <rect
                      key={`handle-${selectedPreviewObject.id}-${handle.key}`}
                      x={handle.x - 3}
                      y={handle.y - 3}
                      width={6}
                      height={6}
                      rx={1.5}
                      ry={1.5}
                      fill="#ff8e3c"
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  ))}
                  <line
                    x1={selectedRect.x + selectedRect.width / 2}
                    y1={selectedRect.y}
                    x2={selectedRect.x + selectedRect.width / 2}
                    y2={selectedRect.y - 14}
                    stroke="#5f71ff"
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={selectedRect.x + selectedRect.width / 2}
                    cy={selectedRect.y - 18}
                    r={3.5}
                    fill="#5f71ff"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                </>
                ) : null}
              </g>
            ) : null}
          </>
        ) : null}

        {effectiveFocusPoints.map((focus, index) => (
          <g
            key={`focus-point-${Math.round(focus.x)}-${Math.round(focus.y)}-${index}`}
            className="workbook-session__focus-blink"
          >
            <circle cx={focus.x} cy={focus.y} r={18} />
            <line x1={focus.x - 8} y1={focus.y} x2={focus.x + 8} y2={focus.y} />
            <line x1={focus.x} y1={focus.y - 8} x2={focus.x} y2={focus.y + 8} />
          </g>
        ))}

        {effectivePointerPoints.map((pointer, index) => (
          <g
            key={`laser-pointer-${Math.round(pointer.x)}-${Math.round(pointer.y)}-${index}`}
            className="workbook-session__teacher-pointer"
            transform={`translate(${pointer.x} ${pointer.y}) rotate(-22) scale(0.5)`}
          >
            <path
              className="workbook-session__teacher-pointer-shaft"
              d="M -82 -5 C -74 -8 -44 -9 -11 -7 L -11 7 C -44 9 -74 8 -82 5 Z"
            />
            <path
              className="workbook-session__teacher-pointer-tip"
              d="M -11 -7 L 13 0 L -11 7 Z"
            />
            <path
              className="workbook-session__teacher-pointer-accent"
              d="M -78 -2 C -58 -5 -33 -5 -13 -4"
            />
            <circle className="workbook-session__teacher-pointer-glow" cx={15} cy={0} r={7.4} />
            <circle className="workbook-session__teacher-pointer-point" cx={15} cy={0} r={3.4} />
          </g>
        ))}
        </g>
        </g>
      </svg>
      {showPageNumbers ? (
        <div className="workbook-session__canvas-page">Страница {Math.max(1, currentPage)}</div>
      ) : null}
    </div>
  );
});
