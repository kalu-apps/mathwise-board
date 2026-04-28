import { useMemo } from "react";
import type { GraphFunctionDraft } from "@/features/workbook/model/functionGraph";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import type { WorkbookUtilityTab } from "@/features/workbook/model/workbookSessionUiTypes";
import {
  MAIN_SCENE_LAYER_ID,
  getFigureVertexLabel,
  resolveGraphFunctionsFromObject,
} from "./WorkbookSessionPage.core";
import {
  TEXT_FONT_OPTIONS,
  getWorkbookObjectTypeLabel,
  is2dFigureClosed,
  is2dFigureObject,
  resolve2dFigureVertices,
  supportsGraphUtilityPanel,
  supportsObjectLabelMarkers,
  supportsTransformUtilityPanel,
} from "./WorkbookSessionPage.geometry";
import { normalizeShapeAngleMarks } from "@/features/workbook/model/shapeAngleMarks";
import { useWorkbookSelectionSolid3dDerivedState } from "./useWorkbookSelectionSolid3dDerivedState";

type UseWorkbookSelectionDerivedStateParams = {
  boardObjects: WorkbookBoardObject[];
  selectedObjectId: string | null;
  isCompactViewport: boolean;
  isUtilityPanelOpen: boolean;
  utilityTab: WorkbookUtilityTab;
  graphFunctionsDraft: GraphFunctionDraft[];
  graphDraftFunctions: GraphFunctionDraft[];
  solid3dSectionPointCollecting: string | null;
  solid3dDraftPoints: { objectId: string } | null;
  getObjectSceneLayerId: (object: WorkbookBoardObject) => string;
  getPointLimitForSolidObject: (object: WorkbookBoardObject) => number;
};

export const useWorkbookSelectionDerivedState = ({
  boardObjects,
  selectedObjectId,
  isCompactViewport,
  isUtilityPanelOpen,
  utilityTab,
  graphFunctionsDraft,
  graphDraftFunctions,
  solid3dSectionPointCollecting,
  solid3dDraftPoints,
  getObjectSceneLayerId,
  getPointLimitForSolidObject,
}: UseWorkbookSelectionDerivedStateParams) => {
  const selectedObject = useMemo(
    () => boardObjects.find((item) => item.id === selectedObjectId) ?? null,
    [boardObjects, selectedObjectId]
  );

  const selectedObjectSupportsTransformPanel = useMemo(
    () => supportsTransformUtilityPanel(selectedObject),
    [selectedObject]
  );

  const selectedObjectSupportsGraphPanel = useMemo(
    () => supportsGraphUtilityPanel(selectedObject),
    [selectedObject]
  );

  const isContextualUtilityPanel = useMemo(
    () =>
      !isCompactViewport &&
      isUtilityPanelOpen &&
      ((utilityTab === "graph" && selectedObjectSupportsGraphPanel) ||
        (utilityTab === "transform" && selectedObjectSupportsTransformPanel)),
    [
      isCompactViewport,
      isUtilityPanelOpen,
      selectedObjectSupportsGraphPanel,
      selectedObjectSupportsTransformPanel,
      utilityTab,
    ]
  );

  const selectedObjectLabel = useMemo(() => {
    if (!selectedObject) return "Объект не выбран";
    return getWorkbookObjectTypeLabel(selectedObject);
  }, [selectedObject]);

  const selectedObjectShowLabels = useMemo(
    () => (selectedObject ? selectedObject.meta?.showLabels !== false : true),
    [selectedObject]
  );

  const selectedObjectSceneLayerId = useMemo(
    () => (selectedObject ? getObjectSceneLayerId(selectedObject) : MAIN_SCENE_LAYER_ID),
    [getObjectSceneLayerId, selectedObject]
  );

  const selectedShape2dObject = useMemo(
    () => (is2dFigureObject(selectedObject) ? selectedObject : null),
    [selectedObject]
  );

  const selectedShape2dVertices = useMemo(
    () => (selectedShape2dObject ? resolve2dFigureVertices(selectedShape2dObject) : []),
    [selectedShape2dObject]
  );

  const selectedShape2dLabels = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.vertexLabels)
      ? selectedShape2dObject.meta.vertexLabels
      : [];
    return selectedShape2dVertices.map((_, index) => {
      const value = typeof raw[index] === "string" ? raw[index].trim() : "";
      return value || getFigureVertexLabel(index);
    });
  }, [selectedShape2dObject, selectedShape2dVertices]);

  const selectedShape2dSegments = useMemo(() => {
    if (!selectedShape2dLabels.length) return [] as string[];
    if (!selectedShape2dObject) return [] as string[];
    const closed = is2dFigureClosed(selectedShape2dObject);
    const segmentCount = closed
      ? selectedShape2dLabels.length
      : Math.max(0, selectedShape2dLabels.length - 1);
    return Array.from({ length: segmentCount }, (_, index) => {
      const start = selectedShape2dLabels[index];
      const end = selectedShape2dLabels[(index + 1) % selectedShape2dLabels.length];
      return `${start}-${end}`;
    });
  }, [selectedShape2dLabels, selectedShape2dObject]);

  const selectedShape2dAngleMarks = useMemo(
    () =>
      normalizeShapeAngleMarks(
        selectedShape2dObject,
        selectedShape2dLabels.length,
        selectedShape2dObject?.color || "#2f4f7f"
      ),
    [selectedShape2dLabels.length, selectedShape2dObject]
  );

  const selectedShape2dAngleNotes = useMemo(
    () => selectedShape2dAngleMarks.map((mark) => mark.valueText),
    [selectedShape2dAngleMarks]
  );

  const selectedShape2dSegmentNotes = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.segmentNotes)
      ? selectedShape2dObject.meta.segmentNotes
      : [];
    return selectedShape2dSegments.map((_, index) =>
      typeof raw[index] === "string" ? raw[index] : ""
    );
  }, [selectedShape2dObject, selectedShape2dSegments]);

  const selectedShape2dShowAngles = useMemo(
    () => Boolean(selectedShape2dObject?.meta?.showAngles),
    [selectedShape2dObject]
  );

  const selectedShape2dHasAngles = useMemo(
    () =>
      Boolean(
        selectedShape2dObject &&
          is2dFigureClosed(selectedShape2dObject) &&
          selectedShape2dVertices.length >= 3
      ),
    [selectedShape2dObject, selectedShape2dVertices.length]
  );

  const selectedShape2dVertexColors = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.vertexColors)
      ? selectedShape2dObject.meta.vertexColors
      : [];
    const fallback = selectedShape2dObject.color || "#2f4f7f";
    return selectedShape2dLabels.map((_, index) =>
      typeof raw[index] === "string" && raw[index] ? raw[index] : fallback
    );
  }, [selectedShape2dLabels, selectedShape2dObject]);

  const selectedShape2dAngleColors = useMemo(
    () => selectedShape2dAngleMarks.map((mark) => mark.color),
    [selectedShape2dAngleMarks]
  );

  const selectedShape2dSegmentColors = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.segmentColors)
      ? selectedShape2dObject.meta.segmentColors
      : [];
    const fallback = selectedShape2dObject.color || "#2f4f7f";
    return selectedShape2dSegments.map((_, index) =>
      typeof raw[index] === "string" && raw[index] ? raw[index] : fallback
    );
  }, [selectedShape2dObject, selectedShape2dSegments]);

  const selectedLineObject = useMemo(
    () =>
      selectedObject &&
      (selectedObject.type === "line" || selectedObject.type === "arrow")
        ? selectedObject
        : null,
    [selectedObject]
  );

  const selectedFunctionGraphObject = useMemo(
    () => (selectedObject?.type === "function_graph" ? selectedObject : null),
    [selectedObject]
  );

  const selectedDividerObject = useMemo(
    () => (selectedObject?.type === "section_divider" ? selectedObject : null),
    [selectedObject]
  );

  const selectedPointObject = useMemo(
    () => (selectedObject?.type === "point" ? selectedObject : null),
    [selectedObject]
  );

  const pointObjectCount = useMemo(
    () => boardObjects.reduce((count, item) => count + (item.type === "point" ? 1 : 0), 0),
    [boardObjects]
  );

  const selectedTextObject = useMemo(
    () => (selectedObject?.type === "text" ? selectedObject : null),
    [selectedObject]
  );

  const selectedLineStyle = useMemo<"solid" | "dashed">(
    () => (selectedLineObject?.meta?.lineStyle === "dashed" ? "dashed" : "solid"),
    [selectedLineObject]
  );

  const selectedLineKind = useMemo<"line" | "segment">(
    () => (selectedLineObject?.meta?.lineKind === "segment" ? "segment" : "line"),
    [selectedLineObject]
  );

  const canToggleSelectedObjectLabels = useMemo(
    () => supportsObjectLabelMarkers(selectedObject),
    [selectedObject]
  );

  const selectedLineColor = useMemo(
    () => selectedLineObject?.color || "#2f4f7f",
    [selectedLineObject]
  );

  const selectedLineStrokeWidth = useMemo(
    () => selectedLineObject?.strokeWidth ?? 3,
    [selectedLineObject]
  );

  const selectedDividerStyle = useMemo<"solid" | "dashed">(
    () => (selectedDividerObject?.meta?.lineStyle === "solid" ? "solid" : "dashed"),
    [selectedDividerObject]
  );

  const selectedDividerColor = useMemo(
    () => selectedDividerObject?.color || "#2f4f7f",
    [selectedDividerObject]
  );

  const selectedDividerStrokeWidth = useMemo(
    () => selectedDividerObject?.strokeWidth ?? 2,
    [selectedDividerObject]
  );

  const selectedLineStartLabel = useMemo(
    () =>
      typeof selectedLineObject?.meta?.startLabel === "string"
        ? selectedLineObject.meta.startLabel
        : "",
    [selectedLineObject]
  );

  const selectedLineEndLabel = useMemo(
    () =>
      typeof selectedLineObject?.meta?.endLabel === "string"
        ? selectedLineObject.meta.endLabel
        : "",
    [selectedLineObject]
  );

  const selectedFunctionGraphFunctions = useMemo(
    () =>
      selectedFunctionGraphObject
        ? resolveGraphFunctionsFromObject(selectedFunctionGraphObject)
        : ([] as GraphFunctionDraft[]),
    [selectedFunctionGraphObject]
  );

  const selectedFunctionGraphAxisColor = useMemo(() => {
    const raw = selectedFunctionGraphObject?.meta?.axisColor;
    return typeof raw === "string" && raw.startsWith("#") ? raw : "#c4872f";
  }, [selectedFunctionGraphObject]);

  const selectedFunctionGraphPlaneColor = useMemo(() => {
    const raw = selectedFunctionGraphObject?.meta?.planeColor;
    return typeof raw === "string" && raw.startsWith("#") ? raw : "#ffffff";
  }, [selectedFunctionGraphObject]);

  const selectedTextColor = useMemo(() => {
    if (!selectedTextObject) return "#1f252b";
    return typeof selectedTextObject.meta?.textColor === "string" &&
      selectedTextObject.meta.textColor
      ? selectedTextObject.meta.textColor
      : selectedTextObject.color || "#1f252b";
  }, [selectedTextObject]);

  const selectedTextBackground = useMemo(
    () =>
      !selectedTextObject
        ? "transparent"
        : typeof selectedTextObject.meta?.textBackground === "string"
          ? selectedTextObject.meta.textBackground
          : "transparent",
    [selectedTextObject]
  );

  const selectedTextFontFamily = useMemo(() => {
    if (!selectedTextObject) return TEXT_FONT_OPTIONS[0].value;
    return typeof selectedTextObject.meta?.textFontFamily === "string" &&
      selectedTextObject.meta.textFontFamily
      ? selectedTextObject.meta.textFontFamily
      : TEXT_FONT_OPTIONS[0].value;
  }, [selectedTextObject]);

  const selectedTextBold = useMemo(
    () => Boolean(selectedTextObject?.meta?.textBold),
    [selectedTextObject]
  );

  const selectedTextItalic = useMemo(
    () => Boolean(selectedTextObject?.meta?.textItalic),
    [selectedTextObject]
  );

  const selectedTextUnderline = useMemo(
    () => Boolean(selectedTextObject?.meta?.textUnderline),
    [selectedTextObject]
  );

  const selectedTextAlign = useMemo<"left" | "center" | "right">(() => {
    if (selectedTextObject?.meta?.textAlign === "center") return "center";
    if (selectedTextObject?.meta?.textAlign === "right") return "right";
    return "left";
  }, [selectedTextObject]);

  const graphTabUsesSelectedObject = Boolean(selectedFunctionGraphObject);

  const functionGraphPlanes = useMemo(
    () =>
      boardObjects
        .filter((item): item is WorkbookBoardObject => item.type === "function_graph")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [boardObjects]
  );

  const graphPlaneEntries = useMemo(
    () =>
      functionGraphPlanes.map((plane, index) => ({
        id: plane.id,
        title: `Плоскость ${index + 1}`,
        functionCount: resolveGraphFunctionsFromObject(plane).length,
      })),
    [functionGraphPlanes]
  );

  const graphTabFunctions = graphTabUsesSelectedObject ? graphFunctionsDraft : graphDraftFunctions;

  const selectedSolid = useWorkbookSelectionSolid3dDerivedState({
    boardObjects,
    selectedObject,
    solid3dSectionPointCollecting,
    solid3dDraftPoints,
    getPointLimitForSolidObject,
  });

  return {
    selectedObject,
    selectedObjectSupportsTransformPanel,
    selectedObjectSupportsGraphPanel,
    isContextualUtilityPanel,
    selectedObjectLabel,
    selectedObjectShowLabels,
    selectedObjectSceneLayerId,
    selectedShape2dObject,
    selectedShape2dVertices,
    selectedShape2dLabels,
    selectedShape2dSegments,
    selectedShape2dAngleMarks,
    selectedShape2dAngleNotes,
    selectedShape2dSegmentNotes,
    selectedShape2dShowAngles,
    selectedShape2dHasAngles,
    selectedShape2dVertexColors,
    selectedShape2dAngleColors,
    selectedShape2dSegmentColors,
    selectedLineObject,
    selectedFunctionGraphObject,
    selectedDividerObject,
    selectedPointObject,
    pointObjectCount,
    selectedTextObject,
    selectedLineStyle,
    selectedLineKind,
    canToggleSelectedObjectLabels,
    selectedLineColor,
    selectedLineStrokeWidth,
    selectedDividerStyle,
    selectedDividerColor,
    selectedDividerStrokeWidth,
    selectedLineStartLabel,
    selectedLineEndLabel,
    selectedFunctionGraphFunctions,
    selectedFunctionGraphAxisColor,
    selectedFunctionGraphPlaneColor,
    selectedTextColor,
    selectedTextBackground,
    selectedTextFontFamily,
    selectedTextBold,
    selectedTextItalic,
    selectedTextUnderline,
    selectedTextAlign,
    graphTabUsesSelectedObject,
    functionGraphPlanes,
    graphPlaneEntries,
    graphTabFunctions,
    ...selectedSolid,
  };
};
