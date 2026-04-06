import type { ComponentProps } from "react";
import type { WorkbookCanvas } from "@/features/workbook/ui/WorkbookCanvas";
import type {
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTool,
} from "@/features/workbook/model/types";
import type {
  WorkbookAreaSelection,
  WorkbookCanvasVisibilityMode,
} from "@/features/workbook/model/workbookSessionUiTypes";
import type { GraphFunctionDraft } from "@/features/workbook/model/functionGraph";
import type { WorkbookIncomingEraserPreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { WorkbookBoardSettings } from "@/features/workbook/model/types";
import type { Solid3dSectionPoint } from "@/features/workbook/model/solid3dState";
import { sanitizeFunctionGraphDrafts } from "@/features/workbook/model/functionGraph";

type CanvasProps = ComponentProps<typeof WorkbookCanvas>;

const sanitizedGraphFunctionsCache = new WeakMap<
  ReadonlyArray<GraphFunctionDraft>,
  GraphFunctionDraft[]
>();

const getSanitizedGraphFunctions = (drafts: GraphFunctionDraft[]) => {
  const cached = sanitizedGraphFunctionsCache.get(drafts);
  if (cached) return cached;
  const sanitized = sanitizeFunctionGraphDrafts(drafts, {
    ensureNonEmpty: false,
  });
  sanitizedGraphFunctionsCache.set(drafts, sanitized);
  return sanitized;
};

interface UseWorkbookCanvasPropsParams {
  visibleBoardStrokes: WorkbookStroke[];
  visibleAnnotationStrokes: WorkbookStroke[];
  previewStrokes: WorkbookStroke[];
  visibleBoardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  layer: WorkbookLayer;
  tool: WorkbookTool;
  strokeColor: string;
  strokeWidth: number;
  userId?: string;
  polygonSides: number;
  polygonMode: "regular" | "points";
  polygonPreset: "regular" | "trapezoid" | "trapezoid_right" | "trapezoid_scalene" | "rhombus";
  textPreset: string;
  graphDraftFunctions: GraphFunctionDraft[];
  lineStyle: "solid" | "dashed";
  boardSettings: Pick<
    WorkbookBoardSettings,
    | "snapToGrid"
    | "gridSize"
    | "showGrid"
    | "gridColor"
    | "backgroundColor"
    | "showPageNumbers"
    | "pageFrameWidth"
    | "autoSectionDividers"
    | "dividerStep"
  >;
  currentPage: number;
  viewportZoom: number;
  canvasVisibilityMode: WorkbookCanvasVisibilityMode;
  imageAssetUrls: Record<string, string>;
  visibleIncomingEraserPreviews: Record<string, WorkbookIncomingEraserPreviewEntry>;
  canEdit: boolean;
  boardLocked: boolean;
  selectedObjectId: string | null;
  selectedConstraintId: string | null;
  focusPoint: WorkbookPoint | null;
  pointerPoint: WorkbookPoint | null;
  focusPoints: WorkbookPoint[];
  pointerPoints: WorkbookPoint[];
  canvasViewport: WorkbookPoint;
  onViewportOffsetChange: CanvasProps["onViewportOffsetChange"];
  onEraserRadiusChange: CanvasProps["onEraserRadiusChange"];
  forcePanMode: boolean;
  areaSelection: WorkbookAreaSelection | null;
  solid3dSectionPointCollecting: string | null;
  isSolid3dPointCollectionActive: boolean;
  solid3dDraftPoints: {
    objectId: string;
    points: Solid3dSectionPoint[];
  } | null;
  onSelectedObjectChange: CanvasProps["onSelectedObjectChange"];
  onSelectedConstraintChange: CanvasProps["onSelectedConstraintChange"];
  onStrokeCommit: CanvasProps["onStrokeCommit"];
  onStrokePreview: CanvasProps["onStrokePreview"];
  onEraserPreview: CanvasProps["onEraserPreview"];
  onEraserCommit: CanvasProps["onEraserCommit"];
  onStrokeDelete: CanvasProps["onStrokeDelete"];
  onStrokeReplace: CanvasProps["onStrokeReplace"];
  onObjectCreate: CanvasProps["onObjectCreate"];
  getLatestBoardObject: CanvasProps["getLatestBoardObject"];
  onObjectUpdate: CanvasProps["onObjectUpdate"];
  onObjectPinToggle: CanvasProps["onObjectPinToggle"];
  onObjectDelete: CanvasProps["onObjectDelete"];
  onObjectContextMenu: CanvasProps["onObjectContextMenu"];
  onShapeVertexContextMenu: CanvasProps["onShapeVertexContextMenu"];
  onLineEndpointContextMenu: CanvasProps["onLineEndpointContextMenu"];
  onSolid3dVertexContextMenu: CanvasProps["onSolid3dVertexContextMenu"];
  onSolid3dSectionVertexContextMenu: CanvasProps["onSolid3dSectionVertexContextMenu"];
  onSolid3dSectionContextMenu: CanvasProps["onSolid3dSectionContextMenu"];
  onSolid3dDraftPointAdd: CanvasProps["onSolid3dDraftPointAdd"];
  onAreaSelectionChange: CanvasProps["onAreaSelectionChange"];
  onAreaSelectionContextMenu: CanvasProps["onAreaSelectionContextMenu"];
  onInlineTextDraftChange: CanvasProps["onInlineTextDraftChange"];
  onRequestSelectTool: CanvasProps["onRequestSelectTool"];
  onLaserPoint: CanvasProps["onLaserPoint"];
  onLaserClear: CanvasProps["onLaserClear"];
  solid3dInsertPreset: CanvasProps["solid3dInsertPreset"];
  onSolid3dInsertConsumed: CanvasProps["onSolid3dInsertConsumed"];
}

export const buildWorkbookCanvasProps = ({
  visibleBoardStrokes,
  visibleAnnotationStrokes,
  previewStrokes,
  visibleBoardObjects,
  constraints,
  layer,
  tool,
  strokeColor,
  strokeWidth,
  userId,
  polygonSides,
  polygonMode,
  polygonPreset,
  textPreset,
  graphDraftFunctions,
  lineStyle,
  boardSettings,
  currentPage,
  viewportZoom,
  canvasVisibilityMode,
  imageAssetUrls,
  visibleIncomingEraserPreviews,
  canEdit,
  boardLocked,
  selectedObjectId,
  selectedConstraintId,
  focusPoint,
  pointerPoint,
  focusPoints,
  pointerPoints,
  canvasViewport,
  onViewportOffsetChange,
  onEraserRadiusChange,
  forcePanMode,
  areaSelection,
  solid3dSectionPointCollecting,
  isSolid3dPointCollectionActive,
  solid3dDraftPoints,
  onSelectedObjectChange,
  onSelectedConstraintChange,
  onStrokeCommit,
  onStrokePreview,
  onEraserPreview,
  onEraserCommit,
  onStrokeDelete,
  onStrokeReplace,
  onObjectCreate,
  getLatestBoardObject,
  onObjectUpdate,
  onObjectPinToggle,
  onObjectDelete,
  onObjectContextMenu,
  onShapeVertexContextMenu,
  onLineEndpointContextMenu,
  onSolid3dVertexContextMenu,
  onSolid3dSectionVertexContextMenu,
  onSolid3dSectionContextMenu,
  onSolid3dDraftPointAdd,
  onAreaSelectionChange,
  onAreaSelectionContextMenu,
  onInlineTextDraftChange,
  onRequestSelectTool,
  onLaserPoint,
  onLaserClear,
  solid3dInsertPreset,
  onSolid3dInsertConsumed,
}: UseWorkbookCanvasPropsParams): CanvasProps => ({
  boardStrokes: visibleBoardStrokes,
  annotationStrokes: visibleAnnotationStrokes,
  previewStrokes,
  boardObjects: visibleBoardObjects,
  constraints,
  layer,
  tool,
  color: strokeColor,
  width: strokeWidth,
  authorUserId: userId ?? "unknown",
  polygonSides,
  polygonMode,
  polygonPreset,
  textPreset,
  graphFunctions: getSanitizedGraphFunctions(graphDraftFunctions),
  lineStyle,
  snapToGrid: boardSettings.snapToGrid,
  gridSize: boardSettings.gridSize,
  viewportZoom,
  pageFrameWidth: boardSettings.pageFrameWidth,
  visibilityMode: canvasVisibilityMode,
  showGrid: boardSettings.showGrid,
  gridColor: boardSettings.gridColor,
  backgroundColor: boardSettings.backgroundColor,
  imageAssetUrls,
  incomingEraserPreviews: visibleIncomingEraserPreviews,
  showPageNumbers: boardSettings.showPageNumbers,
  currentPage,
  disabled: !canEdit || boardLocked,
  selectedObjectId,
  selectedConstraintId,
  focusPoint,
  pointerPoint,
  focusPoints,
  pointerPoints,
  viewportOffset: canvasViewport,
  onViewportOffsetChange,
  onEraserRadiusChange,
  forcePanMode,
  autoDividersEnabled: boardSettings.autoSectionDividers,
  autoDividerStep: boardSettings.dividerStep,
  areaSelection,
  solid3dDraftPointCollectionObjectId: solid3dSectionPointCollecting,
  solid3dSectionMarkers:
    isSolid3dPointCollectionActive && solid3dDraftPoints
      ? {
          objectId: solid3dDraftPoints.objectId,
          sectionId: "draft",
          selectedPoints: solid3dDraftPoints.points,
        }
      : null,
  onSelectedObjectChange,
  onSelectedConstraintChange,
  onStrokeCommit,
  onStrokePreview,
  onEraserPreview,
  onEraserCommit,
  onStrokeDelete,
  onStrokeReplace,
  onObjectCreate,
  getLatestBoardObject,
  onObjectUpdate,
  onObjectPinToggle,
  onObjectDelete,
  onObjectContextMenu,
  onShapeVertexContextMenu,
  onLineEndpointContextMenu,
  onSolid3dVertexContextMenu,
  onSolid3dSectionVertexContextMenu,
  onSolid3dSectionContextMenu,
  onSolid3dDraftPointAdd,
  onAreaSelectionChange,
  onAreaSelectionContextMenu,
  onInlineTextDraftChange,
  onRequestSelectTool,
  onLaserPoint,
  onLaserClear,
  solid3dInsertPreset,
  onSolid3dInsertConsumed,
});
