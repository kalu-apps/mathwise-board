import type { WorkbookBoardSettings } from "@/features/workbook/model/types";
import type { WorkbookSessionBoardSettingsPanelProps } from "./WorkbookSessionBoardSettingsPanel";
import type { WorkbookSessionGraphPanelProps } from "./WorkbookSessionGraphPanel";

type BuildWorkbookSessionUtilityPanelPropsInput = {
  settings: {
    boardSettings: WorkbookBoardSettings;
    onSharedBoardSettingsChange: (patch: Partial<WorkbookBoardSettings>) => void;
    boardPageOptions: WorkbookSessionBoardSettingsPanelProps["pageOptions"];
    canManageSharedBoardSettings: boolean;
  };
  graph: {
    graphTabUsesSelectedObject: boolean;
    canDraw: boolean;
    graphPlaneEntries: WorkbookSessionGraphPanelProps["planeEntries"];
    selectedFunctionGraphAxisColor: string;
    selectedFunctionGraphPlaneColor: string;
    graphWorkbenchTab: "catalog" | "work";
    graphExpressionDraft: string;
    graphDraftError: string | null;
    selectedGraphPresetId: string | null;
    graphTabFunctions: WorkbookSessionGraphPanelProps["graphTabFunctions"];
    onCreatePlane: () => void;
    onSelectPlane: (planeId: string) => void;
    onAxisColorChange: (color: string) => void;
    onPlaneColorChange: (color: string) => void;
    onClearPlaneBackground: () => void;
    onSelectCatalogTab: () => void;
    onSelectWorkTab: () => void;
    onGraphExpressionDraftChange: (value: string) => void;
    onAddGraphFunction: () => void;
    onSelectGraphPreset: (presetId: string, expression: string) => void;
    onGraphFunctionColorChange: (id: string, color: string) => void;
    onGraphFunctionExpressionChange: (id: string, value: string) => void;
    onCommitGraphExpressions: () => void;
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
    onSharedBoardSettingsChange: settings.onSharedBoardSettingsChange,
    pageOptions: settings.boardPageOptions,
    canManageSharedBoardSettings: settings.canManageSharedBoardSettings,
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
    graphExpressionDraft: graph.graphExpressionDraft,
    graphDraftError: graph.graphDraftError,
    onGraphExpressionDraftChange: graph.onGraphExpressionDraftChange,
    onAddGraphFunction: graph.onAddGraphFunction,
    selectedGraphPresetId: graph.selectedGraphPresetId,
    onSelectGraphPreset: graph.onSelectGraphPreset,
    graphTabFunctions: graph.graphTabFunctions,
    onGraphFunctionColorChange: graph.onGraphFunctionColorChange,
    onGraphFunctionExpressionChange: graph.onGraphFunctionExpressionChange,
    onCommitGraphExpressions: graph.onCommitGraphExpressions,
    onRemoveGraphFunction: graph.onRemoveGraphFunction,
    onToggleGraphFunctionVisibility: graph.onToggleGraphFunctionVisibility,
    onReflectGraphFunctionByAxis: graph.onReflectGraphFunctionByAxis,
  };

  return {
    settingsPanelProps,
    graphPanelProps,
  };
};
