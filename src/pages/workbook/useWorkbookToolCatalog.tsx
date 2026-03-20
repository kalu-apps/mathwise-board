import { useCallback, useMemo, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Tooltip } from "@mui/material";
import BorderColorRoundedIcon from "@mui/icons-material/BorderColorRounded";
import PanToolRoundedIcon from "@mui/icons-material/PanToolRounded";
import AdsClickRoundedIcon from "@mui/icons-material/AdsClickRounded";
import HorizontalRuleRoundedIcon from "@mui/icons-material/HorizontalRuleRounded";
import DragHandleRoundedIcon from "@mui/icons-material/DragHandleRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import TextFieldsRoundedIcon from "@mui/icons-material/TextFieldsRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import CreateRoundedIcon from "@mui/icons-material/CreateRounded";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import ContentCutRoundedIcon from "@mui/icons-material/ContentCutRounded";
import type { WorkbookPolygonPreset } from "@/features/workbook/model/shapeGeometry";
import type { WorkbookTool } from "@/features/workbook/model/types";
import { ShapeCatalogPreview } from "@/features/workbook/ui/WorkbookCatalogPreviews";

type ToolButton = {
  tool: WorkbookTool;
  label: string;
  icon: ReactNode;
};

export type ShapeCatalogItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  tool: WorkbookTool;
  apply: () => void;
};

type UseWorkbookToolCatalogParams = {
  tool: WorkbookTool;
  canSelect: boolean;
  canDelete: boolean;
  canUseLaser: boolean;
  canDraw: boolean;
  activateTool: (nextTool: WorkbookTool) => void;
  resetToolRuntimeToSelect: () => void;
  createFunctionGraphPlane: () => void;
  setTool: (nextTool: WorkbookTool) => void;
  setPolygonMode: (nextMode: "regular" | "points") => void;
  setPolygonPreset: (nextPreset: WorkbookPolygonPreset) => void;
  setPolygonSides: (nextSides: number) => void;
  onToolContextMenu: (event: ReactMouseEvent<HTMLButtonElement>, tool: WorkbookTool) => void;
};

export const useWorkbookToolCatalog = ({
  tool,
  canSelect,
  canDelete,
  canUseLaser,
  canDraw,
  activateTool,
  resetToolRuntimeToSelect,
  createFunctionGraphPlane,
  setTool,
  setPolygonMode,
  setPolygonPreset,
  setPolygonSides,
  onToolContextMenu,
}: UseWorkbookToolCatalogParams) => {
  const toolButtons = useMemo<Array<ToolButton>>(
    () => [
      { tool: "select", label: "Выбор", icon: <AdsClickRoundedIcon /> },
      { tool: "pan", label: "Рука", icon: <PanToolRoundedIcon /> },
      { tool: "pen", label: "Ручка", icon: <CreateRoundedIcon /> },
      { tool: "highlighter", label: "Маркер", icon: <BorderColorRoundedIcon /> },
      { tool: "line", label: "Линия", icon: <HorizontalRuleRoundedIcon /> },
      { tool: "function_graph", label: "График функции", icon: <ShowChartRoundedIcon /> },
      { tool: "point", label: "Точка", icon: <FiberManualRecordRoundedIcon /> },
      { tool: "area_select", label: "Ножницы", icon: <ContentCutRoundedIcon /> },
      { tool: "text", label: "Текст", icon: <TextFieldsRoundedIcon /> },
      { tool: "divider", label: "Разделитель", icon: <DragHandleRoundedIcon /> },
      { tool: "eraser", label: "Ластик", icon: <CleaningServicesRoundedIcon /> },
      { tool: "laser", label: "Указка (Esc/ПКМ убрать)", icon: <MyLocationRoundedIcon /> },
      { tool: "sweep", label: "Метёлка", icon: <DeleteSweepRoundedIcon /> },
    ],
    []
  );

  const pointToolIndex = useMemo(
    () => toolButtons.findIndex((item) => item.tool === "point"),
    [toolButtons]
  );

  const toolButtonsBeforeCatalog = useMemo(
    () => (pointToolIndex >= 0 ? toolButtons.slice(0, pointToolIndex + 1) : toolButtons),
    [pointToolIndex, toolButtons]
  );

  const toolButtonsAfterCatalog = useMemo(
    () => (pointToolIndex >= 0 ? toolButtons.slice(pointToolIndex + 1) : []),
    [pointToolIndex, toolButtons]
  );

  const renderToolButton = useCallback(
    (item: ToolButton) => {
      const isActive = tool === item.tool;
      const isDisabled =
        (item.tool === "select" && !canSelect) ||
        (item.tool === "area_select" && !canSelect) ||
        (item.tool === "eraser" && !canDelete) ||
        (item.tool === "sweep" && !canDelete) ||
        (item.tool === "laser" && !canUseLaser) ||
        (!canDraw &&
          item.tool !== "select" &&
          item.tool !== "area_select" &&
          item.tool !== "pan" &&
          item.tool !== "eraser" &&
          item.tool !== "laser" &&
          item.tool !== "sweep");

      return (
        <Tooltip key={item.tool} title={item.label} placement="left" arrow>
          <span>
            <button
              type="button"
              className={`workbook-session__tool-btn ${isActive ? "is-active" : ""}`}
              disabled={isDisabled}
              onClick={() => {
                if (item.tool === "function_graph") {
                  if (tool === "function_graph") {
                    resetToolRuntimeToSelect();
                    return;
                  }
                  createFunctionGraphPlane();
                  return;
                }
                if (
                  (item.tool === "sweep" && tool === "sweep") ||
                  (item.tool === "area_select" && tool === "area_select") ||
                  (item.tool === "eraser" && tool === "eraser")
                ) {
                  resetToolRuntimeToSelect();
                  return;
                }
                activateTool(item.tool);
              }}
              onContextMenu={(event) => onToolContextMenu(event, item.tool)}
              aria-label={item.label}
              title={item.label}
            >
              {item.icon}
            </button>
          </span>
        </Tooltip>
      );
    },
    [
      activateTool,
      canDelete,
      canDraw,
      canSelect,
      canUseLaser,
      createFunctionGraphPlane,
      resetToolRuntimeToSelect,
      tool,
      onToolContextMenu,
    ]
  );

  const shapeCatalog = useMemo<Array<ShapeCatalogItem>>(
    () => [
      {
        id: "rectangle",
        title: "Прямоугольник",
        subtitle: "4 стороны",
        icon: <ShapeCatalogPreview variant="rectangle" />,
        tool: "rectangle",
        apply: () => setTool("rectangle"),
      },
      {
        id: "ellipse",
        title: "Эллипс",
        subtitle: "Окружность / овал",
        icon: <ShapeCatalogPreview variant="ellipse" />,
        tool: "ellipse",
        apply: () => setTool("ellipse"),
      },
      {
        id: "triangle",
        title: "Треугольник",
        subtitle: "3 стороны",
        icon: <ShapeCatalogPreview variant="polygon" sides={3} />,
        tool: "triangle",
        apply: () => setTool("triangle"),
      },
      {
        id: "trapezoid",
        title: "Трапеция",
        subtitle: "4 стороны",
        icon: <ShapeCatalogPreview variant="trapezoid" />,
        tool: "polygon",
        apply: () => {
          setPolygonMode("regular");
          setPolygonPreset("trapezoid");
          setPolygonSides(4);
          setTool("polygon");
        },
      },
      {
        id: "trapezoid-right",
        title: "Прямоугольная трапеция",
        subtitle: "Прямой угол",
        icon: <ShapeCatalogPreview variant="trapezoid_right" />,
        tool: "polygon",
        apply: () => {
          setPolygonMode("regular");
          setPolygonPreset("trapezoid_right");
          setPolygonSides(4);
          setTool("polygon");
        },
      },
      {
        id: "trapezoid-scalene",
        title: "Неравнобедренная трапеция",
        subtitle: "Разные боковые стороны",
        icon: <ShapeCatalogPreview variant="trapezoid_scalene" />,
        tool: "polygon",
        apply: () => {
          setPolygonMode("regular");
          setPolygonPreset("trapezoid_scalene");
          setPolygonSides(4);
          setTool("polygon");
        },
      },
      {
        id: "rhombus",
        title: "Ромб",
        subtitle: "Равные стороны",
        icon: <ShapeCatalogPreview variant="rhombus" />,
        tool: "polygon",
        apply: () => {
          setPolygonMode("regular");
          setPolygonPreset("rhombus");
          setPolygonSides(4);
          setTool("polygon");
        },
      },
      {
        id: "polygon-4",
        title: "Квадрат",
        subtitle: "Регулярный 4-угольник",
        icon: <ShapeCatalogPreview variant="polygon" sides={4} />,
        tool: "polygon",
        apply: () => {
          setPolygonMode("regular");
          setPolygonPreset("regular");
          setPolygonSides(4);
          setTool("polygon");
        },
      },
      {
        id: "polygon-5",
        title: "Пятиугольник",
        subtitle: "Регулярный 5-угольник",
        icon: <ShapeCatalogPreview variant="polygon" sides={5} />,
        tool: "polygon",
        apply: () => {
          setPolygonMode("regular");
          setPolygonPreset("regular");
          setPolygonSides(5);
          setTool("polygon");
        },
      },
      {
        id: "polygon-6",
        title: "Шестиугольник",
        subtitle: "Регулярный 6-угольник",
        icon: <ShapeCatalogPreview variant="polygon" sides={6} />,
        tool: "polygon",
        apply: () => {
          setPolygonMode("regular");
          setPolygonPreset("regular");
          setPolygonSides(6);
          setTool("polygon");
        },
      },
    ],
    [setPolygonMode, setPolygonPreset, setPolygonSides, setTool]
  );

  return {
    toolButtonsBeforeCatalog,
    toolButtonsAfterCatalog,
    renderToolButton,
    shapeCatalog,
  };
};
