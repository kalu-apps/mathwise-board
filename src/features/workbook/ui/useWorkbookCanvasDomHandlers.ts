import { useCallback, useMemo, type CSSProperties } from "react";
import type { MouseEvent, WheelEvent } from "react";
import { readSolid3dState, writeSolid3dState } from "../model/solid3dState";
import { getObjectRect, isInsideRect } from "../model/sceneGeometry";
import { isWorkbookPolygonPointTool } from "../model/sceneTools";
import type {
  WorkbookBoardObject,
  WorkbookPoint,
  WorkbookTool,
} from "../model/types";
import type { WorkbookPageFrameBounds } from "../model/pageFrame";
import { handleWorkbookCanvasContextMenu } from "./workbookCanvasContextMenu";
import type { WorkbookCanvasAreaSelection } from "./WorkbookCanvas.types";

interface UseWorkbookCanvasDomHandlersParams {
  disabled: boolean;
  selectedObjectId: string | null;
  objectById: Map<string, WorkbookBoardObject>;
  mapPointer: (
    svg: SVGSVGElement | null,
    clientX: number,
    clientY: number,
    useSnap?: boolean,
    clampToViewport?: boolean
  ) => WorkbookPoint;
  resolveTopObject: (point: WorkbookPoint) => WorkbookBoardObject | null;
  tool: WorkbookTool;
  viewportOffset: WorkbookPoint;
  safeZoom: number;
  pageFrameBounds: WorkbookPageFrameBounds;
  onViewportOffsetChange?: (offset: WorkbookPoint) => void;
  onObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void;
  onSelectedObjectChange: (objectId: string | null) => void;
  onSelectedConstraintChange: (constraintId: string | null) => void;
  startInlineTextEdit: (objectId: string) => void;
  areaSelection: WorkbookCanvasAreaSelection | null;
  solid3dPreviewMetaById: Record<string, Record<string, unknown>>;
  roundSolidPresets: Set<string>;
  onLaserClear?: () => void;
  onObjectContextMenu?: (objectId: string, anchor: { x: number; y: number }) => void;
  onShapeVertexContextMenu?: (payload: {
    objectId: string;
    vertexIndex: number;
    label: string;
    anchor: { x: number; y: number };
  }) => void;
  onLineEndpointContextMenu?: (payload: {
    objectId: string;
    endpoint: "start" | "end";
    label: string;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dVertexContextMenu?: (payload: {
    objectId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dSectionVertexContextMenu?: (payload: {
    objectId: string;
    sectionId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => void;
  onSolid3dSectionContextMenu?: (payload: {
    objectId: string;
    sectionId: string;
    anchor: { x: number; y: number };
  }) => void;
  onAreaSelectionContextMenu?: (payload: {
    objectIds: string[];
    strokeIds: Array<{ id: string; layer: "board" | "annotations" }>;
    rect: { x: number; y: number; width: number; height: number };
    anchor: { x: number; y: number };
  }) => void;
  gridSize: number;
  showGrid: boolean;
  gridColor: string;
  backgroundColor: string;
  polygonMode: "regular" | "points";
  setPolygonHoverPoint: (point: WorkbookPoint | null) => void;
  setEraserCursorPoint: (point: WorkbookPoint | null) => void;
}

const toPositiveModulo = (value: number, modulo: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(modulo) || modulo <= 0) return 0;
  const normalized = value % modulo;
  return normalized < 0 ? normalized + modulo : normalized;
};

export const useWorkbookCanvasDomHandlers = ({
  disabled,
  selectedObjectId,
  objectById,
  mapPointer,
  resolveTopObject,
  tool,
  viewportOffset,
  safeZoom,
  pageFrameBounds,
  onViewportOffsetChange,
  onObjectUpdate,
  onSelectedObjectChange,
  onSelectedConstraintChange,
  startInlineTextEdit,
  areaSelection,
  solid3dPreviewMetaById,
  roundSolidPresets,
  onLaserClear,
  onObjectContextMenu,
  onShapeVertexContextMenu,
  onLineEndpointContextMenu,
  onSolid3dVertexContextMenu,
  onSolid3dSectionVertexContextMenu,
  onSolid3dSectionContextMenu,
  onAreaSelectionContextMenu,
  gridSize,
  showGrid,
  gridColor,
  backgroundColor,
  polygonMode,
  setPolygonHoverPoint,
  setEraserCursorPoint,
}: UseWorkbookCanvasDomHandlersParams) => {
  const handleSelectConstraint = useCallback(
    (constraintId: string) => {
      onSelectedObjectChange(null);
      onSelectedConstraintChange(constraintId);
    },
    [onSelectedConstraintChange, onSelectedObjectChange]
  );

  const canvasStyle = useMemo(
    () => {
      const safeGridSizeWorld = Math.max(8, Math.min(96, Math.floor(gridSize || 22)));
      const safeRenderZoom = Math.max(0.08, Number.isFinite(safeZoom) ? safeZoom : 1);
      const gridStepPx = Math.max(1, safeGridSizeWorld * safeRenderZoom);
      // Align screen-space CSS grid phase with world-space viewport translation.
      const gridOffsetXPx = toPositiveModulo(-viewportOffset.x * safeRenderZoom, gridStepPx);
      const gridOffsetYPx = toPositiveModulo(-viewportOffset.y * safeRenderZoom, gridStepPx);
      const pageLeftPx = (pageFrameBounds.minX - viewportOffset.x) * safeRenderZoom;
      const pageTopPx = (pageFrameBounds.minY - viewportOffset.y) * safeRenderZoom;
      const pageWidthPx = pageFrameBounds.width * safeRenderZoom;
      const pageHeightPx = pageFrameBounds.height * safeRenderZoom;
      const pageGridOffsetXPx = toPositiveModulo(gridOffsetXPx - pageLeftPx, gridStepPx);
      const pageGridOffsetYPx = toPositiveModulo(gridOffsetYPx - pageTopPx, gridStepPx);
      return {
        "--workbook-grid-size-world": `${safeGridSizeWorld}px`,
        "--workbook-grid-size": `${gridStepPx}px`,
        "--workbook-grid-offset-x": `${gridOffsetXPx}px`,
        "--workbook-grid-offset-y": `${gridOffsetYPx}px`,
        "--workbook-page-grid-offset-x": `${pageGridOffsetXPx}px`,
        "--workbook-page-grid-offset-y": `${pageGridOffsetYPx}px`,
        "--workbook-page-left": `${pageLeftPx}px`,
        "--workbook-page-top": `${pageTopPx}px`,
        "--workbook-page-width": `${pageWidthPx}px`,
        "--workbook-page-height": `${pageHeightPx}px`,
        "--workbook-grid-color": showGrid ? gridColor : "transparent",
        "--workbook-background-color": backgroundColor,
      } as CSSProperties;
    },
    [
      backgroundColor,
      gridColor,
      gridSize,
      pageFrameBounds.height,
      pageFrameBounds.minX,
      pageFrameBounds.minY,
      pageFrameBounds.width,
      safeZoom,
      showGrid,
      viewportOffset.x,
      viewportOffset.y,
    ]
  );

  const preventDefaultIfCancelable = (
    event: WheelEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>
  ) => {
    const nativeCancelable =
      (event.nativeEvent as Event | undefined)?.cancelable;
    const syntheticCancelable = event.cancelable;
    if (nativeCancelable === false || syntheticCancelable === false) {
      return false;
    }
    event.preventDefault();
    return true;
  };

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      if (disabled) return;
      if (!event.ctrlKey && !event.metaKey) {
        if (!onViewportOffsetChange) return;
        // Intercept all regular wheel/trackpad gestures on canvas.
        // Horizontal pan is enabled only when zoomed in beyond 100%.
        preventDefaultIfCancelable(event);
        const allowHorizontalPan = safeZoom > 1;
        const hasDeltaY = Number.isFinite(event.deltaY) && Math.abs(event.deltaY) > 0.0001;
        const hasDeltaX =
          allowHorizontalPan && Number.isFinite(event.deltaX) && Math.abs(event.deltaX) > 0.0001;
        if (!hasDeltaY && !hasDeltaX) return;
        const deltaModeScale =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? (typeof window !== "undefined" ? Math.max(480, window.innerHeight) : 800)
              : 1;
        const deltaY = hasDeltaY ? event.deltaY * deltaModeScale : 0;
        const deltaX = hasDeltaX ? event.deltaX * deltaModeScale : 0;
        const safeScrollZoom = Math.max(0.08, safeZoom);
        const nextOffset: WorkbookPoint = {
          x: Math.max(0, viewportOffset.x + deltaX / safeScrollZoom),
          y: Math.max(0, viewportOffset.y + deltaY / safeScrollZoom),
        };
        onViewportOffsetChange(nextOffset);
        return;
      }
      if (!selectedObjectId) return;
      const selectedObject = objectById.get(selectedObjectId);
      if (!selectedObject || selectedObject.type !== "solid3d") return;
      const svg = event.currentTarget ?? null;
      if (!svg) return;
      const point = mapPointer(svg, event.clientX, event.clientY);
      if (!isInsideRect(point, getObjectRect(selectedObject))) return;
      preventDefaultIfCancelable(event);
      const state = readSolid3dState(selectedObject.meta);
      const step = event.deltaY < 0 ? 0.08 : -0.08;
      const nextZoom = Math.max(0.4, Math.min(2.4, state.view.zoom + step));
      onObjectUpdate(selectedObject.id, {
        meta: writeSolid3dState(
          {
            ...state,
            view: {
              ...state.view,
              zoom: nextZoom,
            },
          },
          selectedObject.meta
        ),
      });
    },
    [
      disabled,
      mapPointer,
      objectById,
      onObjectUpdate,
      onViewportOffsetChange,
      safeZoom,
      selectedObjectId,
      viewportOffset.x,
      viewportOffset.y,
    ]
  );

  const handleDoubleClick = useCallback(
    (event: MouseEvent<SVGSVGElement>) => {
      if (disabled) return;
      const svg = event.currentTarget ?? null;
      if (!svg) return;
      const point = mapPointer(svg, event.clientX, event.clientY, true);
      const target = resolveTopObject(point);
      if (!target && tool === "select") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!target || target.type !== "text" || target.pinned) return;
      event.preventDefault();
      event.stopPropagation();
      startInlineTextEdit(target.id);
    },
    [disabled, mapPointer, resolveTopObject, startInlineTextEdit, tool]
  );

  const handleContextMenu = useCallback(
    (event: MouseEvent<SVGSVGElement>) => {
      handleWorkbookCanvasContextMenu({
        event,
        tool,
        areaSelection,
        solid3dPreviewMetaById,
        roundSolidPresets,
        mapPointer,
        resolveTopObject,
        onLaserClear,
        onSelectedConstraintChange,
        onSelectedObjectChange,
        onObjectContextMenu,
        onShapeVertexContextMenu,
        onLineEndpointContextMenu,
        onSolid3dVertexContextMenu,
        onSolid3dSectionVertexContextMenu,
        onSolid3dSectionContextMenu,
        onAreaSelectionContextMenu,
      });
    },
    [
      areaSelection,
      mapPointer,
      onAreaSelectionContextMenu,
      onLaserClear,
      onLineEndpointContextMenu,
      onObjectContextMenu,
      onSelectedConstraintChange,
      onSelectedObjectChange,
      onShapeVertexContextMenu,
      onSolid3dSectionContextMenu,
      onSolid3dSectionVertexContextMenu,
      onSolid3dVertexContextMenu,
      resolveTopObject,
      roundSolidPresets,
      solid3dPreviewMetaById,
      tool,
    ]
  );

  const handlePointerLeave = useCallback(() => {
    if (isWorkbookPolygonPointTool(tool, polygonMode)) {
      setPolygonHoverPoint(null);
    }
    if (tool === "eraser") {
      setEraserCursorPoint(null);
    }
  }, [polygonMode, setEraserCursorPoint, setPolygonHoverPoint, tool]);

  return {
    handleSelectConstraint,
    canvasStyle,
    handleWheel,
    handleDoubleClick,
    handleContextMenu,
    handlePointerLeave,
  };
};
