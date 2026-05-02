import { useCallback, useRef, type MutableRefObject } from "react";
import { generateId } from "@/shared/lib/id";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";
import {
  mergeBoardObjectPatches,
  mergeBoardObjectWithPatch,
} from "@/features/workbook/model/runtime";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookEraserCommitPayload } from "@/features/workbook/ui/WorkbookCanvas";
import type { WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

type StateUpdater<T> = T | ((current: T) => T);
type SetState<T> = (updater: StateUpdater<T>) => void;

type AppendEventsAndApply = (
  events: WorkbookClientEventInput[],
  options?: {
    trackHistory?: boolean;
    markDirty?: boolean;
    historyEntry?: WorkbookHistoryEntry | null;
  }
) => Promise<void>;

type UseWorkbookStrokeCommitHandlersParams = {
  sessionId: string;
  canDraw: boolean;
  canDelete: boolean;
  currentBoardPage: number;
  buildHistoryEntryFromEvents: (events: WorkbookClientEventInput[]) => WorkbookHistoryEntry | null;
  queueStrokePreview: (payload: {
    stroke: WorkbookStroke;
    previewVersion: number;
    flush?: "immediate";
  }) => void;
  finalizeStrokePreview: (strokeId: string) => void;
  applyLocalStrokeCollection: (
    targetLayer: WorkbookLayer,
    updater: (current: WorkbookStroke[]) => WorkbookStroke[]
  ) => void;
  appendEventsAndApply: AppendEventsAndApply;
  setError: (value: string | null) => void;
  setSaveSyncWarning: (value: string | null) => void;
  setBoardStrokes: SetState<WorkbookStroke[]>;
  setAnnotationStrokes: SetState<WorkbookStroke[]>;
  applyLocalBoardObjects: (
    updater: (current: WorkbookBoardObject[]) => WorkbookBoardObject[]
  ) => void;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  commitInteractiveBoardObjects: (objects: WorkbookBoardObject[]) => void;
  markDirty: () => void;
};

const BOARD_SYNC_WARNING_FAILURE_WINDOW_MS = 15_000;
const BOARD_SYNC_WARNING_MIN_FAILURES = 3;
const BOARD_SYNC_WARNING_COOLDOWN_MS = 45_000;
const BOARD_SYNC_WARNING_MESSAGE =
  "Синхронизация доски заметно задерживается. Проверьте Wi-Fi, мобильную сеть или VPN. Мы продолжаем отправлять изменения.";

export const useWorkbookStrokeCommitHandlers = ({
  sessionId,
  canDraw,
  canDelete,
  currentBoardPage,
  buildHistoryEntryFromEvents,
  queueStrokePreview,
  finalizeStrokePreview,
  applyLocalStrokeCollection,
  appendEventsAndApply,
  setError,
  setSaveSyncWarning,
  setBoardStrokes,
  setAnnotationStrokes,
  applyLocalBoardObjects,
  boardStrokesRef,
  annotationStrokesRef,
  boardObjectsRef,
  commitInteractiveBoardObjects,
  markDirty,
}: UseWorkbookStrokeCommitHandlersParams) => {
  const recoverableSyncIssueRef = useRef({
    firstFailureAtMs: 0,
    failureCount: 0,
    lastWarningAtMs: 0,
  });
  const clearRecoverableSyncIssue = useCallback(() => {
    recoverableSyncIssueRef.current.firstFailureAtMs = 0;
    recoverableSyncIssueRef.current.failureCount = 0;
  }, []);
  const noteRecoverableSyncIssue = useCallback(() => {
    const now = Date.now();
    const state = recoverableSyncIssueRef.current;
    if (
      state.firstFailureAtMs <= 0 ||
      now - state.firstFailureAtMs > BOARD_SYNC_WARNING_FAILURE_WINDOW_MS
    ) {
      state.firstFailureAtMs = now;
      state.failureCount = 1;
      return;
    }
    state.failureCount += 1;
    if (
      state.failureCount >= BOARD_SYNC_WARNING_MIN_FAILURES &&
      now - state.lastWarningAtMs >= BOARD_SYNC_WARNING_COOLDOWN_MS
    ) {
      state.lastWarningAtMs = now;
      setSaveSyncWarning(BOARD_SYNC_WARNING_MESSAGE);
    }
  }, [setSaveSyncWarning]);

  const commitStrokePreview = useCallback(
    (payload: { stroke: WorkbookStroke; previewVersion: number; flush?: "immediate" }) => {
      if (!sessionId || !canDraw) return;
      if (payload.stroke.tool !== "pen" && payload.stroke.tool !== "highlighter") return;
      const strokeWithPage: WorkbookStroke = {
        ...payload.stroke,
        page: Math.max(1, payload.stroke.page ?? currentBoardPage),
      };
      queueStrokePreview({
        stroke: strokeWithPage,
        previewVersion: payload.previewVersion,
        flush: payload.flush,
      });
    },
    [canDraw, currentBoardPage, queueStrokePreview, sessionId]
  );

  const commitStroke = useCallback(
    async (stroke: WorkbookStroke) => {
      if (!sessionId || !canDraw) return;
      const type = stroke.layer === "board" ? "board.stroke" : "annotations.stroke";
      const strokeWithPage: WorkbookStroke = {
        ...stroke,
        page: Math.max(1, stroke.page ?? currentBoardPage),
      };
      finalizeStrokePreview(strokeWithPage.id);
      applyLocalStrokeCollection(strokeWithPage.layer, (current) =>
        current.some((item) => item.id === strokeWithPage.id)
          ? current
          : [...current, strokeWithPage]
      );
      const persistStroke = () =>
        appendEventsAndApply([{ type, payload: { stroke: strokeWithPage } }]);
      try {
        await persistStroke();
        clearRecoverableSyncIssue();
      } catch (error) {
        let effectiveError: unknown = error;
        if (error instanceof ApiError && error.code === "conflict") {
          try {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, 220);
            });
            await persistStroke();
            clearRecoverableSyncIssue();
            return;
          } catch (retryError) {
            effectiveError = retryError;
          }
        }
        if (isRecoverableApiError(effectiveError)) {
          markDirty();
          noteRecoverableSyncIssue();
          return;
        }
        applyLocalStrokeCollection(strokeWithPage.layer, (current) =>
          current.filter((item) => item.id !== strokeWithPage.id)
        );
        setError("Не удалось синхронизировать штрих. Проверьте подключение.");
      }
    },
    [
      appendEventsAndApply,
      applyLocalStrokeCollection,
      canDraw,
      clearRecoverableSyncIssue,
      currentBoardPage,
      finalizeStrokePreview,
      markDirty,
      noteRecoverableSyncIssue,
      sessionId,
      setError,
    ]
  );

  const commitStrokeDelete = useCallback(
    async (strokeId: string, targetLayer: WorkbookLayer) => {
      if (!sessionId || !canDelete) return;
      const type =
        targetLayer === "annotations"
          ? ("annotations.stroke.delete" as const)
          : ("board.stroke.delete" as const);
      finalizeStrokePreview(strokeId);
      let deletedStroke: WorkbookStroke | null = null;
      applyLocalStrokeCollection(targetLayer, (current) => {
        deletedStroke = current.find((item) => item.id === strokeId) ?? null;
        return current.filter((item) => item.id !== strokeId);
      });
      try {
        await appendEventsAndApply([{ type, payload: { strokeId } }]);
      } catch {
        if (deletedStroke) {
          applyLocalStrokeCollection(targetLayer, (current) =>
            current.some((item) => item.id === strokeId)
              ? current
              : [...current, deletedStroke as WorkbookStroke]
          );
        }
        setError("Не удалось удалить штрих.");
      }
    },
    [
      appendEventsAndApply,
      applyLocalStrokeCollection,
      canDelete,
      finalizeStrokePreview,
      sessionId,
      setError,
    ]
  );

  const commitStrokeReplace = useCallback(
    async (payload: {
      stroke: WorkbookStroke;
      fragments: WorkbookPoint[][];
      preserveSourceId?: boolean;
    }) => {
      if (!sessionId || !canDelete) return;
      const sourceStroke = payload.stroke;
      const fragments = payload.fragments
        .map((fragment) =>
          fragment.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        )
        .filter((fragment) => fragment.length > 0);
      const layerTypeCreate =
        sourceStroke.layer === "annotations"
          ? ("annotations.stroke" as const)
          : ("board.stroke" as const);
      const layerTypeDelete =
        sourceStroke.layer === "annotations"
          ? ("annotations.stroke.delete" as const)
          : ("board.stroke.delete" as const);
      const replacementStrokes: WorkbookStroke[] = fragments.map((points, index) => ({
        ...sourceStroke,
        id: payload.preserveSourceId && index === 0 ? sourceStroke.id : generateId(),
        points,
        createdAt: new Date().toISOString(),
        page: Math.max(1, sourceStroke.page ?? currentBoardPage),
      }));
      const replacementIds = new Set(replacementStrokes.map((item) => item.id));
      finalizeStrokePreview(sourceStroke.id);
      applyLocalStrokeCollection(sourceStroke.layer, (current) => {
        const withoutSource = current.filter((item) => item.id !== sourceStroke.id);
        if (replacementStrokes.length === 0) return withoutSource;
        return [...withoutSource, ...replacementStrokes];
      });
      try {
        await appendEventsAndApply([
          {
            type: layerTypeDelete,
            payload: { strokeId: sourceStroke.id },
          },
          ...replacementStrokes.map((stroke) => ({
            type: layerTypeCreate,
            payload: { stroke },
          })),
        ]);
      } catch {
        applyLocalStrokeCollection(sourceStroke.layer, (current) => {
          const cleaned = current.filter((item) => !replacementIds.has(item.id));
          if (cleaned.some((item) => item.id === sourceStroke.id)) return cleaned;
          return [...cleaned, sourceStroke];
        });
        setError("Не удалось обновить штрих после стирания.");
      }
    },
    [
      appendEventsAndApply,
      applyLocalStrokeCollection,
      canDelete,
      currentBoardPage,
      finalizeStrokePreview,
      sessionId,
      setError,
    ]
  );

  const commitEraserBatch = useCallback(
    async (payload: WorkbookEraserCommitPayload) => {
      if (!sessionId || !canDelete) return;
      const deleteBoardStrokeIds = new Set<string>();
      const deleteAnnotationStrokeIds = new Set<string>();
      const replacementBoardStrokes: WorkbookStroke[] = [];
      const replacementAnnotationStrokes: WorkbookStroke[] = [];
      const createStrokeEvents: WorkbookClientEventInput[] = [];
      const objectPatchById = new Map<string, Partial<WorkbookBoardObject>>();
      const nowIso = new Date().toISOString();

      payload.strokeReplacements.forEach((entry) => {
        const sourceStroke = entry.stroke;
        const sourceId =
          sourceStroke && typeof sourceStroke.id === "string"
            ? sourceStroke.id.trim()
            : "";
        const sourceLayer: WorkbookLayer =
          sourceStroke?.layer === "annotations" ? "annotations" : "board";
        if (!sourceId) return;
        if (sourceLayer === "annotations") {
          deleteAnnotationStrokeIds.add(sourceId);
        } else {
          deleteBoardStrokeIds.add(sourceId);
        }
        const sanitizedFragments = entry.fragments
          .map((fragment) =>
            fragment.filter(
              (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
            )
          )
          .filter((fragment) => fragment.length > 0);
        if (sanitizedFragments.length === 0) return;
        const replacements = sanitizedFragments.map((points, index) => ({
          ...sourceStroke,
          id: entry.preserveSourceId && index === 0 ? sourceId : generateId(),
          points,
          createdAt: nowIso,
          page: Math.max(1, sourceStroke.page ?? currentBoardPage),
        }));
        replacements.forEach((stroke) => {
          createStrokeEvents.push({
            type:
              sourceLayer === "annotations"
                ? "annotations.stroke"
                : "board.stroke",
            payload: { stroke },
          });
        });
        if (sourceLayer === "annotations") {
          replacementAnnotationStrokes.push(...replacements);
        } else {
          replacementBoardStrokes.push(...replacements);
        }
      });

      payload.strokeDeletes.forEach((entry) => {
        const strokeId = typeof entry.strokeId === "string" ? entry.strokeId.trim() : "";
        if (!strokeId) return;
        if (entry.layer === "annotations") {
          deleteAnnotationStrokeIds.add(strokeId);
        } else {
          deleteBoardStrokeIds.add(strokeId);
        }
      });

      payload.objectUpdates.forEach((entry) => {
        const objectId = typeof entry.objectId === "string" ? entry.objectId.trim() : "";
        const patch =
          entry.patch && typeof entry.patch === "object"
            ? (entry.patch as Partial<WorkbookBoardObject>)
            : null;
        if (!objectId || !patch) return;
        const currentPatch = objectPatchById.get(objectId) ?? {};
        objectPatchById.set(objectId, mergeBoardObjectPatches(currentPatch, patch));
      });

      const events: WorkbookClientEventInput[] = [
        ...Array.from(deleteBoardStrokeIds.values()).map((strokeId) => ({
          type: "board.stroke.delete" as const,
          payload: { strokeId },
        })),
        ...Array.from(deleteAnnotationStrokeIds.values()).map((strokeId) => ({
          type: "annotations.stroke.delete" as const,
          payload: { strokeId },
        })),
        ...createStrokeEvents,
        ...Array.from(objectPatchById.entries()).map(([objectId, patch]) => ({
          type: "board.object.update" as const,
          payload: { objectId, patch },
        })),
      ];

      if (events.length === 0) return;
      const historyEntry = buildHistoryEntryFromEvents(events);

      const previousBoardStrokes = boardStrokesRef.current;
      const previousAnnotationStrokes = annotationStrokesRef.current;
      const previousBoardObjects = boardObjectsRef.current;

      if (deleteBoardStrokeIds.size > 0 || replacementBoardStrokes.length > 0) {
        setBoardStrokes((current) => {
          const filtered = current.filter((stroke) => !deleteBoardStrokeIds.has(stroke.id));
          if (replacementBoardStrokes.length === 0) return filtered;
          const existingIds = new Set(filtered.map((stroke) => stroke.id));
          const additions = replacementBoardStrokes.filter(
            (stroke) => !existingIds.has(stroke.id)
          );
          return additions.length > 0 ? [...filtered, ...additions] : filtered;
        });
      }
      if (deleteAnnotationStrokeIds.size > 0 || replacementAnnotationStrokes.length > 0) {
        setAnnotationStrokes((current) => {
          const filtered = current.filter(
            (stroke) => !deleteAnnotationStrokeIds.has(stroke.id)
          );
          if (replacementAnnotationStrokes.length === 0) return filtered;
          const existingIds = new Set(filtered.map((stroke) => stroke.id));
          const additions = replacementAnnotationStrokes.filter(
            (stroke) => !existingIds.has(stroke.id)
          );
          return additions.length > 0 ? [...filtered, ...additions] : filtered;
        });
      }
      if (objectPatchById.size > 0) {
        applyLocalBoardObjects((current) =>
          current.map((object) => {
            const patch = objectPatchById.get(object.id);
            return patch ? mergeBoardObjectWithPatch(object, patch) : object;
          })
        );
      }

      try {
        await appendEventsAndApply(events, historyEntry ? { historyEntry } : undefined);
        clearRecoverableSyncIssue();
      } catch (error) {
        if (isRecoverableApiError(error)) {
          markDirty();
          noteRecoverableSyncIssue();
          return;
        }
        setBoardStrokes(previousBoardStrokes);
        setAnnotationStrokes(previousAnnotationStrokes);
        commitInteractiveBoardObjects(previousBoardObjects);
        setError("Не удалось синхронизировать изменения ластика.");
      }
    },
    [
      appendEventsAndApply,
      applyLocalBoardObjects,
      buildHistoryEntryFromEvents,
      canDelete,
      clearRecoverableSyncIssue,
      currentBoardPage,
      commitInteractiveBoardObjects,
      markDirty,
      noteRecoverableSyncIssue,
      sessionId,
      setAnnotationStrokes,
      setBoardStrokes,
      setError,
      annotationStrokesRef,
      boardObjectsRef,
      boardStrokesRef,
    ]
  );

  return {
    commitStrokePreview,
    commitStroke,
    commitStrokeDelete,
    commitStrokeReplace,
    commitEraserBatch,
  };
};
