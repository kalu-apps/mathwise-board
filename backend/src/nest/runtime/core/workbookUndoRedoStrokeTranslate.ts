import type { WorkbookClientEventInput } from "../../../../../src/features/workbook/model/events";
import {
  normalizeWorkbookStrokeTranslatePayload,
  resolveWorkbookStrokeTranslateLayer,
  translateWorkbookStrokesByIds,
} from "../../../../../src/features/workbook/model/strokeTranslateEvents";
import type {
  WorkbookBoardSettings,
  WorkbookEvent,
  WorkbookLayer,
  WorkbookStroke,
} from "../../../../../src/features/workbook/model/types";

export type WorkbookStrokeTranslateHistoryOperation = {
  kind: "translate_strokes";
  layer: WorkbookLayer;
  strokeIds: string[];
  dx: number;
  dy: number;
};

type WorkbookStrokeTranslateHistoryState = {
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  boardSettings: WorkbookBoardSettings;
};

type WorkbookStrokeTranslateHistorySourceEvent = WorkbookClientEventInput | WorkbookEvent;

const toSafePage = (value: number | null | undefined) =>
  Math.max(1, Math.round(value || 1));

export const buildWorkbookStrokeTranslateHistoryDraft = (
  state: WorkbookStrokeTranslateHistoryState,
  event: WorkbookStrokeTranslateHistorySourceEvent,
  fallbackPage: number
): {
  forward: WorkbookStrokeTranslateHistoryOperation[];
  inverse: WorkbookStrokeTranslateHistoryOperation[];
  page: number;
} | null => {
  if (event.type !== "board.strokes.translate" && event.type !== "annotations.strokes.translate") {
    return null;
  }
  const layer = resolveWorkbookStrokeTranslateLayer(event.type);
  const payload = normalizeWorkbookStrokeTranslatePayload(event.payload);
  if (!layer || !payload) return null;
  const collection = layer === "annotations" ? state.annotationStrokes : state.boardStrokes;
  const existingIds = new Set(collection.map((stroke) => stroke.id));
  const strokeIds = payload.strokeIds.filter((strokeId) => existingIds.has(strokeId));
  if (strokeIds.length === 0) return null;
  const strokeIdSet = new Set(strokeIds);
  const sourcePages = collection
    .filter((stroke) => strokeIdSet.has(stroke.id))
    .map((stroke) => toSafePage(stroke.page));
  const eventPage =
    payload.page ??
    (sourcePages.length > 0 && sourcePages.every((page) => page === sourcePages[0])
      ? sourcePages[0]
      : fallbackPage);
  const forward = [
    { kind: "translate_strokes" as const, layer, strokeIds, dx: payload.dx, dy: payload.dy },
  ];
  const inverse = [
    { kind: "translate_strokes" as const, layer, strokeIds, dx: -payload.dx, dy: -payload.dy },
  ];
  return { forward, inverse, page: toSafePage(eventPage) };
};

export const applyWorkbookStrokeTranslateHistoryOperation = (
  state: WorkbookStrokeTranslateHistoryState,
  operation: WorkbookStrokeTranslateHistoryOperation
) => {
  if (operation.layer === "annotations") {
    const next = translateWorkbookStrokesByIds(
      state.annotationStrokes,
      operation.strokeIds,
      operation.dx,
      operation.dy
    );
    if (next === state.annotationStrokes) return false;
    state.annotationStrokes = next;
    return true;
  }
  const next = translateWorkbookStrokesByIds(
    state.boardStrokes,
    operation.strokeIds,
    operation.dx,
    operation.dy
  );
  if (next === state.boardStrokes) return false;
  state.boardStrokes = next;
  return true;
};
