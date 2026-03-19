import { useCallback, type MutableRefObject } from "react";
import {
  normalizeShapeAngleMarks,
  type WorkbookShapeAngleMark,
  type WorkbookShapeAngleMarkStyle,
} from "@/features/workbook/model/shapeAngleMarks";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import { getFigureVertexLabel } from "./WorkbookSessionPage.core";
import {
  is2dFigureClosed,
  is2dFigureObject,
  resolve2dFigureVertices,
} from "./WorkbookSessionPage.geometry";

type UseWorkbookSelectedShape2dActionsParams = {
  selectedObjectId: string | null;
  canSelect: boolean;
  boardObjects: WorkbookBoardObject[];
  shape2dStrokeWidthDraft: number;
  commitObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void | Promise<void>;
  shapeAngleDraftValuesRef: MutableRefObject<Map<number, string>>;
  shapeAngleDraftCommitTimersRef: MutableRefObject<Map<number, number>>;
  shapeAngleDraftObjectIdRef: MutableRefObject<string | null>;
  shapeSegmentDraftValuesRef: MutableRefObject<Map<number, string>>;
  shapeSegmentDraftCommitTimersRef: MutableRefObject<Map<number, number>>;
  shapeSegmentDraftObjectIdRef: MutableRefObject<string | null>;
};

export const useWorkbookSelectedShape2dActions = ({
  selectedObjectId,
  canSelect,
  boardObjects,
  shape2dStrokeWidthDraft,
  commitObjectUpdate,
  shapeAngleDraftValuesRef,
  shapeAngleDraftCommitTimersRef,
  shapeAngleDraftObjectIdRef,
  shapeSegmentDraftValuesRef,
  shapeSegmentDraftCommitTimersRef,
  shapeSegmentDraftObjectIdRef,
}: UseWorkbookSelectedShape2dActionsParams) => {
  const updateSelectedShape2dMeta = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedShape2dObject = useCallback(
    async (patch: Partial<WorkbookBoardObject>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      await commitObjectUpdate(target.id, patch);
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const buildShapeAngleMetaPatch = useCallback(
    (marks: WorkbookShapeAngleMark[]) => ({
      angleMarks: marks.map((mark) => ({
        valueText: mark.valueText.slice(0, 24),
        color: mark.color,
        style: mark.style,
      })),
      angleNotes: marks.map((mark) => mark.valueText.slice(0, 24)),
      angleColors: marks.map((mark) => mark.color),
    }),
    []
  );

  const updateSelectedShape2dAngleMark = useCallback(
    async (
      index: number,
      patch: Partial<Pick<WorkbookShapeAngleMark, "valueText" | "color" | "style">>
    ) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const fallback = target.color || "#4f63ff";
      const next = normalizeShapeAngleMarks(target, vertices.length, fallback);
      const currentMark = next[index];
      if (!currentMark) return;
      next[index] = {
        ...currentMark,
        ...(patch.valueText !== undefined
          ? { valueText: patch.valueText.slice(0, 24) }
          : {}),
        ...(patch.color !== undefined ? { color: patch.color || fallback } : {}),
        ...(patch.style !== undefined ? { style: patch.style } : {}),
      };
      await updateSelectedShape2dMeta(buildShapeAngleMetaPatch(next));
    },
    [
      boardObjects,
      buildShapeAngleMetaPatch,
      selectedObjectId,
      updateSelectedShape2dMeta,
    ]
  );

  const renameSelectedShape2dVertex = useCallback(
    async (index: number, label: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const raw = Array.isArray(target.meta?.vertexLabels) ? target.meta.vertexLabels : [];
      const next = vertices.map((_, vertexIndex) => {
        const value = typeof raw[vertexIndex] === "string" ? raw[vertexIndex].trim() : "";
        return value || getFigureVertexLabel(vertexIndex);
      });
      next[index] = label.trim().slice(0, 12) || getFigureVertexLabel(index);
      await updateSelectedShape2dMeta({ vertexLabels: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  const updateSelectedShape2dAngleNote = useCallback(
    async (index: number, value: string) => {
      await updateSelectedShape2dAngleMark(index, {
        valueText: value.slice(0, 24),
      });
    },
    [updateSelectedShape2dAngleMark]
  );

  const updateSelectedShape2dSegmentNote = useCallback(
    async (index: number, value: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (vertices.length < 2) return;
      const closed = is2dFigureClosed(target);
      const segmentCount = closed ? vertices.length : Math.max(0, vertices.length - 1);
      const raw = Array.isArray(target.meta?.segmentNotes) ? target.meta.segmentNotes : [];
      const next = Array.from({ length: segmentCount }, (_, itemIndex) =>
        typeof raw[itemIndex] === "string" ? raw[itemIndex] : ""
      );
      next[index] = value.slice(0, 24);
      await updateSelectedShape2dMeta({ segmentNotes: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  const updateSelectedShape2dVertexColor = useCallback(
    async (index: number, color: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const raw = Array.isArray(target.meta?.vertexColors) ? target.meta.vertexColors : [];
      const fallback = target.color || "#4f63ff";
      const next = vertices.map((_, itemIndex) =>
        typeof raw[itemIndex] === "string" && raw[itemIndex] ? raw[itemIndex] : fallback
      );
      next[index] = color || fallback;
      await updateSelectedShape2dMeta({ vertexColors: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  const updateSelectedShape2dAngleColor = useCallback(
    async (index: number, color: string) => {
      await updateSelectedShape2dAngleMark(index, {
        color,
      });
    },
    [updateSelectedShape2dAngleMark]
  );

  const updateSelectedShape2dAngleStyle = useCallback(
    async (index: number, style: WorkbookShapeAngleMarkStyle) => {
      await updateSelectedShape2dAngleMark(index, {
        style,
      });
    },
    [updateSelectedShape2dAngleMark]
  );

  const commitSelectedShape2dStrokeWidth = useCallback(async () => {
    if (!selectedObjectId) return;
    const target = boardObjects.find((item) => item.id === selectedObjectId);
    if (!target || !is2dFigureObject(target)) return;
    const next = Math.max(1, Math.min(18, Math.round(shape2dStrokeWidthDraft)));
    const current = target.strokeWidth ?? 2;
    if (Math.abs(next - current) < 0.01) return;
    await updateSelectedShape2dObject({ strokeWidth: next });
  }, [
    boardObjects,
    selectedObjectId,
    shape2dStrokeWidthDraft,
    updateSelectedShape2dObject,
  ]);

  const flushSelectedShape2dAngleDraftCommit = useCallback(
    async (index: number, draftOverride?: string) => {
      const timer = shapeAngleDraftCommitTimersRef.current.get(index);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        shapeAngleDraftCommitTimersRef.current.delete(index);
      }
      if (!selectedObjectId) return;
      const draftObjectId = shapeAngleDraftObjectIdRef.current;
      if (!draftObjectId || draftObjectId !== selectedObjectId) return;
      const nextValue = (draftOverride ?? shapeAngleDraftValuesRef.current.get(index) ?? "")
        .slice(0, 24);
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const fallback = target.color || "#4f63ff";
      const currentValue =
        normalizeShapeAngleMarks(target, vertices.length, fallback)[index]?.valueText ?? "";
      if (currentValue === nextValue) return;
      await updateSelectedShape2dAngleNote(index, nextValue);
    },
    [
      boardObjects,
      selectedObjectId,
      shapeAngleDraftCommitTimersRef,
      shapeAngleDraftObjectIdRef,
      shapeAngleDraftValuesRef,
      updateSelectedShape2dAngleNote,
    ]
  );

  const scheduleSelectedShape2dAngleDraftCommit = useCallback(
    (index: number, value: string) => {
      if (!selectedObjectId) return;
      const nextValue = value.slice(0, 24);
      shapeAngleDraftObjectIdRef.current = selectedObjectId;
      shapeAngleDraftValuesRef.current.set(index, nextValue);
      const existingTimer = shapeAngleDraftCommitTimersRef.current.get(index);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        void flushSelectedShape2dAngleDraftCommit(index, nextValue);
      }, 260);
      shapeAngleDraftCommitTimersRef.current.set(index, timer);
    },
    [
      flushSelectedShape2dAngleDraftCommit,
      selectedObjectId,
      shapeAngleDraftCommitTimersRef,
      shapeAngleDraftObjectIdRef,
      shapeAngleDraftValuesRef,
    ]
  );

  const flushSelectedShape2dSegmentDraftCommit = useCallback(
    async (index: number, draftOverride?: string) => {
      const timer = shapeSegmentDraftCommitTimersRef.current.get(index);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        shapeSegmentDraftCommitTimersRef.current.delete(index);
      }
      if (!selectedObjectId) return;
      const draftObjectId = shapeSegmentDraftObjectIdRef.current;
      if (!draftObjectId || draftObjectId !== selectedObjectId) return;
      const nextValue = (draftOverride ?? shapeSegmentDraftValuesRef.current.get(index) ?? "")
        .slice(0, 24);
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (vertices.length < 2) return;
      const raw = Array.isArray(target.meta?.segmentNotes) ? target.meta.segmentNotes : [];
      const currentValue = typeof raw[index] === "string" ? raw[index] : "";
      if (currentValue === nextValue) return;
      await updateSelectedShape2dSegmentNote(index, nextValue);
    },
    [
      boardObjects,
      selectedObjectId,
      shapeSegmentDraftCommitTimersRef,
      shapeSegmentDraftObjectIdRef,
      shapeSegmentDraftValuesRef,
      updateSelectedShape2dSegmentNote,
    ]
  );

  const scheduleSelectedShape2dSegmentDraftCommit = useCallback(
    (index: number, value: string) => {
      if (!selectedObjectId) return;
      const nextValue = value.slice(0, 24);
      shapeSegmentDraftObjectIdRef.current = selectedObjectId;
      shapeSegmentDraftValuesRef.current.set(index, nextValue);
      const existingTimer = shapeSegmentDraftCommitTimersRef.current.get(index);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        void flushSelectedShape2dSegmentDraftCommit(index, nextValue);
      }, 260);
      shapeSegmentDraftCommitTimersRef.current.set(index, timer);
    },
    [
      flushSelectedShape2dSegmentDraftCommit,
      selectedObjectId,
      shapeSegmentDraftCommitTimersRef,
      shapeSegmentDraftObjectIdRef,
      shapeSegmentDraftValuesRef,
    ]
  );

  const updateSelectedShape2dSegmentColor = useCallback(
    async (index: number, color: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (vertices.length < 2) return;
      const closed = is2dFigureClosed(target);
      const segmentCount = closed ? vertices.length : Math.max(0, vertices.length - 1);
      const raw = Array.isArray(target.meta?.segmentColors) ? target.meta.segmentColors : [];
      const fallback = target.color || "#4f63ff";
      const next = Array.from({ length: segmentCount }, (_, itemIndex) =>
        typeof raw[itemIndex] === "string" && raw[itemIndex] ? raw[itemIndex] : fallback
      );
      next[index] = color || fallback;
      await updateSelectedShape2dMeta({ segmentColors: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  return {
    updateSelectedShape2dMeta,
    updateSelectedShape2dObject,
    updateSelectedShape2dVertexColor,
    updateSelectedShape2dAngleColor,
    updateSelectedShape2dAngleStyle,
    updateSelectedShape2dSegmentColor,
    renameSelectedShape2dVertex,
    commitSelectedShape2dStrokeWidth,
    flushSelectedShape2dAngleDraftCommit,
    scheduleSelectedShape2dAngleDraftCommit,
    flushSelectedShape2dSegmentDraftCommit,
    scheduleSelectedShape2dSegmentDraftCommit,
  };
};
