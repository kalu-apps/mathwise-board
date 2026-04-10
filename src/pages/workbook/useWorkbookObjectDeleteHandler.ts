import { useCallback, type MutableRefObject } from "react";
import { ApiError } from "@/shared/api/client";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
} from "@/features/workbook/model/types";
import { MAIN_SCENE_LAYER_ID } from "./WorkbookSessionPage.core";

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

type UseWorkbookObjectDeleteHandlerParams = {
  sessionId: string;
  canDelete: boolean;
  selectedObjectId: string | null;
  selectedConstraintId: string | null;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  constraintsRef: MutableRefObject<WorkbookConstraint[]>;
  boardSettingsRef: MutableRefObject<WorkbookBoardSettings>;
  objectUpdateQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectUpdateDispatchOptionsRef: MutableRefObject<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >;
  objectUpdateHistoryBeforeRef: MutableRefObject<Map<string, WorkbookBoardObject>>;
  objectPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectPreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
  localPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectPreviewVersionRef: MutableRefObject<Map<string, number>>;
  incomingPreviewVersionByAuthorObjectRef: MutableRefObject<Map<string, number>>;
  objectUpdateTimersRef: MutableRefObject<Map<string, number>>;
  objectUpdateInFlightRef: MutableRefObject<Set<string>>;
  setConstraints: SetState<WorkbookConstraint[]>;
  setBoardSettings: SetState<WorkbookBoardSettings>;
  setSelectedObjectId: SetState<string | null>;
  setSelectedConstraintId: SetState<string | null>;
  setError: (value: string | null) => void;
  buildHistoryEntryFromEvents: (events: WorkbookClientEventInput[]) => unknown;
  appendEventsAndApply: AppendEventsAndApply;
  commitInteractiveBoardObjects: (objects: WorkbookBoardObject[]) => void;
  handleRealtimeConflict: () => void;
  getObjectSceneLayerId: (object: WorkbookBoardObject) => string;
};

export const useWorkbookObjectDeleteHandler = ({
  sessionId,
  canDelete,
  selectedObjectId,
  selectedConstraintId,
  boardObjectsRef,
  constraintsRef,
  boardSettingsRef,
  objectUpdateQueuedPatchRef,
  objectUpdateDispatchOptionsRef,
  objectUpdateHistoryBeforeRef,
  objectPreviewQueuedPatchRef,
  objectPreviewQueuedAtRef,
  localPreviewQueuedPatchRef,
  objectPreviewVersionRef,
  incomingPreviewVersionByAuthorObjectRef,
  objectUpdateTimersRef,
  objectUpdateInFlightRef,
  setConstraints,
  setBoardSettings,
  setSelectedObjectId,
  setSelectedConstraintId,
  setError,
  buildHistoryEntryFromEvents,
  appendEventsAndApply,
  commitInteractiveBoardObjects,
  handleRealtimeConflict,
  getObjectSceneLayerId,
}: UseWorkbookObjectDeleteHandlerParams) => {
  const commitObjectDelete = useCallback(
    async (objectId: string) => {
      if (!sessionId || !canDelete) return;
      objectUpdateQueuedPatchRef.current.delete(objectId);
      objectUpdateDispatchOptionsRef.current.delete(objectId);
      objectUpdateHistoryBeforeRef.current.delete(objectId);
      objectPreviewQueuedPatchRef.current.delete(objectId);
      objectPreviewQueuedAtRef.current.delete(objectId);
      localPreviewQueuedPatchRef.current.delete(objectId);
      objectPreviewVersionRef.current.delete(objectId);
      Array.from(incomingPreviewVersionByAuthorObjectRef.current.keys()).forEach((key) => {
        if (key.endsWith(`:${objectId}`)) {
          incomingPreviewVersionByAuthorObjectRef.current.delete(key);
        }
      });
      const pendingTimer = objectUpdateTimersRef.current.get(objectId);
      if (pendingTimer !== undefined) {
        window.clearTimeout(pendingTimer);
        objectUpdateTimersRef.current.delete(objectId);
      }
      objectUpdateInFlightRef.current.delete(objectId);
      const currentBoardObjects = boardObjectsRef.current;
      const currentConstraints = constraintsRef.current;
      const currentBoardSettings = boardSettingsRef.current;
      const currentSelectedObjectId = selectedObjectId;
      const currentSelectedConstraintId = selectedConstraintId;
      const targetObject = currentBoardObjects.find((item) => item.id === objectId);
      const targetLayerId = targetObject
        ? getObjectSceneLayerId(targetObject)
        : MAIN_SCENE_LAYER_ID;
      const shouldPruneLayer =
        targetLayerId !== MAIN_SCENE_LAYER_ID &&
        currentBoardObjects.filter(
          (object) =>
            object.id !== objectId && getObjectSceneLayerId(object) === targetLayerId
        ).length === 0;
      const nextSettings: WorkbookBoardSettings | null = shouldPruneLayer
        ? {
            ...currentBoardSettings,
            sceneLayers: currentBoardSettings.sceneLayers.filter(
              (entry) => entry.id !== targetLayerId
            ),
            activeSceneLayerId:
              currentBoardSettings.activeSceneLayerId === targetLayerId
                ? MAIN_SCENE_LAYER_ID
                : currentBoardSettings.activeSceneLayerId,
          }
        : null;
      const events: WorkbookClientEventInput[] = [
        {
          type: "board.object.delete",
          payload: { objectId },
        },
      ];
      if (nextSettings) {
        events.push({
          type: "board.settings.update",
          payload: { boardSettings: nextSettings },
        });
      }
      const historyEntry = buildHistoryEntryFromEvents(events);
      const optimisticBoardObjects = currentBoardObjects.filter(
        (item) => item.id !== objectId
      );
      const optimisticConstraints = currentConstraints.filter(
        (constraint) =>
          constraint.sourceObjectId !== objectId &&
          constraint.targetObjectId !== objectId
      );
      commitInteractiveBoardObjects(optimisticBoardObjects);
      constraintsRef.current = optimisticConstraints;
      setConstraints(optimisticConstraints);
      setSelectedObjectId((current) => (current === objectId ? null : current));
      if (nextSettings) {
        boardSettingsRef.current = nextSettings;
        setBoardSettings(nextSettings);
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await appendEventsAndApply(events, historyEntry ? { historyEntry } : undefined);
          return;
        } catch (error) {
          if (error instanceof ApiError && error.code === "not_found") {
            return;
          }
          if (
            error instanceof ApiError &&
            error.code === "conflict" &&
            error.status === 409
          ) {
            commitInteractiveBoardObjects(currentBoardObjects);
            constraintsRef.current = currentConstraints;
            setConstraints(currentConstraints);
            if (nextSettings) {
              boardSettingsRef.current = currentBoardSettings;
              setBoardSettings(currentBoardSettings);
            }
            setSelectedObjectId(currentSelectedObjectId);
            setSelectedConstraintId(currentSelectedConstraintId);
            handleRealtimeConflict();
            return;
          }
          const transient =
            error instanceof ApiError &&
            (error.code === "server_unavailable" ||
              error.code === "network_error" ||
              error.code === "timeout" ||
              error.code === "rate_limited");
          if (transient && attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 140));
            continue;
          }
          commitInteractiveBoardObjects(currentBoardObjects);
          constraintsRef.current = currentConstraints;
          setConstraints(currentConstraints);
          if (nextSettings) {
            boardSettingsRef.current = currentBoardSettings;
            setBoardSettings(currentBoardSettings);
          }
          setSelectedObjectId(currentSelectedObjectId);
          setSelectedConstraintId(currentSelectedConstraintId);
          setError("Не удалось удалить объект.");
          return;
        }
      }
    },
    [
      appendEventsAndApply,
      boardObjectsRef,
      boardSettingsRef,
      buildHistoryEntryFromEvents,
      canDelete,
      commitInteractiveBoardObjects,
      constraintsRef,
      getObjectSceneLayerId,
      handleRealtimeConflict,
      incomingPreviewVersionByAuthorObjectRef,
      localPreviewQueuedPatchRef,
      objectPreviewQueuedAtRef,
      objectPreviewQueuedPatchRef,
      objectPreviewVersionRef,
      objectUpdateDispatchOptionsRef,
      objectUpdateHistoryBeforeRef,
      objectUpdateInFlightRef,
      objectUpdateQueuedPatchRef,
      objectUpdateTimersRef,
      selectedConstraintId,
      selectedObjectId,
      sessionId,
      setBoardSettings,
      setConstraints,
      setError,
      setSelectedConstraintId,
      setSelectedObjectId,
    ]
  );

  return {
    commitObjectDelete,
  };
};
