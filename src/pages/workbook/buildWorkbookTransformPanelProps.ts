import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";

export interface BuildWorkbookTransformPanelPropsParams {
  selectionDerivedState: Partial<WorkbookSessionTransformPanelProps>;
  workbookSessionTooling: Partial<WorkbookSessionTransformPanelProps>;
  workbookSessionPage: Partial<WorkbookSessionTransformPanelProps>;
  tool: WorkbookSessionTransformPanelProps["tool"];
  canSelect: WorkbookSessionTransformPanelProps["canSelect"];
  canDelete: WorkbookSessionTransformPanelProps["canDelete"];
  pointObjectCount: WorkbookSessionTransformPanelProps["pointObjectCount"];
  eraserRadiusMin: WorkbookSessionTransformPanelProps["eraserRadiusMin"];
  eraserRadiusMax: WorkbookSessionTransformPanelProps["eraserRadiusMax"];
  strokeWidth: WorkbookSessionTransformPanelProps["strokeWidth"];
  onStrokeWidthChange: WorkbookSessionTransformPanelProps["onStrokeWidthChange"];
  selectedObject: WorkbookSessionTransformPanelProps["selectedObject"];
  selectedObjectLabel: WorkbookSessionTransformPanelProps["selectedObjectLabel"];
  canToggleSelectedObjectLabels: WorkbookSessionTransformPanelProps["canToggleSelectedObjectLabels"];
  selectedObjectShowLabels: WorkbookSessionTransformPanelProps["selectedObjectShowLabels"];
  isSelectedObjectInComposition: WorkbookSessionTransformPanelProps["isSelectedObjectInComposition"];
  onMirrorSelectedObject: WorkbookSessionTransformPanelProps["onMirrorSelectedObject"];
  onUpdateSelectedObjectMeta: WorkbookSessionTransformPanelProps["onUpdateSelectedObjectMeta"];
  onDissolveCompositionLayer: WorkbookSessionTransformPanelProps["onDissolveCompositionLayer"];
  onOpenGraphPanel: WorkbookSessionTransformPanelProps["onOpenGraphPanel"];
  textFontOptions: WorkbookSessionTransformPanelProps["textFontOptions"];
  setSelectedTextDraft: WorkbookSessionTransformPanelProps["setSelectedTextDraft"];
  onScheduleSelectedTextDraftCommit: WorkbookSessionTransformPanelProps["onScheduleSelectedTextDraftCommit"];
  onFlushSelectedTextDraftCommit: WorkbookSessionTransformPanelProps["onFlushSelectedTextDraftCommit"];
  setSelectedTextFontSizeDraft: WorkbookSessionTransformPanelProps["setSelectedTextFontSizeDraft"];
  onUpdateSelectedTextFormatting: WorkbookSessionTransformPanelProps["onUpdateSelectedTextFormatting"];
  setDividerWidthDraft: WorkbookSessionTransformPanelProps["setDividerWidthDraft"];
  onUpdateSelectedDividerMeta: WorkbookSessionTransformPanelProps["onUpdateSelectedDividerMeta"];
  onUpdateSelectedDividerObject: WorkbookSessionTransformPanelProps["onUpdateSelectedDividerObject"];
  onCommitSelectedDividerWidth: WorkbookSessionTransformPanelProps["onCommitSelectedDividerWidth"];
  setLineStyle: WorkbookSessionTransformPanelProps["setLineStyle"];
  setLineWidthDraft: WorkbookSessionTransformPanelProps["setLineWidthDraft"];
  setSelectedLineStartLabelDraft: WorkbookSessionTransformPanelProps["setSelectedLineStartLabelDraft"];
  setSelectedLineEndLabelDraft: WorkbookSessionTransformPanelProps["setSelectedLineEndLabelDraft"];
  onUpdateSelectedLineMeta: WorkbookSessionTransformPanelProps["onUpdateSelectedLineMeta"];
  onUpdateSelectedLineObject: WorkbookSessionTransformPanelProps["onUpdateSelectedLineObject"];
  onCommitSelectedLineWidth: WorkbookSessionTransformPanelProps["onCommitSelectedLineWidth"];
  onCommitSelectedLineEndpointLabel: WorkbookSessionTransformPanelProps["onCommitSelectedLineEndpointLabel"];
  onConnectPointObjectsChronologically: WorkbookSessionTransformPanelProps["onConnectPointObjectsChronologically"];
  setShape2dInspectorTab: WorkbookSessionTransformPanelProps["setShape2dInspectorTab"];
  setShapeVertexLabelDrafts: WorkbookSessionTransformPanelProps["setShapeVertexLabelDrafts"];
  setShapeAngleNoteDrafts: WorkbookSessionTransformPanelProps["setShapeAngleNoteDrafts"];
  setShapeSegmentNoteDrafts: WorkbookSessionTransformPanelProps["setShapeSegmentNoteDrafts"];
  setShape2dStrokeWidthDraft: WorkbookSessionTransformPanelProps["setShape2dStrokeWidthDraft"];
  onUpdateSelectedShape2dMeta: WorkbookSessionTransformPanelProps["onUpdateSelectedShape2dMeta"];
  onUpdateSelectedShape2dObject: WorkbookSessionTransformPanelProps["onUpdateSelectedShape2dObject"];
  onCommitSelectedShape2dStrokeWidth: WorkbookSessionTransformPanelProps["onCommitSelectedShape2dStrokeWidth"];
  onRenameSelectedShape2dVertex: WorkbookSessionTransformPanelProps["onRenameSelectedShape2dVertex"];
  onScheduleSelectedShape2dAngleDraftCommit: WorkbookSessionTransformPanelProps["onScheduleSelectedShape2dAngleDraftCommit"];
  onFlushSelectedShape2dAngleDraftCommit: WorkbookSessionTransformPanelProps["onFlushSelectedShape2dAngleDraftCommit"];
  onUpdateSelectedShape2dAngleStyle: WorkbookSessionTransformPanelProps["onUpdateSelectedShape2dAngleStyle"];
  onScheduleSelectedShape2dSegmentDraftCommit: WorkbookSessionTransformPanelProps["onScheduleSelectedShape2dSegmentDraftCommit"];
  onFlushSelectedShape2dSegmentDraftCommit: WorkbookSessionTransformPanelProps["onFlushSelectedShape2dSegmentDraftCommit"];
  onUpdateSelectedShape2dVertexColor: WorkbookSessionTransformPanelProps["onUpdateSelectedShape2dVertexColor"];
  onUpdateSelectedShape2dAngleColor: WorkbookSessionTransformPanelProps["onUpdateSelectedShape2dAngleColor"];
  onUpdateSelectedShape2dSegmentColor: WorkbookSessionTransformPanelProps["onUpdateSelectedShape2dSegmentColor"];
  setSolid3dInspectorTab: WorkbookSessionTransformPanelProps["setSolid3dInspectorTab"];
  setSolid3dFigureTab: WorkbookSessionTransformPanelProps["setSolid3dFigureTab"];
  setActiveSolidSectionId: WorkbookSessionTransformPanelProps["setActiveSolidSectionId"];
  onSetSolid3dHiddenEdges: WorkbookSessionTransformPanelProps["onSetSolid3dHiddenEdges"];
  onUpdateSelectedSolid3dSurfaceColor: WorkbookSessionTransformPanelProps["onUpdateSelectedSolid3dSurfaceColor"];
  setSolid3dStrokeWidthDraft: WorkbookSessionTransformPanelProps["setSolid3dStrokeWidthDraft"];
  onUpdateSelectedSolid3dStrokeWidth: WorkbookSessionTransformPanelProps["onUpdateSelectedSolid3dStrokeWidth"];
  onCommitSelectedSolid3dStrokeWidth: WorkbookSessionTransformPanelProps["onCommitSelectedSolid3dStrokeWidth"];
  onResetSolid3dFaceColors: WorkbookSessionTransformPanelProps["onResetSolid3dFaceColors"];
  onSetSolid3dFaceColor: WorkbookSessionTransformPanelProps["onSetSolid3dFaceColor"];
  onResetSolid3dEdgeColors: WorkbookSessionTransformPanelProps["onResetSolid3dEdgeColors"];
  onSetSolid3dEdgeColor: WorkbookSessionTransformPanelProps["onSetSolid3dEdgeColor"];
  onAddSolid3dAngleMark: WorkbookSessionTransformPanelProps["onAddSolid3dAngleMark"];
  onUpdateSolid3dAngleMark: WorkbookSessionTransformPanelProps["onUpdateSolid3dAngleMark"];
  onDeleteSolid3dAngleMark: WorkbookSessionTransformPanelProps["onDeleteSolid3dAngleMark"];
  onStartSolid3dSectionPointCollection: WorkbookSessionTransformPanelProps["onStartSolid3dSectionPointCollection"];
  onBuildSectionFromDraftPoints: WorkbookSessionTransformPanelProps["onBuildSectionFromDraftPoints"];
  onClearSolid3dDraftPoints: WorkbookSessionTransformPanelProps["onClearSolid3dDraftPoints"];
  onUpdateSolid3dSection: WorkbookSessionTransformPanelProps["onUpdateSolid3dSection"];
  onDeleteSolid3dSection: WorkbookSessionTransformPanelProps["onDeleteSolid3dSection"];
  getSolidVertexLabel: WorkbookSessionTransformPanelProps["getSolidVertexLabel"];
  getSectionVertexLabel: WorkbookSessionTransformPanelProps["getSectionVertexLabel"];
}

export const buildWorkbookTransformPanelProps = ({
  selectionDerivedState,
  workbookSessionTooling,
  workbookSessionPage,
  tool,
  canSelect,
  canDelete,
  pointObjectCount,
  eraserRadiusMin,
  eraserRadiusMax,
  strokeWidth,
  onStrokeWidthChange,
  selectedObject,
  selectedObjectLabel,
  canToggleSelectedObjectLabels,
  selectedObjectShowLabels,
  isSelectedObjectInComposition,
  onMirrorSelectedObject,
  onUpdateSelectedObjectMeta,
  onDissolveCompositionLayer,
  onOpenGraphPanel,
  textFontOptions,
  setSelectedTextDraft,
  onScheduleSelectedTextDraftCommit,
  onFlushSelectedTextDraftCommit,
  setSelectedTextFontSizeDraft,
  onUpdateSelectedTextFormatting,
  setDividerWidthDraft,
  onUpdateSelectedDividerMeta,
  onUpdateSelectedDividerObject,
  onCommitSelectedDividerWidth,
  setLineStyle,
  setLineWidthDraft,
  setSelectedLineStartLabelDraft,
  setSelectedLineEndLabelDraft,
  onUpdateSelectedLineMeta,
  onUpdateSelectedLineObject,
  onCommitSelectedLineWidth,
  onCommitSelectedLineEndpointLabel,
  onConnectPointObjectsChronologically,
  setShape2dInspectorTab,
  setShapeVertexLabelDrafts,
  setShapeAngleNoteDrafts,
  setShapeSegmentNoteDrafts,
  setShape2dStrokeWidthDraft,
  onUpdateSelectedShape2dMeta,
  onUpdateSelectedShape2dObject,
  onCommitSelectedShape2dStrokeWidth,
  onRenameSelectedShape2dVertex,
  onScheduleSelectedShape2dAngleDraftCommit,
  onFlushSelectedShape2dAngleDraftCommit,
  onUpdateSelectedShape2dAngleStyle,
  onScheduleSelectedShape2dSegmentDraftCommit,
  onFlushSelectedShape2dSegmentDraftCommit,
  onUpdateSelectedShape2dVertexColor,
  onUpdateSelectedShape2dAngleColor,
  onUpdateSelectedShape2dSegmentColor,
  setSolid3dInspectorTab,
  setSolid3dFigureTab,
  setActiveSolidSectionId,
  onSetSolid3dHiddenEdges,
  onUpdateSelectedSolid3dSurfaceColor,
  setSolid3dStrokeWidthDraft,
  onUpdateSelectedSolid3dStrokeWidth,
  onCommitSelectedSolid3dStrokeWidth,
  onResetSolid3dFaceColors,
  onSetSolid3dFaceColor,
  onResetSolid3dEdgeColors,
  onSetSolid3dEdgeColor,
  onAddSolid3dAngleMark,
  onUpdateSolid3dAngleMark,
  onDeleteSolid3dAngleMark,
  onStartSolid3dSectionPointCollection,
  onBuildSectionFromDraftPoints,
  onClearSolid3dDraftPoints,
  onUpdateSolid3dSection,
  onDeleteSolid3dSection,
  getSolidVertexLabel,
  getSectionVertexLabel,
}: BuildWorkbookTransformPanelPropsParams): WorkbookSessionTransformPanelProps =>
  ({
    ...selectionDerivedState,
    ...workbookSessionTooling,
    ...workbookSessionPage,
    tool,
    canSelect,
    canDelete,
    pointObjectCount,
    eraserRadiusMin,
    eraserRadiusMax,
    strokeWidth,
    onStrokeWidthChange,
    selectedObject,
    selectedObjectLabel,
    canToggleSelectedObjectLabels,
    selectedObjectShowLabels,
    isSelectedObjectInComposition,
    onMirrorSelectedObject,
    onUpdateSelectedObjectMeta,
    onDissolveCompositionLayer,
    onOpenGraphPanel,
    textFontOptions,
    setSelectedTextDraft,
    onScheduleSelectedTextDraftCommit,
    onFlushSelectedTextDraftCommit,
    setSelectedTextFontSizeDraft,
    onUpdateSelectedTextFormatting,
    setDividerWidthDraft,
    onUpdateSelectedDividerMeta,
    onUpdateSelectedDividerObject,
    onCommitSelectedDividerWidth,
    setLineStyle,
    setLineWidthDraft,
    setSelectedLineStartLabelDraft,
    setSelectedLineEndLabelDraft,
    onUpdateSelectedLineMeta,
    onUpdateSelectedLineObject,
    onCommitSelectedLineWidth,
    onCommitSelectedLineEndpointLabel,
    onConnectPointObjectsChronologically,
    setShape2dInspectorTab,
    setShapeVertexLabelDrafts,
    setShapeAngleNoteDrafts,
    setShapeSegmentNoteDrafts,
    setShape2dStrokeWidthDraft,
    onUpdateSelectedShape2dMeta,
    onUpdateSelectedShape2dObject,
    onCommitSelectedShape2dStrokeWidth,
    onRenameSelectedShape2dVertex,
    onScheduleSelectedShape2dAngleDraftCommit,
    onFlushSelectedShape2dAngleDraftCommit,
    onUpdateSelectedShape2dAngleStyle,
    onScheduleSelectedShape2dSegmentDraftCommit,
    onFlushSelectedShape2dSegmentDraftCommit,
    onUpdateSelectedShape2dVertexColor,
    onUpdateSelectedShape2dAngleColor,
    onUpdateSelectedShape2dSegmentColor,
    setSolid3dInspectorTab,
    setSolid3dFigureTab,
    setActiveSolidSectionId,
    onSetSolid3dHiddenEdges,
    onUpdateSelectedSolid3dSurfaceColor,
    setSolid3dStrokeWidthDraft,
    onUpdateSelectedSolid3dStrokeWidth,
    onCommitSelectedSolid3dStrokeWidth,
    onResetSolid3dFaceColors,
    onSetSolid3dFaceColor,
    onResetSolid3dEdgeColors,
    onSetSolid3dEdgeColor,
    onAddSolid3dAngleMark,
    onUpdateSolid3dAngleMark,
    onDeleteSolid3dAngleMark,
    onStartSolid3dSectionPointCollection,
    onBuildSectionFromDraftPoints,
    onClearSolid3dDraftPoints,
    onUpdateSolid3dSection,
    onDeleteSolid3dSection,
    getSolidVertexLabel,
    getSectionVertexLabel,
  }) as WorkbookSessionTransformPanelProps;
