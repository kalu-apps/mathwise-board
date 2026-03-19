import { getObjectRect } from "./sceneGeometry";
import type { WorkbookBoardObject, WorkbookPoint } from "./types";

export type WorkbookPageFrameBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export const WORKBOOK_PAGE_FRAME_PORTRAIT_RATIO = 210 / 297;
export const WORKBOOK_PAGE_FRAME_WIDTH = 1200;

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const toFiniteNumber = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

export const resolveWorkbookPageFrameBounds = (
  width = WORKBOOK_PAGE_FRAME_WIDTH
): WorkbookPageFrameBounds => {
  const safeWidth = Math.max(320, Math.round(toFiniteNumber(width, WORKBOOK_PAGE_FRAME_WIDTH)));
  const safeHeight = Math.max(320, Math.round(safeWidth / WORKBOOK_PAGE_FRAME_PORTRAIT_RATIO));
  return {
    minX: 0,
    minY: 0,
    maxX: safeWidth,
    maxY: safeHeight,
    width: safeWidth,
    height: safeHeight,
  };
};

export const clampWorkbookPointToPageFrame = (
  point: WorkbookPoint,
  bounds: WorkbookPageFrameBounds
): WorkbookPoint => ({
  x: clampNumber(
    toFiniteNumber(point.x, bounds.minX),
    bounds.minX,
    bounds.maxX
  ),
  y: clampNumber(
    toFiniteNumber(point.y, bounds.minY),
    bounds.minY,
    bounds.maxY
  ),
});

export const clampWorkbookViewportOffsetToPageFrame = (params: {
  offset: WorkbookPoint;
  bounds: WorkbookPageFrameBounds;
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const viewportWidth = Math.max(1, toFiniteNumber(params.viewportWidth, params.bounds.width));
  const viewportHeight = Math.max(
    1,
    toFiniteNumber(params.viewportHeight, params.bounds.height)
  );
  const maxX = Math.max(params.bounds.minX, params.bounds.maxX - viewportWidth);
  const maxY = Math.max(params.bounds.minY, params.bounds.maxY - viewportHeight);
  return {
    x: clampNumber(
      toFiniteNumber(params.offset.x, params.bounds.minX),
      params.bounds.minX,
      maxX
    ),
    y: clampNumber(
      toFiniteNumber(params.offset.y, params.bounds.minY),
      params.bounds.minY,
      maxY
    ),
  };
};

const translateWorkbookObject = (
  object: WorkbookBoardObject,
  deltaX: number,
  deltaY: number
): WorkbookBoardObject => {
  if (Math.abs(deltaX) <= 1e-6 && Math.abs(deltaY) <= 1e-6) return object;
  return {
    ...object,
    x: object.type === "section_divider" ? object.x : object.x + deltaX,
    y: object.y + deltaY,
    points: Array.isArray(object.points)
      ? object.points.map((point) => ({
          x: point.x + deltaX,
          y: point.y + deltaY,
        }))
      : object.points,
  };
};

export const clampWorkbookObjectToPageFrame = (
  object: WorkbookBoardObject,
  bounds: WorkbookPageFrameBounds
): WorkbookBoardObject => {
  const rect = getObjectRect(object);
  let deltaX = 0;
  let deltaY = 0;

  if (rect.width <= bounds.width) {
    if (rect.x < bounds.minX) {
      deltaX = bounds.minX - rect.x;
    } else if (rect.x + rect.width > bounds.maxX) {
      deltaX = bounds.maxX - (rect.x + rect.width);
    }
  } else {
    deltaX = bounds.minX - rect.x;
  }

  if (rect.height <= bounds.height) {
    if (rect.y < bounds.minY) {
      deltaY = bounds.minY - rect.y;
    } else if (rect.y + rect.height > bounds.maxY) {
      deltaY = bounds.maxY - (rect.y + rect.height);
    }
  } else {
    deltaY = bounds.minY - rect.y;
  }

  return translateWorkbookObject(object, deltaX, deltaY);
};
