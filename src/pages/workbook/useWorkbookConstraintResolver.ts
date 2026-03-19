import { useCallback, useMemo } from "react";
import type { WorkbookBoardObject, WorkbookConstraint } from "@/features/workbook/model/types";

interface UseWorkbookConstraintResolverParams {
  constraints: WorkbookConstraint[];
  strictGeometryEnabled: boolean;
}

export function useWorkbookConstraintResolver({
  constraints,
  strictGeometryEnabled,
}: UseWorkbookConstraintResolverParams) {
  const constraintShapeTypes = useMemo(
    () =>
      new Set([
        "line",
        "arrow",
        "rectangle",
        "ellipse",
        "triangle",
        "polygon",
        "solid3d",
        "section3d",
        "net3d",
      ]),
    []
  );

  const applyConstraintsForObject = useCallback(
    (object: WorkbookBoardObject, allObjects: WorkbookBoardObject[]) => {
      if (!strictGeometryEnabled) return object;
      if (!constraintShapeTypes.has(object.type)) return object;
      const relevant = constraints.filter(
        (constraint) =>
          constraint.enabled &&
          (constraint.sourceObjectId === object.id || constraint.targetObjectId === object.id)
      );
      if (relevant.length === 0) return object;

      const next = { ...object };
      relevant.forEach((constraint) => {
        const otherId =
          constraint.sourceObjectId === next.id
            ? constraint.targetObjectId
            : constraint.sourceObjectId;
        const other = allObjects.find((candidate) => candidate.id === otherId);
        if (!other || !constraintShapeTypes.has(other.type)) return;
        const otherDx = other.width;
        const otherDy = other.height;
        const currentLength = Math.hypot(next.width, next.height) || 1;
        const otherLength = Math.hypot(otherDx, otherDy) || 1;
        const otherAngle = Math.atan2(otherDy, otherDx);
        const currentAngle = Math.atan2(next.height, next.width);

        if (constraint.type === "parallel") {
          next.width = Math.cos(otherAngle) * currentLength;
          next.height = Math.sin(otherAngle) * currentLength;
        }
        if (constraint.type === "perpendicular") {
          const targetAngle = otherAngle + Math.PI / 2;
          next.width = Math.cos(targetAngle) * currentLength;
          next.height = Math.sin(targetAngle) * currentLength;
        }
        if (constraint.type === "equal_length") {
          next.width = Math.cos(currentAngle) * otherLength;
          next.height = Math.sin(currentAngle) * otherLength;
        }
      });
      return next;
    },
    [constraintShapeTypes, constraints, strictGeometryEnabled]
  );

  return {
    applyConstraintsForObject,
  };
}
