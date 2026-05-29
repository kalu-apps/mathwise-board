import type { WorkbookBoardObject, WorkbookStroke } from "@/features/workbook/model/types";
import type { WorkbookStrokeTranslateCommitPayload } from "./WorkbookCanvas.types";

type BuildWorkbookStrokeTranslateCommitPayloadArgs = {
  strokes: WorkbookStroke[];
  objectPatches: Array<{ id: string; patch: Partial<WorkbookBoardObject> }>;
  dx: number;
  dy: number;
  currentPage: number;
};

export const buildWorkbookStrokeTranslateCommitPayload = ({
  strokes,
  objectPatches,
  dx,
  dy,
  currentPage,
}: BuildWorkbookStrokeTranslateCommitPayloadArgs): WorkbookStrokeTranslateCommitPayload => {
  const strokeMoveGroups = new Map<string, WorkbookStrokeTranslateCommitPayload["strokeMoves"][number]>();
  strokes.forEach((stroke) => {
    const page = Math.max(1, stroke.page ?? currentPage);
    const key = `${stroke.layer}:${page}`;
    const existing = strokeMoveGroups.get(key);
    if (existing) {
      existing.strokeIds.push(stroke.id);
      return;
    }
    strokeMoveGroups.set(key, { layer: stroke.layer, strokeIds: [stroke.id], dx, dy, page });
  });
  return {
    strokeMoves: Array.from(strokeMoveGroups.values()),
    objectUpdates: objectPatches.map(({ id, patch }) => ({ objectId: id, patch })),
  };
};
