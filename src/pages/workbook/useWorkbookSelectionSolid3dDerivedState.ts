import { useMemo } from "react";
import { getSolid3dMesh } from "@/features/workbook/model/solid3dGeometry";
import { readSolid3dState } from "@/features/workbook/model/solid3dState";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import { getSolidVertexLabel } from "./WorkbookSessionPage.core";
import {
  CURVED_SURFACE_ONLY_SOLID_PRESETS,
  getSolidSectionPointLimit,
} from "./WorkbookSessionPage.geometry";

type Solid3dDraftPointsRef = {
  objectId: string;
} | null;

type UseWorkbookSelectionSolid3dDerivedStateParams = {
  boardObjects: WorkbookBoardObject[];
  selectedObject: WorkbookBoardObject | null;
  solid3dSectionPointCollecting: string | null;
  solid3dDraftPoints: Solid3dDraftPointsRef;
  getPointLimitForSolidObject: (object: WorkbookBoardObject) => number;
};

export const useWorkbookSelectionSolid3dDerivedState = ({
  boardObjects,
  selectedObject,
  solid3dSectionPointCollecting,
  solid3dDraftPoints,
  getPointLimitForSolidObject,
}: UseWorkbookSelectionSolid3dDerivedStateParams) => {
  const selectedSolid3dState = useMemo(
    () => (selectedObject?.type === "solid3d" ? readSolid3dState(selectedObject.meta) : null),
    [selectedObject]
  );

  const selectedSolidPresetId = useMemo(() => {
    if (selectedObject?.type !== "solid3d") return null;
    return typeof selectedObject.meta?.presetId === "string"
      ? selectedObject.meta.presetId
      : "cube";
  }, [selectedObject]);

  const selectedSolidIsCurved = useMemo(
    () =>
      Boolean(
        selectedSolidPresetId && CURVED_SURFACE_ONLY_SOLID_PRESETS.has(selectedSolidPresetId)
      ),
    [selectedSolidPresetId]
  );

  const selectedSolidMesh = useMemo(() => {
    if (!selectedObject || selectedObject.type !== "solid3d") return null;
    if (!selectedSolidPresetId) return null;
    return getSolid3dMesh(
      selectedSolidPresetId,
      Math.max(1, Math.abs(selectedObject.width)),
      Math.max(1, Math.abs(selectedObject.height))
    );
  }, [selectedObject, selectedSolidPresetId]);

  const selectedSolidVertexLabels = useMemo(
    () => selectedSolid3dState?.vertexLabels ?? [],
    [selectedSolid3dState?.vertexLabels]
  );

  const selectedSolidHiddenEdges = useMemo(
    () => Boolean(selectedSolid3dState?.hiddenFaceIds?.includes("hidden_edges")),
    [selectedSolid3dState?.hiddenFaceIds]
  );

  const selectedSolidFaceColors = useMemo(
    () => selectedSolid3dState?.faceColors ?? {},
    [selectedSolid3dState?.faceColors]
  );

  const selectedSolidSurfaceColor = useMemo(
    () =>
      selectedObject?.type === "solid3d" && typeof selectedObject.fill === "string" && selectedObject.fill
        ? selectedObject.fill
        : "#5f6f86",
    [selectedObject]
  );

  const selectedSolidStrokeWidth = useMemo(
    () => (selectedObject?.type === "solid3d" ? selectedObject.strokeWidth ?? 2 : 2),
    [selectedObject]
  );

  const selectedSolidEdgeColors = useMemo(
    () => selectedSolid3dState?.edgeColors ?? {},
    [selectedSolid3dState?.edgeColors]
  );

  const selectedSolidEdges = useMemo(() => {
    if (!selectedSolidMesh) return [] as Array<{ key: string; label: string }>;
    const seen = new Set<string>();
    return selectedSolidMesh.faces.reduce<Array<{ key: string; label: string }>>((acc, face) => {
      if (face.length < 2) return acc;
      face.forEach((fromIndex, localIndex) => {
        const toIndex = face[(localIndex + 1) % face.length];
        const min = Math.min(fromIndex, toIndex);
        const max = Math.max(fromIndex, toIndex);
        const key = `${min}:${max}`;
        if (seen.has(key)) return;
        seen.add(key);
        const label = `${selectedSolidVertexLabels[min] || getSolidVertexLabel(min)}-${selectedSolidVertexLabels[max] || getSolidVertexLabel(max)}`;
        acc.push({ key, label });
      });
      return acc;
    }, []);
  }, [selectedSolidMesh, selectedSolidVertexLabels]);

  const selectedSolidAngleMarks = useMemo(
    () => selectedSolid3dState?.angleMarks ?? [],
    [selectedSolid3dState?.angleMarks]
  );

  const selectedSolidSectionPointLimit = useMemo(
    () => getSolidSectionPointLimit(selectedSolidPresetId, selectedSolidMesh),
    [selectedSolidPresetId, selectedSolidMesh]
  );

  const isSolid3dPointCollectionActive = Boolean(
    selectedObject?.type === "solid3d" &&
      solid3dSectionPointCollecting &&
      selectedObject.id === solid3dSectionPointCollecting
  );

  const solid3dDraftPointLimit = useMemo(() => {
    if (!solid3dDraftPoints) return selectedSolidSectionPointLimit;
    const targetObject = boardObjects.find((item) => item.id === solid3dDraftPoints.objectId);
    if (!targetObject || targetObject.type !== "solid3d") return selectedSolidSectionPointLimit;
    return getPointLimitForSolidObject(targetObject);
  }, [boardObjects, getPointLimitForSolidObject, selectedSolidSectionPointLimit, solid3dDraftPoints]);

  return {
    selectedSolid3dState,
    selectedSolidPresetId,
    selectedSolidIsCurved,
    selectedSolidMesh,
    selectedSolidVertexLabels,
    selectedSolidHiddenEdges,
    selectedSolidFaceColors,
    selectedSolidSurfaceColor,
    selectedSolidStrokeWidth,
    selectedSolidEdgeColors,
    selectedSolidEdges,
    selectedSolidAngleMarks,
    selectedSolidSectionPointLimit,
    isSolid3dPointCollectionActive,
    solid3dDraftPointLimit,
  };
};
