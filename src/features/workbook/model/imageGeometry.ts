import { WORKBOOK_IMAGE_ASPECT_RATIO_META_KEY } from "./scene";
import type { WorkbookBoardObject } from "./types";

const MIN_IMAGE_ASPECT_RATIO = 1e-4;
const MAX_IMAGE_ASPECT_RATIO = 1e4;

const sanitizeAspectRatio = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < MIN_IMAGE_ASPECT_RATIO || numeric > MAX_IMAGE_ASPECT_RATIO) {
    return null;
  }
  return numeric;
};

export const resolveWorkbookImageAspectRatioFromDimensions = (params: {
  width?: number;
  height?: number;
}): number | null => {
  const width = Number(params.width);
  const height = Number(params.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return sanitizeAspectRatio(width / height);
};

export const readWorkbookImageAspectRatioMeta = (
  object: Pick<WorkbookBoardObject, "type" | "meta" | "width" | "height">
): number | null => {
  if (object.type !== "image") return null;
  const metaRatio = sanitizeAspectRatio(
    object.meta?.[WORKBOOK_IMAGE_ASPECT_RATIO_META_KEY]
  );
  if (metaRatio) return metaRatio;
  return resolveWorkbookImageAspectRatioFromDimensions({
    width: Math.abs(object.width),
    height: Math.abs(object.height),
  });
};

export const withWorkbookImageAspectRatioMeta = <T extends WorkbookBoardObject>(
  object: T,
  ratio: number | null
): T => {
  if (object.type !== "image") return object;
  const safeRatio = sanitizeAspectRatio(ratio);
  if (!safeRatio) return object;
  return {
    ...object,
    meta: {
      ...(object.meta ?? {}),
      [WORKBOOK_IMAGE_ASPECT_RATIO_META_KEY]: safeRatio,
    },
  };
};
