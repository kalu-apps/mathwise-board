import type { WorkbookPoint, WorkbookStroke } from "../model/types";
import {
  buildWorkbookStrokeSelectionKey,
  type WorkbookStrokeSelection,
} from "../model/strokeSelection";

export const EMPTY_STROKE_REPLACEMENT_BY_SELECTION_KEY = new Map<string, WorkbookStroke>();

const RENDERED_STROKE_PREVIEW_ID_MARKER = "::preview-";

export const buildMovingStrokeDisplayState = (params: {
  moving: { current: WorkbookPoint; start: WorkbookPoint } | null;
  movingStrokeSelections: WorkbookStrokeSelection[];
  strokeByKey: ReadonlyMap<string, WorkbookStroke>;
}) => {
  const selectionKeys = new Set<string>();
  const selections: WorkbookStrokeSelection[] = [];
  const replacementBySelectionKey = new Map<string, WorkbookStroke>();
  if (!params.moving || params.movingStrokeSelections.length === 0) {
    return { replacementBySelectionKey, selectionKeys, selections };
  }

  const deltaX = params.moving.current.x - params.moving.start.x;
  const deltaY = params.moving.current.y - params.moving.start.y;
  if (Math.abs(deltaX) <= 0.01 && Math.abs(deltaY) <= 0.01) {
    return { replacementBySelectionKey, selectionKeys, selections };
  }

  params.movingStrokeSelections.forEach((selection) => {
    const sourceStrokeKey = buildWorkbookStrokeSelectionKey(selection);
    const sourceStroke = params.strokeByKey.get(sourceStrokeKey) ?? null;
    if (!sourceStroke) return;
    const translatedPoints = sourceStroke.points.map((point) => ({
      x: point.x + deltaX,
      y: point.y + deltaY,
    }));
    if (translatedPoints.length === 0) return;
    selectionKeys.add(sourceStrokeKey);
    selections.push(selection);
    replacementBySelectionKey.set(sourceStrokeKey, {
      ...sourceStroke,
      points: translatedPoints,
    });
  });

  return { replacementBySelectionKey, selectionKeys, selections };
};

export const replaceRenderedStrokesBySelection = (params: {
  baseStrokes: WorkbookStroke[];
  selections: WorkbookStrokeSelection[];
  replacementBySelectionKey: Map<string, WorkbookStroke>;
  keepOriginalWhenMissingReplacement?: boolean;
}) => {
  if (params.selections.length === 0) return params.baseStrokes;

  const replacedSelectionKeys = new Set<string>();
  const nextStrokes: WorkbookStroke[] = [];
  params.baseStrokes.forEach((stroke) => {
    const matchingSelection = params.selections.find(
      (selection) =>
        stroke.layer === selection.layer &&
        (stroke.id === selection.id ||
          stroke.id.startsWith(`${selection.id}${RENDERED_STROKE_PREVIEW_ID_MARKER}`))
    );
    if (!matchingSelection) {
      nextStrokes.push(stroke);
      return;
    }
    const selectionKey = buildWorkbookStrokeSelectionKey(matchingSelection);
    const replacementStroke = params.replacementBySelectionKey.get(selectionKey);
    if (!replacementStroke) {
      if (params.keepOriginalWhenMissingReplacement) nextStrokes.push(stroke);
      return;
    }
    if (replacedSelectionKeys.has(selectionKey)) return;
    replacedSelectionKeys.add(selectionKey);
    nextStrokes.push(replacementStroke);
  });

  params.replacementBySelectionKey.forEach((replacementStroke, selectionKey) => {
    if (!replacedSelectionKeys.has(selectionKey)) nextStrokes.push(replacementStroke);
  });
  return nextStrokes;
};

export const buildRenderedStrokeSelectionKey = (stroke: WorkbookStroke) => {
  const previewMarkerIndex = stroke.id.indexOf(RENDERED_STROKE_PREVIEW_ID_MARKER);
  return buildWorkbookStrokeSelectionKey({
    id: previewMarkerIndex >= 0 ? stroke.id.slice(0, previewMarkerIndex) : stroke.id,
    layer: stroke.layer,
  });
};
