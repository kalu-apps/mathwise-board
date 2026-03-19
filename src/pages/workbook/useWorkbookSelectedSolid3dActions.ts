import { useCallback } from "react";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import {
  readSolid3dState,
  writeSolid3dState,
  type Solid3dSectionPoint,
  type Solid3dSectionState,
  type Solid3dState,
} from "@/features/workbook/model/solid3dState";
import type { Solid3dMesh } from "@/features/workbook/model/solid3dGeometry";
import type { WorkbookShapeAngleMarkStyle } from "@/features/workbook/model/shapeAngleMarks";
import { ensureUniqueSectionPointLabels, getSectionVertexLabel } from "./WorkbookSessionPage.core";
import { generateId } from "@/shared/lib/id";

type Updater<T> = T | ((current: T) => T);

type Solid3dDraftPointsState = {
  objectId: string;
  points: Solid3dSectionPoint[];
} | null;

type Solid3dSectionVertexContextMenuState = {
  sectionId: string;
  vertexIndex: number;
  label: string;
  x?: number;
  y?: number;
  objectId?: string;
} | null;

type UseWorkbookSelectedSolid3dActionsParams = {
  canSelect: boolean;
  selectedObjectId: string | null;
  boardObjects: WorkbookBoardObject[];
  selectedSolidMesh: Solid3dMesh | null;
  selectedSolid3dState: Solid3dState | null;
  solid3dStrokeWidthDraft: number;
  activeSolidSectionId: string | null;
  commitObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void | Promise<void>;
  setError: (value: string | null) => void;
  setActiveSolidSectionId: (value: string | null) => void;
  setSolid3dSectionVertexContextMenu: (
    value:
      | Updater<Solid3dSectionVertexContextMenuState>
      | Solid3dSectionVertexContextMenuState
  ) => void;
  setSolid3dInspectorTab: (tab: "display" | "section" | "angles") => void;
  setSolid3dSectionPointCollecting: (value: string | null) => void;
  setSolid3dDraftPoints: (value: Updater<Solid3dDraftPointsState>) => void;
  resetToolRuntimeToSelect: () => void;
  getSolidVertexLabel: (index: number) => string;
};

export const useWorkbookSelectedSolid3dActions = ({
  canSelect,
  selectedObjectId,
  boardObjects,
  selectedSolidMesh,
  selectedSolid3dState,
  solid3dStrokeWidthDraft,
  activeSolidSectionId,
  commitObjectUpdate,
  setError,
  setActiveSolidSectionId,
  setSolid3dSectionVertexContextMenu,
  setSolid3dInspectorTab,
  setSolid3dSectionPointCollecting,
  setSolid3dDraftPoints,
  resetToolRuntimeToSelect,
  getSolidVertexLabel,
}: UseWorkbookSelectedSolid3dActionsParams) => {
  const updateSelectedSolid3dState = useCallback(
    async (
      updater: (state: Solid3dState) => Solid3dState,
      objectIdOverride?: string
    ) => {
      if (!canSelect) return;
      const targetObjectId = objectIdOverride ?? selectedObjectId;
      if (!targetObjectId) return;
      const targetObject = boardObjects.find(
        (item): item is WorkbookBoardObject & { type: "solid3d" } =>
          item.id === targetObjectId && item.type === "solid3d"
      );
      if (!targetObject) return;
      const currentState = readSolid3dState(targetObject.meta);
      const nextState = updater(currentState);
      await commitObjectUpdate(targetObject.id, {
        meta: writeSolid3dState(nextState, targetObject.meta),
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const setSolid3dHiddenEdges = useCallback(
    async (hidden: boolean) => {
      await updateSelectedSolid3dState((state) => {
        const current = new Set(state.hiddenFaceIds);
        if (hidden) {
          current.add("hidden_edges");
        } else {
          current.delete("hidden_edges");
        }
        return {
          ...state,
          hiddenFaceIds: [...current],
        };
      });
    },
    [updateSelectedSolid3dState]
  );

  const setSolid3dFaceColor = useCallback(
    async (faceIndex: number, color: string) => {
      if (!Number.isInteger(faceIndex) || faceIndex < 0) return;
      await updateSelectedSolid3dState((state) => ({
        ...state,
        faceColors: {
          ...(state.faceColors ?? {}),
          [String(faceIndex)]: color || "#5f6aa0",
        },
      }));
    },
    [updateSelectedSolid3dState]
  );

  const resetSolid3dFaceColors = useCallback(async () => {
    await updateSelectedSolid3dState((state) => ({
      ...state,
      faceColors: {},
    }));
  }, [updateSelectedSolid3dState]);

  const updateSelectedSolid3dSurfaceColor = useCallback(
    async (color: string) => {
      if (!canSelect || !selectedObjectId) return;
      const targetObject = boardObjects.find(
        (item): item is WorkbookBoardObject & { type: "solid3d" } =>
          item.id === selectedObjectId && item.type === "solid3d"
      );
      if (!targetObject) return;
      await commitObjectUpdate(targetObject.id, {
        fill: color || "#5f6aa0",
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedSolid3dStrokeWidth = useCallback(
    async (strokeWidthValue: number) => {
      if (!canSelect || !selectedObjectId) return;
      const targetObject = boardObjects.find(
        (item): item is WorkbookBoardObject & { type: "solid3d" } =>
          item.id === selectedObjectId && item.type === "solid3d"
      );
      if (!targetObject) return;
      await commitObjectUpdate(targetObject.id, {
        strokeWidth: Math.max(1, Math.min(18, Math.round(strokeWidthValue))),
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const commitSelectedSolid3dStrokeWidth = useCallback(async () => {
    if (!selectedObjectId) return;
    const targetObject = boardObjects.find(
      (item): item is WorkbookBoardObject & { type: "solid3d" } =>
        item.id === selectedObjectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    const next = Math.max(1, Math.min(18, Math.round(solid3dStrokeWidthDraft)));
    const current = targetObject.strokeWidth ?? 2;
    if (Math.abs(next - current) < 0.01) return;
    await updateSelectedSolid3dStrokeWidth(next);
  }, [
    boardObjects,
    selectedObjectId,
    solid3dStrokeWidthDraft,
    updateSelectedSolid3dStrokeWidth,
  ]);

  const setSolid3dEdgeColor = useCallback(
    async (edgeKey: string, color: string) => {
      if (!edgeKey.trim()) return;
      await updateSelectedSolid3dState((state) => ({
        ...state,
        edgeColors: {
          ...(state.edgeColors ?? {}),
          [edgeKey]: color || "#4f63ff",
        },
      }));
    },
    [updateSelectedSolid3dState]
  );

  const resetSolid3dEdgeColors = useCallback(async () => {
    await updateSelectedSolid3dState((state) => ({
      ...state,
      edgeColors: {},
    }));
  }, [updateSelectedSolid3dState]);

  const addSolid3dAngleMark = useCallback(async () => {
    if (!selectedSolidMesh) return;
    const existing = selectedSolid3dState?.angleMarks ?? [];
    const used = new Set(
      existing.map(
        (mark) =>
          `${Number.isInteger(mark.faceIndex) ? mark.faceIndex : -1}:${mark.vertexIndex}`
      )
    );
    let nextFaceIndex = -1;
    let nextVertexIndex = -1;
    selectedSolidMesh.faces.some((face, faceIndex) => {
      if (face.length < 3) return false;
      const vertexIndex = face.find((index) => !used.has(`${faceIndex}:${index}`));
      if (vertexIndex === undefined) return false;
      nextFaceIndex = faceIndex;
      nextVertexIndex = vertexIndex;
      return true;
    });
    if (nextFaceIndex < 0 || nextVertexIndex < 0) {
      setError("Для этой фигуры уже добавлены все доступные углы.");
      return;
    }
    await updateSelectedSolid3dState((state) => ({
      ...state,
      angleMarks: [
        ...(state.angleMarks ?? []),
        {
          id: generateId(),
          faceIndex: nextFaceIndex,
          vertexIndex: nextVertexIndex,
          label: "",
          style: "arc_single",
          color: "#ff8e3c",
          visible: true,
        },
      ],
    }));
  }, [selectedSolid3dState?.angleMarks, selectedSolidMesh, setError, updateSelectedSolid3dState]);

  const updateSolid3dAngleMark = useCallback(
    async (
      markId: string,
      patch: Partial<{
        faceIndex: number;
        vertexIndex: number;
        label: string;
        style: WorkbookShapeAngleMarkStyle;
        color: string;
        visible: boolean;
      }>
    ) => {
      await updateSelectedSolid3dState((state) => ({
        ...state,
        angleMarks: (state.angleMarks ?? []).map((mark) =>
          mark.id === markId
            ? (() => {
                const next = {
                  ...mark,
                  ...patch,
                  label:
                    typeof patch.label === "string"
                      ? patch.label.trim().slice(0, 64)
                      : mark.label,
                };
                if (!selectedSolidMesh) return next;
                const requestedFaceIndex =
                  typeof next.faceIndex === "number" &&
                  Number.isInteger(next.faceIndex) &&
                  next.faceIndex >= 0
                    ? next.faceIndex
                    : null;
                const face =
                  requestedFaceIndex !== null
                    ? selectedSolidMesh.faces[requestedFaceIndex]
                    : null;
                if (requestedFaceIndex !== null && face && face.length >= 3) {
                  if (!face.includes(next.vertexIndex)) {
                    next.vertexIndex = face[0];
                  }
                  next.faceIndex = requestedFaceIndex;
                } else {
                  delete next.faceIndex;
                }
                return next;
              })()
            : mark
        ),
      }));
    },
    [selectedSolidMesh, updateSelectedSolid3dState]
  );

  const deleteSolid3dAngleMark = useCallback(
    async (markId: string) => {
      await updateSelectedSolid3dState((state) => ({
        ...state,
        angleMarks: (state.angleMarks ?? []).filter((mark) => mark.id !== markId),
      }));
    },
    [updateSelectedSolid3dState]
  );

  const updateSolid3dSection = useCallback(
    async (
      sectionId: string,
      patch: Partial<Solid3dSectionState>,
      objectIdOverride?: string
    ) => {
      const normalizedPatch: Partial<Solid3dSectionState> = { ...patch };
      if (Array.isArray(patch.points)) {
        normalizedPatch.points = ensureUniqueSectionPointLabels(patch.points);
      }
      if (Array.isArray(patch.vertexLabels)) {
        normalizedPatch.vertexLabels = patch.vertexLabels.map(
          (label, index) =>
            (typeof label === "string" ? label.trim().slice(0, 16) : "") ||
            getSectionVertexLabel(index)
        );
      }
      await updateSelectedSolid3dState(
        (state) => ({
          ...state,
          sections: state.sections.map((section) =>
            section.id === sectionId ? { ...section, ...normalizedPatch } : section
          ),
        }),
        objectIdOverride
      );
    },
    [updateSelectedSolid3dState]
  );

  const deleteSolid3dSection = useCallback(
    async (sectionId: string, objectIdOverride?: string) => {
      await updateSelectedSolid3dState(
        (state) => ({
          ...state,
          sections: state.sections.filter((section) => section.id !== sectionId),
        }),
        objectIdOverride
      );
      if (activeSolidSectionId === sectionId) {
        const fallback =
          selectedSolid3dState?.sections.find((section) => section.id !== sectionId)?.id ??
          null;
        setActiveSolidSectionId(fallback);
      }
      setSolid3dSectionVertexContextMenu((current) =>
        current?.sectionId === sectionId ? null : current
      );
    },
    [
      activeSolidSectionId,
      selectedSolid3dState?.sections,
      setActiveSolidSectionId,
      setSolid3dSectionVertexContextMenu,
      updateSelectedSolid3dState,
    ]
  );

  const startSolid3dSectionPointCollection = useCallback(() => {
    const targetObject =
      selectedObjectId != null
        ? boardObjects.find((item) => item.id === selectedObjectId)
        : null;
    if (!targetObject || targetObject.type !== "solid3d") {
      setError("Сначала выберите 3D-фигуру.");
      return;
    }
    setSolid3dInspectorTab("section");
    resetToolRuntimeToSelect();
    setSolid3dSectionPointCollecting(targetObject.id);
    setSolid3dDraftPoints({
      objectId: targetObject.id,
      points: [],
    });
  }, [
    boardObjects,
    resetToolRuntimeToSelect,
    selectedObjectId,
    setError,
    setSolid3dDraftPoints,
    setSolid3dInspectorTab,
    setSolid3dSectionPointCollecting,
  ]);

  const renameSolid3dSectionVertex = useCallback(
    async (sectionId: string, vertexIndex: number, label: string) => {
      const normalized = label.trim().slice(0, 16);
      await updateSelectedSolid3dState((state) => ({
        ...state,
        sections: state.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const current = Array.isArray(section.vertexLabels)
            ? section.vertexLabels
            : [];
          const nextLength = Math.max(current.length, vertexIndex + 1);
          const nextLabels = Array.from({ length: nextLength }, (_, index) =>
            (typeof current[index] === "string"
              ? current[index].trim().slice(0, 16)
              : "") || getSectionVertexLabel(index)
          );
          nextLabels[vertexIndex] = normalized || getSectionVertexLabel(vertexIndex);
          return {
            ...section,
            vertexLabels: nextLabels,
          };
        }),
      }));
    },
    [updateSelectedSolid3dState]
  );

  const renameSolid3dVertex = useCallback(
    async (vertexIndex: number, label: string) => {
      const normalized = label.trim().slice(0, 16);
      await updateSelectedSolid3dState((state) => {
        const current = Array.isArray(state.vertexLabels) ? state.vertexLabels : [];
        const nextLength = Math.max(current.length, vertexIndex + 1);
        const nextLabels = Array.from(
          { length: nextLength },
          (_, index) => current[index] ?? getSolidVertexLabel(index)
        );
        nextLabels[vertexIndex] = normalized || getSolidVertexLabel(vertexIndex);
        return {
          ...state,
          vertexLabels: nextLabels,
        };
      });
    },
    [getSolidVertexLabel, updateSelectedSolid3dState]
  );

  return {
    setSolid3dHiddenEdges,
    setSolid3dFaceColor,
    resetSolid3dFaceColors,
    updateSelectedSolid3dSurfaceColor,
    updateSelectedSolid3dStrokeWidth,
    commitSelectedSolid3dStrokeWidth,
    setSolid3dEdgeColor,
    resetSolid3dEdgeColors,
    addSolid3dAngleMark,
    updateSolid3dAngleMark,
    deleteSolid3dAngleMark,
    updateSolid3dSection,
    deleteSolid3dSection,
    startSolid3dSectionPointCollection,
    renameSolid3dSectionVertex,
    renameSolid3dVertex,
  };
};
