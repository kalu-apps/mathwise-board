import { useCallback, useEffect } from "react";
import { generateId } from "@/shared/lib/id";
import { resolveSolid3dPresetId } from "@/features/workbook/model/solid3d";
import type { WorkbookBoardObject, WorkbookTool } from "@/features/workbook/model/types";

type StateUpdater<T> = T | ((current: T) => T);
type SetState<T> = (updater: StateUpdater<T>) => void;

type PendingSolid3dInsertPreset = {
  presetId: string;
  presetTitle?: string;
} | null;

type UseWorkbookMathPresetCreationHandlersParams = {
  canDraw: boolean;
  tool: WorkbookTool;
  boardObjectCount: number;
  boardGridSize: number;
  userId?: string;
  pendingSolid3dInsertPreset: PendingSolid3dInsertPreset;
  setPendingSolid3dInsertPreset: SetState<PendingSolid3dInsertPreset>;
  setSelectedObjectId: SetState<string | null>;
  setSelectedConstraintId: SetState<string | null>;
  setGraphDraftError: SetState<string | null>;
  setGraphWorkbenchTab: SetState<"catalog" | "work">;
  resetToolRuntimeToSelect: () => void;
  activateTool: (tool: WorkbookTool) => void;
  setSuppressAutoPanelSelectionObjectId: (objectId: string) => void;
  commitObjectCreate: (
    object: WorkbookBoardObject,
    options?: {
      auxiliaryEvents?: Array<{
        type: string;
        payload: Record<string, unknown>;
      }>;
    }
  ) => Promise<boolean>;
};

export const useWorkbookMathPresetCreationHandlers = ({
  canDraw,
  tool,
  boardObjectCount,
  boardGridSize,
  userId,
  pendingSolid3dInsertPreset,
  setPendingSolid3dInsertPreset,
  setSelectedObjectId,
  setSelectedConstraintId,
  setGraphDraftError,
  setGraphWorkbenchTab,
  resetToolRuntimeToSelect,
  activateTool,
  setSuppressAutoPanelSelectionObjectId,
  commitObjectCreate,
}: UseWorkbookMathPresetCreationHandlersParams) => {
  const createMathPresetObject = useCallback(
    async (
      type: "coordinate_grid" | "solid3d" | "section3d" | "net3d",
      options?: { presetId?: string; presetTitle?: string }
    ) => {
      if (!canDraw) return;
      if (type === "solid3d") {
        setPendingSolid3dInsertPreset({
          presetId: resolveSolid3dPresetId(options?.presetId ?? "cube"),
          presetTitle: options?.presetTitle,
        });
        setSelectedObjectId(null);
        setSelectedConstraintId(null);
        resetToolRuntimeToSelect();
        return;
      }
      const defaultSolidWidth = 220;
      const defaultSolidHeight = 180;
      const objectMeta =
        type === "coordinate_grid"
          ? { step: boardGridSize }
          : options?.presetId || options?.presetTitle
            ? {
                presetId: options?.presetId ?? null,
                presetTitle: options?.presetTitle ?? null,
              }
            : undefined;
      const object: WorkbookBoardObject = {
        id: generateId(),
        type,
        layer: "board",
        x: 110 + boardObjectCount * 6,
        y: 90 + boardObjectCount * 6,
        width: type === "coordinate_grid" ? 360 : defaultSolidWidth,
        height: type === "coordinate_grid" ? 240 : defaultSolidHeight,
        color:
          type === "section3d"
            ? "#c4872f"
            : type === "net3d"
              ? "#2f7464"
              : "#2f4f7f",
        fill:
          type === "section3d"
            ? "rgba(196, 135, 47, 0.22)"
            : type === "net3d"
              ? "rgba(47, 116, 100, 0.18)"
              : "transparent",
        strokeWidth: 2,
        opacity: 1,
        text: options?.presetTitle,
        meta: objectMeta,
        authorUserId: userId ?? "unknown",
        createdAt: new Date().toISOString(),
      };
      const created = await commitObjectCreate(object);
      if (!created) return;
      setSuppressAutoPanelSelectionObjectId(object.id);
      setSelectedObjectId(object.id);
      resetToolRuntimeToSelect();
    },
    [
      boardGridSize,
      boardObjectCount,
      canDraw,
      commitObjectCreate,
      resetToolRuntimeToSelect,
      setPendingSolid3dInsertPreset,
      setSelectedConstraintId,
      setSelectedObjectId,
      setSuppressAutoPanelSelectionObjectId,
      userId,
    ]
  );

  const createFunctionGraphPlane = useCallback(() => {
    if (!canDraw) return;
    setSelectedConstraintId(null);
    setSelectedObjectId(null);
    setGraphDraftError(null);
    setGraphWorkbenchTab("catalog");
    activateTool("function_graph");
  }, [
    activateTool,
    canDraw,
    setGraphDraftError,
    setGraphWorkbenchTab,
    setSelectedConstraintId,
    setSelectedObjectId,
  ]);

  useEffect(() => {
    if (!pendingSolid3dInsertPreset) return;
    if (tool === "select") return;
    setPendingSolid3dInsertPreset(null);
  }, [pendingSolid3dInsertPreset, setPendingSolid3dInsertPreset, tool]);

  const clearPendingSolid3dInsertPreset = useCallback(() => {
    setPendingSolid3dInsertPreset(null);
    resetToolRuntimeToSelect();
  }, [resetToolRuntimeToSelect, setPendingSolid3dInsertPreset]);

  return {
    createMathPresetObject,
    createFunctionGraphPlane,
    clearPendingSolid3dInsertPreset,
  };
};
