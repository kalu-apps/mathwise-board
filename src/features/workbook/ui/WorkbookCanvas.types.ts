import type { GraphFunctionDraft } from "../model/functionGraph";
import type { Solid3dSectionPoint } from "../model/solid3dState";
import type { ProjectedSolidVertex } from "../model/solid3dGeometry";
import type { WorkbookAreaSelection } from "../model/sceneSelection";
import type {
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTool,
} from "../model/types";
import type { WorkbookIncomingEraserPreview } from "../model/remoteEraserPreview";
import type { WorkbookPolygonPreset } from "../model/shapeGeometry";

export type WorkbookCanvasAreaSelection = WorkbookAreaSelection;

export type WorkbookEraserCommitPayload = {
  strokeDeletes: Array<{ strokeId: string; layer: WorkbookLayer }>;
  strokeReplacements: Array<{ stroke: WorkbookStroke; fragments: WorkbookPoint[][] }>;
  objectUpdates: Array<{ objectId: string; patch: Partial<WorkbookBoardObject> }>;
};

export type ShapeDraft = {
  tool:
    | "line"
    | "arrow"
    | "rectangle"
    | "ellipse"
    | "triangle"
    | "polygon"
    | "text"
    | "compass"
    | "formula"
    | "function_graph"
    | "frame"
    | "divider"
    | "sticker"
    | "comment"
    | "solid3d";
  start: WorkbookPoint;
  current: WorkbookPoint;
};

export type PendingCommittedStrokeBridge = {
  id: string;
  layer: WorkbookLayer;
  page: number;
  color: string;
  width: number;
  tool: WorkbookTool;
  path: string;
  isPresentInState: boolean;
  isDrawnInCommittedLayer: boolean;
};

export type InlineTextEditDraft = {
  objectId: string;
  value: string;
};

export type WorkbookCanvasProps = {
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  previewStrokes?: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  layer: WorkbookLayer;
  tool: WorkbookTool;
  color: string;
  width: number;
  authorUserId: string;
  polygonSides: number;
  polygonMode: "regular" | "points";
  polygonPreset?: WorkbookPolygonPreset;
  textPreset: string;
  formulaLatex?: string;
  formulaMathMl?: string;
  graphFunctions?: GraphFunctionDraft[];
  stickerText?: string;
  commentText?: string;
  lineStyle?: "solid" | "dashed";
  snapToGrid?: boolean;
  gridSize?: number;
  viewportZoom?: number;
  visibilityMode?: "viewport" | "full";
  showGrid?: boolean;
  gridColor?: string;
  backgroundColor?: string;
  imageAssetUrls?: Record<string, string>;
  incomingEraserPreviews?: WorkbookIncomingEraserPreview[];
  showPageNumbers?: boolean;
  currentPage?: number;
  disabled?: boolean;
  selectedObjectId: string | null;
  selectedConstraintId: string | null;
  focusPoint?: WorkbookPoint | null;
  pointerPoint?: WorkbookPoint | null;
  focusPoints?: WorkbookPoint[];
  pointerPoints?: WorkbookPoint[];
  viewportOffset?: WorkbookPoint;
  onViewportOffsetChange?: (offset: WorkbookPoint) => void;
  forcePanMode?: boolean;
  autoDividerStep?: number;
  autoDividersEnabled?: boolean;
  areaSelection?: WorkbookCanvasAreaSelection | null;
  solid3dDraftPointCollectionObjectId?: string | null;
  solid3dSectionMarkers?: {
    objectId: string;
    sectionId: string;
    selectedPoints: Solid3dSectionPoint[];
  } | null;
  onSelectedObjectChange: (objectId: string | null) => void;
  onSelectedConstraintChange: (constraintId: string | null) => void;
  onStrokeCommit: (stroke: WorkbookStroke) => void;
  onStrokePreview?: (payload: { stroke: WorkbookStroke; previewVersion: number }) => void;
  onEraserPreview?: (payload: {
    gestureId: string;
    layer: WorkbookLayer;
    page: number;
    radius: number;
    points: WorkbookPoint[];
    ended?: boolean;
  }) => void;
  onEraserCommit?: (payload: WorkbookEraserCommitPayload) => void;
  onStrokeDelete: (strokeId: string, layer: WorkbookLayer) => void;
  onStrokeReplace: (payload: {
    stroke: WorkbookStroke;
    fragments: WorkbookPoint[][];
  }) => void;
  onObjectCreate: (object: WorkbookBoardObject) => void;
  getLatestBoardObject?: (objectId: string) => WorkbookBoardObject | null;
  onObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void;
  onObjectDelete: (objectId: string) => void;
  onObjectContextMenu?: (objectId: string, anchor: { x: number; y: number }) => void;
  onShapeVertexContextMenu?: (payload: {
    objectId: string;
    vertexIndex: number;
    label: string;
    anchor: { x: number; y: number };
  }) => void;
  onLineEndpointContextMenu?: (payload: {
    objectId: string;
    endpoint: "start" | "end";
    label: string;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dVertexContextMenu?: (payload: {
    objectId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dSectionVertexContextMenu?: (payload: {
    objectId: string;
    sectionId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dSectionContextMenu?: (payload: {
    objectId: string;
    sectionId: string;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dDraftPointAdd?: (payload: {
    objectId: string;
    point: Solid3dSectionPoint;
  }) => void;
  onAreaSelectionChange?: (selection: WorkbookCanvasAreaSelection | null) => void;
  onAreaSelectionContextMenu?: (payload: {
    objectIds: string[];
    strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
    rect: { x: number; y: number; width: number; height: number };
    anchor: { x: number; y: number };
  }) => void;
  onInlineTextDraftChange?: (objectId: string, value: string) => void;
  onRequestSelectTool?: () => void;
  onLaserPoint: (point: WorkbookPoint) => void;
  onLaserClear?: () => void;
  onEraserRadiusChange?: (nextRadius: number) => void;
  solid3dInsertPreset?: {
    presetId: string;
    presetTitle?: string;
  } | null;
  onSolid3dInsertConsumed?: () => void;
};

export const STROKE_PREVIEW_SEND_INTERVAL_MS = 32;
export const COMMITTED_STROKE_BRIDGE_TIMEOUT_MS = 160;

export const ROUND_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);

export const summarizeProjectedVertices = (
  projectedVertexByIndex: Map<number, ProjectedSolidVertex>,
  indices: number[]
) => {
  const points = indices
    .map((index) => projectedVertexByIndex.get(index))
    .filter((point): point is ProjectedSolidVertex => Boolean(point));
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return {
    points,
    center: {
      x: center.x / points.length,
      y: center.y / points.length,
    },
    minX,
    maxX,
    minY,
    maxY,
    rx: Math.max(2, (maxX - minX) / 2),
    ry: Math.max(2, (maxY - minY) / 2),
  };
};

export const getSectionVertexLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length)}`;
};
