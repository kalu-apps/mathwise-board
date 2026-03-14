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

export const resolveWorkbookObjectSceneLayerId = (object: WorkbookBoardObject) => {
  const layerId =
    object.meta && typeof object.meta === "object" && typeof object.meta.sceneLayerId === "string"
      ? object.meta.sceneLayerId
      : "";
  return layerId.trim() || "main";
};

export const buildWorkbookSceneLayerObjectGroups = (
  boardObjects: WorkbookBoardObject[]
) => {
  const result = new Map<string, WorkbookBoardObject[]>();
  boardObjects.forEach((object) => {
    if (object.pinned) return;
    const layerId = resolveWorkbookObjectSceneLayerId(object);
    const existing = result.get(layerId);
    if (existing) {
      existing.push(object);
    } else {
      result.set(layerId, [object]);
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

type WorkbookSceneRectIndex<T> = {
  cellSize: number;
  orderByKey: Map<string, number>;
  itemByKey: Map<string, T>;
  rectByKey: Map<string, WorkbookSceneRect>;
  nonIndexedKeys: string[];
  buckets: Map<string, string[]>;
};

const SCENE_HIT_INDEX_CELL_SIZE = 160;
const OBJECT_HIT_INDEX_PADDING = 24;
const STROKE_HIT_INDEX_PADDING = 12;

const buildRectIndexKey = (cellX: number, cellY: number) => `${cellX}:${cellY}`;

const expandRectForIndex = (
  rect: WorkbookSceneRect,
  padding: number
): WorkbookSceneRect => ({
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2,
});

const buildWorkbookSceneRectIndex = <T>(params: {
  items: T[];
  getKey: (item: T) => string;
  getRect: (item: T) => WorkbookSceneRect | null;
  cellSize?: number;
  padding?: number;
}): WorkbookSceneRectIndex<T> => {
  const cellSize = params.cellSize ?? SCENE_HIT_INDEX_CELL_SIZE;
  const padding = params.padding ?? 0;
  const orderByKey = new Map<string, number>();
  const itemByKey = new Map<string, T>();
  const rectByKey = new Map<string, WorkbookSceneRect>();
  const nonIndexedKeys: string[] = [];
  const buckets = new Map<string, string[]>();

  params.items.forEach((item, index) => {
    const key = params.getKey(item);
    const rect = params.getRect(item);
    orderByKey.set(key, index);
    itemByKey.set(key, item);
    if (!rect) {
      nonIndexedKeys.push(key);
      return;
    }
    const indexedRect = padding > 0 ? expandRectForIndex(rect, padding) : rect;
    rectByKey.set(key, indexedRect);
    const startX = Math.floor(indexedRect.x / cellSize);
    const endX = Math.floor((indexedRect.x + indexedRect.width) / cellSize);
    const startY = Math.floor(indexedRect.y / cellSize);
    const endY = Math.floor((indexedRect.y + indexedRect.height) / cellSize);
    for (let cellX = startX; cellX <= endX; cellX += 1) {
      for (let cellY = startY; cellY <= endY; cellY += 1) {
        const bucketKey = buildRectIndexKey(cellX, cellY);
        const bucket = buckets.get(bucketKey);
        if (bucket) {
          bucket.push(key);
        } else {
          buckets.set(bucketKey, [key]);
        }
      }
    }
  });

  return {
    cellSize,
    orderByKey,
    itemByKey,
    rectByKey,
    nonIndexedKeys,
    buckets,
  };
};

const sortSceneIndexKeys = <T>(index: WorkbookSceneRectIndex<T>, keys: string[]) => {
  keys.sort(
    (left, right) =>
      (index.orderByKey.get(left) ?? Number.POSITIVE_INFINITY) -
      (index.orderByKey.get(right) ?? Number.POSITIVE_INFINITY)
  );
  return keys;
};

const mapSceneIndexKeysToItems = <T>(index: WorkbookSceneRectIndex<T>, keys: string[]) =>
  keys
    .map((key) => index.itemByKey.get(key))
    .filter((item): item is T => Boolean(item));

const queryWorkbookSceneRectIndex = <T>(
  index: WorkbookSceneRectIndex<T>,
  point: WorkbookPoint
) => {
  const cellX = Math.floor(point.x / index.cellSize);
  const cellY = Math.floor(point.y / index.cellSize);
  const bucket = index.buckets.get(buildRectIndexKey(cellX, cellY));
  if (!bucket || bucket.length === 0) return [] as T[];
  const seen = new Set<string>();
  const keys = bucket.filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    const rect = index.rectByKey.get(key);
    if (!rect) return false;
    return isPointInsideSceneRect(point, rect);
  });
  return mapSceneIndexKeysToItems(index, sortSceneIndexKeys(index, keys));
};

const queryWorkbookSceneRectIndexByRect = <T>(
  index: WorkbookSceneRectIndex<T>,
  rect: WorkbookSceneRect
) => {
  const startX = Math.floor(rect.x / index.cellSize);
  const endX = Math.floor((rect.x + rect.width) / index.cellSize);
  const startY = Math.floor(rect.y / index.cellSize);
  const endY = Math.floor((rect.y + rect.height) / index.cellSize);
  const seen = new Set<string>();
  const keys: string[] = [];
  for (let cellX = startX; cellX <= endX; cellX += 1) {
    for (let cellY = startY; cellY <= endY; cellY += 1) {
      const bucket = index.buckets.get(buildRectIndexKey(cellX, cellY));
      if (!bucket || bucket.length === 0) continue;
      bucket.forEach((key) => {
        if (seen.has(key)) return;
        const keyRect = index.rectByKey.get(key);
        if (!keyRect || !rectIntersects(keyRect, rect)) return;
        seen.add(key);
        keys.push(key);
      });
    }
  }
  return mapSceneIndexKeysToItems(index, sortSceneIndexKeys(index, keys));
};

const collectSceneIndexItemsInRect = <T>(params: {
  index: WorkbookSceneRectIndex<T>;
  rect: WorkbookSceneRect;
  getKey: (item: T) => string;
  nonIndexedPredicate?: (item: T, rect: WorkbookSceneRect) => boolean;
}) => {
  const indexedItems = queryWorkbookSceneRectIndexByRect(params.index, params.rect);
  if (!params.nonIndexedPredicate || params.index.nonIndexedKeys.length === 0) {
    return indexedItems;
  }
  const seen = new Set(indexedItems.map((item) => params.getKey(item)));
  const merged = indexedItems.slice();
  params.index.nonIndexedKeys.forEach((key) => {
    if (seen.has(key)) return;
    const item = params.index.itemByKey.get(key);
    if (!item) return;
    if (!params.nonIndexedPredicate?.(item, params.rect)) return;
    seen.add(key);
    merged.push(item);
  });
  merged.sort(
    (left, right) =>
      (params.index.orderByKey.get(params.getKey(left)) ?? Number.POSITIVE_INFINITY) -
      (params.index.orderByKey.get(params.getKey(right)) ?? Number.POSITIVE_INFINITY)
  );
  return merged;
};

const appendForcedVisibleObjects = (params: {
  objects: WorkbookBoardObject[];
  index: WorkbookSceneRectIndex<WorkbookBoardObject>;
  objectById: Map<string, WorkbookBoardObject>;
  forcedVisibleObjectIds?: ReadonlySet<string>;
}) => {
  if (!params.forcedVisibleObjectIds || params.forcedVisibleObjectIds.size === 0) {
    return params.objects;
  }
  const seen = new Set(params.objects.map((object) => object.id));
  const merged = params.objects.slice();
  params.forcedVisibleObjectIds.forEach((objectId) => {
    if (seen.has(objectId)) return;
    const object = params.objectById.get(objectId);
    if (!object) return;
    seen.add(objectId);
    merged.push(object);
  });
  merged.sort(
    (left, right) =>
      (params.index.orderByKey.get(left.id) ?? Number.POSITIVE_INFINITY) -
      (params.index.orderByKey.get(right.id) ?? Number.POSITIVE_INFINITY)
  );
  return merged;
};

const isStrokeInsideRect = (stroke: WorkbookStroke, rect: WorkbookSceneRect) =>
  stroke.points.some((point) => isPointInsideSceneRect(point, rect));

const resolveSceneContentRect = (params: {
  sceneIndex: WorkbookSceneIndex;
  fallbackRect: WorkbookSceneRect;
}): WorkbookSceneRect => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const includeRect = (rect: WorkbookSceneRect | null | undefined) => {
    if (!rect) return;
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  };

  params.sceneIndex.boardObjects.forEach((object) => {
    includeRect(params.sceneIndex.getObjectRect(object));
  });
  params.sceneIndex.strokes.forEach((stroke) => {
    const strokeRect = getStrokeRect(stroke);
    if (strokeRect) {
      includeRect(strokeRect);
      return;
    }
    stroke.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return params.fallbackRect;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export type WorkbookSceneIndex = {
  boardObjects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
  objectById: Map<string, WorkbookBoardObject>;
  strokeByKey: Map<string, WorkbookStroke>;
  unpinnedSceneLayerObjectsById: Map<string, WorkbookBoardObject[]>;
  allObjectIndex: WorkbookSceneRectIndex<WorkbookBoardObject>;
  allStrokeIndex: WorkbookSceneRectIndex<WorkbookStroke>;
  getObjectRect: (object: WorkbookBoardObject) => WorkbookSceneRect;
};

export type WorkbookSceneAccess = {
  objectById: Map<string, WorkbookBoardObject>;
  strokeByKey: Map<string, WorkbookStroke>;
  unpinnedSceneLayerObjectsById: Map<string, WorkbookBoardObject[]>;
  boardObjectCandidatesInRect: (rect: WorkbookSceneRect) => WorkbookBoardObject[];
  strokeCandidatesInRect: (rect: WorkbookSceneRect) => WorkbookStroke[];
  viewportRect: WorkbookSceneRect;
  renderViewportRect: WorkbookSceneRect;
  visibleBoardObjects: WorkbookBoardObject[];
  visibleHitObjects: WorkbookBoardObject[];
  visibleHitObjectCandidatesAtPoint: (point: WorkbookPoint) => WorkbookBoardObject[];
  visibleHitObjectCandidatesInRect: (rect: WorkbookSceneRect) => WorkbookBoardObject[];
  visibleStrokes: WorkbookStroke[];
  visibleHitStrokes: WorkbookStroke[];
  visibleHitStrokeCandidatesAtPoint: (point: WorkbookPoint) => WorkbookStroke[];
  visibleHitStrokeCandidatesInRect: (rect: WorkbookSceneRect) => WorkbookStroke[];
};

export const buildWorkbookSceneIndex = (params: {
  boardObjects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
  getObjectRect: (object: WorkbookBoardObject) => WorkbookSceneRect;
}): WorkbookSceneIndex => {
  const allObjectIndex = buildWorkbookSceneRectIndex({
    items: params.boardObjects,
    getKey: (object) => object.id,
    getRect: params.getObjectRect,
  });
  const allStrokeIndex = buildWorkbookSceneRectIndex({
    items: params.strokes,
    getKey: (stroke) => `${stroke.layer}:${stroke.id}`,
    getRect: (stroke) => getStrokeRect(stroke),
  });
  return {
    boardObjects: params.boardObjects,
    strokes: params.strokes,
    objectById: buildWorkbookObjectLookup(params.boardObjects),
    strokeByKey: buildWorkbookStrokeLookup(params.strokes),
    unpinnedSceneLayerObjectsById: buildWorkbookSceneLayerObjectGroups(params.boardObjects),
    allObjectIndex,
    allStrokeIndex,
    getObjectRect: params.getObjectRect,
  };
};

export const buildWorkbookSceneAccessFromIndex = (params: {
  sceneIndex: WorkbookSceneIndex;
  viewportOffset: WorkbookPoint;
  width: number;
  height: number;
  zoom: number;
  visibilityMode?: "viewport" | "full";
  renderPadding?: number;
  hitPadding?: number;
  forcedVisibleObjectIds?: ReadonlySet<string>;
}): WorkbookSceneAccess => {
  const viewportRect = buildViewportSceneRect({
    viewportOffset: params.viewportOffset,
    width: params.width,
    height: params.height,
    zoom: params.zoom,
  });
  const renderPadding = params.renderPadding ?? 360;
  const hitPadding = params.hitPadding ?? 96;
  const visibilityMode = params.visibilityMode ?? "viewport";
  const sceneContentRect =
    visibilityMode === "full"
      ? resolveSceneContentRect({
          sceneIndex: params.sceneIndex,
          fallbackRect: viewportRect,
        })
      : viewportRect;
  const renderViewportRect = expandSceneRect(sceneContentRect, renderPadding);
  const hitViewportRect = expandSceneRect(sceneContentRect, hitPadding);
  const visibleBoardObjects =
    visibilityMode === "full"
      ? appendForcedVisibleObjects({
          objects: params.sceneIndex.boardObjects,
          index: params.sceneIndex.allObjectIndex,
          objectById: params.sceneIndex.objectById,
          forcedVisibleObjectIds: params.forcedVisibleObjectIds,
        })
      : appendForcedVisibleObjects({
          objects: collectSceneIndexItemsInRect({
            index: params.sceneIndex.allObjectIndex,
            rect: renderViewportRect,
            getKey: (object) => object.id,
          }),
          index: params.sceneIndex.allObjectIndex,
          objectById: params.sceneIndex.objectById,
          forcedVisibleObjectIds: params.forcedVisibleObjectIds,
        });
  const visibleHitObjects =
    visibilityMode === "full"
      ? appendForcedVisibleObjects({
          objects: params.sceneIndex.boardObjects,
          index: params.sceneIndex.allObjectIndex,
          objectById: params.sceneIndex.objectById,
          forcedVisibleObjectIds: params.forcedVisibleObjectIds,
        })
      : appendForcedVisibleObjects({
          objects: collectSceneIndexItemsInRect({
            index: params.sceneIndex.allObjectIndex,
            rect: hitViewportRect,
            getKey: (object) => object.id,
          }),
          index: params.sceneIndex.allObjectIndex,
          objectById: params.sceneIndex.objectById,
          forcedVisibleObjectIds: params.forcedVisibleObjectIds,
        });
  const visibleStrokes =
    visibilityMode === "full"
      ? params.sceneIndex.strokes
      : collectSceneIndexItemsInRect({
          index: params.sceneIndex.allStrokeIndex,
          rect: renderViewportRect,
          getKey: (stroke) => `${stroke.layer}:${stroke.id}`,
          nonIndexedPredicate: isStrokeInsideRect,
        });
  const visibleHitStrokes =
    visibilityMode === "full"
      ? params.sceneIndex.strokes
      : collectSceneIndexItemsInRect({
          index: params.sceneIndex.allStrokeIndex,
          rect: hitViewportRect,
          getKey: (stroke) => `${stroke.layer}:${stroke.id}`,
          nonIndexedPredicate: isStrokeInsideRect,
        });
  const objectHitIndex = buildWorkbookSceneRectIndex({
    items: visibleHitObjects,
    getKey: (object) => object.id,
    getRect: params.sceneIndex.getObjectRect,
    padding: OBJECT_HIT_INDEX_PADDING,
  });
  const strokeHitIndex = buildWorkbookSceneRectIndex({
    items: visibleHitStrokes,
    getKey: (stroke) => `${stroke.layer}:${stroke.id}`,
    getRect: (stroke) => getStrokeRect(stroke),
    padding: STROKE_HIT_INDEX_PADDING,
  });
  return {
    objectById: params.sceneIndex.objectById,
    strokeByKey: params.sceneIndex.strokeByKey,
    unpinnedSceneLayerObjectsById: params.sceneIndex.unpinnedSceneLayerObjectsById,
    boardObjectCandidatesInRect: (rect) =>
      collectSceneIndexItemsInRect({
        index: params.sceneIndex.allObjectIndex,
        rect,
        getKey: (object) => object.id,
      }),
    strokeCandidatesInRect: (rect) =>
      collectSceneIndexItemsInRect({
        index: params.sceneIndex.allStrokeIndex,
        rect,
        getKey: (stroke) => `${stroke.layer}:${stroke.id}`,
        nonIndexedPredicate: isStrokeInsideRect,
      }),
    viewportRect,
    renderViewportRect,
    visibleBoardObjects,
    visibleHitObjects,
    visibleHitObjectCandidatesAtPoint: (point) =>
      queryWorkbookSceneRectIndex(objectHitIndex, point),
    visibleHitObjectCandidatesInRect: (rect) =>
      queryWorkbookSceneRectIndexByRect(objectHitIndex, rect),
    visibleStrokes,
    visibleHitStrokes,
    visibleHitStrokeCandidatesAtPoint: (point) =>
      queryWorkbookSceneRectIndex(strokeHitIndex, point),
    visibleHitStrokeCandidatesInRect: (rect) =>
      queryWorkbookSceneRectIndexByRect(strokeHitIndex, rect),
  };
};

export const buildWorkbookSceneAccess = (params: {
  boardObjects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
  viewportOffset: WorkbookPoint;
  width: number;
  height: number;
  zoom: number;
  visibilityMode?: "viewport" | "full";
  renderPadding?: number;
  hitPadding?: number;
  forcedVisibleObjectIds?: ReadonlySet<string>;
  getObjectRect: (object: WorkbookBoardObject) => WorkbookSceneRect;
}): WorkbookSceneAccess =>
  buildWorkbookSceneAccessFromIndex({
    sceneIndex: buildWorkbookSceneIndex({
      boardObjects: params.boardObjects,
      strokes: params.strokes,
      getObjectRect: params.getObjectRect,
    }),
    viewportOffset: params.viewportOffset,
    width: params.width,
    height: params.height,
    zoom: params.zoom,
    visibilityMode: params.visibilityMode,
    renderPadding: params.renderPadding,
    hitPadding: params.hitPadding,
    forcedVisibleObjectIds: params.forcedVisibleObjectIds,
  });

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
