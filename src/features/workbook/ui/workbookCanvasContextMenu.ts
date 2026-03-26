import type { MouseEvent as ReactMouseEvent } from "react";
import type { WorkbookBoardObject, WorkbookPoint, WorkbookTool } from "../model/types";
import type { WorkbookAreaSelection } from "../model/sceneSelection";
import {
  resolveSolid3dSectionAtPointer,
  resolveSolid3dSectionVertexAtPointer,
  resolveSolid3dVertexAtPointer,
} from "../model/sceneSolid3d";
import {
  resolveWorkbook2dFigureVertexAtPoint,
  resolveWorkbookLineEndpointAtPoint,
} from "../model/sceneHitTesting";
import {
  getFigureVertexLabel,
  normalizeRect,
  resolve2dFigureVertexLabels,
  resolve2dFigureVertices,
  isInsideRect,
} from "../model/sceneGeometry";

type WorkbookCanvasContextMenuParams = {
  event: ReactMouseEvent<SVGSVGElement>;
  tool: WorkbookTool;
  areaSelection: WorkbookAreaSelection | null;
  solid3dPreviewMetaById: Record<string, Record<string, unknown>>;
  roundSolidPresets: Set<string>;
  mapPointer: (svg: SVGSVGElement, clientX: number, clientY: number) => WorkbookPoint;
  resolveTopObject: (point: WorkbookPoint) => WorkbookBoardObject | null;
  onLaserClear?: () => void;
  onSelectedConstraintChange: (constraintId: string | null) => void;
  onSelectedObjectChange: (objectId: string | null) => void;
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
};

export const handleWorkbookCanvasContextMenu = ({
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
}: WorkbookCanvasContextMenuParams) => {
  if (tool === "laser") {
    event.preventDefault();
    onLaserClear?.();
    return;
  }
  const svg = event.currentTarget ?? null;
  if (!svg) return;
  const point = mapPointer(svg, event.clientX, event.clientY);
  const canOpenAreaSelectionMenu =
    (tool === "area_select" || tool === "select") &&
    areaSelection &&
    (areaSelection.objectIds.length > 0 || areaSelection.strokeIds.length > 0) &&
    isInsideRect(point, areaSelection.rect);

  if (canOpenAreaSelectionMenu) {
    event.preventDefault();
    onAreaSelectionContextMenu?.({
      objectIds: areaSelection.objectIds,
      strokeIds: areaSelection.strokeIds,
      rect: areaSelection.rect,
      anchor: { x: event.clientX, y: event.clientY },
    });
    return;
  }

  if (tool === "area_select") {
    return;
  }

  const target = resolveTopObject(point);
  if (!target) return;

  if (target.type === "solid3d") {
    const vertexIndex = resolveSolid3dVertexAtPointer(target, point, solid3dPreviewMetaById);
    if (vertexIndex !== null && onSolid3dVertexContextMenu) {
      event.preventDefault();
      onSelectedConstraintChange(null);
      onSelectedObjectChange(target.id);
      onSolid3dVertexContextMenu({
        objectId: target.id,
        vertexIndex,
        anchor: { x: event.clientX, y: event.clientY },
      });
      return;
    }

    const sectionVertex = resolveSolid3dSectionVertexAtPointer(
      target,
      point,
      solid3dPreviewMetaById,
      roundSolidPresets
    );
    if (sectionVertex && onSolid3dSectionVertexContextMenu) {
      event.preventDefault();
      onSelectedConstraintChange(null);
      onSelectedObjectChange(target.id);
      onSolid3dSectionVertexContextMenu({
        objectId: target.id,
        sectionId: sectionVertex.sectionId,
        vertexIndex: sectionVertex.vertexIndex,
        anchor: { x: event.clientX, y: event.clientY },
      });
      return;
    }

    const sectionId = resolveSolid3dSectionAtPointer(target, point, solid3dPreviewMetaById);
    if (sectionId && onSolid3dSectionContextMenu) {
      event.preventDefault();
      onSelectedConstraintChange(null);
      onSelectedObjectChange(target.id);
      onSolid3dSectionContextMenu({
        objectId: target.id,
        sectionId,
        anchor: { x: event.clientX, y: event.clientY },
      });
      return;
    }
  }

  if ((target.type === "line" || target.type === "arrow") && onLineEndpointContextMenu) {
    const endpoint = resolveWorkbookLineEndpointAtPoint(target, point);
    if (endpoint) {
      event.preventDefault();
      onSelectedConstraintChange(null);
      onSelectedObjectChange(target.id);
      const labelRaw = endpoint === "start" ? target.meta?.startLabel : target.meta?.endLabel;
      const fallback = endpoint === "start" ? "A" : "B";
      const label = typeof labelRaw === "string" && labelRaw.trim() ? labelRaw : fallback;
      onLineEndpointContextMenu({
        objectId: target.id,
        endpoint,
        label,
        anchor: { x: event.clientX, y: event.clientY },
      });
      return;
    }
  }

  if (
    (target.type === "rectangle" || target.type === "triangle" || target.type === "polygon") &&
    onShapeVertexContextMenu
  ) {
    const vertexIndex = resolveWorkbook2dFigureVertexAtPoint(target, point);
    if (vertexIndex !== null) {
      const rect = normalizeRect(
        { x: target.x, y: target.y },
        { x: target.x + target.width, y: target.y + target.height }
      );
      const vertices = resolve2dFigureVertices(target, rect);
      const labels = resolve2dFigureVertexLabels(target, vertices.length);
      event.preventDefault();
      onSelectedConstraintChange(null);
      onSelectedObjectChange(target.id);
      onShapeVertexContextMenu({
        objectId: target.id,
        vertexIndex,
        label: labels[vertexIndex] ?? getFigureVertexLabel(vertexIndex),
        anchor: { x: event.clientX, y: event.clientY },
      });
      return;
    }
  }

  if (!onObjectContextMenu) return;
  event.preventDefault();
  onSelectedConstraintChange(null);
  onSelectedObjectChange(target.id);
  onObjectContextMenu(target.id, {
    x: event.clientX,
    y: event.clientY,
  });
};
