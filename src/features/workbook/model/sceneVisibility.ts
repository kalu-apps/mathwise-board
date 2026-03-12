import { getStrokeRect } from "./stroke";
import type { WorkbookBoardObject, WorkbookPoint, WorkbookStroke } from "./types";

export type WorkbookSceneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const rectIntersects = (a: WorkbookSceneRect, b: WorkbookSceneRect) =>
  a.x <= b.x + b.width &&
  a.x + a.width >= b.x &&
  a.y <= b.y + b.height &&
  a.y + a.height >= b.y;

export const expandSceneRect = (
  rect: WorkbookSceneRect,
  padding: number
): WorkbookSceneRect => ({
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2,
});

export const isPointInsideSceneRect = (
  point: WorkbookPoint,
  rect: WorkbookSceneRect
) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const buildViewportSceneRect = (params: {
  viewportOffset: WorkbookPoint;
  width: number;
  height: number;
  zoom: number;
}): WorkbookSceneRect => ({
  x: Math.max(0, params.viewportOffset.x),
  y: Math.max(0, params.viewportOffset.y),
  width: Math.max(1, params.width / params.zoom),
  height: Math.max(1, params.height / params.zoom),
});

export const buildWorkbookObjectLookup = (boardObjects: WorkbookBoardObject[]) =>
  new Map(boardObjects.map((object) => [object.id, object]));

export const buildWorkbookStrokeLookup = (strokes: WorkbookStroke[]) =>
  new Map(strokes.map((stroke) => [`${stroke.layer}:${stroke.id}`, stroke]));

export const buildForcedVisibleObjectIdSet = (
  ids: Array<string | null | undefined>
) => {
  const result = new Set<string>();
  ids.forEach((id) => {
    if (typeof id === "string" && id.trim().length > 0) {
      result.add(id);
    }
  });
  return result;
};

export const filterVisibleBoardObjects = (params: {
  boardObjects: WorkbookBoardObject[];
  viewportRect: WorkbookSceneRect;
  padding: number;
  forcedVisibleObjectIds?: ReadonlySet<string>;
  getObjectRect: (object: WorkbookBoardObject) => WorkbookSceneRect;
}) => {
  const expandedViewport = expandSceneRect(params.viewportRect, params.padding);
  return params.boardObjects.filter(
    (object) =>
      params.forcedVisibleObjectIds?.has(object.id) ||
      rectIntersects(params.getObjectRect(object), expandedViewport)
  );
};

export const filterVisibleStrokes = (params: {
  strokes: WorkbookStroke[];
  viewportRect: WorkbookSceneRect;
  padding: number;
}) => {
  const expandedViewport = expandSceneRect(params.viewportRect, params.padding);
  return params.strokes.filter((stroke) => {
    const strokeRect = getStrokeRect(stroke);
    if (strokeRect) {
      return rectIntersects(strokeRect, expandedViewport);
    }
    return stroke.points.some((point) => isPointInsideSceneRect(point, expandedViewport));
  });
};

export type WorkbookSceneAccess = {
  objectById: Map<string, WorkbookBoardObject>;
  strokeByKey: Map<string, WorkbookStroke>;
  viewportRect: WorkbookSceneRect;
  renderViewportRect: WorkbookSceneRect;
  visibleBoardObjects: WorkbookBoardObject[];
  visibleHitObjects: WorkbookBoardObject[];
  visibleStrokes: WorkbookStroke[];
  visibleHitStrokes: WorkbookStroke[];
};

export const buildWorkbookSceneAccess = (params: {
  boardObjects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
  viewportOffset: WorkbookPoint;
  width: number;
  height: number;
  zoom: number;
  renderPadding?: number;
  hitPadding?: number;
  forcedVisibleObjectIds?: ReadonlySet<string>;
  getObjectRect: (object: WorkbookBoardObject) => WorkbookSceneRect;
}): WorkbookSceneAccess => {
  const viewportRect = buildViewportSceneRect({
    viewportOffset: params.viewportOffset,
    width: params.width,
    height: params.height,
    zoom: params.zoom,
  });
  const renderPadding = params.renderPadding ?? 360;
  const hitPadding = params.hitPadding ?? 96;
  return {
    objectById: buildWorkbookObjectLookup(params.boardObjects),
    strokeByKey: buildWorkbookStrokeLookup(params.strokes),
    viewportRect,
    renderViewportRect: expandSceneRect(viewportRect, renderPadding),
    visibleBoardObjects: filterVisibleBoardObjects({
      boardObjects: params.boardObjects,
      viewportRect,
      padding: renderPadding,
      forcedVisibleObjectIds: params.forcedVisibleObjectIds,
      getObjectRect: params.getObjectRect,
    }),
    visibleHitObjects: filterVisibleBoardObjects({
      boardObjects: params.boardObjects,
      viewportRect,
      padding: hitPadding,
      forcedVisibleObjectIds: params.forcedVisibleObjectIds,
      getObjectRect: params.getObjectRect,
    }),
    visibleStrokes: filterVisibleStrokes({
      strokes: params.strokes,
      viewportRect,
      padding: renderPadding,
    }),
    visibleHitStrokes: filterVisibleStrokes({
      strokes: params.strokes,
      viewportRect,
      padding: hitPadding,
    }),
  };
};

export const resolveTopVisibleBoardObject = (
  boardObjects: WorkbookBoardObject[],
  predicate: (object: WorkbookBoardObject) => boolean
) => {
  for (let index = boardObjects.length - 1; index >= 0; index -= 1) {
    const object = boardObjects[index];
    if (object.locked) continue;
    if (predicate(object)) {
      return object;
    }
  }
  return null;
};

export const resolveTopVisibleStroke = (
  strokes: WorkbookStroke[],
  predicate: (stroke: WorkbookStroke) => boolean
) => {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (predicate(stroke)) {
      return stroke;
    }
  }
  return null;
};
