import type { WorkbookTool } from "./types";

export type WorkbookContinueInteractionMode =
  | "polygon_hover"
  | "ignore"
  | "panning"
  | "graph_pan"
  | "solid3d_gesture"
  | "solid3d_resize"
  | "area_selection_resize"
  | "area_selection_draft"
  | "eraser"
  | "stroke"
  | "shape"
  | "resizing"
  | "moving"
  | "idle";

export type WorkbookFinishInteractionMode =
  | "ignore"
  | "erasing"
  | "stroke"
  | "shape"
  | "area_selection_resize"
  | "area_selection_draft"
  | "panning"
  | "graph_pan"
  | "solid3d_gesture"
  | "solid3d_resize"
  | "resizing"
  | "moving"
  | "idle";

export const shouldPreventWorkbookPointerDefault = (pointerType: string) =>
  pointerType !== "mouse";

export const shouldTrackWorkbookEraserHover = (tool: WorkbookTool) =>
  tool === "eraser";

export const resolveWorkbookContinueInteractionMode = (params: {
  pointerIdMatches: boolean;
  polygonPointMode: boolean;
  panning: boolean;
  forcePanMode: boolean;
  graphPan: boolean;
  solid3dGesture: boolean;
  solid3dResize: boolean;
  areaSelectionResize: boolean;
  areaSelectionDraft: boolean;
  erasing: boolean;
  eraserMode: boolean;
  hasStrokePoints: boolean;
  shapeDraft: boolean;
  resizing: boolean;
  moving: boolean;
}) => {
  if (params.polygonPointMode && !params.panning && !params.forcePanMode) {
    return "polygon_hover" as const;
  }
  if (!params.pointerIdMatches) {
    return "ignore" as const;
  }
  if (params.panning) return "panning" as const;
  if (params.graphPan) return "graph_pan" as const;
  if (params.solid3dGesture) return "solid3d_gesture" as const;
  if (params.solid3dResize) return "solid3d_resize" as const;
  if (params.areaSelectionResize) return "area_selection_resize" as const;
  if (params.areaSelectionDraft) return "area_selection_draft" as const;
  if (params.erasing && params.eraserMode) return "eraser" as const;
  if (params.hasStrokePoints) return "stroke" as const;
  if (params.shapeDraft) return "shape" as const;
  if (params.resizing) return "resizing" as const;
  if (params.moving) return "moving" as const;
  return "idle" as const;
};

export const resolveWorkbookFinishInteractionMode = (params: {
  pointerIdMatches: boolean;
  svgPresent: boolean;
  erasing: boolean;
  hasStrokePoints: boolean;
  hasShapeDraft: boolean;
  hasAreaSelectionResize: boolean;
  hasAreaSelectionDraft: boolean;
  panning: boolean;
  hasGraphPan: boolean;
  hasSolid3dGesture: boolean;
  hasSolid3dResize: boolean;
  hasResizing: boolean;
  hasMoving: boolean;
}) => {
  if (!params.pointerIdMatches) return "ignore" as const;
  if (!params.svgPresent) return "ignore" as const;
  if (params.erasing) return "erasing" as const;
  if (params.hasStrokePoints) return "stroke" as const;
  if (params.hasShapeDraft) return "shape" as const;
  if (params.hasAreaSelectionResize) return "area_selection_resize" as const;
  if (params.hasAreaSelectionDraft) return "area_selection_draft" as const;
  if (params.panning) return "panning" as const;
  if (params.hasGraphPan) return "graph_pan" as const;
  if (params.hasSolid3dGesture) return "solid3d_gesture" as const;
  if (params.hasSolid3dResize) return "solid3d_resize" as const;
  if (params.hasResizing) return "resizing" as const;
  if (params.hasMoving) return "moving" as const;
  return "idle" as const;
};
