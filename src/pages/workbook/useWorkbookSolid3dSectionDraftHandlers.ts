import { useCallback } from "react";
import { generateId } from "@/shared/lib/id";
import {
  computeSectionPolygon,
  getSolid3dMesh,
} from "@/features/workbook/model/solid3dGeometry";
import {
  readSolid3dState,
  type Solid3dSectionPoint,
  type Solid3dSectionState,
  type Solid3dState,
  writeSolid3dState,
} from "@/features/workbook/model/solid3dState";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import { getSolidSectionPointLimit } from "./WorkbookSessionPage.geometry";
import {
  collectBoardObjectLabels,
  ensureUniqueSectionPointLabels,
  getNextUniqueBoardLabel,
  getSectionPointLabel,
} from "./WorkbookSessionPage.core";

type StateUpdater<T> = T | ((current: T) => T);
type SetState<T> = (updater: StateUpdater<T>) => void;

type Solid3dDraftPointsState = {
  objectId: string;
  points: Solid3dSectionPoint[];
} | null;

type UseWorkbookSolid3dSectionDraftHandlersParams = {
  boardObjects: WorkbookBoardObject[];
  solid3dSectionPointCollecting: string | null;
  solid3dDraftPoints: Solid3dDraftPointsState;
  setSolid3dDraftPoints: SetState<Solid3dDraftPointsState>;
  setSolid3dSectionPointCollecting: SetState<string | null>;
  setSelectedObjectId: SetState<string | null>;
  setActiveSolidSectionId: SetState<string | null>;
  setError: (value: string | null) => void;
  commitObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void;
};

export const useWorkbookSolid3dSectionDraftHandlers = ({
  boardObjects,
  solid3dSectionPointCollecting,
  solid3dDraftPoints,
  setSolid3dDraftPoints,
  setSolid3dSectionPointCollecting,
  setSelectedObjectId,
  setActiveSolidSectionId,
  setError,
  commitObjectUpdate,
}: UseWorkbookSolid3dSectionDraftHandlersParams) => {
  const getPointLimitForSolidObject = useCallback((object: WorkbookBoardObject) => {
    if (object.type !== "solid3d") return 8;
    const presetId =
      typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
    const mesh = getSolid3dMesh(
      presetId,
      Math.max(1, Math.abs(object.width)),
      Math.max(1, Math.abs(object.height))
    );
    return getSolidSectionPointLimit(presetId, mesh);
  }, []);

  const createUniqueSectionVertexLabels = useCallback(
    (vertexCount: number) => {
      const used = new Set<string>();
      boardObjects.forEach((object) => {
        collectBoardObjectLabels(object).forEach((label) => used.add(label));
      });
      return Array.from({ length: Math.max(0, vertexCount) }, (_, index) =>
        getNextUniqueBoardLabel(used, index)
      );
    },
    [boardObjects]
  );

  const addDraftPointToSolid = useCallback(
    (payload: { objectId: string; point: Solid3dSectionPoint }) => {
      const targetObject = boardObjects.find((item) => item.id === payload.objectId);
      if (!targetObject || targetObject.type !== "solid3d") return;
      if (solid3dSectionPointCollecting !== targetObject.id) return;
      const triangleIndices = payload.point.triangleVertexIndices ?? [];
      const barycentric = payload.point.barycentric ?? [];
      const hasEdgeOrVertexBarycentric =
        barycentric.length === 3 && barycentric.some((weight) => Math.abs(weight) <= 1e-4);
      const isSurfacePoint =
        Number.isInteger(payload.point.faceIndex) &&
        triangleIndices.length === 3 &&
        new Set(triangleIndices).size >= 1 &&
        hasEdgeOrVertexBarycentric;
      if (!isSurfacePoint) {
        setError("Точка должна лежать на ребре или вершине фигуры.");
        return;
      }
      const maxPoints = getPointLimitForSolidObject(targetObject);
      setSelectedObjectId(targetObject.id);
      setSolid3dDraftPoints((current) => {
        const sameObject = current?.objectId === targetObject.id;
        const base = sameObject ? current.points : [];
        const isDuplicate = base.some(
          (entry) =>
            Math.hypot(entry.x - payload.point.x, entry.y - payload.point.y, entry.z - payload.point.z) <
            1e-4
        );
        if (isDuplicate) return current ?? { objectId: targetObject.id, points: base };
        if (base.length >= maxPoints) return current ?? { objectId: targetObject.id, points: base };
        const nextIndex = base.length;
        const nextPoints = [
          ...base,
          {
            ...payload.point,
            label: payload.point.label || getSectionPointLabel(nextIndex),
          },
        ];
        return {
          objectId: targetObject.id,
          points: ensureUniqueSectionPointLabels(nextPoints),
        };
      });
    },
    [
      boardObjects,
      getPointLimitForSolidObject,
      setError,
      setSelectedObjectId,
      setSolid3dDraftPoints,
      solid3dSectionPointCollecting,
    ]
  );

  const clearSolid3dDraftPoints = useCallback(() => {
    if (solid3dSectionPointCollecting) {
      setSolid3dDraftPoints({
        objectId: solid3dSectionPointCollecting,
        points: [],
      });
      return;
    }
    setSolid3dDraftPoints(null);
  }, [setSolid3dDraftPoints, solid3dSectionPointCollecting]);

  const buildSectionFromDraftPoints = useCallback(() => {
    if (!solid3dDraftPoints || solid3dDraftPoints.points.length < 3) {
      setError("Для построения сечения нужно минимум 3 точки на ребрах/вершинах.");
      return;
    }
    const targetObject = boardObjects.find((item) => item.id === solid3dDraftPoints.objectId);
    if (!targetObject || targetObject.type !== "solid3d") {
      setError("Не удалось найти выбранную 3D-фигуру.");
      return;
    }
    const presetId =
      typeof targetObject.meta?.presetId === "string" ? targetObject.meta.presetId : "cube";
    const mesh = getSolid3dMesh(
      presetId,
      Math.max(1, Math.abs(targetObject.width)),
      Math.max(1, Math.abs(targetObject.height))
    );
    if (!mesh) {
      setError("Не удалось построить сечение для выбранной фигуры.");
      return;
    }
    const currentState = readSolid3dState(targetObject.meta);
    const maxPoints = getSolidSectionPointLimit(presetId, mesh);
    const tempSection: Solid3dSectionState = {
      id: generateId(),
      name: `Сечение ${Math.max(1, currentState.sections.length + 1)}`,
      visible: true,
      mode: "through_points",
      pointIndices: [],
      points: ensureUniqueSectionPointLabels(solid3dDraftPoints.points.slice(0, maxPoints)),
      vertexLabels: [],
      offset: 0,
      tiltX: 0,
      tiltY: 0,
      keepSide: "both",
      color: "#ff8e3c",
      thickness: 2,
      fillEnabled: true,
      fillOpacity: 0.18,
      showMetrics: false,
    };
    const polygon = computeSectionPolygon(mesh, tempSection).polygon;
    if (polygon.length < 3) {
      setError("По выбранным точкам не удалось построить корректное сечение.");
      return;
    }
    const nextSection: Solid3dSectionState = {
      ...tempSection,
      points: ensureUniqueSectionPointLabels(solid3dDraftPoints.points.slice(0, maxPoints)),
      vertexLabels: createUniqueSectionVertexLabels(polygon.length),
    };
    const nextState: Solid3dState = {
      ...currentState,
      sections: [...currentState.sections, nextSection],
    };
    commitObjectUpdate(targetObject.id, {
      meta: writeSolid3dState(nextState, targetObject.meta),
    });
    setSelectedObjectId(targetObject.id);
    setActiveSolidSectionId(nextSection.id);
    setSolid3dSectionPointCollecting(null);
    setSolid3dDraftPoints(null);
  }, [
    boardObjects,
    commitObjectUpdate,
    createUniqueSectionVertexLabels,
    setActiveSolidSectionId,
    setError,
    setSelectedObjectId,
    setSolid3dDraftPoints,
    setSolid3dSectionPointCollecting,
    solid3dDraftPoints,
  ]);

  return {
    getPointLimitForSolidObject,
    addDraftPointToSolid,
    clearSolid3dDraftPoints,
    buildSectionFromDraftPoints,
  };
};
