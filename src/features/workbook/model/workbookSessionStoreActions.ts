import {
  buildInitialWorkbookSessionCoreState,
} from "./workbookSessionStoreInitialState";
import {
  resolveStateUpdater,
  type StateUpdater,
  type WorkbookSessionStoreActions,
  type WorkbookSessionStoreSet,
} from "./workbookSessionStoreTypes";

const updateUi = <K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["ui"]>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["ui"][K]>
) => {
  set((state) => ({
    ui: {
      ...state.ui,
      [key]: resolveStateUpdater(updater, state.ui[key]),
    },
  }));
};

const updateCollab = <
  K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["collab"],
>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["collab"][K]>
) => {
  set((state) => ({
    collab: {
      ...state.collab,
      [key]: resolveStateUpdater(updater, state.collab[key]),
    },
  }));
};

const updateScene = <
  K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["scene"],
>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["scene"][K]>
) => {
  set((state) => ({
    scene: {
      ...state.scene,
      [key]: resolveStateUpdater(updater, state.scene[key]),
    },
  }));
};

const updateRuntime = <
  K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["runtime"],
>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["runtime"][K]>
) => {
  set((state) => ({
    runtime: {
      ...state.runtime,
      [key]: resolveStateUpdater(updater, state.runtime[key]),
    },
  }));
};

const updateTooling = <
  K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["tooling"],
>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["tooling"][K]>
) => {
  set((state) => ({
    tooling: {
      ...state.tooling,
      [key]: resolveStateUpdater(updater, state.tooling[key]),
    },
  }));
};

const updateMedia = <
  K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["media"],
>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["media"][K]>
) => {
  set((state) => ({
    media: {
      ...state.media,
      [key]: resolveStateUpdater(updater, state.media[key]),
    },
  }));
};

const updatePage = <
  K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["page"],
>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["page"][K]>
) => {
  set((state) => ({
    page: {
      ...state.page,
      [key]: resolveStateUpdater(updater, state.page[key]),
    },
  }));
};

const updateData = <
  K extends keyof ReturnType<typeof buildInitialWorkbookSessionCoreState>["data"],
>(
  set: WorkbookSessionStoreSet,
  key: K,
  updater: StateUpdater<ReturnType<typeof buildInitialWorkbookSessionCoreState>["data"][K]>
) => {
  set((state) => ({
    data: {
      ...state.data,
      [key]: resolveStateUpdater(updater, state.data[key]),
    },
  }));
};

export const createWorkbookSessionStoreActions = (
  set: WorkbookSessionStoreSet
): WorkbookSessionStoreActions => ({
  setLatestSeq: (updater) => updateCollab(set, "latestSeq", updater),
  setRealtimeSyncWarning: (updater) => updateCollab(set, "realtimeSyncWarning", updater),
  setIsWorkbookStreamConnected: (updater) =>
    updateCollab(set, "isWorkbookStreamConnected", updater),
  setIsWorkbookLiveConnected: (updater) =>
    updateCollab(set, "isWorkbookLiveConnected", updater),
  setIsSessionChatOpen: (updater) => updateUi(set, "isSessionChatOpen", updater),
  setIsSessionChatMinimized: (updater) => updateUi(set, "isSessionChatMinimized", updater),
  setIsSessionChatMaximized: (updater) => updateUi(set, "isSessionChatMaximized", updater),
  setIsParticipantsCollapsed: (updater) => updateUi(set, "isParticipantsCollapsed", updater),
  setSessionChatPosition: (updater) => updateUi(set, "sessionChatPosition", updater),
  setContextbarPosition: (updater) => updateUi(set, "contextbarPosition", updater),
  setFloatingPanelsTop: (updater) => updateUi(set, "floatingPanelsTop", updater),
  setSelectedObjectId: (updater) => updateScene(set, "selectedObjectId", updater),
  setSelectedConstraintId: (updater) => updateScene(set, "selectedConstraintId", updater),
  setCanvasViewport: (updater) => updateScene(set, "canvasViewport", updater),
  setViewportZoom: (updater) => updateScene(set, "viewportZoom", updater),
  setFocusPoint: (updater) => updateRuntime(set, "focusPoint", updater),
  setPointerPoint: (updater) => updateRuntime(set, "pointerPoint", updater),
  setFocusPointsByUser: (updater) => updateRuntime(set, "focusPointsByUser", updater),
  setPointerPointsByUser: (updater) => updateRuntime(set, "pointerPointsByUser", updater),
  setTool: (updater) => updateTooling(set, "tool", updater),
  setPenToolSettings: (updater) => updateTooling(set, "penToolSettings", updater),
  setHighlighterToolSettings: (updater) =>
    updateTooling(set, "highlighterToolSettings", updater),
  setEraserRadius: (updater) => updateTooling(set, "eraserRadius", updater),
  setStrokeColor: (updater) => updateTooling(set, "strokeColor", updater),
  setStrokeWidth: (updater) => updateTooling(set, "strokeWidth", updater),
  setPolygonSides: (updater) => updateTooling(set, "polygonSides", updater),
  setPolygonMode: (updater) => updateTooling(set, "polygonMode", updater),
  setPolygonPreset: (updater) => updateTooling(set, "polygonPreset", updater),
  setLineStyle: (updater) => updateTooling(set, "lineStyle", updater),
  setLineWidthDraft: (updater) => updateTooling(set, "lineWidthDraft", updater),
  setShape2dStrokeWidthDraft: (updater) =>
    updateTooling(set, "shape2dStrokeWidthDraft", updater),
  setDividerWidthDraft: (updater) => updateTooling(set, "dividerWidthDraft", updater),
  setSolid3dStrokeWidthDraft: (updater) =>
    updateTooling(set, "solid3dStrokeWidthDraft", updater),
  setGraphExpressionDraft: (updater) => updateTooling(set, "graphExpressionDraft", updater),
  setGraphDraftFunctions: (updater) => updateTooling(set, "graphDraftFunctions", updater),
  setSelectedGraphPresetId: (updater) => updateTooling(set, "selectedGraphPresetId", updater),
  setGraphDraftError: (updater) => updateTooling(set, "graphDraftError", updater),
  setGraphFunctionsDraft: (updater) => updateTooling(set, "graphFunctionsDraft", updater),
  setGraphCatalogCursorActive: (updater) =>
    updateTooling(set, "graphCatalogCursorActive", updater),
  setPendingSolid3dInsertPreset: (updater) =>
    updateTooling(set, "pendingSolid3dInsertPreset", updater),
  setGraphWorkbenchTab: (updater) => updateTooling(set, "graphWorkbenchTab", updater),
  setSolid3dInspectorTab: (updater) => updateTooling(set, "solid3dInspectorTab", updater),
  setSolid3dFigureTab: (updater) => updateTooling(set, "solid3dFigureTab", updater),
  setShape2dInspectorTab: (updater) => updateTooling(set, "shape2dInspectorTab", updater),
  setActiveSolidSectionId: (updater) => updateTooling(set, "activeSolidSectionId", updater),
  setSolid3dSectionPointCollecting: (updater) =>
    updateTooling(set, "solid3dSectionPointCollecting", updater),
  setSolid3dDraftPoints: (updater) => updateTooling(set, "solid3dDraftPoints", updater),
  setMicEnabled: (updater) => updateMedia(set, "micEnabled", updater),
  setSpacePanActive: (updater) => updatePage(set, "spacePanActive", updater),
  setIsFullscreen: (updater) => updatePage(set, "isFullscreen", updater),
  setIsCompactViewport: (updater) => updatePage(set, "isCompactViewport", updater),
  setIsDockedContextbarViewport: (updater) =>
    updatePage(set, "isDockedContextbarViewport", updater),
  setUtilityTab: (updater) => updatePage(set, "utilityTab", updater),
  setIsUtilityPanelOpen: (updater) => updatePage(set, "isUtilityPanelOpen", updater),
  setIsUtilityPanelCollapsed: (updater) => updatePage(set, "isUtilityPanelCollapsed", updater),
  setUtilityPanelPosition: (updater) => updatePage(set, "utilityPanelPosition", updater),
  setUtilityPanelDragState: (updater) => updatePage(set, "utilityPanelDragState", updater),
  setFrameFocusMode: (updater) => updatePage(set, "frameFocusMode", updater),
  setObjectContextMenu: (updater) => updatePage(set, "objectContextMenu", updater),
  setShapeVertexContextMenu: (updater) => updatePage(set, "shapeVertexContextMenu", updater),
  setLineEndpointContextMenu: (updater) => updatePage(set, "lineEndpointContextMenu", updater),
  setSolid3dVertexContextMenu: (updater) => updatePage(set, "solid3dVertexContextMenu", updater),
  setSolid3dSectionVertexContextMenu: (updater) =>
    updatePage(set, "solid3dSectionVertexContextMenu", updater),
  setSolid3dSectionContextMenu: (updater) =>
    updatePage(set, "solid3dSectionContextMenu", updater),
  setPointLabelDraft: (updater) => updatePage(set, "pointLabelDraft", updater),
  setShapeVertexLabelDraft: (updater) => updatePage(set, "shapeVertexLabelDraft", updater),
  setLineEndpointLabelDraft: (updater) => updatePage(set, "lineEndpointLabelDraft", updater),
  setSelectedLineStartLabelDraft: (updater) =>
    updatePage(set, "selectedLineStartLabelDraft", updater),
  setSelectedLineEndLabelDraft: (updater) =>
    updatePage(set, "selectedLineEndLabelDraft", updater),
  setSelectedTextDraft: (updater) => updatePage(set, "selectedTextDraft", updater),
  setSelectedTextFontSizeDraft: (updater) => updatePage(set, "selectedTextFontSizeDraft", updater),
  setShapeVertexLabelDrafts: (updater) => updatePage(set, "shapeVertexLabelDrafts", updater),
  setShapeAngleNoteDrafts: (updater) => updatePage(set, "shapeAngleNoteDrafts", updater),
  setShapeSegmentNoteDrafts: (updater) => updatePage(set, "shapeSegmentNoteDrafts", updater),
  setLoading: (updater) => updatePage(set, "loading", updater),
  setBootstrapReady: (updater) => updatePage(set, "bootstrapReady", updater),
  setError: (updater) => updatePage(set, "error", updater),
  setSaveSyncWarning: (updater) => updatePage(set, "saveSyncWarning", updater),
  setIsSessionTabPassive: (updater) => updatePage(set, "isSessionTabPassive", updater),
  setActiveSessionTabId: (updater) => updatePage(set, "activeSessionTabId", updater),
  setCopyingInviteLink: (updater) => updatePage(set, "copyingInviteLink", updater),
  setMenuAnchor: (updater) => updatePage(set, "menuAnchor", updater),
  setIsStereoDialogOpen: (updater) => updatePage(set, "isStereoDialogOpen", updater),
  setIsShapesDialogOpen: (updater) => updatePage(set, "isShapesDialogOpen", updater),
  setExportingSections: (updater) => updatePage(set, "exportingSections", updater),
  setIsBoardPageMutationPending: (updater) =>
    updatePage(set, "isBoardPageMutationPending", updater),
  setCanvasVisibilityMode: (updater) => updatePage(set, "canvasVisibilityMode", updater),
  setDocsWindow: (updater) => updatePage(set, "docsWindow", updater),
  setUploadingDoc: (updater) => updatePage(set, "uploadingDoc", updater),
  setUploadProgress: (updater) => updatePage(set, "uploadProgress", updater),
  setPendingClearRequest: (updater) => updatePage(set, "pendingClearRequest", updater),
  setAwaitingClearRequest: (updater) => updatePage(set, "awaitingClearRequest", updater),
  setConfirmedClearRequest: (updater) => updatePage(set, "confirmedClearRequest", updater),
  setIncomingStrokePreviews: (updater) => updatePage(set, "incomingStrokePreviews", updater),
  setIncomingEraserPreviews: (updater) => updatePage(set, "incomingEraserPreviews", updater),
  setIsSessionChatAtBottom: (updater) => updatePage(set, "isSessionChatAtBottom", updater),
  setSessionChatDraft: (updater) => updatePage(set, "sessionChatDraft", updater),
  setIsSessionChatEmojiOpen: (updater) => updatePage(set, "isSessionChatEmojiOpen", updater),
  setSessionChatReadAt: (updater) => updatePage(set, "sessionChatReadAt", updater),
  setIsClearSessionChatDialogOpen: (updater) =>
    updatePage(set, "isClearSessionChatDialogOpen", updater),
  setAreaSelection: (updater) => updatePage(set, "areaSelection", updater),
  setAreaSelectionContextMenu: (updater) => updatePage(set, "areaSelectionContextMenu", updater),
  setSaveState: (updater) => updatePage(set, "saveState", updater),
  setUndoDepth: (updater) => updatePage(set, "undoDepth", updater),
  setRedoDepth: (updater) => updatePage(set, "redoDepth", updater),
  setSession: (updater) => updateData(set, "session", updater),
  setBoardStrokes: (updater) => updateData(set, "boardStrokes", updater),
  setBoardObjects: (updater) => updateData(set, "boardObjects", updater),
  setConstraints: (updater) => updateData(set, "constraints", updater),
  setAnnotationStrokes: (updater) => updateData(set, "annotationStrokes", updater),
  setChatMessages: (updater) => updateData(set, "chatMessages", updater),
  setComments: (updater) => updateData(set, "comments", updater),
  setTimerState: (updater) => updateData(set, "timerState", updater),
  setBoardSettings: (updater) => updateData(set, "boardSettings", updater),
  setLibraryState: (updater) => updateData(set, "libraryState", updater),
  setDocumentState: (updater) => updateData(set, "documentState", updater),
  setSmartInkOptions: (updater) => updateData(set, "smartInkOptions", updater),
  resetForSession: () => {
    set(buildInitialWorkbookSessionCoreState());
  },
});
