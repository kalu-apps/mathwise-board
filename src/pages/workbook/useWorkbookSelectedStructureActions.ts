import { useCallback, type MutableRefObject } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import { ensureWorkbookObjectZOrder } from "@/features/workbook/model/objectZOrder";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";
import { generateId } from "@/shared/lib/id";
import {
  clampBoardObjectToPageFrame,
  collectBoardObjectLabels,
  getFigureVertexLabel,
  getNextUniqueBoardLabel,
} from "./WorkbookSessionPage.core";
import {
  classifyConnectedFigureKind,
  getPointsBounds,
  is2dFigureObject,
  resolve2dFigureVertices,
} from "./WorkbookSessionPage.geometry";

type Updater<T> = T | ((current: T) => T);

type UseWorkbookSelectedStructureActionsParams = {
  selectedObjectId: string | null;
  canSelect: boolean;
  canDraw: boolean;
  canDelete: boolean;
  sessionId: string;
  activeSceneLayerId: string;
  userId?: string;
  boardObjects: WorkbookBoardObject[];
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  dividerWidthDraft: number;
  setSelectedObjectId: (value: Updater<string | null>) => void;
  setError: (value: string | null) => void;
  commitObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void | Promise<void>;
  appendEventsAndApply: (events: WorkbookClientEventInput[]) => Promise<void>;
};

export const useWorkbookSelectedStructureActions = ({
  selectedObjectId,
  canSelect,
  canDraw,
  canDelete,
  sessionId,
  activeSceneLayerId,
  userId,
  boardObjects,
  boardObjectsRef,
  dividerWidthDraft,
  setSelectedObjectId,
  setError,
  commitObjectUpdate,
  appendEventsAndApply,
}: UseWorkbookSelectedStructureActionsParams) => {
  const updateSelectedDividerMeta = useCallback(
    async (patch: Partial<{ lineStyle: "solid" | "dashed" }>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || target.type !== "section_divider") return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedDividerObject = useCallback(
    async (patch: Partial<WorkbookBoardObject>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || target.type !== "section_divider") return;
      await commitObjectUpdate(target.id, patch);
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const commitSelectedDividerWidth = useCallback(async () => {
    if (!selectedObjectId) return;
    const target = boardObjects.find((item) => item.id === selectedObjectId);
    if (!target || target.type !== "section_divider") return;
    const next = Math.max(1, Math.min(18, Math.round(dividerWidthDraft)));
    const current = target.strokeWidth ?? 2;
    if (Math.abs(next - current) < 0.01) return;
    await updateSelectedDividerObject({ strokeWidth: next });
  }, [boardObjects, dividerWidthDraft, selectedObjectId, updateSelectedDividerObject]);

  const renamePointObject = useCallback(
    async (objectId: string, label: string) => {
      const target = boardObjects.find((item) => item.id === objectId);
      if (!target || target.type !== "point") return;
      await commitObjectUpdate(objectId, {
        meta: {
          ...(target.meta ?? {}),
          label: label.trim().slice(0, 12),
        },
      });
    },
    [boardObjects, commitObjectUpdate]
  );

  const renameShape2dVertexByObjectId = useCallback(
    async (objectId: string, vertexIndex: number, label: string) => {
      const target = boardObjects.find((item) => item.id === objectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length || vertexIndex < 0 || vertexIndex >= vertices.length) return;
      const raw = Array.isArray(target.meta?.vertexLabels) ? target.meta.vertexLabels : [];
      const next = vertices.map((_, index) => {
        const current = typeof raw[index] === "string" ? raw[index].trim() : "";
        return current || getFigureVertexLabel(index);
      });
      next[vertexIndex] = label.trim().slice(0, 12) || getFigureVertexLabel(vertexIndex);
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          vertexLabels: next,
        },
      });
    },
    [boardObjects, commitObjectUpdate]
  );

  const renameLineEndpointByObjectId = useCallback(
    async (objectId: string, endpoint: "start" | "end", label: string) => {
      const target = boardObjects.find((item) => item.id === objectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      if (target.meta?.lineKind !== "segment") return;
      const nextLabel = label.trim().slice(0, 12);
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          [endpoint === "start" ? "startLabel" : "endLabel"]: nextLabel,
        },
      });
    },
    [boardObjects, commitObjectUpdate]
  );

  const connectPointObjectsChronologically = useCallback(async () => {
    if (!sessionId || !canDraw) return;
    if (!canDelete) {
      setError("Для объединения точек нужно разрешение на удаление.");
      return;
    }
    const points = boardObjects
      .filter((object): object is WorkbookBoardObject & { type: "point" } => object.type === "point")
      .slice()
      .sort((a, b) => {
        const left = Date.parse(a.createdAt);
        const right = Date.parse(b.createdAt);
        if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
        return a.id.localeCompare(b.id);
      });
    if (points.length < 2) {
      setError("Нужно минимум две точки, чтобы объединить их.");
      return;
    }

    const selectedPoint =
      selectedObjectId
        ? boardObjects.find(
            (object): object is WorkbookBoardObject & { type: "point" } =>
              object.id === selectedObjectId && object.type === "point"
          ) ?? null
        : null;
    const resolveSceneLayerId = (object: WorkbookBoardObject & { type: "point" }) =>
      typeof object.meta?.sceneLayerId === "string" && object.meta.sceneLayerId.trim().length > 0
        ? object.meta.sceneLayerId
        : activeSceneLayerId;
    const targetPage = Math.max(
      1,
      selectedPoint?.page ??
        points[points.length - 1]?.page ??
        1
    );
    const targetSceneLayerId = selectedPoint
      ? resolveSceneLayerId(selectedPoint)
      : activeSceneLayerId;
    const pointsForMerge = points.filter(
      (point) =>
        Math.max(1, point.page ?? 1) === targetPage &&
        resolveSceneLayerId(point) === targetSceneLayerId
    );
    if (pointsForMerge.length < 2) {
      setError("На текущей странице нужно минимум две точки, чтобы объединить их.");
      return;
    }

    const used = new Set<string>();
    const pointIds = new Set(pointsForMerge.map((point) => point.id));
    boardObjects.forEach((object) => {
      if (pointIds.has(object.id)) return;
      collectBoardObjectLabels(object).forEach((label) => used.add(label));
    });

    const labels = pointsForMerge.map((_, index) => getNextUniqueBoardLabel(used, index));
    const polylinePoints = pointsForMerge.map((point) => ({
      x: point.x + point.width / 2,
      y: point.y + point.height / 2,
    }));
    const bounds = getPointsBounds(polylinePoints);
    const createdAt = new Date().toISOString();
    const fallbackColor = "#2f4f7f";
    const figureKind = classifyConnectedFigureKind(polylinePoints);
    const created: WorkbookBoardObject =
      polylinePoints.length === 2
        ? {
            id: generateId(),
            type: "line",
            layer: "board",
            x: polylinePoints[0].x,
            y: polylinePoints[0].y,
            width: polylinePoints[1].x - polylinePoints[0].x,
            height: polylinePoints[1].y - polylinePoints[0].y,
            page: targetPage,
            color: fallbackColor,
            fill: "transparent",
            strokeWidth: 2,
            opacity: 1,
            authorUserId: userId ?? "unknown",
            createdAt,
            meta: {
              sceneLayerId: targetSceneLayerId,
              lineKind: "segment",
              lineStyle: "solid",
              startLabel: labels[0],
              endLabel: labels[1],
              figureKind: "segment",
            },
          }
        : {
            id: generateId(),
            type: "polygon",
            layer: "board",
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.width,
            height: bounds.height,
            page: targetPage,
            color: fallbackColor,
            fill: "transparent",
            strokeWidth: 2,
            opacity: 1,
            points: polylinePoints,
            sides: polylinePoints.length,
            authorUserId: userId ?? "unknown",
            createdAt,
            meta: {
              sceneLayerId: targetSceneLayerId,
              polygonMode: "points",
              polygonPreset: "regular",
              closed: true,
              figureKind,
              vertexLabels: labels,
              showAngles: false,
              vertexColors: Array.from({ length: polylinePoints.length }, () => fallbackColor),
              angleMarks: Array.from({ length: polylinePoints.length }, () => ({
                valueText: "",
                color: fallbackColor,
                style: "auto" as const,
              })),
              angleNotes: Array.from({ length: polylinePoints.length }, () => ""),
              angleColors: Array.from({ length: polylinePoints.length }, () => fallbackColor),
              segmentNotes: Array.from({ length: polylinePoints.length }, () => ""),
              segmentColors: Array.from({ length: polylinePoints.length }, () => fallbackColor),
            },
          };

    const deleteEvents = pointsForMerge.map((point) => ({
      type: "board.object.delete" as const,
      payload: { objectId: point.id },
    }));
    const createdWithZOrder = ensureWorkbookObjectZOrder(
      clampBoardObjectToPageFrame(created),
      boardObjectsRef.current
    );

    const mergeEvents: WorkbookClientEventInput[] = [
      {
        type: "board.object.create",
        payload: { object: createdWithZOrder },
      },
      ...deleteEvents,
    ];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await appendEventsAndApply(mergeEvents);
        setSelectedObjectId(createdWithZOrder.id);
        return;
      } catch (error) {
        const isConflict =
          error instanceof ApiError &&
          error.code === "conflict" &&
          error.status === 409;
        if (isConflict && attempt < 2) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 160 * (attempt + 1));
          });
          continue;
        }
        if (isRecoverableApiError(error) && attempt < 2) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 210 * (attempt + 1));
          });
          continue;
        }
        break;
      }
    }
    setError("Не удалось объединить точки.");
  }, [activeSceneLayerId, appendEventsAndApply, boardObjects, boardObjectsRef, canDelete, canDraw, selectedObjectId, sessionId, setError, setSelectedObjectId, userId]);

  return {
    updateSelectedDividerMeta,
    updateSelectedDividerObject,
    commitSelectedDividerWidth,
    renamePointObject,
    renameShape2dVertexByObjectId,
    renameLineEndpointByObjectId,
    connectPointObjectsChronologically,
  };
};
