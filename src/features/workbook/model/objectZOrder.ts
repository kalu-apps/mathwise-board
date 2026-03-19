import type { WorkbookBoardObject } from "./types";

const MAIN_SCENE_LAYER_ID = "main";

const toFiniteInteger = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
};

const resolveWorkbookObjectPage = (object: Pick<WorkbookBoardObject, "page">) => {
  const page = toFiniteInteger(object.page);
  return page === null ? 1 : Math.max(1, page);
};

const resolveWorkbookObjectZOrderScope = (
  object: Pick<WorkbookBoardObject, "layer" | "page" | "meta" | "pinned">
) => ({
  page: resolveWorkbookObjectPage(object),
  layer: object.layer,
  sceneLayerId: resolveWorkbookObjectSceneLayerId(object),
  pinned: Boolean(object.pinned),
});

const areWorkbookObjectZOrderScopesEqual = (
  left: ReturnType<typeof resolveWorkbookObjectZOrderScope>,
  right: ReturnType<typeof resolveWorkbookObjectZOrderScope>
) =>
  left.page === right.page &&
  left.layer === right.layer &&
  left.sceneLayerId === right.sceneLayerId &&
  left.pinned === right.pinned;

export const normalizeWorkbookObjectZOrder = (value: unknown): number | undefined => {
  const normalized = toFiniteInteger(value);
  return normalized === null ? undefined : normalized;
};

export const resolveWorkbookObjectSceneLayerId = (
  object: Pick<WorkbookBoardObject, "meta">
) => {
  const layerId =
    object.meta && typeof object.meta === "object" && typeof object.meta.sceneLayerId === "string"
      ? object.meta.sceneLayerId
      : "";
  return layerId.trim() || MAIN_SCENE_LAYER_ID;
};

export const isWorkbookObjectInSameZOrderScope = (
  left: Pick<WorkbookBoardObject, "layer" | "page" | "meta" | "pinned">,
  right: Pick<WorkbookBoardObject, "layer" | "page" | "meta" | "pinned">
) =>
  areWorkbookObjectZOrderScopesEqual(
    resolveWorkbookObjectZOrderScope(left),
    resolveWorkbookObjectZOrderScope(right)
  );

export const resolveWorkbookObjectEffectiveZOrder = (
  object: Pick<WorkbookBoardObject, "zOrder">,
  fallbackOrder: number
) => normalizeWorkbookObjectZOrder(object.zOrder) ?? Math.trunc(fallbackOrder);

export const sortWorkbookObjectsByZOrder = (
  objects: WorkbookBoardObject[]
): WorkbookBoardObject[] =>
  objects
    .map((object, index) => ({
      object,
      index,
      zOrder: resolveWorkbookObjectEffectiveZOrder(object, index),
    }))
    .sort((left, right) => {
      if (left.zOrder !== right.zOrder) {
        return left.zOrder - right.zOrder;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.object);

export const ensureWorkbookObjectZOrder = (
  object: WorkbookBoardObject,
  currentObjects: WorkbookBoardObject[]
): WorkbookBoardObject => {
  if (normalizeWorkbookObjectZOrder(object.zOrder) !== undefined) {
    return object;
  }
  let maxZOrder = Number.NEGATIVE_INFINITY;
  currentObjects.forEach((candidate, index) => {
    if (!isWorkbookObjectInSameZOrderScope(candidate, object)) return;
    maxZOrder = Math.max(
      maxZOrder,
      resolveWorkbookObjectEffectiveZOrder(candidate, index)
    );
  });
  const nextZOrder = Number.isFinite(maxZOrder) ? maxZOrder + 1 : 0;
  return {
    ...object,
    zOrder: nextZOrder,
  };
};

export const resolveWorkbookObjectReorderZOrder = (params: {
  objects: WorkbookBoardObject[];
  targetObjectId: string;
  direction: "front" | "back";
}) => {
  if (!params.targetObjectId) return null;
  const target = params.objects.find((object) => object.id === params.targetObjectId);
  if (!target) return null;
  const scoped = params.objects
    .map((object, index) => ({
      object,
      index,
      zOrder: resolveWorkbookObjectEffectiveZOrder(object, index),
    }))
    .filter((entry) => isWorkbookObjectInSameZOrderScope(entry.object, target))
    .sort((left, right) => {
      if (left.zOrder !== right.zOrder) {
        return left.zOrder - right.zOrder;
      }
      return left.index - right.index;
    });
  if (scoped.length === 0) return null;
  const currentPosition = scoped.findIndex(
    (entry) => entry.object.id === params.targetObjectId
  );
  if (currentPosition < 0) return null;
  if (params.direction === "front") {
    if (currentPosition === scoped.length - 1) return null;
    return scoped[scoped.length - 1].zOrder + 1;
  }
  if (currentPosition === 0) return null;
  return scoped[0].zOrder - 1;
};
