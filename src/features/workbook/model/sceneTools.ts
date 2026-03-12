import type { WorkbookTool } from "./types";

const POINTER_SNAP_TOOLS = new Set<WorkbookTool>([
  "line",
  "arrow",
  "point",
  "rectangle",
  "ellipse",
  "triangle",
  "polygon",
  "text",
  "compass",
  "formula",
  "function_graph",
  "frame",
  "divider",
  "sticker",
  "comment",
]);

const SHAPE_CREATION_TOOLS = new Set<WorkbookTool>([
  "line",
  "arrow",
  "rectangle",
  "ellipse",
  "triangle",
  "text",
  "compass",
  "formula",
  "function_graph",
  "frame",
  "divider",
  "sticker",
  "comment",
]);

export const shouldSnapWorkbookPointerForTool = (
  tool: WorkbookTool,
  options?: {
    polygonMode?: "regular" | "points";
    includeSolid3dInsertPreset?: boolean;
  }
) => {
  if (options?.includeSolid3dInsertPreset) return true;
  if (tool === "polygon") return true;
  return POINTER_SNAP_TOOLS.has(tool);
};

export const isWorkbookPolygonPointTool = (
  tool: WorkbookTool,
  polygonMode: "regular" | "points"
) => tool === "polygon" && polygonMode === "points";

export const isWorkbookShapeCreationTool = (
  tool: WorkbookTool,
  polygonMode: "regular" | "points"
) => {
  if (tool === "polygon") return polygonMode === "regular";
  return SHAPE_CREATION_TOOLS.has(tool);
};

export const isWorkbookStrokeDrawingTool = (tool: WorkbookTool) =>
  tool === "pen" || tool === "highlighter";

export const resolveWorkbookCanvasModeFlags = (
  tool: WorkbookTool,
  forcePanMode: boolean
) => ({
  panModeEnabled: tool === "pan" || forcePanMode,
  graphModeEnabled: tool === "function_graph",
  eraserModeEnabled: tool === "eraser",
});

export const resolveWorkbookStrokeVisual = (
  tool: WorkbookTool,
  color: string,
  width: number
) => ({
  color: tool === "eraser" ? "var(--surface-soft)" : color,
  width: tool === "eraser" ? Math.max(8, width * 1.6) : width,
  opacity: tool === "highlighter" ? 0.5 : 1,
  committedTool: tool === "eraser" ? ("pen" as const) : tool,
});
