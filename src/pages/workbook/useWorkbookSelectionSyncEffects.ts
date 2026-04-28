import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { GraphFunctionDraft } from "@/features/workbook/model/functionGraph";
import { resolveSolid3dPresetId } from "@/features/workbook/model/solid3d";
import type { Solid3dSectionPoint, Solid3dState } from "@/features/workbook/model/solid3dState";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import type {
  WorkbookSolid3dSectionContextMenu,
  WorkbookSolid3dSectionVertexContextMenu,
  WorkbookSolid3dVertexContextMenu,
  WorkbookUtilityTab,
} from "@/features/workbook/model/workbookSessionUiTypes";
import type { StateUpdater } from "@/features/workbook/model/workbookSessionStoreTypes";
import { areGraphFunctionDraftListsEqual } from "./WorkbookSessionPage.core";
import { ROUND_SOLID_PRESETS } from "./WorkbookSessionPage.geometry";

type UseWorkbookSelectionSyncEffectsParams = {
  selectedObject: WorkbookBoardObject | null;
  boardObjects: WorkbookBoardObject[];
  selectedShape2dObject: WorkbookBoardObject | null;
  selectedShape2dHasAngles: boolean;
  selectedFunctionGraphObject: WorkbookBoardObject | null;
  selectedFunctionGraphFunctions: GraphFunctionDraft[];
  selectedSolid3dState: Solid3dState | null;
  selectedSolidIsCurved: boolean;
  selectedSolidMesh: { vertices: unknown[] } | null;
  selectedSolidStrokeWidth: number;
  selectedDividerObject: WorkbookBoardObject | null;
  selectedLineObject: WorkbookBoardObject | null;
  selectedLineStrokeWidth: number;
  selectedLineStartLabel: string;
  selectedLineEndLabel: string;
  selectedTextObject: WorkbookBoardObject | null;
  selectedTextDraft: string;
  selectedShape2dLabels: string[];
  selectedShape2dAngleNotes: string[];
  selectedShape2dSegmentNotes: string[];
  selectedObjectSupportsGraphPanel: boolean;
  selectedObjectSupportsTransformPanel: boolean;
  isUtilityPanelOpen: boolean;
  utilityTab: WorkbookUtilityTab;
  tool: string;
  activeSolidSectionId: string | null;
  solid3dFigureTab: "display" | "surface" | "faces" | "edges" | "angles";
  solid3dSectionPointCollecting: string | null;
  solid3dDraftPoints: { objectId: string; points: Solid3dSectionPoint[] } | null;
  solid3dSectionVertexContextMenu: { sectionId: string } | null;
  canSelect: boolean;
  lineDraftObjectIdRef: MutableRefObject<string | null>;
  selectedTextDraftValueRef: MutableRefObject<string>;
  selectedTextDraftObjectIdRef: MutableRefObject<string | null>;
  selectedTextDraftDirtyRef: MutableRefObject<boolean>;
  selectedTextDraftCommitTimerRef: MutableRefObject<number | null>;
  graphDraftObjectIdRef: MutableRefObject<string | null>;
  shapeDraftObjectIdRef: MutableRefObject<string | null>;
  shapeAngleDraftCommitTimersRef: MutableRefObject<Map<number, number>>;
  shapeAngleDraftValuesRef: MutableRefObject<Map<number, string>>;
  shapeSegmentDraftCommitTimersRef: MutableRefObject<Map<number, number>>;
  shapeSegmentDraftValuesRef: MutableRefObject<Map<number, string>>;
  dividerDraftObjectIdRef: MutableRefObject<string | null>;
  setIsUtilityPanelOpen: Dispatch<SetStateAction<boolean>>;
  setSolid3dFigureTab: (tab: "display" | "surface" | "faces" | "edges" | "angles") => void;
  setSolid3dInspectorTab: (tab: "figure" | "section" | "hosted") => void;
  setShape2dInspectorTab: (tab: "display" | "vertices" | "angles" | "segments") => void;
  shape2dInspectorTab: "display" | "vertices" | "angles" | "segments";
  setSelectedTextDraft: Dispatch<SetStateAction<string>>;
  setSelectedTextFontSizeDraft: Dispatch<SetStateAction<number>>;
  setLineWidthDraft: (value: number) => void;
  setSelectedLineStartLabelDraft: (value: string) => void;
  setSelectedLineEndLabelDraft: (value: string) => void;
  setGraphFunctionsDraft: Dispatch<SetStateAction<GraphFunctionDraft[]>>;
  setGraphDraftError: (value: string | null) => void;
  setGraphWorkbenchTab: (tab: "catalog" | "work") => void;
  setShape2dStrokeWidthDraft: (value: number) => void;
  setShapeVertexLabelDrafts: (value: string[]) => void;
  setShapeAngleNoteDrafts: (value: string[]) => void;
  setShapeSegmentNoteDrafts: (value: string[]) => void;
  setDividerWidthDraft: (value: number) => void;
  setActiveSolidSectionId: (value: string | null) => void;
  setSolid3dSectionPointCollecting: (value: string | null) => void;
  setSolid3dDraftPoints: (
    value: StateUpdater<{ objectId: string; points: Solid3dSectionPoint[] } | null>
  ) => void;
  setSolid3dVertexContextMenu: (
    value: StateUpdater<WorkbookSolid3dVertexContextMenu | null>
  ) => void;
  setSolid3dSectionVertexContextMenu: (
    value: StateUpdater<WorkbookSolid3dSectionVertexContextMenu | null>
  ) => void;
  setSolid3dSectionContextMenu: (
    value: StateUpdater<WorkbookSolid3dSectionContextMenu | null>
  ) => void;
  setSolid3dStrokeWidthDraft: (value: number) => void;
  commitObjectUpdate: (objectId: string, patch: Partial<WorkbookBoardObject>) => void;
};

export const useWorkbookSelectionSyncEffects = ({
  selectedObject,
  boardObjects,
  selectedShape2dObject,
  selectedShape2dHasAngles,
  selectedFunctionGraphObject,
  selectedFunctionGraphFunctions,
  selectedSolid3dState,
  selectedSolidIsCurved,
  selectedSolidMesh,
  selectedSolidStrokeWidth,
  selectedDividerObject,
  selectedLineObject,
  selectedLineStrokeWidth,
  selectedLineStartLabel,
  selectedLineEndLabel,
  selectedTextObject,
  selectedTextDraft,
  selectedShape2dLabels,
  selectedShape2dAngleNotes,
  selectedShape2dSegmentNotes,
  selectedObjectSupportsGraphPanel,
  selectedObjectSupportsTransformPanel,
  isUtilityPanelOpen,
  utilityTab,
  tool,
  activeSolidSectionId,
  solid3dFigureTab,
  solid3dSectionPointCollecting,
  solid3dDraftPoints,
  solid3dSectionVertexContextMenu,
  canSelect,
  lineDraftObjectIdRef,
  selectedTextDraftValueRef,
  selectedTextDraftObjectIdRef,
  selectedTextDraftDirtyRef,
  selectedTextDraftCommitTimerRef,
  graphDraftObjectIdRef,
  shapeDraftObjectIdRef,
  shapeAngleDraftCommitTimersRef,
  shapeAngleDraftValuesRef,
  shapeSegmentDraftCommitTimersRef,
  shapeSegmentDraftValuesRef,
  dividerDraftObjectIdRef,
  setIsUtilityPanelOpen,
  setSolid3dFigureTab,
  setSolid3dInspectorTab,
  setShape2dInspectorTab,
  shape2dInspectorTab,
  setSelectedTextDraft,
  setSelectedTextFontSizeDraft,
  setLineWidthDraft,
  setSelectedLineStartLabelDraft,
  setSelectedLineEndLabelDraft,
  setGraphFunctionsDraft,
  setGraphDraftError,
  setGraphWorkbenchTab,
  setShape2dStrokeWidthDraft,
  setShapeVertexLabelDrafts,
  setShapeAngleNoteDrafts,
  setShapeSegmentNoteDrafts,
  setDividerWidthDraft,
  setActiveSolidSectionId,
  setSolid3dSectionPointCollecting,
  setSolid3dDraftPoints,
  setSolid3dVertexContextMenu,
  setSolid3dSectionVertexContextMenu,
  setSolid3dSectionContextMenu,
  setSolid3dStrokeWidthDraft,
  commitObjectUpdate,
}: UseWorkbookSelectionSyncEffectsParams) => {
  useEffect(() => {
    if (!isUtilityPanelOpen) return;
    if (utilityTab === "graph" && !selectedObjectSupportsGraphPanel) {
      setIsUtilityPanelOpen(false);
      return;
    }
    if (utilityTab === "transform" && !selectedObjectSupportsTransformPanel) {
      setIsUtilityPanelOpen(false);
    }
  }, [isUtilityPanelOpen, selectedObjectSupportsGraphPanel, selectedObjectSupportsTransformPanel, setIsUtilityPanelOpen, utilityTab]);

  useEffect(() => {
    if (selectedObject?.type !== "solid3d") {
      setSolid3dFigureTab("display");
    }
  }, [selectedObject?.type, setSolid3dFigureTab]);

  useEffect(() => {
    if (!selectedShape2dObject) {
      setShape2dInspectorTab("display");
      return;
    }
    if (selectedShape2dObject.type === "ellipse" && shape2dInspectorTab !== "display") {
      setShape2dInspectorTab("display");
      return;
    }
    if (!selectedShape2dHasAngles && shape2dInspectorTab === "angles") {
      setShape2dInspectorTab("display");
    }
  }, [selectedShape2dHasAngles, selectedShape2dObject, shape2dInspectorTab, setShape2dInspectorTab]);

  useEffect(() => {
    if (!selectedLineObject) {
      lineDraftObjectIdRef.current = null;
      return;
    }
    if (lineDraftObjectIdRef.current === selectedLineObject.id) return;
    lineDraftObjectIdRef.current = selectedLineObject.id;
    setLineWidthDraft(Math.max(1, Math.round(selectedLineStrokeWidth)));
    setSelectedLineStartLabelDraft(selectedLineStartLabel);
    setSelectedLineEndLabelDraft(selectedLineEndLabel);
  }, [
    lineDraftObjectIdRef,
    selectedLineEndLabel,
    selectedLineObject,
    selectedLineStartLabel,
    selectedLineStrokeWidth,
    setLineWidthDraft,
    setSelectedLineEndLabelDraft,
    setSelectedLineStartLabelDraft,
  ]);

  useEffect(() => {
    selectedTextDraftValueRef.current = selectedTextDraft;
  }, [selectedTextDraft, selectedTextDraftValueRef]);

  useEffect(() => {
    if (!selectedTextObject) {
      selectedTextDraftObjectIdRef.current = null;
      selectedTextDraftDirtyRef.current = false;
      if (selectedTextDraftCommitTimerRef.current !== null) {
        window.clearTimeout(selectedTextDraftCommitTimerRef.current);
        selectedTextDraftCommitTimerRef.current = null;
      }
      setSelectedTextDraft("");
      return;
    }
    const selectedId = selectedTextObject.id;
    if (selectedTextDraftObjectIdRef.current !== selectedId) {
      selectedTextDraftObjectIdRef.current = selectedId;
      selectedTextDraftDirtyRef.current = false;
    }
    const nextText = typeof selectedTextObject.text === "string" ? selectedTextObject.text : "";
    if (!selectedTextDraftDirtyRef.current) {
      setSelectedTextDraft((current) => (current === nextText ? current : nextText));
    }
    const nextSize = Math.max(12, Math.round(selectedTextObject.fontSize ?? 18));
    setSelectedTextFontSizeDraft((current) => (current === nextSize ? current : nextSize));
  }, [
    selectedTextDraft,
    selectedTextObject,
    selectedTextObject?.fontSize,
    selectedTextObject?.id,
    selectedTextObject?.text,
    selectedTextDraftCommitTimerRef,
    selectedTextDraftDirtyRef,
    selectedTextDraftObjectIdRef,
    setSelectedTextDraft,
    setSelectedTextFontSizeDraft,
  ]);

  useEffect(
    () => () => {
      if (selectedTextDraftCommitTimerRef.current !== null) {
        window.clearTimeout(selectedTextDraftCommitTimerRef.current);
        selectedTextDraftCommitTimerRef.current = null;
      }
    },
    [selectedTextDraftCommitTimerRef]
  );

  useEffect(() => {
    if (!selectedFunctionGraphObject) {
      graphDraftObjectIdRef.current = null;
      setGraphFunctionsDraft([]);
      return;
    }
    if (graphDraftObjectIdRef.current !== selectedFunctionGraphObject.id) {
      graphDraftObjectIdRef.current = selectedFunctionGraphObject.id;
    }
    setGraphFunctionsDraft((current) =>
      areGraphFunctionDraftListsEqual(current, selectedFunctionGraphFunctions)
        ? current
        : selectedFunctionGraphFunctions
    );
    setGraphDraftError(null);
  }, [
    graphDraftObjectIdRef,
    selectedFunctionGraphFunctions,
    selectedFunctionGraphObject,
    setGraphDraftError,
    setGraphFunctionsDraft,
  ]);

  useEffect(() => {
    if (selectedFunctionGraphObject) {
      setGraphWorkbenchTab("work");
      return;
    }
    if (tool === "function_graph") {
      setGraphWorkbenchTab("catalog");
    }
  }, [selectedFunctionGraphObject, setGraphWorkbenchTab, tool]);

  useEffect(() => {
    if (!selectedShape2dObject) {
      shapeDraftObjectIdRef.current = null;
      return;
    }
    setShape2dStrokeWidthDraft(Math.max(1, Math.round(selectedShape2dObject.strokeWidth ?? 2)));
  }, [selectedShape2dObject, shapeDraftObjectIdRef, setShape2dStrokeWidthDraft]);

  useEffect(() => {
    if (!selectedShape2dObject) {
      shapeAngleDraftCommitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      shapeAngleDraftCommitTimersRef.current.clear();
      shapeAngleDraftValuesRef.current.clear();
      shapeSegmentDraftCommitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      shapeSegmentDraftCommitTimersRef.current.clear();
      shapeSegmentDraftValuesRef.current.clear();
      shapeDraftObjectIdRef.current = null;
      return;
    }
    if (shapeDraftObjectIdRef.current === selectedShape2dObject.id) return;
    shapeAngleDraftCommitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    shapeAngleDraftCommitTimersRef.current.clear();
    shapeAngleDraftValuesRef.current.clear();
    shapeSegmentDraftCommitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    shapeSegmentDraftCommitTimersRef.current.clear();
    shapeSegmentDraftValuesRef.current.clear();
    shapeDraftObjectIdRef.current = selectedShape2dObject.id;
    setShapeVertexLabelDrafts(selectedShape2dLabels);
    setShapeAngleNoteDrafts(selectedShape2dAngleNotes);
    setShapeSegmentNoteDrafts(selectedShape2dSegmentNotes);
  }, [
    selectedShape2dAngleNotes,
    selectedShape2dLabels,
    selectedShape2dObject,
    selectedShape2dSegmentNotes,
    shapeAngleDraftCommitTimersRef,
    shapeAngleDraftValuesRef,
    shapeDraftObjectIdRef,
    shapeSegmentDraftCommitTimersRef,
    shapeSegmentDraftValuesRef,
    setShapeAngleNoteDrafts,
    setShapeSegmentNoteDrafts,
    setShapeVertexLabelDrafts,
  ]);

  useEffect(
    () => () => {
      shapeAngleDraftCommitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      shapeAngleDraftCommitTimersRef.current.clear();
      shapeSegmentDraftCommitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      shapeSegmentDraftCommitTimersRef.current.clear();
    },
    [shapeAngleDraftCommitTimersRef, shapeSegmentDraftCommitTimersRef]
  );

  useEffect(() => {
    if (!selectedDividerObject) {
      dividerDraftObjectIdRef.current = null;
      return;
    }
    if (dividerDraftObjectIdRef.current === selectedDividerObject.id) return;
    dividerDraftObjectIdRef.current = selectedDividerObject.id;
    setDividerWidthDraft(Math.max(1, Math.round(selectedDividerObject.strokeWidth ?? 2)));
  }, [dividerDraftObjectIdRef, selectedDividerObject, setDividerWidthDraft]);

  useEffect(() => {
    if (selectedObject?.type !== "solid3d") {
      setActiveSolidSectionId(null);
      setSolid3dSectionPointCollecting(null);
      setSolid3dInspectorTab("section");
      setSolid3dDraftPoints(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dSectionVertexContextMenu(null);
      setSolid3dSectionContextMenu(null);
    }
  }, [
    selectedObject?.type,
    setActiveSolidSectionId,
    setSolid3dDraftPoints,
    setSolid3dInspectorTab,
    setSolid3dSectionContextMenu,
    setSolid3dSectionPointCollecting,
    setSolid3dSectionVertexContextMenu,
    setSolid3dVertexContextMenu,
  ]);

  useEffect(() => {
    if (!selectedSolid3dState) return;
    if (selectedSolid3dState.sections.length === 0) {
      setActiveSolidSectionId(null);
      return;
    }
    if (!activeSolidSectionId || !selectedSolid3dState.sections.some((section) => section.id === activeSolidSectionId)) {
      setActiveSolidSectionId(selectedSolid3dState.sections[0].id);
    }
  }, [activeSolidSectionId, selectedSolid3dState, setActiveSolidSectionId]);

  useEffect(() => {
    if (selectedObject?.type !== "solid3d") return;
    setSolid3dStrokeWidthDraft(Math.max(1, Math.round(selectedSolidStrokeWidth)));
  }, [
    selectedObject?.id,
    selectedObject?.type,
    selectedSolidStrokeWidth,
    setSolid3dStrokeWidthDraft,
  ]);

  useEffect(() => {
    if (selectedSolidIsCurved) {
      if (
        solid3dFigureTab === "faces" ||
        solid3dFigureTab === "edges" ||
        solid3dFigureTab === "angles"
      ) {
        setSolid3dFigureTab("surface");
      }
      return;
    }
    if (solid3dFigureTab === "surface") {
      setSolid3dFigureTab("display");
    }
  }, [selectedSolidIsCurved, setSolid3dFigureTab, solid3dFigureTab]);

  useEffect(() => {
    if (!selectedObject || selectedObject.type !== "solid3d") return;
    if (!selectedSolidMesh || !selectedSolid3dState) return;
    if (!canSelect) return;
    const selectedPresetRaw = typeof selectedObject.meta?.presetId === "string" ? selectedObject.meta.presetId : "cube";
    const selectedPresetId = resolveSolid3dPresetId(selectedPresetRaw);
    if (ROUND_SOLID_PRESETS.has(selectedPresetId)) return;
    const required = selectedSolidMesh.vertices.length;
    const current = selectedSolid3dState.vertexLabels ?? [];
    if (current.length >= required && current.slice(0, required).every((label) => typeof label === "string" && label.trim())) {
      return;
    }
    const nextLabels = Array.from({ length: required }, (_, index) => {
      const currentLabel = current[index];
      return typeof currentLabel === "string" && currentLabel.trim() ? currentLabel.trim() : `V${index + 1}`;
    });
    void commitObjectUpdate(selectedObject.id, {
      meta: { ...selectedObject.meta, vertexLabels: nextLabels } as never,
    });
  }, [canSelect, commitObjectUpdate, selectedObject, selectedSolid3dState, selectedSolidMesh]);

  useEffect(() => {
    if (!solid3dDraftPoints) return;
    const targetObject = boardObjects.find((item) => item.id === solid3dDraftPoints.objectId);
    if (!targetObject || targetObject.type !== "solid3d") {
      setSolid3dDraftPoints(null);
      setSolid3dSectionPointCollecting(null);
    }
  }, [boardObjects, setSolid3dDraftPoints, setSolid3dSectionPointCollecting, solid3dDraftPoints]);

  useEffect(() => {
    if (!solid3dSectionPointCollecting || !selectedObject) return;
    if (selectedObject.type !== "solid3d" || selectedObject.id !== solid3dSectionPointCollecting) {
      setSolid3dSectionPointCollecting(null);
      setSolid3dDraftPoints(null);
    }
  }, [selectedObject, setSolid3dDraftPoints, setSolid3dSectionPointCollecting, solid3dSectionPointCollecting]);

  useEffect(() => {
    if (!solid3dSectionVertexContextMenu || !selectedSolid3dState) return;
    const section = selectedSolid3dState.sections.find((entry) => entry.id === solid3dSectionVertexContextMenu.sectionId);
    if (!section) {
      setSolid3dSectionVertexContextMenu(null);
    }
  }, [selectedSolid3dState, setSolid3dSectionVertexContextMenu, solid3dSectionVertexContextMenu]);
};
