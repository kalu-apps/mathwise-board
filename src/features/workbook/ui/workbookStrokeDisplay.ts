import type { WorkbookStroke } from "../model/types";
import {
  buildWorkbookStrokeSelectionKey,
  type WorkbookStrokeSelection,
} from "../model/strokeSelection";

export const EMPTY_STROKE_REPLACEMENT_BY_SELECTION_KEY = new Map<string, WorkbookStroke>();

const RENDERED_STROKE_PREVIEW_ID_MARKER = "::preview-";

export const replaceRenderedStrokesBySelection = (params: {
  baseStrokes: WorkbookStroke[];
  selections: WorkbookStrokeSelection[];
  replacementBySelectionKey: Map<string, WorkbookStroke>;
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
    if (replacedSelectionKeys.has(selectionKey)) return;
    replacedSelectionKeys.add(selectionKey);
    const replacementStroke = params.replacementBySelectionKey.get(selectionKey);
    if (replacementStroke) nextStrokes.push(replacementStroke);
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
