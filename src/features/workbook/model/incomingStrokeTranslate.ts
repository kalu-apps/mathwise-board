import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  normalizeWorkbookStrokeTranslatePreviewPayload,
  normalizeWorkbookStrokeTranslatePayload,
  rememberWorkbookStrokeTranslateOperationId,
  resolveWorkbookStrokeTranslatePreviewLayer,
  resolveWorkbookStrokeTranslateLayer,
  translateWorkbookStroke,
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

type ApplyIncomingWorkbookStrokeTranslatePreviewEventParams = {
  event: WorkbookEvent;
  userId?: string;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  incomingStrokePreviewVersionRef: MutableRefObject<Map<string, number>>;
  queueIncomingStrokePreview: (
    entry: { stroke: WorkbookStroke; previewVersion: number; updatedAt: number },
    strokeId: string
  ) => void;
};

export const applyIncomingWorkbookStrokeTranslatePreviewEvent = ({
  event,
  userId,
  boardStrokesRef,
  annotationStrokesRef,
  incomingStrokePreviewVersionRef,
  queueIncomingStrokePreview,
}: ApplyIncomingWorkbookStrokeTranslatePreviewEventParams) => {
  if (
    event.type !== "board.strokes.translate.preview" &&
    event.type !== "annotations.strokes.translate.preview"
  ) {
    return false;
  }
  if (event.authorUserId === userId) return true;
  const layer = resolveWorkbookStrokeTranslatePreviewLayer(event.type);
  const payload = normalizeWorkbookStrokeTranslatePreviewPayload(event.payload);
  if (!layer || !payload) return true;
  const previewVersion =
    typeof payload.previewVersion === "number" && Number.isFinite(payload.previewVersion)
      ? Math.max(1, Math.trunc(payload.previewVersion))
      : Date.now();
  const currentStrokes = layer === "annotations" ? annotationStrokesRef.current : boardStrokesRef.current;
  if (currentStrokes.length === 0) return true;
  const strokeIdSet = new Set(payload.strokeIds);
  const updatedAt = Date.now();
  currentStrokes.forEach((stroke) => {
    if (!strokeIdSet.has(stroke.id)) return;
    if (payload.page !== undefined && Math.max(1, Math.trunc(stroke.page ?? 1)) !== payload.page) {
      return;
    }
    const versionKey = `translate:${event.authorUserId}:${layer}:${stroke.id}`;
    const appliedVersion = incomingStrokePreviewVersionRef.current.get(versionKey) ?? 0;
    if (previewVersion <= appliedVersion) return;
    incomingStrokePreviewVersionRef.current.set(versionKey, previewVersion);
    queueIncomingStrokePreview(
      {
        stroke: translateWorkbookStroke(stroke, payload.dx, payload.dy),
        previewVersion,
        updatedAt,
      },
      stroke.id
    );
  });
  return true;
};
