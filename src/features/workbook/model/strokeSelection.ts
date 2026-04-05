import { getStrokeRect } from "./stroke";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";

export type WorkbookStrokeSelection = {
  id: string;
  layer: WorkbookLayer;
};

const STROKE_MOVE_PROXY_META_KEY = "__strokeMoveProxy";

type StrokeMoveProxyMeta = {
  [STROKE_MOVE_PROXY_META_KEY]: true;
  strokeId: string;
  strokeLayer: WorkbookLayer;
};

const asStrokeMoveProxyMeta = (value: unknown): StrokeMoveProxyMeta | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<StrokeMoveProxyMeta>;
  if (raw[STROKE_MOVE_PROXY_META_KEY] !== true) return null;
  if (typeof raw.strokeId !== "string" || raw.strokeId.trim().length === 0) return null;
  if (raw.strokeLayer !== "board" && raw.strokeLayer !== "annotations") return null;
  return {
    [STROKE_MOVE_PROXY_META_KEY]: true,
    strokeId: raw.strokeId,
    strokeLayer: raw.strokeLayer,
  };
};

export const buildWorkbookStrokeSelectionKey = (
  selection: WorkbookStrokeSelection | null
) => (selection ? `${selection.layer}:${selection.id}` : "");

export const buildWorkbookStrokeMoveProxyObject = (
  stroke: WorkbookStroke,
  authorUserId: string
): WorkbookBoardObject | null => {
  const rect = getStrokeRect(stroke);
  if (!rect) return null;
  const safeAuthorUserId = authorUserId.trim().length > 0 ? authorUserId : "unknown";
  return {
    id: `__stroke-move__:${stroke.layer}:${stroke.id}`,
    type: "frame",
    layer: stroke.layer,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: "#2f4f7f",
    fill: "transparent",
    strokeWidth: 1,
    opacity: 1,
    points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
    meta: {
      [STROKE_MOVE_PROXY_META_KEY]: true,
      strokeId: stroke.id,
      strokeLayer: stroke.layer,
    } satisfies StrokeMoveProxyMeta,
    authorUserId: safeAuthorUserId,
    createdAt: new Date().toISOString(),
  };
};

export const resolveWorkbookStrokeMoveProxySelection = (
  object: WorkbookBoardObject
): WorkbookStrokeSelection | null => {
  const meta = asStrokeMoveProxyMeta(object.meta);
  if (!meta) return null;
  return {
    id: meta.strokeId,
    layer: meta.strokeLayer,
  };
};

export const translateWorkbookStrokePoints = (
  points: WorkbookPoint[],
  deltaX: number,
  deltaY: number
) =>
  points.map((point) => ({
    x: point.x + deltaX,
    y: point.y + deltaY,
  }));
