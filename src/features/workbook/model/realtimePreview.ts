import type { WorkbookBoardObject, WorkbookPoint } from "./types";

const COORD_DELTA_EPSILON = 0.01;
const REALTIME_META_PATCH_MAX_SIGNATURE = 8_192;

export const REALTIME_PREVIEW_REPEAT_GUARD_MS = 120;

export const hasCoordChanged = (left: number, right: number) =>
  Math.abs(left - right) > COORD_DELTA_EPSILON;

export const arePointsEqual = (
  left: WorkbookPoint[] | undefined,
  right: WorkbookPoint[] | undefined
) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (
      hasCoordChanged(left[index].x, right[index].x) ||
      hasCoordChanged(left[index].y, right[index].y)
    ) {
      return false;
    }
  }
  return true;
};

export const toStableSignature = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
};

export const buildRealtimeObjectPatch = (
  base: WorkbookBoardObject,
  preview: WorkbookBoardObject
): Partial<WorkbookBoardObject> | null => {
  const patch: Partial<WorkbookBoardObject> = {};
  if (hasCoordChanged(base.x, preview.x)) patch.x = preview.x;
  if (hasCoordChanged(base.y, preview.y)) patch.y = preview.y;
  if (hasCoordChanged(base.width, preview.width)) patch.width = preview.width;
  if (hasCoordChanged(base.height, preview.height)) patch.height = preview.height;
  if (hasCoordChanged(base.rotation ?? 0, preview.rotation ?? 0)) {
    patch.rotation = preview.rotation;
  }
  const basePoints = Array.isArray(base.points) ? base.points : undefined;
  const previewPoints = Array.isArray(preview.points) ? preview.points : undefined;
  if (!arePointsEqual(basePoints, previewPoints)) {
    patch.points = previewPoints;
  }
  const baseMetaSignature = toStableSignature(base.meta ?? null);
  const previewMetaSignature = toStableSignature(preview.meta ?? null);
  if (baseMetaSignature !== previewMetaSignature) {
    const previewMeta =
      preview.meta && typeof preview.meta === "object" && !Array.isArray(preview.meta)
        ? (preview.meta as Record<string, unknown>)
        : null;
    const baseMeta =
      base.meta && typeof base.meta === "object" && !Array.isArray(base.meta)
        ? (base.meta as Record<string, unknown>)
        : null;

    // For 3D objects stream only live camera/view deltas; full 3D state is committed on finalize.
    if (preview.type === "solid3d" && previewMeta) {
      const previewView =
        previewMeta.view && typeof previewMeta.view === "object" && !Array.isArray(previewMeta.view)
          ? (previewMeta.view as Record<string, unknown>)
          : null;
      const baseView =
        baseMeta?.view && typeof baseMeta.view === "object" && !Array.isArray(baseMeta.view)
          ? (baseMeta.view as Record<string, unknown>)
          : null;
      if (toStableSignature(baseView ?? null) !== toStableSignature(previewView ?? null)) {
        patch.meta = { view: previewView ?? null };
      }
    } else if (previewMetaSignature.length <= REALTIME_META_PATCH_MAX_SIGNATURE) {
      patch.meta = preview.meta;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
};
