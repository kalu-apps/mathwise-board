import { useCallback, type MutableRefObject } from "react";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import { readSolid3dState, writeSolid3dState } from "@/features/workbook/model/solid3dState";
import { getPointsBounds } from "./WorkbookSessionPage.geometry";

type CommitObjectUpdate = (
  objectId: string,
  patch: Partial<WorkbookBoardObject>,
  options?: {
    trackHistory?: boolean;
    markDirty?: boolean;
  }
) => void;

type UseWorkbookObjectTransformHandlersParams = {
  canSelect: boolean;
  selectedObjectId: string | null;
  boardObjects: WorkbookBoardObject[];
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  commitObjectUpdate: CommitObjectUpdate;
};

export const useWorkbookObjectTransformHandlers = ({
  canSelect,
  selectedObjectId,
  boardObjects,
  boardObjectsRef,
  commitObjectUpdate,
}: UseWorkbookObjectTransformHandlersParams) => {
  const scaleObject = useCallback(
    async (factor: number, objectId?: string) => {
      if (!canSelect) return;
      const targetObjectId = objectId ?? selectedObjectId;
      if (!targetObjectId) return;
      const targetObject = boardObjects.find((item) => item.id === targetObjectId);
      if (!targetObject) return;
      const safeFactor = Number.isFinite(factor) ? factor : 1;
      if (safeFactor <= 0) return;
      const nextWidth = targetObject.width * safeFactor;
      const nextHeight = targetObject.height * safeFactor;
      if (Array.isArray(targetObject.points) && targetObject.points.length > 0) {
        const bounds = getPointsBounds(targetObject.points);
        const centerX = bounds.minX + bounds.width / 2;
        const centerY = bounds.minY + bounds.height / 2;
        const scaledPoints = targetObject.points.map((point) => ({
          x: centerX + (point.x - centerX) * safeFactor,
          y: centerY + (point.y - centerY) * safeFactor,
        }));
        const scaledBounds = getPointsBounds(scaledPoints);
        commitObjectUpdate(targetObject.id, {
          x: scaledBounds.minX,
          y: scaledBounds.minY,
          width: scaledBounds.width,
          height: scaledBounds.height,
          points: scaledPoints,
        });
        return;
      }
      commitObjectUpdate(targetObject.id, {
        width: Math.abs(nextWidth) < 1 ? Math.sign(nextWidth || 1) : nextWidth,
        height: Math.abs(nextHeight) < 1 ? Math.sign(nextHeight || 1) : nextHeight,
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const mirrorSelectedObject = useCallback(
    async (axis: "horizontal" | "vertical") => {
      if (!selectedObjectId || !canSelect) return;
      const targetObject = boardObjectsRef.current.find((item) => item.id === selectedObjectId);
      if (!targetObject) return;

      const centerX = targetObject.x + targetObject.width / 2;
      const centerY = targetObject.y + targetObject.height / 2;

      if (Array.isArray(targetObject.points) && targetObject.points.length > 0) {
        const mirroredPoints = targetObject.points.map((point) => ({
          x: axis === "horizontal" ? centerX * 2 - point.x : point.x,
          y: axis === "vertical" ? centerY * 2 - point.y : point.y,
        }));
        const bounds = getPointsBounds(mirroredPoints);
        commitObjectUpdate(targetObject.id, {
          points: mirroredPoints,
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.width,
          height: bounds.height,
        });
        return;
      }

      if (targetObject.type === "line" || targetObject.type === "arrow") {
        const start = { x: targetObject.x, y: targetObject.y };
        const end = {
          x: targetObject.x + targetObject.width,
          y: targetObject.y + targetObject.height,
        };
        const mirroredStart =
          axis === "horizontal"
            ? { x: centerX * 2 - start.x, y: start.y }
            : { x: start.x, y: centerY * 2 - start.y };
        const mirroredEnd =
          axis === "horizontal"
            ? { x: centerX * 2 - end.x, y: end.y }
            : { x: end.x, y: centerY * 2 - end.y };
        commitObjectUpdate(targetObject.id, {
          x: mirroredStart.x,
          y: mirroredStart.y,
          width: mirroredEnd.x - mirroredStart.x,
          height: mirroredEnd.y - mirroredStart.y,
        });
        return;
      }

      if (targetObject.type === "solid3d") {
        const state = readSolid3dState(targetObject.meta);
        const nextState =
          axis === "horizontal"
            ? {
                ...state,
                view: {
                  ...state.view,
                  rotationY: -state.view.rotationY,
                },
              }
            : {
                ...state,
                view: {
                  ...state.view,
                  rotationX: -state.view.rotationX,
                },
              };
        commitObjectUpdate(targetObject.id, {
          meta: writeSolid3dState(nextState, targetObject.meta),
        });
        return;
      }

      const baseRotation =
        typeof targetObject.rotation === "number" && Number.isFinite(targetObject.rotation)
          ? targetObject.rotation
          : 0;
      commitObjectUpdate(targetObject.id, {
        rotation: axis === "horizontal" ? -baseRotation : Math.PI - baseRotation,
      });
    },
    [boardObjectsRef, canSelect, commitObjectUpdate, selectedObjectId]
  );

  return {
    scaleObject,
    mirrorSelectedObject,
  };
};
