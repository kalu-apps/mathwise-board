import { useCallback } from "react";
import { generateId } from "@/shared/lib/id";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
} from "@/features/workbook/model/types";
import { MAIN_SCENE_LAYER_ID } from "./WorkbookSessionPage.core";
import type { WorkbookAreaSelection } from "@/features/workbook/model/workbookSessionUiTypes";
import type { WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

type StateUpdater<T> = T | ((current: T) => T);
type SetState<T> = (updater: StateUpdater<T>) => void;

type AppendEventsAndApply = (
  events: WorkbookClientEventInput[],
  options?: {
    trackHistory?: boolean;
    markDirty?: boolean;
    historyEntry?: WorkbookHistoryEntry | null;
  }
) => Promise<void>;

type UseWorkbookCompositionLayerHandlersParams = {
  canSelect: boolean;
  areaSelection: WorkbookAreaSelection | null;
  boardObjects: WorkbookBoardObject[];
  boardSettings: WorkbookBoardSettings;
  sceneLayers: WorkbookBoardSettings["sceneLayers"];
  getObjectSceneLayerId: (object: WorkbookBoardObject) => string;
  appendEventsAndApply: AppendEventsAndApply;
  setAreaSelectionContextMenu: SetState<{ x: number; y: number } | null>;
  setError: (value: string | null) => void;
};

export const useWorkbookCompositionLayerHandlers = ({
  canSelect,
  areaSelection,
  boardObjects,
  boardSettings,
  sceneLayers,
  getObjectSceneLayerId,
  appendEventsAndApply,
  setAreaSelectionContextMenu,
  setError,
}: UseWorkbookCompositionLayerHandlersParams) => {
  const createCompositionFromAreaSelection = useCallback(async () => {
    if (!canSelect || !areaSelection || areaSelection.objectIds.length === 0) return;
    const objectIds = areaSelection.objectIds.filter((id) =>
      boardObjects.some((object) => object.id === id && !object.pinned)
    );
    if (objectIds.length < 2) {
      setError("Для композиции выберите минимум два объекта.");
      return;
    }
    const existingLayerNames = new Set(sceneLayers.map((item) => item.name));
    let index = sceneLayers.length;
    let layerName = `Композиция ${index}`;
    while (existingLayerNames.has(layerName)) {
      index += 1;
      layerName = `Композиция ${index}`;
    }
    const layerId = generateId();
    const createdAt = new Date().toISOString();
    const nextSettings: WorkbookBoardSettings = {
      ...boardSettings,
      sceneLayers: [
        ...sceneLayers,
        {
          id: layerId,
          name: layerName,
          createdAt,
        },
      ],
      activeSceneLayerId: boardSettings.activeSceneLayerId,
    };
    const updateEvents = objectIds.map((objectId) => {
      const object = boardObjects.find((item) => item.id === objectId);
      return {
        type: "board.object.update" as const,
        payload: {
          objectId,
          patch: {
            meta: {
              ...(object?.meta ?? {}),
              sceneLayerId: layerId,
            },
          },
        },
      };
    });
    try {
      await appendEventsAndApply([
        ...updateEvents,
        {
          type: "board.settings.update",
          payload: {
            boardSettings: nextSettings,
          },
        },
      ]);
      setAreaSelectionContextMenu(null);
    } catch {
      setError("Не удалось создать композицию.");
    }
  }, [
    appendEventsAndApply,
    areaSelection,
    boardObjects,
    boardSettings,
    canSelect,
    sceneLayers,
    setAreaSelectionContextMenu,
    setError,
  ]);

  const removeObjectFromComposition = useCallback(
    async (objectId: string, layerId: string) => {
      if (!canSelect || !objectId || !layerId || layerId === MAIN_SCENE_LAYER_ID) return;
      const target = boardObjects.find((object) => object.id === objectId);
      if (!target) return;
      const remainingObjects = boardObjects.filter(
        (object) => object.id !== objectId && getObjectSceneLayerId(object) === layerId
      );
      const nextSettings: WorkbookBoardSettings | null =
        remainingObjects.length === 0
          ? {
              ...boardSettings,
              sceneLayers: sceneLayers.filter((entry) => entry.id !== layerId),
              activeSceneLayerId:
                boardSettings.activeSceneLayerId === layerId
                  ? MAIN_SCENE_LAYER_ID
                  : boardSettings.activeSceneLayerId,
            }
          : null;
      const updateEvents: WorkbookClientEventInput[] = [
        {
          type: "board.object.update",
          payload: {
            objectId,
            patch: {
              meta: {
                ...(target.meta ?? {}),
                sceneLayerId: MAIN_SCENE_LAYER_ID,
              },
            },
          },
        },
      ];
      if (nextSettings) {
        updateEvents.push({
          type: "board.settings.update",
          payload: {
            boardSettings: nextSettings,
          },
        });
      }
      try {
        await appendEventsAndApply(updateEvents);
      } catch {
        setError("Не удалось убрать объект из композиции.");
      }
    },
    [
      appendEventsAndApply,
      boardObjects,
      boardSettings,
      canSelect,
      getObjectSceneLayerId,
      sceneLayers,
      setError,
    ]
  );

  const dissolveCompositionLayer = useCallback(
    async (layerId: string) => {
      if (!layerId || layerId === MAIN_SCENE_LAYER_ID || !canSelect) return;
      const groupedObjects = boardObjects.filter(
        (object) => getObjectSceneLayerId(object) === layerId
      );
      const updateEvents = groupedObjects.map((object) => ({
        type: "board.object.update" as const,
        payload: {
          objectId: object.id,
          patch: {
            meta: {
              ...(object.meta ?? {}),
              sceneLayerId: MAIN_SCENE_LAYER_ID,
            },
          },
        },
      }));
      const nextSettings: WorkbookBoardSettings = {
        ...boardSettings,
        sceneLayers: sceneLayers.filter((entry) => entry.id !== layerId),
        activeSceneLayerId:
          boardSettings.activeSceneLayerId === layerId
            ? MAIN_SCENE_LAYER_ID
            : boardSettings.activeSceneLayerId,
      };
      try {
        await appendEventsAndApply([
          ...updateEvents,
          {
            type: "board.settings.update",
            payload: {
              boardSettings: nextSettings,
            },
          },
        ]);
      } catch {
        setError("Не удалось удалить композицию.");
      }
    },
    [
      appendEventsAndApply,
      boardObjects,
      boardSettings,
      canSelect,
      getObjectSceneLayerId,
      sceneLayers,
      setError,
    ]
  );

  return {
    createCompositionFromAreaSelection,
    removeObjectFromComposition,
    dissolveCompositionLayer,
  };
};
