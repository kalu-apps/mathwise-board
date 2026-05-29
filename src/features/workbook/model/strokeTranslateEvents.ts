import type {
  WorkbookEventType,
  WorkbookLayer,
  WorkbookStroke,
} from "./types";

export type WorkbookStrokeTranslatePayload = {
  strokeIds: string[];
  dx: number;
  dy: number;
  page?: number;
  operationId?: string;
};

export const WORKBOOK_MAX_STROKE_TRANSLATE_IDS = 5_000;
const MAX_OPERATION_ID_LENGTH = 160;

export const buildWorkbookStrokeTranslateEventType = (
  layer: WorkbookLayer
): Extract<WorkbookEventType, "board.strokes.translate" | "annotations.strokes.translate"> =>
  layer === "annotations" ? "annotations.strokes.translate" : "board.strokes.translate";

export const resolveWorkbookStrokeTranslateLayer = (
  type: WorkbookEventType | string
): WorkbookLayer | null => {
  if (type === "board.strokes.translate") return "board";
  if (type === "annotations.strokes.translate") return "annotations";
  return null;
};

export const normalizeWorkbookStrokeTranslatePayload = (
  payload: unknown,
  options?: { maxStrokeIds?: number }
): WorkbookStrokeTranslatePayload | null => {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as {
    strokeIds?: unknown;
    dx?: unknown;
    dy?: unknown;
    page?: unknown;
    operationId?: unknown;
  };
  if (!Array.isArray(raw.strokeIds)) return null;
  const maxStrokeIds = Math.max(
    1,
    Math.trunc(options?.maxStrokeIds ?? WORKBOOK_MAX_STROKE_TRANSLATE_IDS)
  );
  const strokeIds: string[] = [];
  const seen = new Set<string>();
  for (const value of raw.strokeIds) {
    if (typeof value !== "string") continue;
    const strokeId = value.trim();
    if (!strokeId || seen.has(strokeId)) continue;
    seen.add(strokeId);
    strokeIds.push(strokeId);
    if (strokeIds.length >= maxStrokeIds) break;
  }
  const dx = typeof raw.dx === "number" && Number.isFinite(raw.dx) ? raw.dx : null;
  const dy = typeof raw.dy === "number" && Number.isFinite(raw.dy) ? raw.dy : null;
  if (strokeIds.length === 0 || dx === null || dy === null) return null;
  if (Math.abs(dx) <= 1e-6 && Math.abs(dy) <= 1e-6) return null;
  const page =
    typeof raw.page === "number" && Number.isFinite(raw.page)
      ? Math.max(1, Math.trunc(raw.page))
      : undefined;
  const operationId =
    typeof raw.operationId === "string" && raw.operationId.trim().length > 0
      ? raw.operationId.trim().slice(0, MAX_OPERATION_ID_LENGTH)
      : undefined;
  return {
    strokeIds,
    dx,
    dy,
    ...(page !== undefined ? { page } : {}),
    ...(operationId ? { operationId } : {}),
  };
};

export const translateWorkbookStroke = (
  stroke: WorkbookStroke,
  dx: number,
  dy: number
): WorkbookStroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({
    x: point.x + dx,
    y: point.y + dy,
  })),
});

export const translateWorkbookStrokesByIds = (
  current: WorkbookStroke[],
  strokeIds: readonly string[],
  dx: number,
  dy: number
) => {
  if (strokeIds.length === 0) return current;
  const strokeIdSet = new Set(strokeIds);
  let changed = false;
  const next = current.map((stroke) => {
    if (!strokeIdSet.has(stroke.id)) return stroke;
    changed = true;
    return translateWorkbookStroke(stroke, dx, dy);
  });
  return changed ? next : current;
};

export const rememberWorkbookStrokeTranslateOperationId = (
  operationIds: Set<string>,
  operationId: string | undefined,
  maxSize = 2_000
) => {
  if (!operationId) return;
  operationIds.add(operationId);
  if (operationIds.size <= maxSize) return;
  const idsToKeep = Array.from(operationIds).slice(-Math.max(1, Math.floor(maxSize / 2)));
  operationIds.clear();
  idsToKeep.forEach((id) => {
    operationIds.add(id);
  });
};
