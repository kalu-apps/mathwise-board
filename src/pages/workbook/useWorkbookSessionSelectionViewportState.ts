import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useWorkbookSelectionDerivedState } from "./useWorkbookSelectionDerivedState";
import { useWorkbookSelectionSyncEffects } from "./useWorkbookSelectionSyncEffects";
import { useWorkbookContextMenuDerivedState } from "./useWorkbookContextMenuDerivedState";
import { useWorkbookPageVisibilityState } from "./useWorkbookPageVisibilityState";
import type { WorkbookPoint } from "@/features/workbook/model/types";

type SelectionDerivedParams = Parameters<typeof useWorkbookSelectionDerivedState>[0];
type SelectionSyncBaseParams = Omit<
  Parameters<typeof useWorkbookSelectionSyncEffects>[0],
  | "selectedObject"
  | "selectedShape2dObject"
  | "selectedShape2dHasAngles"
  | "selectedFunctionGraphObject"
  | "selectedFunctionGraphFunctions"
  | "selectedSolid3dState"
  | "selectedSolidIsCurved"
  | "selectedSolidMesh"
  | "selectedSolidStrokeWidth"
  | "selectedDividerObject"
  | "selectedLineObject"
  | "selectedLineStrokeWidth"
  | "selectedLineStartLabel"
  | "selectedLineEndLabel"
  | "selectedTextObject"
  | "selectedShape2dLabels"
  | "selectedShape2dAngleNotes"
  | "selectedShape2dSegmentNotes"
  | "selectedObjectSupportsGraphPanel"
  | "selectedObjectSupportsTransformPanel"
>;
type ContextMenuDerivedParams = Omit<
  Parameters<typeof useWorkbookContextMenuDerivedState>[0],
  "selectedSolid3dState"
>;
type PageVisibilityParams = Parameters<typeof useWorkbookPageVisibilityState>[0];

interface UseWorkbookSessionSelectionViewportStateParams {
  selectionDerivedParams: SelectionDerivedParams;
  selectionSyncParams: SelectionSyncBaseParams;
  contextMenuDerivedParams: ContextMenuDerivedParams;
  pageVisibilityParams: PageVisibilityParams;
  sessionId: string;
  setCanvasViewport: Dispatch<SetStateAction<WorkbookPoint>>;
  setSpacePanActive: Dispatch<SetStateAction<boolean>>;
}

export function useWorkbookSessionSelectionViewportState({
  selectionDerivedParams,
  selectionSyncParams,
  contextMenuDerivedParams,
  pageVisibilityParams,
  sessionId,
  setCanvasViewport,
  setSpacePanActive,
}: UseWorkbookSessionSelectionViewportStateParams) {
  const selectionDerivedState = useWorkbookSelectionDerivedState(selectionDerivedParams);

  const {
    selectedObject,
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
    selectedShape2dLabels,
    selectedShape2dAngleNotes,
    selectedShape2dSegmentNotes,
    selectedObjectSupportsGraphPanel,
    selectedObjectSupportsTransformPanel,
  } = selectionDerivedState;

  useEffect(() => {
    if (selectedObject?.type !== "solid3d") {
      selectionSyncParams.setSolid3dFigureTab("display");
    }
  }, [selectedObject?.id, selectedObject?.type, selectionSyncParams]);

  useWorkbookSelectionSyncEffects({
    ...selectionSyncParams,
    selectedObject,
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
    selectedShape2dLabels,
    selectedShape2dAngleNotes,
    selectedShape2dSegmentNotes,
    selectedObjectSupportsGraphPanel,
    selectedObjectSupportsTransformPanel,
  });

  useEffect(() => {
    setCanvasViewport({ x: 0, y: 0 });
  }, [sessionId, setCanvasViewport]);

  useEffect(() => {
    const isTypingElement = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        element.isContentEditable
      );
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (isTypingElement(event.target)) return;
      event.preventDefault();
      setSpacePanActive(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      setSpacePanActive(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleKeyUp as EventListener);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleKeyUp as EventListener);
    };
  }, [setSpacePanActive]);

  const contextMenuDerivedState = useWorkbookContextMenuDerivedState({
    ...contextMenuDerivedParams,
    selectedSolid3dState,
  });

  const pageVisibilityState = useWorkbookPageVisibilityState(pageVisibilityParams);

  return {
    selectionDerivedState,
    ...selectionDerivedState,
    ...contextMenuDerivedState,
    ...pageVisibilityState,
  };
}
