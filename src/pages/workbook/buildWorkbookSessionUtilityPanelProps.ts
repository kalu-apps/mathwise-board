import type { WorkbookBoardSettings } from "@/features/workbook/model/types";
import type { WorkbookSessionBoardSettingsPanelProps } from "./WorkbookSessionBoardSettingsPanel";
import type { WorkbookSessionGraphPanelProps } from "./WorkbookSessionGraphPanel";

type BuildWorkbookSessionUtilityPanelPropsInput = {
  settings: {
    boardSettings: WorkbookBoardSettings;
    currentBoardPage: number;
    onSharedBoardSettingsChange: (patch: Partial<WorkbookBoardSettings>) => void;
    boardPageOptions: WorkbookSessionBoardSettingsPanelProps["pageOptions"];
    canManageSharedBoardSettings: boolean;
    compactToolSettings?: WorkbookSessionBoardSettingsPanelProps["compactToolSettings"];
  };
  graph: {
    graphTabUsesSelectedObject: boolean;
    canDraw: boolean;
    graphPlaneEntries: WorkbookSessionGraphPanelProps["planeEntries"];
    selectedFunctionGraphAxisColor: string;
    selectedFunctionGraphPlaneColor: string;
    graphWorkbenchTab: "catalog" | "work";
    selectedGraphPresetId: string | null;
    graphTabFunctions: WorkbookSessionGraphPanelProps["graphTabFunctions"];
    onCreatePlane: () => void;
    onSelectPlane: (planeId: string) => void;
    onAxisColorChange: (color: string) => void;
    onPlaneColorChange: (color: string) => void;
    onClearPlaneBackground: () => void;
    onSelectCatalogTab: () => void;
    onSelectWorkTab: () => void;
    onSelectGraphPreset: (presetId: string, expression: string) => void;
    onGraphFunctionColorChange: (id: string, color: string) => void;
    onToggleGraphFunctionDashed: (id: string, dashed: boolean) => void;
    onRemoveGraphFunction: (id: string) => void;
    onToggleGraphFunctionVisibility: (id: string, hidden: boolean) => void;
    onReflectGraphFunctionByAxis: (id: string, axis: "x" | "y") => void;
  };
};

export const buildWorkbookSessionUtilityPanelProps = ({
  settings,
  graph,
}: BuildWorkbookSessionUtilityPanelPropsInput) => {
  const settingsPanelProps: WorkbookSessionBoardSettingsPanelProps = {
    sharedBoardSettings: settings.boardSettings,
    currentBoardPage: settings.currentBoardPage,
    onSharedBoardSettingsChange: settings.onSharedBoardSettingsChange,
    pageOptions: settings.boardPageOptions,
    canManageSharedBoardSettings: settings.canManageSharedBoardSettings,
    compactToolSettings: settings.compactToolSettings,
  };

  const graphPanelProps: WorkbookSessionGraphPanelProps = {
    graphTabUsesSelectedObject: graph.graphTabUsesSelectedObject,
    canDraw: graph.canDraw,
    planeEntries: graph.graphPlaneEntries,
    onCreatePlane: graph.onCreatePlane,
    onSelectPlane: graph.onSelectPlane,
    selectedFunctionGraphAxisColor: graph.selectedFunctionGraphAxisColor,
    selectedFunctionGraphPlaneColor: graph.selectedFunctionGraphPlaneColor,
    onAxisColorChange: graph.onAxisColorChange,
    onPlaneColorChange: graph.onPlaneColorChange,
    onClearPlaneBackground: graph.onClearPlaneBackground,
    graphWorkbenchTab: graph.graphWorkbenchTab,
    onSelectCatalogTab: graph.onSelectCatalogTab,
    onSelectWorkTab: graph.onSelectWorkTab,
    selectedGraphPresetId: graph.selectedGraphPresetId,
    onSelectGraphPreset: graph.onSelectGraphPreset,
    graphTabFunctions: graph.graphTabFunctions,
    onGraphFunctionColorChange: graph.onGraphFunctionColorChange,
    onToggleGraphFunctionDashed: graph.onToggleGraphFunctionDashed,
    onRemoveGraphFunction: graph.onRemoveGraphFunction,
    onToggleGraphFunctionVisibility: graph.onToggleGraphFunctionVisibility,
    onReflectGraphFunctionByAxis: graph.onReflectGraphFunctionByAxis,
  };

  return {
    settingsPanelProps,
    graphPanelProps,
  };
};
