import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { WorkbookTool } from "@/features/workbook/model/types";
import { defaultColorByLayer } from "./WorkbookSessionPage.core";
import { getDefaultToolWidth, type ToolPaintSettings } from "./WorkbookSessionPage.geometry";

interface UseWorkbookToolRuntimeHandlersParams {
  tool: WorkbookTool;
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  eraserRadius: number;
  strokeColor: string;
  strokeWidth: number;
  setTool: Dispatch<SetStateAction<WorkbookTool>>;
  setPenToolSettings: Dispatch<SetStateAction<ToolPaintSettings>>;
  setHighlighterToolSettings: Dispatch<SetStateAction<ToolPaintSettings>>;
  setEraserRadius: Dispatch<SetStateAction<number>>;
  setStrokeColor: Dispatch<SetStateAction<string>>;
  setStrokeWidth: Dispatch<SetStateAction<number>>;
  eraserRadiusMin: number;
  eraserRadiusMax: number;
}

export function useWorkbookToolRuntimeHandlers({
  tool,
  penToolSettings,
  highlighterToolSettings,
  eraserRadius,
  strokeColor,
  strokeWidth,
  setTool,
  setPenToolSettings,
  setHighlighterToolSettings,
  setEraserRadius,
  setStrokeColor,
  setStrokeWidth,
  eraserRadiusMin,
  eraserRadiusMax,
}: UseWorkbookToolRuntimeHandlersParams) {
  const clampEraserRadius = useCallback(
    (value: number) =>
      Math.max(eraserRadiusMin, Math.min(eraserRadiusMax, Math.round(value))),
    [eraserRadiusMax, eraserRadiusMin]
  );

  const clampedEraserRadius = clampEraserRadius(eraserRadius);

  const resetToolRuntimeToSelect = useCallback(() => {
    setTool("select");
    setStrokeColor(defaultColorByLayer.board);
    setStrokeWidth(getDefaultToolWidth("select"));
  }, [setStrokeColor, setStrokeWidth, setTool]);

  const activateTool = useCallback(
    (nextTool: WorkbookTool) => {
      setTool(nextTool);
      if (nextTool === "pen") {
        setStrokeColor(penToolSettings.color);
        setStrokeWidth(penToolSettings.width);
        return;
      }
      if (nextTool === "highlighter") {
        setStrokeColor(highlighterToolSettings.color);
        setStrokeWidth(highlighterToolSettings.width);
        return;
      }
      if (nextTool === "eraser") {
        setStrokeColor(defaultColorByLayer.board);
        setStrokeWidth(clampedEraserRadius);
        return;
      }
      setStrokeColor(defaultColorByLayer.board);
      setStrokeWidth(getDefaultToolWidth(nextTool));
    },
    [
      clampedEraserRadius,
      highlighterToolSettings,
      penToolSettings,
      setStrokeColor,
      setStrokeWidth,
      setTool,
    ]
  );

  const handlePenToolSettingsChange = useCallback(
    (patch: Partial<ToolPaintSettings>) => {
      setPenToolSettings((current) => {
        const next = {
          color: typeof patch.color === "string" && patch.color ? patch.color : current.color,
          width:
            typeof patch.width === "number" && Number.isFinite(patch.width)
              ? Math.max(1, Math.round(patch.width))
              : current.width,
        };
        if (tool === "pen") {
          setStrokeColor(next.color);
          setStrokeWidth(next.width);
        }
        return next;
      });
    },
    [setPenToolSettings, setStrokeColor, setStrokeWidth, tool]
  );

  const handleHighlighterToolSettingsChange = useCallback(
    (patch: Partial<ToolPaintSettings>) => {
      setHighlighterToolSettings((current) => {
        const next = {
          color: typeof patch.color === "string" && patch.color ? patch.color : current.color,
          width:
            typeof patch.width === "number" && Number.isFinite(patch.width)
              ? Math.max(2, Math.round(patch.width))
              : current.width,
        };
        if (tool === "highlighter") {
          setStrokeColor(next.color);
          setStrokeWidth(next.width);
        }
        return next;
      });
    },
    [setHighlighterToolSettings, setStrokeColor, setStrokeWidth, tool]
  );

  const handleEraserRadiusChange = useCallback(
    (value: number) => {
      const nextRadius = clampEraserRadius(value);
      setEraserRadius(nextRadius);
      if (tool === "eraser") {
        setStrokeWidth(nextRadius);
      }
    },
    [clampEraserRadius, setEraserRadius, setStrokeWidth, tool]
  );

  useEffect(() => {
    if (tool === "pen") {
      if (strokeColor !== penToolSettings.color) {
        setStrokeColor(penToolSettings.color);
      }
      if (strokeWidth !== penToolSettings.width) {
        setStrokeWidth(penToolSettings.width);
      }
      return;
    }
    if (tool === "highlighter") {
      if (strokeColor !== highlighterToolSettings.color) {
        setStrokeColor(highlighterToolSettings.color);
      }
      if (strokeWidth !== highlighterToolSettings.width) {
        setStrokeWidth(highlighterToolSettings.width);
      }
      return;
    }
    if (tool === "eraser" && strokeWidth !== clampedEraserRadius) {
      setStrokeWidth(clampedEraserRadius);
    }
  }, [
    clampedEraserRadius,
    highlighterToolSettings.color,
    highlighterToolSettings.width,
    penToolSettings.color,
    penToolSettings.width,
    setStrokeColor,
    setStrokeWidth,
    strokeColor,
    strokeWidth,
    tool,
  ]);

  const handleTransformStrokeWidthChange = useCallback(
    (value: number) => {
      handleEraserRadiusChange(value);
    },
    [handleEraserRadiusChange]
  );

  return {
    clampedEraserRadius,
    resetToolRuntimeToSelect,
    activateTool,
    handlePenToolSettingsChange,
    handleHighlighterToolSettingsChange,
    handleEraserRadiusChange,
    handleTransformStrokeWidthChange,
  };
}
