import type {
  WorkbookSessionPageSlice,
  WorkbookSessionStoreActions,
  WorkbookSessionToolingSlice,
} from "@/features/workbook/model/workbookSessionStoreTypes";
import type { useWorkbookSessionSelectionViewportState } from "./useWorkbookSessionSelectionViewportState";
import type { useWorkbookSelectedGraphTextActions } from "./useWorkbookSelectedGraphTextActions";
import type { useWorkbookSelectedStructureActions } from "./useWorkbookSelectedStructureActions";
import type { useWorkbookSelectedShape2dActions } from "./useWorkbookSelectedShape2dActions";
import type { useWorkbookSelectedSolid3dActions } from "./useWorkbookSelectedSolid3dActions";
import type { useWorkbookSolid3dSectionDraftHandlers } from "./useWorkbookSolid3dSectionDraftHandlers";
import type { useWorkbookObjectTransformHandlers } from "./useWorkbookObjectTransformHandlers";
import { buildWorkbookTransformPanelProps } from "./buildWorkbookTransformPanelProps";
import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";
import {
  ERASER_RADIUS_MAX,
  ERASER_RADIUS_MIN,
  MAIN_SCENE_LAYER_ID,
  getSectionVertexLabel,
  getSolidVertexLabel,
} from "./WorkbookSessionPage.core";
import { TEXT_FONT_OPTIONS } from "./WorkbookSessionPage.geometry";

type SelectionViewportState = ReturnType<typeof useWorkbookSessionSelectionViewportState>;
type SelectedGraphTextActions = ReturnType<typeof useWorkbookSelectedGraphTextActions>;
type SelectedStructureActions = ReturnType<typeof useWorkbookSelectedStructureActions>;
type SelectedShape2dActions = ReturnType<typeof useWorkbookSelectedShape2dActions>;
type SelectedSolid3dActions = ReturnType<typeof useWorkbookSelectedSolid3dActions>;
type Solid3dSectionDraftHandlers = ReturnType<typeof useWorkbookSolid3dSectionDraftHandlers>;
type ObjectTransformHandlers = ReturnType<typeof useWorkbookObjectTransformHandlers>;

type BuildWorkbookSessionTransformPanelRuntimePropsParams = {
  selectionViewportState: SelectionViewportState;
  workbookSessionTooling: WorkbookSessionToolingSlice;
  workbookSessionPage: WorkbookSessionPageSlice;
  workbookSessionActions: WorkbookSessionStoreActions;
  tool: WorkbookSessionTransformPanelProps["tool"];
  canSelect: boolean;
  canDelete: boolean;
  clampedEraserRadius: number;
  handleTransformStrokeWidthChange: (value: number) => void;
  handleTransformDissolveCompositionLayer: (layerId: string) => void;
  handleTransformOpenGraphPanel: () => void;
  selectedGraphTextActions: SelectedGraphTextActions;
  selectedStructureActions: SelectedStructureActions;
  selectedShape2dActions: SelectedShape2dActions;
  selectedSolid3dActions: SelectedSolid3dActions;
  solid3dSectionDraftHandlers: Solid3dSectionDraftHandlers;
  mirrorSelectedObject: ObjectTransformHandlers["mirrorSelectedObject"];
};

export const buildWorkbookSessionTransformPanelRuntimeProps = ({
  selectionViewportState,
  workbookSessionTooling,
  workbookSessionPage,
  workbookSessionActions,
  tool,
  canSelect,
  canDelete,
  clampedEraserRadius,
  handleTransformStrokeWidthChange,
  handleTransformDissolveCompositionLayer,
  handleTransformOpenGraphPanel,
  selectedGraphTextActions,
  selectedStructureActions,
  selectedShape2dActions,
  selectedSolid3dActions,
  solid3dSectionDraftHandlers,
  mirrorSelectedObject,
}: BuildWorkbookSessionTransformPanelRuntimePropsParams): WorkbookSessionTransformPanelProps =>
  buildWorkbookTransformPanelProps({
    selectionDerivedState: selectionViewportState.selectionDerivedState,
    workbookSessionTooling,
    workbookSessionPage,
    tool,
    canSelect,
    canDelete,
    pointObjectCount: selectionViewportState.pointObjectCount,
    eraserRadiusMin: ERASER_RADIUS_MIN,
    eraserRadiusMax: ERASER_RADIUS_MAX,
    strokeWidth: clampedEraserRadius,
    onStrokeWidthChange: handleTransformStrokeWidthChange,
    selectedObject: selectionViewportState.selectedObject,
    selectedObjectLabel: selectionViewportState.selectedObjectLabel,
    canToggleSelectedObjectLabels: selectionViewportState.canToggleSelectedObjectLabels,
    selectedObjectShowLabels: selectionViewportState.selectedObjectShowLabels,
    isSelectedObjectInComposition:
      selectionViewportState.selectedObjectSceneLayerId !== MAIN_SCENE_LAYER_ID,
    onMirrorSelectedObject: mirrorSelectedObject,
    onUpdateSelectedObjectMeta: selectedGraphTextActions.updateSelectedObjectMeta,
    onDissolveCompositionLayer: handleTransformDissolveCompositionLayer,
    onOpenGraphPanel: handleTransformOpenGraphPanel,
    textFontOptions: TEXT_FONT_OPTIONS,
    setSelectedTextDraft: workbookSessionActions.setSelectedTextDraft,
    onScheduleSelectedTextDraftCommit: selectedGraphTextActions.scheduleSelectedTextDraftCommit,
    onFlushSelectedTextDraftCommit: selectedGraphTextActions.flushSelectedTextDraftCommit,
    setSelectedTextFontSizeDraft: workbookSessionActions.setSelectedTextFontSizeDraft,
    onUpdateSelectedTextFormatting: selectedGraphTextActions.updateSelectedTextFormatting,
    setDividerWidthDraft: workbookSessionActions.setDividerWidthDraft,
    onUpdateSelectedDividerMeta: selectedStructureActions.updateSelectedDividerMeta,
    onUpdateSelectedDividerObject: selectedStructureActions.updateSelectedDividerObject,
    onCommitSelectedDividerWidth: selectedStructureActions.commitSelectedDividerWidth,
    setLineStyle: workbookSessionActions.setLineStyle,
    setLineWidthDraft: workbookSessionActions.setLineWidthDraft,
    setSelectedLineStartLabelDraft: workbookSessionActions.setSelectedLineStartLabelDraft,
    setSelectedLineEndLabelDraft: workbookSessionActions.setSelectedLineEndLabelDraft,
    onUpdateSelectedLineMeta: selectedGraphTextActions.updateSelectedLineMeta,
    onUpdateSelectedLineObject: selectedGraphTextActions.updateSelectedLineObject,
    onCommitSelectedLineWidth: selectedGraphTextActions.commitSelectedLineWidth,
    onCommitSelectedLineEndpointLabel: selectedGraphTextActions.commitSelectedLineEndpointLabel,
    onConnectPointObjectsChronologically:
      selectedStructureActions.connectPointObjectsChronologically,
    setShape2dInspectorTab: workbookSessionActions.setShape2dInspectorTab,
    setShapeVertexLabelDrafts: workbookSessionActions.setShapeVertexLabelDrafts,
    setShapeAngleNoteDrafts: workbookSessionActions.setShapeAngleNoteDrafts,
    setShapeSegmentNoteDrafts: workbookSessionActions.setShapeSegmentNoteDrafts,
    setShape2dStrokeWidthDraft: workbookSessionActions.setShape2dStrokeWidthDraft,
    onUpdateSelectedShape2dMeta: selectedShape2dActions.updateSelectedShape2dMeta,
    onUpdateSelectedShape2dObject: selectedShape2dActions.updateSelectedShape2dObject,
    onCommitSelectedShape2dStrokeWidth:
      selectedShape2dActions.commitSelectedShape2dStrokeWidth,
    onRenameSelectedShape2dVertex: selectedShape2dActions.renameSelectedShape2dVertex,
    onScheduleSelectedShape2dAngleDraftCommit:
      selectedShape2dActions.scheduleSelectedShape2dAngleDraftCommit,
    onFlushSelectedShape2dAngleDraftCommit:
      selectedShape2dActions.flushSelectedShape2dAngleDraftCommit,
    onUpdateSelectedShape2dAngleStyle: selectedShape2dActions.updateSelectedShape2dAngleStyle,
    onScheduleSelectedShape2dSegmentDraftCommit:
      selectedShape2dActions.scheduleSelectedShape2dSegmentDraftCommit,
    onFlushSelectedShape2dSegmentDraftCommit:
      selectedShape2dActions.flushSelectedShape2dSegmentDraftCommit,
    onUpdateSelectedShape2dVertexColor: selectedShape2dActions.updateSelectedShape2dVertexColor,
    onUpdateSelectedShape2dAngleColor: selectedShape2dActions.updateSelectedShape2dAngleColor,
    onUpdateSelectedShape2dSegmentColor:
      selectedShape2dActions.updateSelectedShape2dSegmentColor,
    setSolid3dInspectorTab: workbookSessionActions.setSolid3dInspectorTab,
    setSolid3dFigureTab: workbookSessionActions.setSolid3dFigureTab,
    setActiveSolidSectionId: workbookSessionActions.setActiveSolidSectionId,
    onSetSolid3dHiddenEdges: selectedSolid3dActions.setSolid3dHiddenEdges,
    onUpdateSelectedSolid3dSurfaceColor:
      selectedSolid3dActions.updateSelectedSolid3dSurfaceColor,
    setSolid3dStrokeWidthDraft: workbookSessionActions.setSolid3dStrokeWidthDraft,
    onUpdateSelectedSolid3dStrokeWidth:
      selectedSolid3dActions.updateSelectedSolid3dStrokeWidth,
    onCommitSelectedSolid3dStrokeWidth:
      selectedSolid3dActions.commitSelectedSolid3dStrokeWidth,
    onResetSolid3dFaceColors: selectedSolid3dActions.resetSolid3dFaceColors,
    onSetSolid3dFaceColor: selectedSolid3dActions.setSolid3dFaceColor,
    onResetSolid3dEdgeColors: selectedSolid3dActions.resetSolid3dEdgeColors,
    onSetSolid3dEdgeColor: selectedSolid3dActions.setSolid3dEdgeColor,
    onAddSolid3dAngleMark: selectedSolid3dActions.addSolid3dAngleMark,
    onUpdateSolid3dAngleMark: selectedSolid3dActions.updateSolid3dAngleMark,
    onDeleteSolid3dAngleMark: selectedSolid3dActions.deleteSolid3dAngleMark,
    onStartSolid3dSectionPointCollection:
      selectedSolid3dActions.startSolid3dSectionPointCollection,
    onBuildSectionFromDraftPoints: solid3dSectionDraftHandlers.buildSectionFromDraftPoints,
    onClearSolid3dDraftPoints: solid3dSectionDraftHandlers.clearSolid3dDraftPoints,
    onUpdateSolid3dSection: selectedSolid3dActions.updateSolid3dSection,
    onDeleteSolid3dSection: selectedSolid3dActions.deleteSolid3dSection,
    getSolidVertexLabel,
    getSectionVertexLabel,
  });
