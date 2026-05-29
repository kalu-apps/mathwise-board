import type { MutableRefObject } from "react";
import { isRecoverableApiError } from "@/shared/api/client";
import { generateId } from "@/shared/lib/id";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import { mergeBoardObjectWithPatch } from "@/features/workbook/model/runtime";
import {
  buildWorkbookStrokeTranslateEventType,
  rememberWorkbookStrokeTranslateOperationId,
  translateWorkbookStrokesByIds,
  WORKBOOK_MAX_STROKE_TRANSLATE_IDS,
} from "@/features/workbook/model/strokeTranslateEvents";
import type { WorkbookBoardObject, WorkbookStroke } from "@/features/workbook/model/types";
import type { WorkbookStrokeTranslateCommitPayload } from "@/features/workbook/ui/WorkbookCanvas";
import type { WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

type SetState<T> = (updater: T | ((current: T) => T)) => void;

type CommitWorkbookStrokeTranslateBatchParams = {
  payload: WorkbookStrokeTranslateCommitPayload;
  sessionId: string;
  canDelete: boolean;
  currentBoardPage: number;
  buildHistoryEntryFromEvents: (events: WorkbookClientEventInput[]) => WorkbookHistoryEntry | null;
  appendEventsAndApply: (
    events: WorkbookClientEventInput[],
    options?: { historyEntry?: WorkbookHistoryEntry | null }
  ) => Promise<void>;
  finalizeStrokePreview: (strokeId: string) => void;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  appliedStrokeTranslateOperationIdsRef: MutableRefObject<Set<string>>;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  setBoardStrokes: SetState<WorkbookStroke[]>;
  setAnnotationStrokes: SetState<WorkbookStroke[]>;
  applyLocalBoardObjects: (
    updater: (current: WorkbookBoardObject[]) => WorkbookBoardObject[]
  ) => void;
  commitInteractiveBoardObjects: (objects: WorkbookBoardObject[]) => void;
  markDirty: () => void;
  clearRecoverableSyncIssue: () => void;
  noteRecoverableSyncIssue: () => void;
  setError: (value: string | null) => void;
};

export const commitWorkbookStrokeTranslateBatch = async ({
  payload,
  sessionId,
  canDelete,
  currentBoardPage,
  buildHistoryEntryFromEvents,
  appendEventsAndApply,
  finalizeStrokePreview,
  boardStrokesRef,
  annotationStrokesRef,
  appliedStrokeTranslateOperationIdsRef,
  boardObjectsRef,
  setBoardStrokes,
  setAnnotationStrokes,
  applyLocalBoardObjects,
  commitInteractiveBoardObjects,
  markDirty,
  clearRecoverableSyncIssue,
  noteRecoverableSyncIssue,
  setError,
}: CommitWorkbookStrokeTranslateBatchParams) => {
  if (!sessionId || !canDelete) return;
  const events: WorkbookClientEventInput[] = [];
  const operationIds: string[] = [];
  const normalizedMoves = payload.strokeMoves.flatMap((move) => {
    const layer = move.layer === "annotations" ? "annotations" : "board";
    const currentStrokes = layer === "annotations" ? annotationStrokesRef.current : boardStrokesRef.current;
    const availableIds = new Set(currentStrokes.map((stroke) => stroke.id));
    const strokeIds = Array.from(
      new Set(move.strokeIds.map((strokeId) => strokeId.trim()).filter((strokeId) => strokeId && availableIds.has(strokeId)))
    );
    if (strokeIds.length === 0 || !Number.isFinite(move.dx) || !Number.isFinite(move.dy)) return [];
    if (Math.abs(move.dx) <= 0.5 && Math.abs(move.dy) <= 0.5) return [];
    const page = Math.max(1, Math.trunc(move.page ?? currentBoardPage));
    for (let index = 0; index < strokeIds.length; index += WORKBOOK_MAX_STROKE_TRANSLATE_IDS) {
      const chunkStrokeIds = strokeIds.slice(index, index + WORKBOOK_MAX_STROKE_TRANSLATE_IDS);
      const operationId = generateId();
      operationIds.push(operationId);
      events.push({
        type: buildWorkbookStrokeTranslateEventType(layer),
        payload: { strokeIds: chunkStrokeIds, dx: move.dx, dy: move.dy, page, operationId },
      });
    }
    return [{ layer, strokeIds, dx: move.dx, dy: move.dy }];
  });

  payload.objectUpdates.forEach((entry) => {
    if (!entry.objectId.trim()) return;
    events.push({ type: "board.object.update", payload: { objectId: entry.objectId, patch: entry.patch } });
  });
  if (events.length === 0) return;

  const historyEntry = buildHistoryEntryFromEvents(events);
  const previousBoardStrokes = boardStrokesRef.current;
  const previousAnnotationStrokes = annotationStrokesRef.current;
  const previousBoardObjects = boardObjectsRef.current;
  operationIds.forEach((operationId) => {
    rememberWorkbookStrokeTranslateOperationId(appliedStrokeTranslateOperationIdsRef.current, operationId);
  });
  normalizedMoves.forEach((move) => {
    move.strokeIds.forEach(finalizeStrokePreview);
    const setStrokes = move.layer === "annotations" ? setAnnotationStrokes : setBoardStrokes;
    setStrokes((current) => translateWorkbookStrokesByIds(current, move.strokeIds, move.dx, move.dy));
  });
  if (payload.objectUpdates.length > 0) {
    const objectPatchById = new Map(payload.objectUpdates.map((entry) => [entry.objectId, entry.patch]));
    applyLocalBoardObjects((current) =>
      current.map((object) => {
        const patch = objectPatchById.get(object.id);
        return patch ? mergeBoardObjectWithPatch(object, patch) : object;
      })
    );
  }
  try {
    await appendEventsAndApply(events, historyEntry ? { historyEntry } : undefined);
    clearRecoverableSyncIssue();
  } catch (error) {
    if (isRecoverableApiError(error)) {
      markDirty();
      noteRecoverableSyncIssue();
      return;
    }
    operationIds.forEach((operationId) => {
      appliedStrokeTranslateOperationIdsRef.current.delete(operationId);
    });
    setBoardStrokes(previousBoardStrokes);
    setAnnotationStrokes(previousAnnotationStrokes);
    commitInteractiveBoardObjects(previousBoardObjects);
    setError("Не удалось синхронизировать перемещение штрихов.");
  }
};
