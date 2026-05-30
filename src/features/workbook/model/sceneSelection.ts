import { getObjectRect, isInsideRect, normalizeRect } from "./sceneGeometry";
import { getStrokeRect } from "./stroke";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";
import { rectIntersects, type WorkbookSceneRect } from "./sceneVisibility";

const AREA_SELECTION_OBJECT_MIN_OVERLAP_RATIO = 0.12;

export type WorkbookAreaSelection = {
  objectIds: string[];
  strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
  rect: WorkbookSceneRect;
  resizeEnabled?: boolean;
};

export type WorkbookAreaSelectionResizeMode =
  | "n"
  | "s"
  | "w"
  | "e"
  | "nw"
  | "ne"
  | "sw"
  | "se";

export type WorkbookAreaSelectionDraft = {
  start: WorkbookPoint;
  current: WorkbookPoint;
};

export const getAreaSelectionHandlePoints = (rect: WorkbookSceneRect) => {
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

export const resolveAreaSelectionResizeMode = (
  rect: WorkbookSceneRect,
  point: WorkbookPoint
): WorkbookAreaSelectionResizeMode | null => {
  const nearest = getAreaSelectionHandlePoints(rect).reduce<{
    mode: WorkbookAreaSelectionResizeMode | null;
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

export const resizeAreaSelectionRect = (
  rect: WorkbookSceneRect,
  mode: WorkbookAreaSelectionResizeMode,
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

export const getAreaSelectionDraftRect = (draft: WorkbookAreaSelectionDraft) =>
  normalizeRect(draft.start, draft.current);

export const hasMeaningfulAreaSelectionRect = (
  rect: WorkbookSceneRect,
  minSize = 8
) => rect.width > minSize || rect.height > minSize;

const getRectIntersection = (
  a: WorkbookSceneRect,
  b: WorkbookSceneRect
): WorkbookSceneRect | null => {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return {
    x: left,
    y: top,
    width,
    height,
  };
};

const getRectArea = (rect: WorkbookSceneRect) =>
  Math.max(1, rect.width) * Math.max(1, rect.height);

const getRectCenter = (rect: WorkbookSceneRect): WorkbookPoint => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

const shouldSelectObjectInArea = (
  object: WorkbookBoardObject,
  rect: WorkbookSceneRect
) => {
  const objectRect = getObjectRect(object);
  if (!rectIntersects(objectRect, rect)) return false;
  if (isInsideRect(getRectCenter(objectRect), rect)) return true;

  const intersection = getRectIntersection(objectRect, rect);
  if (!intersection) return false;

  return (
    getRectArea(intersection) / getRectArea(objectRect) >=
    AREA_SELECTION_OBJECT_MIN_OVERLAP_RATIO
  );
};

const orientation = (a: WorkbookPoint, b: WorkbookPoint, c: WorkbookPoint) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) <= 1e-9) return 0;
  return value > 0 ? 1 : 2;
};

const isPointOnSegment = (point: WorkbookPoint, a: WorkbookPoint, b: WorkbookPoint) =>
  point.x <= Math.max(a.x, b.x) + 1e-9 &&
  point.x >= Math.min(a.x, b.x) - 1e-9 &&
  point.y <= Math.max(a.y, b.y) + 1e-9 &&
  point.y >= Math.min(a.y, b.y) - 1e-9;

const segmentsIntersect = (
  firstStart: WorkbookPoint,
  firstEnd: WorkbookPoint,
  secondStart: WorkbookPoint,
  secondEnd: WorkbookPoint
) => {
  const o1 = orientation(firstStart, firstEnd, secondStart);
  const o2 = orientation(firstStart, firstEnd, secondEnd);
  const o3 = orientation(secondStart, secondEnd, firstStart);
  const o4 = orientation(secondStart, secondEnd, firstEnd);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && isPointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (o2 === 0 && isPointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (o3 === 0 && isPointOnSegment(firstStart, secondStart, secondEnd)) return true;
  if (o4 === 0 && isPointOnSegment(firstEnd, secondStart, secondEnd)) return true;
  return false;
};

const segmentIntersectsRect = (
  start: WorkbookPoint,
  end: WorkbookPoint,
  rect: WorkbookSceneRect
) => {
  if (isInsideRect(start, rect) || isInsideRect(end, rect)) return true;
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const edges: Array<[WorkbookPoint, WorkbookPoint]> = [
    [
      { x: left, y: top },
      { x: right, y: top },
    ],
    [
      { x: right, y: top },
      { x: right, y: bottom },
    ],
    [
      { x: right, y: bottom },
      { x: left, y: bottom },
    ],
    [
      { x: left, y: bottom },
      { x: left, y: top },
    ],
  ];
  return edges.some(([edgeStart, edgeEnd]) =>
    segmentsIntersect(start, end, edgeStart, edgeEnd)
  );
};

const expandAreaSelectionRectForStroke = (
  rect: WorkbookSceneRect,
  stroke: WorkbookStroke
): WorkbookSceneRect => {
  const padding = Math.min(4, Math.max(1.5, (stroke.width ?? 2) / 4));
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
};

const shouldSelectStrokeInArea = (
  stroke: WorkbookStroke,
  rect: WorkbookSceneRect
) => {
  const strokeRect = getStrokeRect(stroke);
  if (!strokeRect || !rectIntersects(strokeRect, rect)) return false;

  const hitRect = expandAreaSelectionRectForStroke(rect, stroke);
  if (stroke.points.length === 1) {
    return isInsideRect(stroke.points[0], hitRect);
  }

  for (let index = 0; index < stroke.points.length - 1; index += 1) {
    if (segmentIntersectsRect(stroke.points[index], stroke.points[index + 1], hitRect)) {
      return true;
    }
  }
  return false;
};

export const buildAreaSelection = (
  rect: WorkbookSceneRect,
  boardObjects: WorkbookBoardObject[],
  strokes: WorkbookStroke[]
): WorkbookAreaSelection | null => {
  const objectIds = boardObjects
    .filter((object) => shouldSelectObjectInArea(object, rect))
    .map((object) => object.id);
  const strokeIds = strokes
    .filter((stroke) => shouldSelectStrokeInArea(stroke, rect))
    .map((stroke) => ({ id: stroke.id, layer: stroke.layer }));
  return objectIds.length > 0 || strokeIds.length > 0
    ? {
        objectIds,
        strokeIds,
        rect,
      }
    : null;
};

export const buildImageScissorsAreaSelection = (params: {
  rect: WorkbookSceneRect;
  probePoints: WorkbookPoint[];
  resolveTopObject: (point: WorkbookPoint) => WorkbookBoardObject | null;
}): WorkbookAreaSelection | null => {
  if (!hasMeaningfulAreaSelectionRect(params.rect)) return null;
  const seenImageIds = new Set<string>();
  for (const point of params.probePoints) {
    const topObject = params.resolveTopObject(point);
    if (!topObject || topObject.type !== "image" || seenImageIds.has(topObject.id)) {
      continue;
    }
    seenImageIds.add(topObject.id);
    if (!rectIntersects(getObjectRect(topObject), params.rect)) {
      continue;
    }
    return {
      objectIds: [topObject.id],
      strokeIds: [],
      rect: params.rect,
    };
  }
  return null;
};

export const collectAreaSelectionObjects = (
  areaSelection: WorkbookAreaSelection | null,
  objectById: Map<string, WorkbookBoardObject>
) =>
  areaSelection
    ? areaSelection.objectIds.reduce<WorkbookBoardObject[]>((acc, objectId) => {
        const object = objectById.get(objectId);
        if (object) {
          acc.push(object);
        }
        return acc;
      }, [])
    : [];

export const buildAreaSelectionProxyObject = (params: {
  rect: WorkbookSceneRect;
  layer: WorkbookLayer;
  authorUserId: string;
}): WorkbookBoardObject => ({
  id: "__area-selection__",
  type: "frame",
  layer: params.layer,
  x: params.rect.x,
  y: params.rect.y,
  width: params.rect.width,
  height: params.rect.height,
  color: "#2f4f7f",
  fill: "transparent",
  strokeWidth: 1,
  opacity: 1,
  authorUserId: params.authorUserId,
  createdAt: new Date().toISOString(),
});
