import { useCallback, type MutableRefObject } from "react";
import { saveWorkbookSnapshot } from "@/features/workbook/model/api";
import { encodeWorkbookSceneSnapshots } from "@/features/workbook/model/workbookSceneCodec";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookLibraryState,
  WorkbookStroke,
  WorkbookTimerState,
} from "@/features/workbook/model/types";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";

interface UseWorkbookPersistSnapshotsParams {
  sessionId: string;
  boardStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  chatMessages: WorkbookChatMessage[];
  comments: WorkbookComment[];
  timerState: WorkbookTimerState;
  boardSettings: WorkbookBoardSettings;
  libraryState: WorkbookLibraryState;
  documentState: WorkbookDocumentState;
  annotationStrokes: WorkbookStroke[];
  latestSeq: number;
  authRequiredRef: MutableRefObject<boolean>;
  dirtyRef: MutableRefObject<boolean>;
  dirtyRevisionRef: MutableRefObject<number>;
  isSavingRef: MutableRefObject<boolean>;
  pendingAutosaveAfterSaveRef: MutableRefObject<boolean>;
  setSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setSaveSyncWarning: (message: string | null) => void;
  handleRealtimeAuthRequired: (status: number) => void;
  scheduleAutosave: (delayMs?: number) => void;
}

export function useWorkbookPersistSnapshots({
  sessionId,
  boardStrokes,
  boardObjects,
  constraints,
  chatMessages,
  comments,
  timerState,
  boardSettings,
  libraryState,
  documentState,
  annotationStrokes,
  latestSeq,
  authRequiredRef,
  dirtyRef,
  dirtyRevisionRef,
  isSavingRef,
  pendingAutosaveAfterSaveRef,
  setSaveState,
  setSaveSyncWarning,
  handleRealtimeAuthRequired,
  scheduleAutosave,
}: UseWorkbookPersistSnapshotsParams) {
  return useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      if (!sessionId) return false;
      if (authRequiredRef.current) return false;
      if (!options?.force && !dirtyRef.current) return true;
      if (isSavingRef.current) {
        pendingAutosaveAfterSaveRef.current = true;
        return true;
      }
      isSavingRef.current = true;
      pendingAutosaveAfterSaveRef.current = false;
      const revisionAtSaveStart = dirtyRevisionRef.current;
      if (!options?.silent) {
        setSaveState("saving");
      }
      try {
        const encodedSnapshots = await encodeWorkbookSceneSnapshots({
          boardState: {
            strokes: boardStrokes,
            objects: boardObjects,
            constraints,
            chat: chatMessages,
            comments,
            timer: timerState,
            boardSettings,
            library: libraryState,
            document: documentState,
          },
          annotationState: {
            strokes: annotationStrokes,
            chat: [],
          },
        });
        await Promise.all([
          saveWorkbookSnapshot({
            sessionId,
            layer: "board",
            version: latestSeq,
            payload: encodedSnapshots.boardPayload,
          }),
          saveWorkbookSnapshot({
            sessionId,
            layer: "annotations",
            version: latestSeq,
            payload: encodedSnapshots.annotationPayload,
          }),
        ]);

        if (dirtyRevisionRef.current === revisionAtSaveStart) {
          dirtyRef.current = false;
          setSaveState("saved");
          setSaveSyncWarning(null);
        } else {
          dirtyRef.current = true;
          pendingAutosaveAfterSaveRef.current = true;
          setSaveState("saving");
        }

        return true;
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403 || error.status === 404)
        ) {
          handleRealtimeAuthRequired(error.status);
          return false;
        }
        if (isRecoverableApiError(error)) {
          setSaveState("saving");
          setSaveSyncWarning(
            "Связь нестабильна. Автосохранение продолжит синхронизацию при восстановлении соединения."
          );
          pendingAutosaveAfterSaveRef.current = true;
          return false;
        }

        setSaveState("error");
        setSaveSyncWarning(
          "Автосохранение временно недоступно. Не закрывайте вкладку: повторяем синхронизацию."
        );
        return false;
      } finally {
        isSavingRef.current = false;
        if (pendingAutosaveAfterSaveRef.current) {
          scheduleAutosave(1_400);
        }
      }
    },
    [
      annotationStrokes,
      authRequiredRef,
      boardObjects,
      boardSettings,
      boardStrokes,
      chatMessages,
      comments,
      constraints,
      dirtyRef,
      dirtyRevisionRef,
      documentState,
      handleRealtimeAuthRequired,
      isSavingRef,
      latestSeq,
      libraryState,
      pendingAutosaveAfterSaveRef,
      scheduleAutosave,
      sessionId,
      setSaveState,
      setSaveSyncWarning,
      timerState,
    ]
  );
}
