import { useCallback, type MutableRefObject } from "react";
import { generateId } from "@/shared/lib/id";
import { ensureWorkbookObjectZOrder } from "@/features/workbook/model/objectZOrder";
import {
  buildWorkbookImageCropRestoreUpdate,
  buildWorkbookImageCropUpdate,
  resolveWorkbookObjectAxisAlignedRect,
} from "@/features/workbook/model/imageCrop";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import {
  MAIN_SCENE_LAYER_ID,
  applyBoardObjectGeometryPatch,
  clampBoardObjectToPageFrame,
} from "./WorkbookSessionPage.core";
import type {
  WorkbookAreaSelection,
  WorkbookAreaSelectionClipboard,
} from "@/features/workbook/model/workbookSessionUiTypes";

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

type UseWorkbookAreaSelectionClipboardHandlersParams = {
  canDelete: boolean;
  canSelect: boolean;
  areaSelection: WorkbookAreaSelection | null;
  areaSelectionHasContent: boolean;
  currentBoardPage: number;
  boardSettings: WorkbookBoardSettings;
  areaFillColor: string;
  selectedObjectId: string | null;
  userId?: string;
  sceneLayers: WorkbookBoardSettings["sceneLayers"];
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  areaSelectionClipboardRef: MutableRefObject<WorkbookAreaSelectionClipboard | null>;
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  getObjectSceneLayerId: (object: WorkbookBoardObject) => string;
  appendEventsAndApply: AppendEventsAndApply;
  commitObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void;
  setAreaSelection: SetState<WorkbookAreaSelection | null>;
  setAreaSelectionContextMenu: SetState<{ x: number; y: number } | null>;
  setSelectedObjectId: SetState<string | null>;
  setError: (value: string | null) => void;
};

export const useWorkbookAreaSelectionClipboardHandlers = ({
  canDelete,
  canSelect,
  areaSelection,
  areaSelectionHasContent,
  currentBoardPage,
  boardSettings,
  areaFillColor,
  selectedObjectId,
  userId,
  sceneLayers,
  boardObjectsRef,
  areaSelectionClipboardRef,
  boardStrokes,
  annotationStrokes,
  getObjectSceneLayerId,
  appendEventsAndApply,
  commitObjectUpdate,
  setAreaSelection,
  setAreaSelectionContextMenu,
  setSelectedObjectId,
  setError,
}: UseWorkbookAreaSelectionClipboardHandlersParams) => {
  const deleteAreaSelectionObjects = useCallback(async () => {
    if (!canDelete || !areaSelection || !areaSelectionHasContent) return;
    const currentBoardObjects = boardObjectsRef.current;
    const objectIds = areaSelection.objectIds.filter((id) =>
      currentBoardObjects.some((object) => object.id === id)
    );
    const strokeIds = areaSelection.strokeIds.filter((entry) => {
      if (entry.layer === "annotations") {
        return annotationStrokes.some((stroke) => stroke.id === entry.id);
      }
      return boardStrokes.some((stroke) => stroke.id === entry.id);
    });
    if (objectIds.length === 0 && strokeIds.length === 0) {
      setAreaSelectionContextMenu(null);
      return;
    }
    try {
      const deletingSet = new Set(objectIds);
      const layerIdsToRemove = sceneLayers
        .filter((layerItem) => layerItem.id !== MAIN_SCENE_LAYER_ID)
        .filter((layerItem) => {
          const layerObjects = currentBoardObjects.filter(
            (object) => getObjectSceneLayerId(object) === layerItem.id
          );
          if (layerObjects.length === 0) return false;
          return layerObjects.every((object) => deletingSet.has(object.id));
        })
        .map((layerItem) => layerItem.id);
      const events: WorkbookClientEventInput[] = [];
      strokeIds.forEach((entry) => {
        events.push({
          type:
            entry.layer === "annotations"
              ? "annotations.stroke.delete"
              : "board.stroke.delete",
          payload: { strokeId: entry.id },
        });
      });
      objectIds.forEach((objectId) => {
        events.push({
          type: "board.object.delete" as const,
          payload: { objectId },
        });
      });
      if (layerIdsToRemove.length > 0) {
        const nextSettings: WorkbookBoardSettings = {
          ...boardSettings,
          sceneLayers: sceneLayers.filter(
            (layerItem) => !layerIdsToRemove.includes(layerItem.id)
          ),
          activeSceneLayerId: layerIdsToRemove.includes(boardSettings.activeSceneLayerId)
            ? MAIN_SCENE_LAYER_ID
            : boardSettings.activeSceneLayerId,
        };
        events.push({
          type: "board.settings.update",
          payload: {
            boardSettings: nextSettings,
          },
        });
      }
      await appendEventsAndApply(events);
      setAreaSelection(null);
      setAreaSelectionContextMenu(null);
      if (selectedObjectId && objectIds.includes(selectedObjectId)) {
        setSelectedObjectId(null);
      }
    } catch {
      setError("Не удалось удалить элементы из выделенной области.");
    }
  }, [
    annotationStrokes,
    appendEventsAndApply,
    areaSelection,
    areaSelectionHasContent,
    boardObjectsRef,
    boardSettings,
    boardStrokes,
    canDelete,
    getObjectSceneLayerId,
    sceneLayers,
    selectedObjectId,
    setAreaSelection,
    setAreaSelectionContextMenu,
    setError,
    setSelectedObjectId,
  ]);

  const copyAreaSelectionObjects = useCallback(() => {
    if (!canSelect || !areaSelection || !areaSelectionHasContent) return;
    const currentBoardObjects = boardObjectsRef.current;
    const selectedObjects = areaSelection.objectIds
      .map((id) => currentBoardObjects.find((object) => object.id === id))
      .filter((object): object is WorkbookBoardObject => object != null);
    const selectedStrokes = areaSelection.strokeIds
      .map((entry) => {
        if (entry.layer === "annotations") {
          return annotationStrokes.find((stroke) => stroke.id === entry.id) ?? null;
        }
        return boardStrokes.find((stroke) => stroke.id === entry.id) ?? null;
      })
      .filter((stroke): stroke is WorkbookStroke => Boolean(stroke));
    if (selectedObjects.length === 0 && selectedStrokes.length === 0) {
      areaSelectionClipboardRef.current = null;
      return;
    }
    areaSelectionClipboardRef.current = {
      objects: selectedObjects.map((object) => structuredClone<WorkbookBoardObject>(object)),
      strokes: selectedStrokes.map((stroke) => structuredClone<WorkbookStroke>(stroke)),
    };
    setAreaSelectionContextMenu(null);
  }, [
    annotationStrokes,
    areaSelection,
    areaSelectionClipboardRef,
    areaSelectionHasContent,
    boardObjectsRef,
    boardStrokes,
    canSelect,
    setAreaSelectionContextMenu,
  ]);

  const pasteAreaSelectionObjects = useCallback(async () => {
    if (!canSelect) return;
    const clipboard = areaSelectionClipboardRef.current;
    if (!clipboard || (clipboard.objects.length === 0 && clipboard.strokes.length === 0)) return;
    const now = new Date().toISOString();
    const offset = 24;
    const simulatedBoardObjects = boardObjectsRef.current.slice();
    const objectCreateEvents = clipboard.objects.map((object) => {
      const translatedObject = clampBoardObjectToPageFrame({
        ...object,
        id: generateId(),
        x: object.x + offset,
        y: object.y + offset,
        points: Array.isArray(object.points)
          ? object.points.map((point) => ({
              x: point.x + offset,
              y: point.y + offset,
            }))
          : object.points,
        createdAt: now,
        authorUserId: userId ?? object.authorUserId,
      });
      const nextObject = ensureWorkbookObjectZOrder(
        translatedObject,
        simulatedBoardObjects
      );
      simulatedBoardObjects.push(nextObject);
      return {
        type: "board.object.create" as const,
        payload: {
          object: nextObject,
        },
      };
    });
    const createEvents: WorkbookClientEventInput[] = [
      ...clipboard.strokes.map((stroke) => ({
        type:
          stroke.layer === "annotations"
            ? ("annotations.stroke" as const)
            : ("board.stroke" as const),
        payload: {
          stroke: {
            ...stroke,
            id: generateId(),
            points: stroke.points.map((point) => ({
              x: point.x + offset,
              y: point.y + offset,
            })),
            createdAt: now,
            authorUserId: userId ?? stroke.authorUserId,
          },
        },
      })),
      ...objectCreateEvents,
    ];
    try {
      await appendEventsAndApply(createEvents);
      setAreaSelectionContextMenu(null);
    } catch {
      setError("Не удалось вставить скопированную область.");
    }
  }, [
    appendEventsAndApply,
    areaSelectionClipboardRef,
    boardObjectsRef,
    canSelect,
    setAreaSelectionContextMenu,
    setError,
    userId,
  ]);

  const cutAreaSelectionObjects = useCallback(async () => {
    if (!canDelete || !areaSelection || !areaSelectionHasContent) return;
    copyAreaSelectionObjects();
    await deleteAreaSelectionObjects();
  }, [
    areaSelection,
    areaSelectionHasContent,
    canDelete,
    copyAreaSelectionObjects,
    deleteAreaSelectionObjects,
  ]);

  const cropImageByAreaSelection = useCallback(() => {
    if (!canSelect || !areaSelection || !areaSelectionHasContent) return;
    if (areaSelection.objectIds.length !== 1 || areaSelection.strokeIds.length > 0) {
      setError("Для обрезки выделите один объект-изображение.");
      return;
    }
    const targetId = areaSelection.objectIds[0];
    const target = boardObjectsRef.current.find((item) => item.id === targetId) ?? null;
    if (!target || target.type !== "image" || target.pinned || target.locked) {
      setError("Обрезка доступна только для одного незакрепленного изображения.");
      return;
    }
    const patch = buildWorkbookImageCropUpdate({
      object: target,
      selectionRect: areaSelection.rect,
    });
    if (!patch) {
      setError("Выделенная область не подходит для обрезки изображения.");
      return;
    }
    commitObjectUpdate(target.id, patch);
    const nextRect = resolveWorkbookObjectAxisAlignedRect(
      applyBoardObjectGeometryPatch(target, patch)
    );
    setAreaSelection({
      objectIds: [target.id],
      strokeIds: [],
      rect: nextRect,
    });
    setSelectedObjectId(target.id);
    setAreaSelectionContextMenu(null);
  }, [
    areaSelection,
    areaSelectionHasContent,
    boardObjectsRef,
    canSelect,
    commitObjectUpdate,
    setAreaSelection,
    setAreaSelectionContextMenu,
    setError,
    setSelectedObjectId,
  ]);

  const fillAreaSelection = useCallback(async (fillColor?: string) => {
    if (!canSelect || !areaSelection || !areaSelectionHasContent) return;
    const safeRect = resolveWorkbookObjectAxisAlignedRect({
      x: areaSelection.rect.x,
      y: areaSelection.rect.y,
      width: areaSelection.rect.width,
      height: areaSelection.rect.height,
    });
    if (!Number.isFinite(safeRect.width) || !Number.isFinite(safeRect.height)) {
      setError("Не удалось залить выделение.");
      return;
    }
    if (safeRect.width < 1 || safeRect.height < 1) {
      setError("Выделенная область слишком мала для заливки.");
      return;
    }
    const normalizedColor =
      typeof fillColor === "string" && fillColor.trim().length > 0
        ? fillColor
        : typeof areaFillColor === "string" && areaFillColor.trim().length > 0
          ? areaFillColor
        : "#2f4f7f";
    const now = new Date().toISOString();
    const baseObject: WorkbookBoardObject = {
      id: generateId(),
      type: "rectangle",
      layer: "board",
      x: safeRect.x,
      y: safeRect.y,
      width: safeRect.width,
      height: safeRect.height,
      color: normalizedColor,
      fill: normalizedColor,
      strokeWidth: 0,
      opacity: 0.24,
      page: currentBoardPage,
      meta: {
        sceneLayerId: boardSettings.activeSceneLayerId,
        showLabels: false,
      },
      authorUserId: userId ?? "unknown",
      createdAt: now,
    };
    const nextObject = ensureWorkbookObjectZOrder(baseObject, boardObjectsRef.current);
    try {
      await appendEventsAndApply([
        {
          type: "board.object.create",
          payload: {
            object: nextObject,
          },
        },
      ]);
      setAreaSelectionContextMenu(null);
    } catch {
      setError("Не удалось залить выделенную область.");
    }
  }, [
    appendEventsAndApply,
    areaFillColor,
    areaSelection,
    areaSelectionHasContent,
    boardObjectsRef,
    boardSettings.activeSceneLayerId,
    canSelect,
    currentBoardPage,
    setAreaSelectionContextMenu,
    setError,
    userId,
  ]);

  const restoreImageOriginalView = useCallback(
    (objectId: string) => {
      if (!canSelect) return;
      const target = boardObjectsRef.current.find((item) => item.id === objectId) ?? null;
      if (!target || target.type !== "image" || target.pinned || target.locked) return;
      const patch = buildWorkbookImageCropRestoreUpdate(target);
      if (!patch) return;
      commitObjectUpdate(target.id, patch);
      if (areaSelection?.objectIds.includes(target.id)) {
        const nextRect = resolveWorkbookObjectAxisAlignedRect(
          applyBoardObjectGeometryPatch(target, patch)
        );
        setAreaSelection({
          objectIds: [target.id],
          strokeIds: [],
          rect: nextRect,
        });
      }
    },
    [areaSelection?.objectIds, boardObjectsRef, canSelect, commitObjectUpdate, setAreaSelection]
  );

  return {
    deleteAreaSelectionObjects,
    copyAreaSelectionObjects,
    pasteAreaSelectionObjects,
    cutAreaSelectionObjects,
    cropImageByAreaSelection,
    fillAreaSelection,
    restoreImageOriginalView,
  };
};
