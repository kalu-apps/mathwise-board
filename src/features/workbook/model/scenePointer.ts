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

export type WorkbookStartInteractionMode =
  | "button_ignore"
  | "solid3d_insert"
  | "force_pan"
  | "pan"
  | "lock_toggle"
  | "polygon_points"
  | "laser"
  | "sweep"
  | "area_select"
  | "point"
  | "solid3d_draft_point"
  | "select"
  | "eraser"
  | "stroke"
  | "shape"
  | "idle";

export type WorkbookPanStartAction =
  | "rotate_solid3d"
  | "graph_pan"
  | "move"
  | "pan";

export type WorkbookSelectStartAction =
  | "solid3d_resize"
  | "resize"
  | "move_group"
  | "move"
  | "area_select";

export const shouldPreventWorkbookPointerDefault = (pointerType: string) =>
  pointerType !== "mouse";

export const shouldTrackWorkbookEraserHover = (tool: WorkbookTool) =>
  tool === "eraser";

export const resolveWorkbookStartInteractionMode = (params: {
  button: number;
  tool: WorkbookTool;
  polygonPointMode: boolean;
  solid3dInsertPreset: boolean;
  forcePanMode: boolean;
}) => {
  if (params.button !== 0) return "button_ignore" as const;
  if (params.solid3dInsertPreset) return "solid3d_insert" as const;
  if (params.forcePanMode) return "force_pan" as const;
  if (params.tool === "pan") return "pan" as const;
  if (params.tool === "lock_toggle") return "lock_toggle" as const;
  if (params.polygonPointMode) return "polygon_points" as const;
  if (params.tool === "laser") return "laser" as const;
  if (params.tool === "sweep") return "sweep" as const;
  if (params.tool === "area_select") return "area_select" as const;
  if (params.tool === "point") return "point" as const;
  if (params.tool === "select") return "select" as const;
  if (params.tool === "eraser") return "eraser" as const;
  if (params.tool === "pen" || params.tool === "highlighter") return "stroke" as const;
  if (
    params.tool === "line" ||
    params.tool === "arrow" ||
    params.tool === "rectangle" ||
    params.tool === "ellipse" ||
    params.tool === "triangle" ||
    params.tool === "polygon" ||
    params.tool === "text" ||
    params.tool === "compass" ||
    params.tool === "formula" ||
    params.tool === "function_graph" ||
    params.tool === "frame" ||
    params.tool === "divider" ||
    params.tool === "sticker" ||
    params.tool === "comment"
  ) {
    return "shape" as const;
  }
  return "idle" as const;
};

export const shouldClearWorkbookLaserOnSecondaryButton = (params: {
  tool: WorkbookTool;
  button: number;
}) => params.tool === "laser" && params.button === 2;

export const resolveWorkbookPanStartAction = (params: {
  hasTarget: boolean;
  targetPinned: boolean;
  targetType: string | null;
  hasTargetFunctionId: boolean;
}): WorkbookPanStartAction => {
  if (!params.hasTarget || params.targetPinned) {
    return "pan";
  }
  if (params.targetType === "solid3d") {
    return "rotate_solid3d";
  }
  if (params.targetType === "function_graph" && params.hasTargetFunctionId) {
    return "graph_pan";
  }
  return "move";
};

export const resolveWorkbookSelectStartAction = (params: {
  hasSelected: boolean;
  selectedPinned: boolean;
  selectedType: string | null;
  hasSolid3dResizeHit: boolean;
  hasResizeMode: boolean;
  keepInsideArea: boolean;
  hasGroupedTargets: boolean;
  hasTarget: boolean;
  targetPinned: boolean;
}): WorkbookSelectStartAction => {
  if (
    params.hasSelected &&
    !params.selectedPinned &&
    params.selectedType === "solid3d" &&
    params.hasSolid3dResizeHit
  ) {
    return "solid3d_resize";
  }
  if (
    params.hasSelected &&
    !params.selectedPinned &&
    params.selectedType !== "solid3d" &&
    params.hasResizeMode
  ) {
    return "resize";
  }
  if (params.keepInsideArea && params.hasGroupedTargets) {
    return "move_group";
  }
  if (params.hasTarget && !params.targetPinned) {
    return "move";
  }
  return "area_select";
};

export const resolveWorkbookContinueInteractionMode = (params: {
  pointerIdMatches: boolean;
  primaryButtonPressed: boolean;
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
  if (!params.primaryButtonPressed) {
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
