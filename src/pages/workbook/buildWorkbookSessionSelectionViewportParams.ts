import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import type {
  WorkbookSessionDataSlice,
  WorkbookSessionPageSlice,
  WorkbookSessionSceneSlice,
  WorkbookSessionStoreActions,
  WorkbookSessionToolingSlice,
} from "@/features/workbook/model/workbookSessionStoreTypes";
import type { useWorkbookSessionRefs } from "./workbookSessionRefs";
import type { useWorkbookObjectMutationHandlers } from "./useWorkbookObjectMutationHandlers";
import type { useWorkbookSolid3dSectionDraftHandlers } from "./useWorkbookSolid3dSectionDraftHandlers";
import type { useWorkbookSessionSelectionViewportState } from "./useWorkbookSessionSelectionViewportState";

type WorkbookSessionRefs = ReturnType<typeof useWorkbookSessionRefs>;
type ObjectMutationHandlers = ReturnType<typeof useWorkbookObjectMutationHandlers>;
type Solid3dDraftHandlers = ReturnType<typeof useWorkbookSolid3dSectionDraftHandlers>;
type SelectionViewportParams = Parameters<typeof useWorkbookSessionSelectionViewportState>[0];

interface BuildWorkbookSessionSelectionViewportParamsInput {
  sessionId: string;
  scene: WorkbookSessionSceneSlice;
  page: WorkbookSessionPageSlice;
  data: WorkbookSessionDataSlice;
  tooling: WorkbookSessionToolingSlice;
  actions: WorkbookSessionStoreActions;
  refs: WorkbookSessionRefs;
  canSelect: boolean;
  areaSelectionHasContent: boolean;
  getObjectSceneLayerId: (object: WorkbookBoardObject) => string;
  getPointLimitForSolidObject: Solid3dDraftHandlers["getPointLimitForSolidObject"];
  commitObjectUpdate: ObjectMutationHandlers["commitObjectUpdate"];
}

export const buildWorkbookSessionSelectionViewportParams = ({
  sessionId,
  scene,
  page,
  data,
  tooling,
  actions,
  refs,
  canSelect,
  areaSelectionHasContent,
  getObjectSceneLayerId,
  getPointLimitForSolidObject,
  commitObjectUpdate,
}: BuildWorkbookSessionSelectionViewportParamsInput): SelectionViewportParams => ({
  selectionDerivedParams: {
    boardObjects: data.boardObjects,
    selectedObjectId: scene.selectedObjectId,
    isCompactViewport: page.isCompactViewport,
    isUtilityPanelOpen: page.isUtilityPanelOpen,
    utilityTab: page.utilityTab,
    graphFunctionsDraft: tooling.graphFunctionsDraft,
    graphDraftFunctions: tooling.graphDraftFunctions,
    solid3dSectionPointCollecting: tooling.solid3dSectionPointCollecting,
    solid3dDraftPoints: tooling.solid3dDraftPoints,
    getObjectSceneLayerId,
    getPointLimitForSolidObject,
  },
  selectionSyncParams: {
    boardObjects: data.boardObjects,
    selectedTextDraft: page.selectedTextDraft,
    isUtilityPanelOpen: page.isUtilityPanelOpen,
    utilityTab: page.utilityTab,
    tool: tooling.tool,
    activeSolidSectionId: tooling.activeSolidSectionId,
    solid3dFigureTab: tooling.solid3dFigureTab,
    solid3dSectionPointCollecting: tooling.solid3dSectionPointCollecting,
    solid3dDraftPoints: tooling.solid3dDraftPoints,
    solid3dSectionVertexContextMenu: page.solid3dSectionVertexContextMenu,
    canSelect,
    lineDraftObjectIdRef: refs.lineDraftObjectIdRef,
    selectedTextDraftValueRef: refs.selectedTextDraftValueRef,
    selectedTextDraftObjectIdRef: refs.selectedTextDraftObjectIdRef,
    selectedTextDraftDirtyRef: refs.selectedTextDraftDirtyRef,
    selectedTextDraftCommitTimerRef: refs.selectedTextDraftCommitTimerRef,
    graphDraftObjectIdRef: refs.graphDraftObjectIdRef,
    shapeDraftObjectIdRef: refs.shapeDraftObjectIdRef,
    shapeAngleDraftCommitTimersRef: refs.shapeAngleDraftCommitTimersRef,
    shapeAngleDraftValuesRef: refs.shapeAngleDraftValuesRef,
    shapeSegmentDraftCommitTimersRef: refs.shapeSegmentDraftCommitTimersRef,
    shapeSegmentDraftValuesRef: refs.shapeSegmentDraftValuesRef,
    dividerDraftObjectIdRef: refs.dividerDraftObjectIdRef,
    setIsUtilityPanelOpen: actions.setIsUtilityPanelOpen,
    setSolid3dFigureTab: actions.setSolid3dFigureTab,
    setSolid3dInspectorTab: actions.setSolid3dInspectorTab,
    setShape2dInspectorTab: actions.setShape2dInspectorTab,
    shape2dInspectorTab: tooling.shape2dInspectorTab,
    setSelectedTextDraft: actions.setSelectedTextDraft,
    setSelectedTextFontSizeDraft: actions.setSelectedTextFontSizeDraft,
    setLineWidthDraft: actions.setLineWidthDraft,
    setSelectedLineStartLabelDraft: actions.setSelectedLineStartLabelDraft,
    setSelectedLineEndLabelDraft: actions.setSelectedLineEndLabelDraft,
    setGraphFunctionsDraft: actions.setGraphFunctionsDraft,
    setGraphDraftError: actions.setGraphDraftError,
    setGraphWorkbenchTab: actions.setGraphWorkbenchTab,
    setShape2dStrokeWidthDraft: actions.setShape2dStrokeWidthDraft,
    setShapeVertexLabelDrafts: actions.setShapeVertexLabelDrafts,
    setShapeAngleNoteDrafts: actions.setShapeAngleNoteDrafts,
    setShapeSegmentNoteDrafts: actions.setShapeSegmentNoteDrafts,
    setDividerWidthDraft: actions.setDividerWidthDraft,
    setActiveSolidSectionId: actions.setActiveSolidSectionId,
    setSolid3dSectionPointCollecting: actions.setSolid3dSectionPointCollecting,
    setSolid3dDraftPoints: actions.setSolid3dDraftPoints,
    setSolid3dVertexContextMenu: actions.setSolid3dVertexContextMenu,
    setSolid3dSectionVertexContextMenu: actions.setSolid3dSectionVertexContextMenu,
    setSolid3dSectionContextMenu: actions.setSolid3dSectionContextMenu,
    setSolid3dStrokeWidthDraft: actions.setSolid3dStrokeWidthDraft,
    commitObjectUpdate,
  },
  contextMenuDerivedParams: {
    boardObjects: data.boardObjects,
    objectContextMenu: page.objectContextMenu,
    shapeVertexContextMenu: page.shapeVertexContextMenu,
    lineEndpointContextMenu: page.lineEndpointContextMenu,
    solid3dSectionContextMenu: page.solid3dSectionContextMenu,
    areaSelection: page.areaSelection,
    areaSelectionHasContent,
    canSelect,
    setPointLabelDraft: actions.setPointLabelDraft,
    setShapeVertexLabelDraft: actions.setShapeVertexLabelDraft,
    setLineEndpointLabelDraft: actions.setLineEndpointLabelDraft,
  },
  pageVisibilityParams: {
    documentState: data.documentState,
    boardObjects: data.boardObjects,
    boardStrokes: data.boardStrokes,
    annotationStrokes: data.annotationStrokes,
    incomingEraserPreviews: page.incomingEraserPreviews,
    currentPage: scene.currentBoardPage,
    boardSettings: {
      pagesCount: data.boardSettings.pagesCount,
      activeFrameId: data.boardSettings.activeFrameId,
      pageOrder: data.boardSettings.pageOrder,
      pageTitles: data.boardSettings.pageTitles,
    },
    frameFocusMode: page.frameFocusMode,
    selectedObjectId: scene.selectedObjectId,
    setSelectedObjectId: actions.setSelectedObjectId,
    setAreaSelection: actions.setAreaSelection,
  },
  sessionId,
  setCanvasViewport: actions.setCanvasViewport,
  setSpacePanActive: actions.setSpacePanActive,
});
