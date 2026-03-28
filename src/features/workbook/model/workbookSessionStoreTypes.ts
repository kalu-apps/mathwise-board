import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookLibraryState,
  WorkbookPoint,
  WorkbookSession,
  WorkbookStroke,
  WorkbookTimerState,
  WorkbookTool,
} from "./types";
import type { GraphFunctionDraft } from "./functionGraph";
import type { Solid3dSectionPoint } from "./solid3dState";
import type {
  WorkbookSessionPageSliceShape,
  WorkbookCanvasVisibilityMode,
  WorkbookUtilityTab,
  WorkbookObjectContextMenu,
  WorkbookShapeVertexContextMenu,
  WorkbookLineEndpointContextMenu,
  WorkbookSolid3dVertexContextMenu,
  WorkbookSolid3dSectionVertexContextMenu,
  WorkbookSolid3dSectionContextMenu,
  WorkbookUtilityPanelDragState,
  DocsWindowState,
  ClearRequest,
  WorkbookAreaSelection,
} from "./workbookSessionUiTypes";
import type {
  WorkbookIncomingEraserPreviewEntry,
  WorkbookStrokePreviewEntry,
} from "./useWorkbookIncomingRuntimeController";

export type StateUpdater<T> = T | ((current: T) => T);

export const resolveStateUpdater = <T>(updater: StateUpdater<T>, current: T): T =>
  typeof updater === "function"
    ? (updater as (current: T) => T)(current)
    : updater;

export type WorkbookToolPaintSettings = {
  color: string;
  width: number;
};

export type WorkbookPolygonPresetMode =
  | "regular"
  | "trapezoid"
  | "trapezoid_right"
  | "trapezoid_scalene"
  | "rhombus";

export type WorkbookSessionUiSlice = {
  isSessionChatOpen: boolean;
  isSessionChatMinimized: boolean;
  isSessionChatMaximized: boolean;
  isParticipantsCollapsed: boolean;
  sessionChatPosition: WorkbookPoint;
  contextbarPosition: WorkbookPoint;
  floatingPanelsTop: number;
};

export type WorkbookSessionCollabSlice = {
  latestSeq: number;
  realtimeSyncWarning: string | null;
  isWorkbookStreamConnected: boolean;
  isWorkbookLiveConnected: boolean;
};

export type WorkbookSessionSceneSlice = {
  selectedObjectId: string | null;
  selectedConstraintId: string | null;
  canvasViewport: WorkbookPoint;
  viewportZoom: number;
};

export type WorkbookSessionRuntimeSlice = {
  focusPoint: WorkbookPoint | null;
  pointerPoint: WorkbookPoint | null;
  focusPointsByUser: Record<string, WorkbookPoint>;
  pointerPointsByUser: Record<string, WorkbookPoint>;
};

export type WorkbookSessionToolingSlice = {
  tool: WorkbookTool;
  penToolSettings: WorkbookToolPaintSettings;
  highlighterToolSettings: WorkbookToolPaintSettings;
  eraserRadius: number;
  strokeColor: string;
  strokeWidth: number;
  polygonSides: number;
  polygonMode: "regular" | "points";
  polygonPreset: WorkbookPolygonPresetMode;
  lineStyle: "solid" | "dashed";
  lineWidthDraft: number;
  shape2dStrokeWidthDraft: number;
  dividerWidthDraft: number;
  solid3dStrokeWidthDraft: number;
  graphExpressionDraft: string;
  graphDraftFunctions: GraphFunctionDraft[];
  selectedGraphPresetId: string | null;
  graphDraftError: string | null;
  graphFunctionsDraft: GraphFunctionDraft[];
  graphCatalogCursorActive: boolean;
  pendingSolid3dInsertPreset: {
    presetId: string;
    presetTitle?: string;
  } | null;
  graphWorkbenchTab: "catalog" | "work";
  solid3dInspectorTab: "figure" | "section" | "hosted";
  solid3dFigureTab: "display" | "surface" | "faces" | "edges" | "angles";
  shape2dInspectorTab: "display" | "vertices" | "angles" | "segments";
  activeSolidSectionId: string | null;
  solid3dSectionPointCollecting: string | null;
  solid3dDraftPoints: {
    objectId: string;
    points: Solid3dSectionPoint[];
  } | null;
};

export type WorkbookSessionMediaSlice = {
  micEnabled: boolean;
};

export type WorkbookSessionPageSlice = WorkbookSessionPageSliceShape;

export type WorkbookSessionDataSlice = {
  session: WorkbookSession | null;
  boardStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  annotationStrokes: WorkbookStroke[];
  chatMessages: WorkbookChatMessage[];
  comments: WorkbookComment[];
  timerState: WorkbookTimerState | null;
  boardSettings: WorkbookBoardSettings;
  libraryState: WorkbookLibraryState;
  documentState: WorkbookDocumentState;
};

export type WorkbookSessionStoreActions = {
  setLatestSeq: (updater: StateUpdater<number>) => void;
  setRealtimeSyncWarning: (updater: StateUpdater<string | null>) => void;
  setIsWorkbookStreamConnected: (updater: StateUpdater<boolean>) => void;
  setIsWorkbookLiveConnected: (updater: StateUpdater<boolean>) => void;
  setIsSessionChatOpen: (updater: StateUpdater<boolean>) => void;
  setIsSessionChatMinimized: (updater: StateUpdater<boolean>) => void;
  setIsSessionChatMaximized: (updater: StateUpdater<boolean>) => void;
  setIsParticipantsCollapsed: (updater: StateUpdater<boolean>) => void;
  setSessionChatPosition: (updater: StateUpdater<WorkbookPoint>) => void;
  setContextbarPosition: (updater: StateUpdater<WorkbookPoint>) => void;
  setFloatingPanelsTop: (updater: StateUpdater<number>) => void;
  setSelectedObjectId: (updater: StateUpdater<string | null>) => void;
  setSelectedConstraintId: (updater: StateUpdater<string | null>) => void;
  setCanvasViewport: (updater: StateUpdater<WorkbookPoint>) => void;
  setViewportZoom: (updater: StateUpdater<number>) => void;
  setFocusPoint: (updater: StateUpdater<WorkbookPoint | null>) => void;
  setPointerPoint: (updater: StateUpdater<WorkbookPoint | null>) => void;
  setFocusPointsByUser: (updater: StateUpdater<Record<string, WorkbookPoint>>) => void;
  setPointerPointsByUser: (updater: StateUpdater<Record<string, WorkbookPoint>>) => void;
  setTool: (updater: StateUpdater<WorkbookTool>) => void;
  setPenToolSettings: (updater: StateUpdater<WorkbookToolPaintSettings>) => void;
  setHighlighterToolSettings: (updater: StateUpdater<WorkbookToolPaintSettings>) => void;
  setEraserRadius: (updater: StateUpdater<number>) => void;
  setStrokeColor: (updater: StateUpdater<string>) => void;
  setStrokeWidth: (updater: StateUpdater<number>) => void;
  setPolygonSides: (updater: StateUpdater<number>) => void;
  setPolygonMode: (updater: StateUpdater<"regular" | "points">) => void;
  setPolygonPreset: (updater: StateUpdater<WorkbookPolygonPresetMode>) => void;
  setLineStyle: (updater: StateUpdater<"solid" | "dashed">) => void;
  setLineWidthDraft: (updater: StateUpdater<number>) => void;
  setShape2dStrokeWidthDraft: (updater: StateUpdater<number>) => void;
  setDividerWidthDraft: (updater: StateUpdater<number>) => void;
  setSolid3dStrokeWidthDraft: (updater: StateUpdater<number>) => void;
  setGraphExpressionDraft: (updater: StateUpdater<string>) => void;
  setGraphDraftFunctions: (updater: StateUpdater<GraphFunctionDraft[]>) => void;
  setSelectedGraphPresetId: (updater: StateUpdater<string | null>) => void;
  setGraphDraftError: (updater: StateUpdater<string | null>) => void;
  setGraphFunctionsDraft: (updater: StateUpdater<GraphFunctionDraft[]>) => void;
  setGraphCatalogCursorActive: (updater: StateUpdater<boolean>) => void;
  setPendingSolid3dInsertPreset: (
    updater: StateUpdater<{ presetId: string; presetTitle?: string } | null>
  ) => void;
  setGraphWorkbenchTab: (updater: StateUpdater<"catalog" | "work">) => void;
  setSolid3dInspectorTab: (
    updater: StateUpdater<"figure" | "section" | "hosted">
  ) => void;
  setSolid3dFigureTab: (
    updater: StateUpdater<"display" | "surface" | "faces" | "edges" | "angles">
  ) => void;
  setShape2dInspectorTab: (
    updater: StateUpdater<"display" | "vertices" | "angles" | "segments">
  ) => void;
  setActiveSolidSectionId: (updater: StateUpdater<string | null>) => void;
  setSolid3dSectionPointCollecting: (updater: StateUpdater<string | null>) => void;
  setSolid3dDraftPoints: (
    updater: StateUpdater<{ objectId: string; points: Solid3dSectionPoint[] } | null>
  ) => void;
  setMicEnabled: (updater: StateUpdater<boolean>) => void;
  setSpacePanActive: (updater: StateUpdater<boolean>) => void;
  setIsFullscreen: (updater: StateUpdater<boolean>) => void;
  setIsCompactViewport: (updater: StateUpdater<boolean>) => void;
  setIsDockedContextbarViewport: (updater: StateUpdater<boolean>) => void;
  setUtilityTab: (updater: StateUpdater<WorkbookUtilityTab>) => void;
  setIsUtilityPanelOpen: (updater: StateUpdater<boolean>) => void;
  setIsUtilityPanelCollapsed: (updater: StateUpdater<boolean>) => void;
  setUtilityPanelPosition: (updater: StateUpdater<WorkbookPoint>) => void;
  setUtilityPanelDragState: (updater: StateUpdater<WorkbookUtilityPanelDragState | null>) => void;
  setFrameFocusMode: (updater: StateUpdater<"all" | "active">) => void;
  setObjectContextMenu: (updater: StateUpdater<WorkbookObjectContextMenu | null>) => void;
  setShapeVertexContextMenu: (
    updater: StateUpdater<WorkbookShapeVertexContextMenu | null>
  ) => void;
  setLineEndpointContextMenu: (
    updater: StateUpdater<WorkbookLineEndpointContextMenu | null>
  ) => void;
  setSolid3dVertexContextMenu: (
    updater: StateUpdater<WorkbookSolid3dVertexContextMenu | null>
  ) => void;
  setSolid3dSectionVertexContextMenu: (
    updater: StateUpdater<WorkbookSolid3dSectionVertexContextMenu | null>
  ) => void;
  setSolid3dSectionContextMenu: (
    updater: StateUpdater<WorkbookSolid3dSectionContextMenu | null>
  ) => void;
  setPointLabelDraft: (updater: StateUpdater<string>) => void;
  setShapeVertexLabelDraft: (updater: StateUpdater<string>) => void;
  setLineEndpointLabelDraft: (updater: StateUpdater<string>) => void;
  setSelectedLineStartLabelDraft: (updater: StateUpdater<string>) => void;
  setSelectedLineEndLabelDraft: (updater: StateUpdater<string>) => void;
  setSelectedTextDraft: (updater: StateUpdater<string>) => void;
  setSelectedTextFontSizeDraft: (updater: StateUpdater<number>) => void;
  setShapeVertexLabelDrafts: (updater: StateUpdater<string[]>) => void;
  setShapeAngleNoteDrafts: (updater: StateUpdater<string[]>) => void;
  setShapeSegmentNoteDrafts: (updater: StateUpdater<string[]>) => void;
  setLoading: (updater: StateUpdater<boolean>) => void;
  setBootstrapReady: (updater: StateUpdater<boolean>) => void;
  setError: (updater: StateUpdater<string | null>) => void;
  setSaveSyncWarning: (updater: StateUpdater<string | null>) => void;
  setIsSessionTabPassive: (updater: StateUpdater<boolean>) => void;
  setActiveSessionTabId: (updater: StateUpdater<string | null>) => void;
  setCopyingInviteLink: (updater: StateUpdater<boolean>) => void;
  setMenuAnchor: (updater: StateUpdater<HTMLElement | null>) => void;
  setIsStereoDialogOpen: (updater: StateUpdater<boolean>) => void;
  setIsShapesDialogOpen: (updater: StateUpdater<boolean>) => void;
  setExportingSections: (updater: StateUpdater<boolean>) => void;
  setIsBoardPageMutationPending: (updater: StateUpdater<boolean>) => void;
  setCanvasVisibilityMode: (updater: StateUpdater<WorkbookCanvasVisibilityMode>) => void;
  setDocsWindow: (updater: StateUpdater<DocsWindowState>) => void;
  setUploadingDoc: (updater: StateUpdater<boolean>) => void;
  setUploadProgress: (updater: StateUpdater<number>) => void;
  setPendingClearRequest: (updater: StateUpdater<ClearRequest | null>) => void;
  setAwaitingClearRequest: (updater: StateUpdater<ClearRequest | null>) => void;
  setConfirmedClearRequest: (updater: StateUpdater<ClearRequest | null>) => void;
  setIncomingStrokePreviews: (
    updater: StateUpdater<Record<string, WorkbookStrokePreviewEntry>>
  ) => void;
  setIncomingEraserPreviews: (
    updater: StateUpdater<Record<string, WorkbookIncomingEraserPreviewEntry>>
  ) => void;
  setIsSessionChatAtBottom: (updater: StateUpdater<boolean>) => void;
  setSessionChatDraft: (updater: StateUpdater<string>) => void;
  setIsSessionChatEmojiOpen: (updater: StateUpdater<boolean>) => void;
  setSessionChatReadAt: (updater: StateUpdater<string | null>) => void;
  setIsClearSessionChatDialogOpen: (updater: StateUpdater<boolean>) => void;
  setAreaSelection: (updater: StateUpdater<WorkbookAreaSelection | null>) => void;
  setAreaSelectionContextMenu: (
    updater: StateUpdater<{ x: number; y: number } | null>
  ) => void;
  setSaveState: (updater: StateUpdater<"saved" | "unsaved" | "saving" | "error">) => void;
  setUndoDepth: (updater: StateUpdater<number>) => void;
  setRedoDepth: (updater: StateUpdater<number>) => void;
  setSession: (updater: StateUpdater<WorkbookSession | null>) => void;
  setBoardStrokes: (updater: StateUpdater<WorkbookStroke[]>) => void;
  setBoardObjects: (updater: StateUpdater<WorkbookBoardObject[]>) => void;
  setConstraints: (updater: StateUpdater<WorkbookConstraint[]>) => void;
  setAnnotationStrokes: (updater: StateUpdater<WorkbookStroke[]>) => void;
  setChatMessages: (updater: StateUpdater<WorkbookChatMessage[]>) => void;
  setComments: (updater: StateUpdater<WorkbookComment[]>) => void;
  setTimerState: (updater: StateUpdater<WorkbookTimerState | null>) => void;
  setBoardSettings: (updater: StateUpdater<WorkbookBoardSettings>) => void;
  setLibraryState: (updater: StateUpdater<WorkbookLibraryState>) => void;
  setDocumentState: (updater: StateUpdater<WorkbookDocumentState>) => void;
  resetForSession: () => void;
};

export type WorkbookSessionStoreState = {
  ui: WorkbookSessionUiSlice;
  collab: WorkbookSessionCollabSlice;
  scene: WorkbookSessionSceneSlice;
  runtime: WorkbookSessionRuntimeSlice;
  tooling: WorkbookSessionToolingSlice;
  media: WorkbookSessionMediaSlice;
  page: WorkbookSessionPageSlice;
  data: WorkbookSessionDataSlice;
  actions: WorkbookSessionStoreActions;
};

export type WorkbookSessionStoreCoreState = Omit<WorkbookSessionStoreState, "actions">;

export type WorkbookSessionStoreSet = (
  partial:
    | Partial<WorkbookSessionStoreState>
    | ((state: WorkbookSessionStoreState) => Partial<WorkbookSessionStoreState>)
) => void;
