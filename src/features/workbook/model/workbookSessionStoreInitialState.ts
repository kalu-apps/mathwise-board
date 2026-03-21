import type {
  WorkbookSessionDataSlice,
  WorkbookSessionCollabSlice,
  WorkbookSessionMediaSlice,
  WorkbookSessionPageSlice,
  WorkbookSessionRuntimeSlice,
  WorkbookSessionSceneSlice,
  WorkbookSessionStoreCoreState,
  WorkbookSessionToolingSlice,
  WorkbookSessionUiSlice,
} from "./workbookSessionStoreTypes";
import {
  DEFAULT_BOARD_SETTINGS,
  DEFAULT_LIBRARY,
} from "@/pages/workbook/WorkbookSessionPage.core";

const COMPACT_VIEWPORT_MAX_WIDTH = 760;
const DOCKED_CONTEXTBAR_MAX_WIDTH = 1024;

export const initialUiSlice = (): WorkbookSessionUiSlice => ({
  isSessionChatOpen: false,
  isSessionChatMinimized: false,
  isSessionChatMaximized: false,
  isParticipantsCollapsed: false,
  sessionChatPosition: { x: 24, y: 96 },
  contextbarPosition: { x: 24, y: 18 },
  floatingPanelsTop: 86,
});

export const initialCollabSlice = (): WorkbookSessionCollabSlice => ({
  latestSeq: 0,
  realtimeSyncWarning: null,
  isWorkbookStreamConnected: false,
  isWorkbookLiveConnected: false,
});

export const initialSceneSlice = (): WorkbookSessionSceneSlice => ({
  selectedObjectId: null,
  selectedConstraintId: null,
  canvasViewport: { x: 0, y: 0 },
  viewportZoom: 1,
});

export const initialRuntimeSlice = (): WorkbookSessionRuntimeSlice => ({
  focusPoint: null,
  pointerPoint: null,
  focusPointsByUser: {},
  pointerPointsByUser: {},
});

export const initialToolingSlice = (): WorkbookSessionToolingSlice => ({
  tool: "select",
  penToolSettings: {
    color: "#4f63ff",
    width: 3,
  },
  highlighterToolSettings: {
    color: "#ffd54f",
    width: 12,
  },
  eraserRadius: 14,
  strokeColor: "#4f63ff",
  strokeWidth: 3,
  polygonSides: 5,
  polygonMode: "regular",
  polygonPreset: "regular",
  lineStyle: "solid",
  lineWidthDraft: 3,
  shape2dStrokeWidthDraft: 2,
  dividerWidthDraft: 2,
  solid3dStrokeWidthDraft: 2,
  graphExpressionDraft: "",
  graphDraftFunctions: [],
  selectedGraphPresetId: null,
  graphDraftError: null,
  graphFunctionsDraft: [],
  graphCatalogCursorActive: false,
  pendingSolid3dInsertPreset: null,
  graphWorkbenchTab: "catalog",
  solid3dInspectorTab: "section",
  solid3dFigureTab: "display",
  shape2dInspectorTab: "display",
  activeSolidSectionId: null,
  solid3dSectionPointCollecting: null,
  solid3dDraftPoints: null,
});

export const initialMediaSlice = (): WorkbookSessionMediaSlice => ({
  micEnabled: true,
});

export const initialPageSlice = (): WorkbookSessionPageSlice => ({
  spacePanActive: false,
  isFullscreen: false,
  isCompactViewport:
    typeof window !== "undefined" ? window.innerWidth <= COMPACT_VIEWPORT_MAX_WIDTH : false,
  isDockedContextbarViewport:
    typeof window !== "undefined" ? window.innerWidth <= DOCKED_CONTEXTBAR_MAX_WIDTH : false,
  utilityTab: "settings",
  isUtilityPanelOpen: false,
  isUtilityPanelCollapsed: false,
  utilityPanelPosition: { x: 0, y: 86 },
  utilityPanelDragState: null,
  frameFocusMode: "all",
  objectContextMenu: null,
  shapeVertexContextMenu: null,
  lineEndpointContextMenu: null,
  solid3dVertexContextMenu: null,
  solid3dSectionVertexContextMenu: null,
  solid3dSectionContextMenu: null,
  pointLabelDraft: "",
  shapeVertexLabelDraft: "",
  lineEndpointLabelDraft: "",
  selectedLineStartLabelDraft: "",
  selectedLineEndLabelDraft: "",
  selectedTextDraft: "",
  selectedTextFontSizeDraft: 18,
  shapeVertexLabelDrafts: [],
  shapeAngleNoteDrafts: [],
  shapeSegmentNoteDrafts: [],
  loading: true,
  bootstrapReady: false,
  error: null,
  saveSyncWarning: null,
  isSessionTabPassive: false,
  activeSessionTabId: null,
  copyingInviteLink: false,
  menuAnchor: null,
  isStereoDialogOpen: false,
  isShapesDialogOpen: false,
  exportingSections: false,
  isBoardPageMutationPending: false,
  canvasVisibilityMode: "viewport",
  docsWindow: {
    open: false,
    pinned: false,
    maximized: false,
  },
  uploadingDoc: false,
  uploadProgress: 0,
  pendingClearRequest: null,
  awaitingClearRequest: null,
  confirmedClearRequest: null,
  incomingStrokePreviews: {},
  incomingEraserPreviews: {},
  isSessionChatAtBottom: true,
  sessionChatDraft: "",
  isSessionChatEmojiOpen: false,
  sessionChatReadAt: null,
  isClearSessionChatDialogOpen: false,
  areaSelection: null,
  areaSelectionContextMenu: null,
  saveState: "saved",
  undoDepth: 0,
  redoDepth: 0,
});

export const initialDataSlice = (): WorkbookSessionDataSlice => ({
  session: null,
  boardStrokes: [],
  boardObjects: [],
  constraints: [],
  annotationStrokes: [],
  chatMessages: [],
  comments: [],
  timerState: null,
  boardSettings: DEFAULT_BOARD_SETTINGS,
  libraryState: DEFAULT_LIBRARY,
  documentState: {
    assets: [],
    activeAssetId: null,
    page: 1,
    zoom: 1,
    annotations: [],
  },
});

export const buildInitialWorkbookSessionCoreState = (): WorkbookSessionStoreCoreState => ({
  ui: initialUiSlice(),
  collab: initialCollabSlice(),
  scene: initialSceneSlice(),
  runtime: initialRuntimeSlice(),
  tooling: initialToolingSlice(),
  media: initialMediaSlice(),
  page: initialPageSlice(),
  data: initialDataSlice(),
});
