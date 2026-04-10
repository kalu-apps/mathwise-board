import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";
import type {
  WorkbookIncomingEraserPreviewEntry,
  WorkbookStrokePreviewEntry,
} from "./useWorkbookIncomingRuntimeController";

export type ClearRequest = {
  requestId: string;
  targetLayer: WorkbookLayer;
  authorUserId: string;
};

export type DocsWindowState = {
  open: boolean;
  pinned: boolean;
  maximized: boolean;
};

export type WorkbookAreaSelection = {
  objectIds: string[];
  strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
  rect: { x: number; y: number; width: number; height: number };
  resizeEnabled?: boolean;
};

export type WorkbookAreaSelectionClipboard = {
  objects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
};

export type WorkbookUtilityTab = "settings" | "graph" | "transform";

export type WorkbookCanvasVisibilityMode = "viewport" | "full";

export type WorkbookObjectContextMenu = {
  objectId: string;
  x: number;
  y: number;
};

export type WorkbookShapeVertexContextMenu = {
  objectId: string;
  vertexIndex: number;
  x: number;
  y: number;
  label: string;
};

export type WorkbookLineEndpointContextMenu = {
  objectId: string;
  endpoint: "start" | "end";
  x: number;
  y: number;
  label: string;
};

export type WorkbookSolid3dVertexContextMenu = {
  objectId: string;
  vertexIndex: number;
  x: number;
  y: number;
  label: string;
};

export type WorkbookSolid3dSectionVertexContextMenu = {
  objectId: string;
  sectionId: string;
  vertexIndex: number;
  x: number;
  y: number;
  label: string;
};

export type WorkbookSolid3dSectionContextMenu = {
  objectId: string;
  sectionId: string;
  x: number;
  y: number;
};

export type WorkbookUtilityPanelDragState = {
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
};

export type WorkbookSessionPageSliceShape = {
  spacePanActive: boolean;
  isFullscreen: boolean;
  isCompactViewport: boolean;
  isDockedContextbarViewport: boolean;
  utilityTab: WorkbookUtilityTab;
  isUtilityPanelOpen: boolean;
  isUtilityPanelCollapsed: boolean;
  utilityPanelPosition: WorkbookPoint;
  utilityPanelDragState: WorkbookUtilityPanelDragState | null;
  frameFocusMode: "all" | "active";
  objectContextMenu: WorkbookObjectContextMenu | null;
  shapeVertexContextMenu: WorkbookShapeVertexContextMenu | null;
  lineEndpointContextMenu: WorkbookLineEndpointContextMenu | null;
  solid3dVertexContextMenu: WorkbookSolid3dVertexContextMenu | null;
  solid3dSectionVertexContextMenu: WorkbookSolid3dSectionVertexContextMenu | null;
  solid3dSectionContextMenu: WorkbookSolid3dSectionContextMenu | null;
  pointLabelDraft: string;
  shapeVertexLabelDraft: string;
  lineEndpointLabelDraft: string;
  selectedLineStartLabelDraft: string;
  selectedLineEndLabelDraft: string;
  selectedTextDraft: string;
  selectedTextFontSizeDraft: number;
  shapeVertexLabelDrafts: string[];
  shapeAngleNoteDrafts: string[];
  shapeSegmentNoteDrafts: string[];
  loading: boolean;
  bootstrapReady: boolean;
  error: string | null;
  saveSyncWarning: string | null;
  isSessionTabPassive: boolean;
  activeSessionTabId: string | null;
  copyingInviteLink: boolean;
  menuAnchor: HTMLElement | null;
  isStereoDialogOpen: boolean;
  isShapesDialogOpen: boolean;
  exportingSections: boolean;
  isBoardPageMutationPending: boolean;
  canvasVisibilityMode: WorkbookCanvasVisibilityMode;
  docsWindow: DocsWindowState;
  uploadingDoc: boolean;
  uploadProgress: number;
  pendingClearRequest: ClearRequest | null;
  awaitingClearRequest: ClearRequest | null;
  confirmedClearRequest: ClearRequest | null;
  incomingStrokePreviews: Record<string, WorkbookStrokePreviewEntry>;
  incomingEraserPreviews: Record<string, WorkbookIncomingEraserPreviewEntry>;
  isSessionChatAtBottom: boolean;
  sessionChatDraft: string;
  isSessionChatEmojiOpen: boolean;
  sessionChatReadAt: string | null;
  isClearSessionChatDialogOpen: boolean;
  areaSelection: WorkbookAreaSelection | null;
  areaSelectionContextMenu: { x: number; y: number } | null;
  saveState: "saved" | "unsaved" | "saving" | "error";
  undoDepth: number;
  redoDepth: number;
};
