import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isWorkbookPolygonPointTool } from "../model/sceneTools";
import type { WorkbookActiveStrokeDraft } from "../model/sceneStroke";
import type { ObjectEraserCut, ObjectEraserPreviewPath } from "../model/eraser";
import type { WorkbookBoardObject, WorkbookPoint, WorkbookTool } from "../model/types";

interface UseWorkbookCanvasToolLifecycleParams {
  selectedObjectId: string | null;
  disabled: boolean;
  objectById: Map<string, WorkbookBoardObject>;
  getObjectSceneLayerId: (object: WorkbookBoardObject) => string;
  onObjectDelete: (objectId: string) => void;
  onSelectedObjectChange: (objectId: string | null) => void;
  tool: WorkbookTool;
  polygonMode: "regular" | "points";
  clearCommittedStrokeBridge: () => void;
  clearEraserCursorPointPending: () => void;
  setEraserCursorPoint: (point: WorkbookPoint | null) => void;
  erasedStrokeIdsRef: MutableRefObject<Set<string>>;
  eraserStrokeFragmentsRef: MutableRefObject<Map<string, WorkbookPoint[][]>>;
  eraserObjectCutsRef: MutableRefObject<Map<string, ObjectEraserCut[]>>;
  eraserObjectPreviewPathsRef: MutableRefObject<Map<string, ObjectEraserPreviewPath[]>>;
  eraserTouchedObjectIdsRef: MutableRefObject<Set<string>>;
  eraserGestureIdRef: MutableRefObject<string | null>;
  eraserLastAppliedPointRef: MutableRefObject<WorkbookPoint | null>;
  eraserLastPreviewPointRef: MutableRefObject<WorkbookPoint | null>;
  clearPolygonHoverPointPending: () => void;
  setPolygonHoverPoint: (point: WorkbookPoint | null) => void;
  setPolygonPointDraft: Dispatch<SetStateAction<WorkbookPoint[]>>;
  commitPolygonByPoints: (points: WorkbookPoint[]) => void;
  polygonPointDraft: WorkbookPoint[];
  strokeFlushFrameRef: MutableRefObject<number | null>;
  strokePreviewTimerRef: MutableRefObject<number | null>;
  activeStrokeRef: MutableRefObject<WorkbookActiveStrokeDraft | null>;
  strokePointsRef: MutableRefObject<WorkbookPoint[]>;
  draftStrokePathRef: MutableRefObject<SVGPathElement | null>;
}

export function useWorkbookCanvasToolLifecycle({
  selectedObjectId,
  disabled,
  objectById,
  getObjectSceneLayerId,
  onObjectDelete,
  onSelectedObjectChange,
  tool,
  polygonMode,
  clearCommittedStrokeBridge,
  clearEraserCursorPointPending,
  setEraserCursorPoint,
  erasedStrokeIdsRef,
  eraserStrokeFragmentsRef,
  eraserObjectCutsRef,
  eraserObjectPreviewPathsRef,
  eraserTouchedObjectIdsRef,
  eraserGestureIdRef,
  eraserLastAppliedPointRef,
  eraserLastPreviewPointRef,
  clearPolygonHoverPointPending,
  setPolygonHoverPoint,
  setPolygonPointDraft,
  commitPolygonByPoints,
  polygonPointDraft,
  strokeFlushFrameRef,
  strokePreviewTimerRef,
  activeStrokeRef,
  strokePointsRef,
  draftStrokePathRef,
}: UseWorkbookCanvasToolLifecycleParams) {
  useEffect(() => {
    if (!selectedObjectId) return;
    const onDelete = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
      );
      if (isTypingTarget) return;
      if (disabled) return;
      const selected = objectById.get(selectedObjectId);
      event.preventDefault();
      const layerId = selected ? getObjectSceneLayerId(selected) : "main";
      if (layerId !== "main") {
        objectById.forEach((item) => {
          if (getObjectSceneLayerId(item) === layerId) {
            onObjectDelete(item.id);
          }
        });
      } else {
        onObjectDelete(selectedObjectId);
      }
      onSelectedObjectChange(null);
    };
    window.addEventListener("keydown", onDelete);
    return () => window.removeEventListener("keydown", onDelete);
  }, [
    disabled,
    getObjectSceneLayerId,
    objectById,
    onObjectDelete,
    onSelectedObjectChange,
    selectedObjectId,
  ]);

  useEffect(() => {
    if (tool !== "pen" && tool !== "highlighter") {
      if (strokeFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(strokeFlushFrameRef.current);
        strokeFlushFrameRef.current = null;
      }
      if (strokePreviewTimerRef.current !== null) {
        window.clearTimeout(strokePreviewTimerRef.current);
        strokePreviewTimerRef.current = null;
      }
      activeStrokeRef.current = null;
      strokePointsRef.current = [];
      draftStrokePathRef.current?.setAttribute("d", "");
      clearCommittedStrokeBridge();
    }
    if (tool !== "eraser") {
      clearEraserCursorPointPending();
      setEraserCursorPoint(null);
      erasedStrokeIdsRef.current.clear();
      eraserStrokeFragmentsRef.current.clear();
      eraserObjectCutsRef.current.clear();
      eraserObjectPreviewPathsRef.current.clear();
      eraserTouchedObjectIdsRef.current.clear();
      eraserGestureIdRef.current = null;
      eraserLastAppliedPointRef.current = null;
      eraserLastPreviewPointRef.current = null;
    }
    if (!isWorkbookPolygonPointTool(tool, polygonMode)) {
      clearPolygonHoverPointPending();
      setPolygonHoverPoint(null);
    }
  }, [
    activeStrokeRef,
    clearCommittedStrokeBridge,
    clearEraserCursorPointPending,
    clearPolygonHoverPointPending,
    draftStrokePathRef,
    erasedStrokeIdsRef,
    eraserGestureIdRef,
    eraserLastAppliedPointRef,
    eraserLastPreviewPointRef,
    eraserObjectCutsRef,
    eraserObjectPreviewPathsRef,
    eraserStrokeFragmentsRef,
    eraserTouchedObjectIdsRef,
    polygonMode,
    setEraserCursorPoint,
    setPolygonHoverPoint,
    strokeFlushFrameRef,
    strokePointsRef,
    strokePreviewTimerRef,
    tool,
  ]);

  useEffect(() => {
    if (!isWorkbookPolygonPointTool(tool, polygonMode)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPolygonPointDraft([]);
        setPolygonHoverPoint(null);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        commitPolygonByPoints(polygonPointDraft);
        setPolygonPointDraft([]);
        setPolygonHoverPoint(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    commitPolygonByPoints,
    polygonMode,
    polygonPointDraft,
    setPolygonHoverPoint,
    setPolygonPointDraft,
    tool,
  ]);
}
