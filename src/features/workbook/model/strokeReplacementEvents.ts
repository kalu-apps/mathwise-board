import type { WorkbookEvent } from "./types";

type StrokeReplacementLayer = "board" | "annotations";

const resolveStrokeLayerFromEventType = (type: WorkbookEvent["type"]): StrokeReplacementLayer | null => {
  if (type === "board.stroke" || type === "board.stroke.delete") return "board";
  if (type === "annotations.stroke" || type === "annotations.stroke.delete") return "annotations";
  return null;
};

const normalizeStrokeId = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const getWorkbookStrokeDeleteReplacementKey = (
  event: Pick<WorkbookEvent, "type" | "payload">
): string | null => {
  const layer = resolveStrokeLayerFromEventType(event.type);
  if (!layer || (event.type !== "board.stroke.delete" && event.type !== "annotations.stroke.delete")) {
    return null;
  }
  const strokeId = normalizeStrokeId((event.payload as { strokeId?: unknown })?.strokeId);
  return strokeId ? `${layer}:${strokeId}` : null;
};

export const getWorkbookStrokeUpsertReplacementKey = (
  event: Pick<WorkbookEvent, "type" | "payload">
): string | null => {
  const layer = resolveStrokeLayerFromEventType(event.type);
  if (!layer || (event.type !== "board.stroke" && event.type !== "annotations.stroke")) {
    return null;
  }
  const stroke = (event.payload as { stroke?: unknown })?.stroke;
  if (!stroke || typeof stroke !== "object") return null;
  const typedStroke = stroke as { id?: unknown; layer?: unknown };
  if (typedStroke.layer !== layer) return null;
  const strokeId = normalizeStrokeId(typedStroke.id);
  return strokeId ? `${layer}:${strokeId}` : null;
};

export const isWorkbookStrokeReplacementPair = (
  deleteEvent: Pick<WorkbookEvent, "type" | "payload"> | undefined,
  upsertEvent: Pick<WorkbookEvent, "type" | "payload"> | undefined
) => {
  if (!deleteEvent || !upsertEvent) return false;
  const deleteKey = getWorkbookStrokeDeleteReplacementKey(deleteEvent);
  return Boolean(deleteKey && deleteKey === getWorkbookStrokeUpsertReplacementKey(upsertEvent));
};

export const findVisuallyAbsorbedWorkbookStrokeDeleteIndexes = (
  events: Array<Pick<WorkbookEvent, "type" | "payload">>
) => {
  const pendingDeleteIndexesByKey = new Map<string, number[]>();
  const absorbedIndexes = new Set<number>();

  events.forEach((event, index) => {
    const deleteKey = getWorkbookStrokeDeleteReplacementKey(event);
    if (deleteKey) {
      const indexes = pendingDeleteIndexesByKey.get(deleteKey) ?? [];
      indexes.push(index);
      pendingDeleteIndexesByKey.set(deleteKey, indexes);
      return;
    }

    const upsertKey = getWorkbookStrokeUpsertReplacementKey(event);
    if (!upsertKey) return;
    const pendingIndexes = pendingDeleteIndexesByKey.get(upsertKey);
    if (!pendingIndexes || pendingIndexes.length === 0) return;
    pendingIndexes.forEach((deleteIndex) => absorbedIndexes.add(deleteIndex));
    pendingDeleteIndexesByKey.delete(upsertKey);
  });

  return absorbedIndexes;
};
