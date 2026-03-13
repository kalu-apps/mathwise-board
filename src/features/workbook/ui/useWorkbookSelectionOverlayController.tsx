import { useMemo, type ReactNode } from "react";
import type { WorkbookBoardObject, WorkbookConstraint, WorkbookPoint } from "../model/types";
import type { Solid3dSectionPoint } from "../model/solid3dState";
import type { Solid3dResizeHandle } from "../model/sceneSolid3d";
import { getLineControlPoints, getObjectCenter, resolveOutsideVertexLabelPlacement } from "../model/sceneGeometry";
import {
  resolveSolid3dPickMarkersForObject,
  resolveSolid3dResizeHandles,
} from "../model/sceneSolid3d";
import {
  buildConstraintRenderSegments,
  resolveAreaSelectionPreviewRects,
  resolveSelectedObjectRect,
  type WorkbookConstraintRenderSegment,
} from "../model/sceneRender";
import type { WorkbookAreaSelectionDraft } from "../model/sceneSelection";
import type { WorkbookAreaSelectionResizeState } from "../model/sceneInteraction";

type UseWorkbookSelectionOverlayControllerParams = {
  selectedPreviewObject: WorkbookBoardObject | null;
  constraints: WorkbookConstraint[];
  objectById: Map<string, WorkbookBoardObject>;
  selectedConstraintId: string | null;
  renderViewportRect: { x: number; y: number; width: number; height: number };
  solid3dSectionMarkers: {
    objectId: string;
    sectionId: string;
    selectedPoints: Solid3dSectionPoint[];
  } | null;
  solid3dPreviewMetaById: Record<string, Record<string, unknown>>;
  areaSelectionDraft: WorkbookAreaSelectionDraft | null;
  areaSelectionResize: WorkbookAreaSelectionResizeState | null;
};

export const useWorkbookSelectionOverlayController = (
  params: UseWorkbookSelectionOverlayControllerParams
) => {
  const {
    selectedPreviewObject,
    constraints,
    objectById,
    selectedConstraintId,
    renderViewportRect,
    solid3dSectionMarkers,
    solid3dPreviewMetaById,
    areaSelectionDraft,
    areaSelectionResize,
  } = params;

  const selectedRect = useMemo(
    () => resolveSelectedObjectRect(selectedPreviewObject),
    [selectedPreviewObject]
  );

  const selectedLineControls = useMemo(() => {
    if (!selectedPreviewObject) return null;
    if (selectedPreviewObject.type !== "line" && selectedPreviewObject.type !== "arrow") {
      return null;
    }
    return getLineControlPoints(selectedPreviewObject);
  }, [selectedPreviewObject]);

  const selectedSolidResizeHandles = useMemo(() => {
    if (!selectedPreviewObject || selectedPreviewObject.type !== "solid3d") {
      return [] as Solid3dResizeHandle[];
    }
    return resolveSolid3dResizeHandles(selectedPreviewObject);
  }, [selectedPreviewObject]);

  const constraintRenderSegments = useMemo<WorkbookConstraintRenderSegment[]>(
    () =>
      buildConstraintRenderSegments({
        constraints,
        objectById,
        selectedConstraintId,
        renderViewportRect,
      }),
    [constraints, objectById, renderViewportRect, selectedConstraintId]
  );

  const solid3dPickMarkers = useMemo(() => {
    const markerSource = solid3dSectionMarkers;
    if (!markerSource?.objectId) {
      return [] as Array<{ index: number; x: number; y: number; label: string }>;
    }
    const sourceObject =
      selectedPreviewObject?.id === markerSource.objectId
        ? selectedPreviewObject
        : objectById.get(markerSource.objectId);
    if (!sourceObject) return [] as Array<{ index: number; x: number; y: number; label: string }>;
    return resolveSolid3dPickMarkersForObject(
      sourceObject,
      markerSource.selectedPoints,
      solid3dPreviewMetaById
    );
  }, [objectById, selectedPreviewObject, solid3dPreviewMetaById, solid3dSectionMarkers]);

  const solid3dMarkerNodes = useMemo(() => {
    if (!solid3dSectionMarkers?.objectId) return null;
    return solid3dPickMarkers.map((marker): ReactNode => {
      const markerObjectId = solid3dSectionMarkers.objectId;
      const markerObject =
        selectedPreviewObject?.id === markerObjectId
          ? selectedPreviewObject
          : objectById.get(markerObjectId);
      const showMarkerLabels = markerObject?.meta?.showLabels !== false;
      const markerCenter = markerObject ? getObjectCenter(markerObject) : marker;
      const markerPlacement = resolveOutsideVertexLabelPlacement({
        vertex: marker as WorkbookPoint,
        center: markerCenter,
        baseOffset: 13,
      });
      return (
        <g key={`solid3d-pick-${markerObjectId}-${marker.index}`}>
          <circle
            cx={marker.x}
            cy={marker.y}
            r={2.8}
            fill="#ff8e3c"
            stroke="#ffffff"
            strokeWidth={1}
          />
          {showMarkerLabels ? (
            <text
              x={markerPlacement.x}
              y={markerPlacement.y}
              fill="#ff8e3c"
              fontSize={8.5}
              fontWeight={700}
              textAnchor={markerPlacement.textAnchor}
              dominantBaseline="central"
            >
              {marker.label}
            </text>
          ) : null}
        </g>
      );
    });
  }, [objectById, selectedPreviewObject, solid3dPickMarkers, solid3dSectionMarkers]);

  const { areaSelectionDraftRect, areaSelectionResizeRect } = useMemo(
    () =>
      resolveAreaSelectionPreviewRects({
        areaSelectionDraft,
        areaSelectionResize,
      }),
    [areaSelectionDraft, areaSelectionResize]
  );

  return {
    selectedRect,
    selectedLineControls,
    selectedSolidResizeHandles,
    constraintRenderSegments,
    solid3dMarkerNodes,
    areaSelectionDraftRect,
    areaSelectionResizeRect,
  };
};
