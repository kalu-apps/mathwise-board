import type { WorkbookTool } from "./types";

export const WORKBOOK_DEFAULT_STROKE_OPACITY = 1;
export const WORKBOOK_HIGHLIGHTER_STROKE_OPACITY = 0.5;

export type WorkbookStrokeSvgBlendMode = "normal" | "multiply";
export type WorkbookStrokeCanvasCompositeOperation = "source-over" | "multiply";

export const WORKBOOK_DEFAULT_STROKE_SVG_BLEND_MODE: WorkbookStrokeSvgBlendMode = "normal";
export const WORKBOOK_HIGHLIGHTER_STROKE_SVG_BLEND_MODE: WorkbookStrokeSvgBlendMode = "normal";

export const WORKBOOK_DEFAULT_STROKE_CANVAS_COMPOSITE_OPERATION: WorkbookStrokeCanvasCompositeOperation =
  "source-over";
export const WORKBOOK_HIGHLIGHTER_STROKE_CANVAS_COMPOSITE_OPERATION: WorkbookStrokeCanvasCompositeOperation =
  "source-over";

export const resolveWorkbookStrokeOpacity = (tool: WorkbookTool | string) =>
  tool === "highlighter"
    ? WORKBOOK_HIGHLIGHTER_STROKE_OPACITY
    : WORKBOOK_DEFAULT_STROKE_OPACITY;

export const resolveWorkbookStrokeSvgBlendMode = (tool: WorkbookTool | string) =>
  tool === "highlighter"
    ? WORKBOOK_HIGHLIGHTER_STROKE_SVG_BLEND_MODE
    : WORKBOOK_DEFAULT_STROKE_SVG_BLEND_MODE;

export const resolveWorkbookStrokeCanvasCompositeOperation = (
  tool: WorkbookTool | string
) =>
  tool === "highlighter"
    ? WORKBOOK_HIGHLIGHTER_STROKE_CANVAS_COMPOSITE_OPERATION
    : WORKBOOK_DEFAULT_STROKE_CANVAS_COMPOSITE_OPERATION;
