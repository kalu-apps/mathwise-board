import type { WorkbookPageFrameBounds } from "./pageFrame";
import { getPointsBoundsFromPoints } from "./sceneGeometry";
import { resizeAreaSelectionRect, type WorkbookAreaSelectionResizeMode } from "./sceneSelection";
import type { WorkbookBoardObject, WorkbookPoint, WorkbookStroke } from "./types";

export type WorkbookAreaSelectionRectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkbookAreaSelectionResizeStateLike = {
  initialRect: WorkbookAreaSelectionRectLike;
  mode: WorkbookAreaSelectionResizeMode;
  current: WorkbookPoint;
};

export const resolveBoundedAreaSelectionResizeRect = (params: {
  resize: WorkbookAreaSelectionResizeStateLike;
  bounds: WorkbookPageFrameBounds;
}): WorkbookAreaSelectionRectLike => {
  const rawRect = resizeAreaSelectionRect(
    params.resize.initialRect,
    params.resize.mode,
    params.resize.current
  );
  const boundedLeft = Math.max(params.bounds.minX, rawRect.x);
  const boundedTop = Math.max(params.bounds.minY, rawRect.y);
  const boundedRight = Math.min(params.bounds.maxX, rawRect.x + rawRect.width);
  const boundedBottom = Math.min(params.bounds.maxY, rawRect.y + rawRect.height);
  return {
    x: boundedLeft,
    y: boundedTop,
    width: Math.max(1, boundedRight - boundedLeft),
    height: Math.max(1, boundedBottom - boundedTop),
  };
};

export const hasMeaningfulAreaSelectionResizeChange = (
  initialRect: WorkbookAreaSelectionRectLike,
  nextRect: WorkbookAreaSelectionRectLike
) =>
  Math.abs(nextRect.x - initialRect.x) > 0.5 ||
  Math.abs(nextRect.y - initialRect.y) > 0.5 ||
  Math.abs(nextRect.width - initialRect.width) > 0.5 ||
  Math.abs(nextRect.height - initialRect.height) > 0.5;

export const createAreaSelectionResizePointMapper = (params: {
  initialRect: WorkbookAreaSelectionRectLike;
  nextRect: WorkbookAreaSelectionRectLike;
}) => {
  const safeWidth = Math.max(1e-6, params.initialRect.width);
  const safeHeight = Math.max(1e-6, params.initialRect.height);
  return (point: WorkbookPoint): WorkbookPoint => ({
    x: params.nextRect.x + ((point.x - params.initialRect.x) / safeWidth) * params.nextRect.width,
    y: params.nextRect.y + ((point.y - params.initialRect.y) / safeHeight) * params.nextRect.height,
  });
};

export const remapAreaSelectionObject = (
  object: WorkbookBoardObject,
  remapPoint: (point: WorkbookPoint) => WorkbookPoint
): WorkbookBoardObject => {
  if (object.type === "line" || object.type === "arrow") {
    const mappedStart = remapPoint({ x: object.x, y: object.y });
    const mappedEnd = remapPoint({
      x: object.x + object.width,
      y: object.y + object.height,
    });
    return {
      ...object,
      x: mappedStart.x,
      y: mappedStart.y,
      width: mappedEnd.x - mappedStart.x,
      height: mappedEnd.y - mappedStart.y,
    };
  }
  if (Array.isArray(object.points) && object.points.length > 0) {
    const nextPoints = object.points.map(remapPoint);
    const nextBounds = getPointsBoundsFromPoints(nextPoints);
    return {
      ...object,
      x: nextBounds.minX,
      y: nextBounds.minY,
      width: nextBounds.width,
      height: nextBounds.height,
      points: nextPoints,
    };
  }
  const mappedStart = remapPoint({ x: object.x, y: object.y });
  const mappedEnd = remapPoint({
    x: object.x + object.width,
    y: object.y + object.height,
  });
  return {
    ...object,
    x: mappedStart.x,
    y: mappedStart.y,
    width: mappedEnd.x - mappedStart.x,
    height: mappedEnd.y - mappedStart.y,
  };
};

export const remapAreaSelectionStroke = (
  stroke: WorkbookStroke,
  remapPoint: (point: WorkbookPoint) => WorkbookPoint
): WorkbookStroke => ({
  ...stroke,
  points: stroke.points.map(remapPoint),
});
