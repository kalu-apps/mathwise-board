import { getObjectRect, normalizeRect } from "./sceneGeometry";
import { getStrokeRect } from "./stroke";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";
import { rectIntersects, type WorkbookSceneRect } from "./sceneVisibility";

export type WorkbookAreaSelection = {
  objectIds: string[];
  strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
  rect: WorkbookSceneRect;
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

export const buildAreaSelection = (
  rect: WorkbookSceneRect,
  boardObjects: WorkbookBoardObject[],
  strokes: WorkbookStroke[]
): WorkbookAreaSelection | null => {
  const objectIds = boardObjects
    .filter((object) => rectIntersects(getObjectRect(object), rect))
    .map((object) => object.id);
  const strokeIds = strokes
    .filter((stroke) => {
      const strokeRect = getStrokeRect(stroke);
      return strokeRect ? rectIntersects(strokeRect, rect) : false;
    })
    .map((stroke) => ({ id: stroke.id, layer: stroke.layer }));
  return objectIds.length > 0 || strokeIds.length > 0
    ? {
        objectIds,
        strokeIds,
        rect,
      }
    : null;
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
