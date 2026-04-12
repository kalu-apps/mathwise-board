import { useCallback, useEffect, type MutableRefObject } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookLayer,
  WorkbookLibraryState,
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTimerState,
} from "@/features/workbook/model/types";
import type { ClearRequest } from "@/features/workbook/model/workbookSessionUiTypes";
import { isRecoverableApiError } from "@/shared/api/client";
import { cloneSerializable } from "./WorkbookSessionPage.core";
import type { WorkbookSceneSnapshot } from "./WorkbookSessionPage.geometry";

type StateUpdater<T> = T | ((current: T) => T);

type SetState<T> = (updater: StateUpdater<T>) => void;

type AppendEventsAndApply = (
  events: WorkbookClientEventInput[],
  options?: {
    trackHistory?: boolean;
    markDirty?: boolean;
    historyEntry?: unknown;
  }
) => Promise<void>;

type UseWorkbookLayerClearActionsParams = {
  chatMessages: WorkbookChatMessage[];
  comments: WorkbookComment[];
  timerState: WorkbookTimerState | null;
  libraryState: WorkbookLibraryState;
  userId?: string;
  pendingClearRequest: ClearRequest | null;
  confirmedClearRequest: ClearRequest | null;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  constraintsRef: MutableRefObject<WorkbookConstraint[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  boardSettingsRef: MutableRefObject<WorkbookBoardSettings>;
  currentBoardPage: number;
  documentStateRef: MutableRefObject<WorkbookDocumentState>;
  focusResetTimersByUserRef: MutableRefObject<Map<string, number>>;
  setBoardStrokes: SetState<WorkbookStroke[]>;
  applyLocalBoardObjects: (
    updater: (current: WorkbookBoardObject[]) => WorkbookBoardObject[]
  ) => void;
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: (options?: { clearFinalized?: boolean }) => void;
  clearIncomingEraserPreviewRuntime: () => void;
  setFocusPoint: SetState<WorkbookPoint | null>;
  setPointerPoint: SetState<WorkbookPoint | null>;
  setFocusPointsByUser: SetState<Record<string, WorkbookPoint>>;
  setPointerPointsByUser: SetState<Record<string, WorkbookPoint>>;
  setConstraints: SetState<WorkbookConstraint[]>;
  setSelectedObjectId: SetState<string | null>;
  setSelectedConstraintId: SetState<string | null>;
  setAnnotationStrokes: SetState<WorkbookStroke[]>;
  setPendingClearRequest: SetState<ClearRequest | null>;
  setAwaitingClearRequest: SetState<ClearRequest | null>;
  setConfirmedClearRequest: SetState<ClearRequest | null>;
  appendEventsAndApply: AppendEventsAndApply;
  markDirty: () => void;
  restoreSceneSnapshot: (snapshot: WorkbookSceneSnapshot) => void;
  setError: (value: string | null) => void;
};

const toSafePage = (value: number | null | undefined) =>
  Math.max(1, Math.round(value || 1));

export const useWorkbookLayerClearActions = ({
  chatMessages,
  comments,
  timerState,
  libraryState,
  userId,
  pendingClearRequest,
  confirmedClearRequest,
  boardStrokesRef,
  boardObjectsRef,
  constraintsRef,
  annotationStrokesRef,
  boardSettingsRef,
  currentBoardPage,
  documentStateRef,
  focusResetTimersByUserRef,
  setBoardStrokes,
  applyLocalBoardObjects,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  setFocusPoint,
  setPointerPoint,
  setFocusPointsByUser,
  setPointerPointsByUser,
  setConstraints,
  setSelectedObjectId,
  setSelectedConstraintId,
  setAnnotationStrokes,
  setPendingClearRequest,
  setAwaitingClearRequest,
  setConfirmedClearRequest,
  appendEventsAndApply,
  markDirty,
  restoreSceneSnapshot,
  setError,
}: UseWorkbookLayerClearActionsParams) => {
  const clearLayerNow = useCallback(
    async (target: WorkbookLayer) => {
      const targetPage = toSafePage(currentBoardPage);
      const previousSnapshot: WorkbookSceneSnapshot = {
        boardStrokes: cloneSerializable(boardStrokesRef.current),
        boardObjects: cloneSerializable(boardObjectsRef.current),
        constraints: cloneSerializable(constraintsRef.current),
        annotationStrokes: cloneSerializable(annotationStrokesRef.current),
        chatMessages: cloneSerializable(chatMessages),
        comments: cloneSerializable(comments),
        timerState: cloneSerializable(timerState),
        boardSettings: cloneSerializable(boardSettingsRef.current),
        libraryState: cloneSerializable(libraryState),
        documentState: cloneSerializable(documentStateRef.current),
      };

      if (target === "board") {
        const removedObjectIds = new Set(
          boardObjectsRef.current
            .filter((object) => toSafePage(object.page) === targetPage)
            .map((object) => object.id)
        );
        // Drop queued preview/object sync frames before applying page clear state.
        clearObjectSyncRuntime();
        setBoardStrokes((current) =>
          current.filter((stroke) => toSafePage(stroke.page) !== targetPage)
        );
        setAnnotationStrokes((current) =>
          current.filter((stroke) => toSafePage(stroke.page) !== targetPage)
        );
        applyLocalBoardObjects((current) =>
          current.filter((object) => toSafePage(object.page) !== targetPage)
        );
        clearStrokePreviewRuntime();
        clearIncomingEraserPreviewRuntime();
        setFocusPoint(null);
        setPointerPoint(null);
        setFocusPointsByUser({});
        setPointerPointsByUser({});
        focusResetTimersByUserRef.current.forEach((timerId) => {
          window.clearTimeout(timerId);
        });
        focusResetTimersByUserRef.current.clear();
        setConstraints((current) =>
          current.filter(
            (constraint) =>
              !removedObjectIds.has(constraint.sourceObjectId) &&
              !removedObjectIds.has(constraint.targetObjectId)
          )
        );
        setSelectedObjectId(null);
        setSelectedConstraintId(null);
      } else {
        clearStrokePreviewRuntime({ clearFinalized: false });
        clearIncomingEraserPreviewRuntime();
        setAnnotationStrokes([]);
      }

      setPendingClearRequest(null);
      setAwaitingClearRequest(null);

      try {
        await appendEventsAndApply([
          {
            type: target === "board" ? "board.clear" : "annotations.clear",
            payload:
              target === "board"
                ? {
                    scope: "page",
                    page: targetPage,
                  }
                : {},
          },
        ]);
      } catch (error) {
        if (isRecoverableApiError(error)) {
          markDirty();
          setError("Сервис временно недоступен (503). Очистка страницы будет повторена автоматически.");
          return;
        }
        restoreSceneSnapshot(previousSnapshot);
        throw error;
      }
    },
    [
      annotationStrokesRef,
      appendEventsAndApply,
      applyLocalBoardObjects,
      boardObjectsRef,
      boardSettingsRef,
      boardStrokesRef,
      chatMessages,
      clearIncomingEraserPreviewRuntime,
      clearObjectSyncRuntime,
      clearStrokePreviewRuntime,
      comments,
      constraintsRef,
      currentBoardPage,
      documentStateRef,
      focusResetTimersByUserRef,
      libraryState,
      markDirty,
      restoreSceneSnapshot,
      setError,
      setAnnotationStrokes,
      setAwaitingClearRequest,
      setBoardStrokes,
      setConstraints,
      setFocusPoint,
      setFocusPointsByUser,
      setPendingClearRequest,
      setPointerPoint,
      setPointerPointsByUser,
      setSelectedConstraintId,
      setSelectedObjectId,
      timerState,
    ]
  );

  const handleConfirmClear = useCallback(async () => {
    if (!pendingClearRequest || pendingClearRequest.authorUserId === userId) return;
    try {
      await appendEventsAndApply([
        {
          type: "board.clear.confirm",
          payload: {
            requestId: pendingClearRequest.requestId,
          },
        },
      ]);
      setPendingClearRequest(null);
    } catch {
      setError("Не удалось подтвердить очистку.");
    }
  }, [appendEventsAndApply, pendingClearRequest, setError, setPendingClearRequest, userId]);

  useEffect(() => {
    if (!confirmedClearRequest) return;
    void clearLayerNow(confirmedClearRequest.targetLayer).finally(() => {
      setConfirmedClearRequest(null);
    });
  }, [clearLayerNow, confirmedClearRequest, setConfirmedClearRequest]);

  return {
    clearLayerNow,
    handleConfirmClear,
  };
};
