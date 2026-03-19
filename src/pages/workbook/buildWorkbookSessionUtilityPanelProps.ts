import type { Dispatch, SetStateAction } from "react";
import type { WorkbookBoardObject, WorkbookBoardSettings, WorkbookSceneLayer } from "@/features/workbook/model/types";
import type { SmartInkOptions } from "./workbookBoardSettingsModel";
import type { WorkbookSessionBoardSettingsPanelProps } from "./WorkbookSessionBoardSettingsPanel";
import type { WorkbookSessionGraphPanelProps } from "./WorkbookSessionGraphPanel";
import type { WorkbookSessionLayersPanelProps } from "./WorkbookSessionLayersPanel";

type BuildWorkbookSessionUtilityPanelPropsInput = {
  settings: {
    boardSettings: WorkbookBoardSettings;
    onSharedBoardSettingsChange: (patch: Partial<WorkbookBoardSettings>) => void;
    boardPageOptions: WorkbookSessionBoardSettingsPanelProps["pageOptions"];
    onSelectBoardPage: (page: number) => void;
    onAddBoardPage: () => void;
    onDeleteBoardPage: (page: number) => void;
    isBoardPageMutationPending: boolean;
    smartInkOptions: SmartInkOptions;
    setSmartInkOptions: Dispatch<SetStateAction<SmartInkOptions>>;
    penToolSettings: WorkbookSessionBoardSettingsPanelProps["penToolSettings"];
    highlighterToolSettings: WorkbookSessionBoardSettingsPanelProps["highlighterToolSettings"];
    clampedEraserRadius: number;
    onPenToolSettingsChange: (patch: Partial<{ color: string; width: number }>) => void;
    onHighlighterToolSettingsChange: (patch: Partial<{ color: string; width: number }>) => void;
    onEraserRadiusChange: (value: number) => void;
    eraserRadiusMin: number;
    eraserRadiusMax: number;
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
  layers: {
    compositionLayerEntries: Array<{ layer: WorkbookSceneLayer; objects: WorkbookBoardObject[] }>;
    getObjectTypeLabel: (object: WorkbookBoardObject) => string;
    onDissolveLayer: (layerId: string) => void;
    onFocusObject: (objectId: string) => void;
    onRemoveObject: (objectId: string, layerId: string) => void;
    onDeleteObject: (objectId: string) => void;
  };
};

export const buildWorkbookSessionUtilityPanelProps = ({
  settings,
  graph,
  layers,
}: BuildWorkbookSessionUtilityPanelPropsInput) => {
  const settingsPanelProps: WorkbookSessionBoardSettingsPanelProps = {
    sharedBoardSettings: settings.boardSettings,
    onSharedBoardSettingsChange: settings.onSharedBoardSettingsChange,
    pageOptions: settings.boardPageOptions,
    onSelectBoardPage: settings.onSelectBoardPage,
    onAddBoardPage: settings.onAddBoardPage,
    onDeleteBoardPage: settings.onDeleteBoardPage,
    isBoardPageMutationPending: settings.isBoardPageMutationPending,
    smartInkOptions: settings.smartInkOptions,
    setSmartInkOptions: settings.setSmartInkOptions,
    penToolSettings: settings.penToolSettings,
    highlighterToolSettings: settings.highlighterToolSettings,
    eraserRadius: settings.clampedEraserRadius,
    onPenToolSettingsChange: settings.onPenToolSettingsChange,
    onHighlighterToolSettingsChange: settings.onHighlighterToolSettingsChange,
    onEraserRadiusChange: settings.onEraserRadiusChange,
    eraserRadiusMin: settings.eraserRadiusMin,
    eraserRadiusMax: settings.eraserRadiusMax,
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

  const layersPanelProps: WorkbookSessionLayersPanelProps = {
    layers: layers.compositionLayerEntries,
    getObjectTypeLabel: layers.getObjectTypeLabel,
    onDissolveLayer: layers.onDissolveLayer,
    onFocusObject: layers.onFocusObject,
    onRemoveObject: layers.onRemoveObject,
    onDeleteObject: layers.onDeleteObject,
  };

  return {
    settingsPanelProps,
    graphPanelProps,
    layersPanelProps,
  };
};
