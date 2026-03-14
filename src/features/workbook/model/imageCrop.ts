import type { WorkbookBoardObject } from "./types";

export type WorkbookImageCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkbookImageCropOriginFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type WorkbookRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const EPSILON = 1e-4;
const MIN_RATIO = 1e-3;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const sanitizeCropRect = (value: unknown): WorkbookImageCropRect | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<WorkbookImageCropRect>;
  if (
    !isFiniteNumber(source.x) ||
    !isFiniteNumber(source.y) ||
    !isFiniteNumber(source.width) ||
    !isFiniteNumber(source.height)
  ) {
    return null;
  }
  const x = clamp(source.x, 0, 1);
  const y = clamp(source.y, 0, 1);
  const right = clamp(source.x + source.width, 0, 1);
  const bottom = clamp(source.y + source.height, 0, 1);
  const width = right - x;
  const height = bottom - y;
  if (width < MIN_RATIO || height < MIN_RATIO) return null;
  return { x, y, width, height };
};

const sanitizeOriginFrame = (value: unknown): WorkbookImageCropOriginFrame | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<WorkbookImageCropOriginFrame>;
  if (
    !isFiniteNumber(source.x) ||
    !isFiniteNumber(source.y) ||
    !isFiniteNumber(source.width) ||
    !isFiniteNumber(source.height)
  ) {
    return null;
  }
  return {
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
    rotation: isFiniteNumber(source.rotation) ? source.rotation : 0,
  };
};

const isCropRectDefault = (crop: WorkbookImageCropRect) =>
  Math.abs(crop.x) <= EPSILON &&
  Math.abs(crop.y) <= EPSILON &&
  Math.abs(crop.width - 1) <= EPSILON &&
  Math.abs(crop.height - 1) <= EPSILON;

const areCropRectsEqual = (left: WorkbookImageCropRect, right: WorkbookImageCropRect) =>
  Math.abs(left.x - right.x) <= EPSILON &&
  Math.abs(left.y - right.y) <= EPSILON &&
  Math.abs(left.width - right.width) <= EPSILON &&
  Math.abs(left.height - right.height) <= EPSILON;

const normalizeRect = (rect: WorkbookRect): WorkbookRect => {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return {
    x: Math.min(rect.x, right),
    y: Math.min(rect.y, bottom),
    width: Math.max(1, Math.abs(rect.width)),
    height: Math.max(1, Math.abs(rect.height)),
  };
};

const resolveIntersectionRect = (
  left: WorkbookRect,
  right: WorkbookRect
): WorkbookRect | null => {
  const l = normalizeRect(left);
  const r = normalizeRect(right);
  const x1 = Math.max(l.x, r.x);
  const y1 = Math.max(l.y, r.y);
  const x2 = Math.min(l.x + l.width, r.x + r.width);
  const y2 = Math.min(l.y + l.height, r.y + r.height);
  if (x2 - x1 <= EPSILON || y2 - y1 <= EPSILON) return null;
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
};

const toLocalCropRect = (
  intersectionRect: WorkbookRect,
  sourceRect: WorkbookRect
): WorkbookImageCropRect => ({
  x: clamp((intersectionRect.x - sourceRect.x) / sourceRect.width, 0, 1),
  y: clamp((intersectionRect.y - sourceRect.y) / sourceRect.height, 0, 1),
  width: clamp(intersectionRect.width / sourceRect.width, MIN_RATIO, 1),
  height: clamp(intersectionRect.height / sourceRect.height, MIN_RATIO, 1),
});

const composeCropRect = (
  base: WorkbookImageCropRect,
  local: WorkbookImageCropRect
): WorkbookImageCropRect => {
  const x = clamp(base.x + local.x * base.width, 0, 1);
  const y = clamp(base.y + local.y * base.height, 0, 1);
  const right = clamp(base.x + (local.x + local.width) * base.width, 0, 1);
  const bottom = clamp(base.y + (local.y + local.height) * base.height, 0, 1);
  return {
    x,
    y,
    width: Math.max(MIN_RATIO, right - x),
    height: Math.max(MIN_RATIO, bottom - y),
  };
};

const readMetaRecord = (object: WorkbookBoardObject) =>
  object.meta && typeof object.meta === "object" && !Array.isArray(object.meta)
    ? (object.meta as Record<string, unknown>)
    : null;

export const resolveWorkbookObjectAxisAlignedRect = (
  object: Pick<WorkbookBoardObject, "x" | "y" | "width" | "height">
): WorkbookRect =>
  normalizeRect({
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  });

export const resolveWorkbookImageCropState = (object: WorkbookBoardObject) => {
  const meta = readMetaRecord(object);
  const crop = sanitizeCropRect(meta?.imageCrop);
  const originFrame = sanitizeOriginFrame(meta?.imageCropOriginFrame);
  const hasCrop = Boolean(crop && !isCropRectDefault(crop));
  return {
    crop: hasCrop ? crop : null,
    originFrame,
    hasCrop,
  };
};

export const isWorkbookImageCropActive = (object: WorkbookBoardObject) =>
  resolveWorkbookImageCropState(object).hasCrop;

export const resolveWorkbookImageCropProjection = (params: {
  frame: WorkbookRect;
  crop: WorkbookImageCropRect;
}) => {
  const safeWidth = Math.max(MIN_RATIO, params.crop.width);
  const safeHeight = Math.max(MIN_RATIO, params.crop.height);
  const width = params.frame.width / safeWidth;
  const height = params.frame.height / safeHeight;
  return {
    x: params.frame.x - params.crop.x * width,
    y: params.frame.y - params.crop.y * height,
    width,
    height,
  };
};

export const buildWorkbookImageCropUpdate = (params: {
  object: WorkbookBoardObject;
  selectionRect: WorkbookRect;
}): Partial<WorkbookBoardObject> | null => {
  if (params.object.type !== "image") return null;
  const objectRect = resolveWorkbookObjectAxisAlignedRect(params.object);
  const selectionRect = normalizeRect(params.selectionRect);
  const intersection = resolveIntersectionRect(objectRect, selectionRect);
  if (!intersection) return null;
  const localCrop = toLocalCropRect(intersection, objectRect);
  const cropState = resolveWorkbookImageCropState(params.object);
  const currentCrop = cropState.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const nextCrop = composeCropRect(currentCrop, localCrop);
  const nextRect = normalizeRect(intersection);
  const objectAlreadyNormalized =
    Math.abs(params.object.x - nextRect.x) <= EPSILON &&
    Math.abs(params.object.y - nextRect.y) <= EPSILON &&
    Math.abs(Math.abs(params.object.width) - nextRect.width) <= EPSILON &&
    Math.abs(Math.abs(params.object.height) - nextRect.height) <= EPSILON;
  if (areCropRectsEqual(currentCrop, nextCrop) && objectAlreadyNormalized) {
    return null;
  }
  const originFrame = cropState.originFrame ?? {
    x: params.object.x,
    y: params.object.y,
    width: params.object.width,
    height: params.object.height,
    rotation:
      typeof params.object.rotation === "number" && Number.isFinite(params.object.rotation)
        ? params.object.rotation
        : 0,
  };
  return {
    x: nextRect.x,
    y: nextRect.y,
    width: nextRect.width,
    height: nextRect.height,
    meta: {
      imageCrop: nextCrop,
      imageCropOriginFrame: originFrame,
      imageCropVersion: 1,
    },
  };
};

export const buildWorkbookImageCropRestoreUpdate = (
  object: WorkbookBoardObject
): Partial<WorkbookBoardObject> | null => {
  if (object.type !== "image") return null;
  const cropState = resolveWorkbookImageCropState(object);
  if (!cropState.hasCrop && !cropState.originFrame) return null;
  const patch: Partial<WorkbookBoardObject> = {
    meta: {
      imageCrop: null,
      imageCropOriginFrame: null,
      imageCropVersion: null,
    },
  };
  if (cropState.originFrame) {
    patch.x = cropState.originFrame.x;
    patch.y = cropState.originFrame.y;
    patch.width = cropState.originFrame.width;
    patch.height = cropState.originFrame.height;
    patch.rotation = cropState.originFrame.rotation;
  }
  return patch;
};
