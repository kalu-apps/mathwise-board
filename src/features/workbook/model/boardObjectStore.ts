import { mergeBoardObjectWithPatch } from "./runtime";
import type { WorkbookBoardObject } from "./types";

export type WorkbookBoardObjectIndex = Map<string, number>;

export const buildWorkbookBoardObjectIndex = (
  objects: WorkbookBoardObject[]
): WorkbookBoardObjectIndex => {
  const index = new Map<string, number>();
  objects.forEach((object, position) => {
    index.set(object.id, position);
  });
  return index;
};

export const resolveWorkbookBoardObjectPosition = (
  objects: WorkbookBoardObject[],
  objectId: string,
  index?: WorkbookBoardObjectIndex | null
) => {
  const indexedPosition = index?.get(objectId);
  if (
    typeof indexedPosition === "number" &&
    indexedPosition >= 0 &&
    indexedPosition < objects.length &&
    objects[indexedPosition]?.id === objectId
  ) {
    return indexedPosition;
  }
  return objects.findIndex((item) => item.id === objectId);
};

export const replaceWorkbookBoardObjectAt = (
  objects: WorkbookBoardObject[],
  position: number,
  nextObject: WorkbookBoardObject
) => {
  if (position < 0 || position >= objects.length) return objects;
  if (objects[position] === nextObject) return objects;
  const next = objects.slice();
  next[position] = nextObject;
  return next;
};

export const applyWorkbookBoardObjectPatchById = (params: {
  objects: WorkbookBoardObject[];
  objectId: string;
  patch: Partial<WorkbookBoardObject>;
  index?: WorkbookBoardObjectIndex | null;
}) => {
  const position = resolveWorkbookBoardObjectPosition(
    params.objects,
    params.objectId,
    params.index
  );
  if (position < 0) {
    return {
      nextObjects: params.objects,
      updatedObject: null,
      position: -1,
    };
  }
  const currentObject = params.objects[position];
  const updatedObject = mergeBoardObjectWithPatch(currentObject, params.patch);
  if (updatedObject === currentObject) {
    return {
      nextObjects: params.objects,
      updatedObject,
      position,
    };
  }
  return {
    nextObjects: replaceWorkbookBoardObjectAt(
      params.objects,
      position,
      updatedObject
    ),
    updatedObject,
    position,
  };
};
