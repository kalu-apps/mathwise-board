import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  normalizeWorkbookStrokeTranslatePayload,
  rememberWorkbookStrokeTranslateOperationId,
  resolveWorkbookStrokeTranslateLayer,
  translateWorkbookStrokesByIds,
} from "./strokeTranslateEvents";
import type { WorkbookEvent, WorkbookStroke } from "./types";

type ApplyIncomingWorkbookStrokeTranslateEventParams = {
  event: WorkbookEvent;
  userId?: string;
  appliedStrokeTranslateOperationIdsRef: MutableRefObject<Set<string>>;
  finalizeStrokePreview: (strokeId: string) => void;
  setBoardStrokes: Dispatch<SetStateAction<WorkbookStroke[]>>;
  setAnnotationStrokes: Dispatch<SetStateAction<WorkbookStroke[]>>;
};

export const applyIncomingWorkbookStrokeTranslateEvent = ({
  event,
  userId,
  appliedStrokeTranslateOperationIdsRef,
  finalizeStrokePreview,
  setBoardStrokes,
  setAnnotationStrokes,
}: ApplyIncomingWorkbookStrokeTranslateEventParams) => {
  if (event.type !== "board.strokes.translate" && event.type !== "annotations.strokes.translate") {
    return false;
  }
  const layer = resolveWorkbookStrokeTranslateLayer(event.type);
  const payload = normalizeWorkbookStrokeTranslatePayload(event.payload);
  if (!layer || !payload) return true;
  if (
    payload.operationId &&
    event.authorUserId === userId &&
    appliedStrokeTranslateOperationIdsRef.current.has(payload.operationId)
  ) {
    return true;
  }
  payload.strokeIds.forEach(finalizeStrokePreview);
  const setStrokes = layer === "annotations" ? setAnnotationStrokes : setBoardStrokes;
  setStrokes((current) =>
    translateWorkbookStrokesByIds(current, payload.strokeIds, payload.dx, payload.dy)
  );
  rememberWorkbookStrokeTranslateOperationId(
    appliedStrokeTranslateOperationIdsRef.current,
    payload.operationId
  );
  return true;
};
