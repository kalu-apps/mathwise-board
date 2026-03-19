import { useCallback, type MutableRefObject } from "react";
import { applyWorkbookBoardObjectPatchById } from "@/features/workbook/model/boardObjectStore";
import {
  GRAPH_FUNCTION_COLORS,
  normalizeGraphScale,
  normalizeFunctionExpression,
  sanitizeFunctionGraphDrafts,
  validateFunctionExpression,
  type GraphFunctionDraft,
} from "@/features/workbook/model/functionGraph";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import { generateId } from "@/shared/lib/id";
import { clampGraphOffset } from "./WorkbookSessionPage.core";

type Updater<T> = T | ((current: T) => T);

type UseWorkbookSelectedGraphTextActionsParams = {
  selectedObjectId: string | null;
  canSelect: boolean;
  boardObjects: WorkbookBoardObject[];
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardObjectIndexByIdRef: MutableRefObject<Map<string, number>>;
  selectedLineStartLabelDraft: string;
  selectedLineEndLabelDraft: string;
  lineWidthDraft: number;
  graphExpressionDraft: string;
  graphFunctionsDraft: GraphFunctionDraft[];
  setGraphFunctionsDraft: (value: Updater<GraphFunctionDraft[]>) => void;
  setGraphDraftFunctions: (value: Updater<GraphFunctionDraft[]>) => void;
  setGraphExpressionDraft: (value: string) => void;
  setGraphDraftError: (value: Updater<string | null>) => void;
  commitObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void | Promise<void>;
  applyLocalBoardObjects: (
    updater: (current: WorkbookBoardObject[]) => WorkbookBoardObject[]
  ) => void;
  selectedTextDraftValueRef: MutableRefObject<string>;
  selectedTextDraftObjectIdRef: MutableRefObject<string | null>;
  selectedTextDraftDirtyRef: MutableRefObject<boolean>;
  selectedTextDraftCommitTimerRef: MutableRefObject<number | null>;
};

export const useWorkbookSelectedGraphTextActions = ({
  selectedObjectId,
  canSelect,
  boardObjects,
  boardObjectsRef,
  boardObjectIndexByIdRef,
  selectedLineStartLabelDraft,
  selectedLineEndLabelDraft,
  lineWidthDraft,
  graphExpressionDraft,
  graphFunctionsDraft,
  setGraphFunctionsDraft,
  setGraphDraftFunctions,
  setGraphExpressionDraft,
  setGraphDraftError,
  commitObjectUpdate,
  applyLocalBoardObjects,
  selectedTextDraftValueRef,
  selectedTextDraftObjectIdRef,
  selectedTextDraftDirtyRef,
  selectedTextDraftCommitTimerRef,
}: UseWorkbookSelectedGraphTextActionsParams) => {
  const updateSelectedLineMeta = useCallback(
    async (
      patch: Partial<{
        lineKind: "line" | "segment";
        lineStyle: "solid" | "dashed";
        startLabel: string;
        endLabel: string;
      }>
    ) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjectsRef.current.find((item) => item.id === selectedObjectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      const nextMeta = {
        ...(target.meta ?? {}),
        ...patch,
      };
      await commitObjectUpdate(target.id, {
        type: "line",
        meta: nextMeta,
      });
    },
    [boardObjectsRef, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedObjectMeta = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjectsRef.current.find((item) => item.id === selectedObjectId);
      if (!target) return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjectsRef, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedLineObject = useCallback(
    async (patch: Partial<WorkbookBoardObject>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjectsRef.current.find((item) => item.id === selectedObjectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      await commitObjectUpdate(target.id, patch);
    },
    [boardObjectsRef, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedFunctionGraphMeta = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjectsRef.current.find((item) => item.id === selectedObjectId);
      if (!target || target.type !== "function_graph") return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjectsRef, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const commitSelectedFunctionGraphDraft = useCallback(
    async (nextFunctions: GraphFunctionDraft[]) => {
      const fallbackFunctions = sanitizeFunctionGraphDrafts(nextFunctions, {
        ensureNonEmpty: false,
      });
      await updateSelectedFunctionGraphMeta({
        functions: fallbackFunctions,
      });
    },
    [updateSelectedFunctionGraphMeta]
  );

  const updateSelectedFunctionGraphAppearance = useCallback(
    (patch: { axisColor?: string; planeColor?: string }) => {
      void updateSelectedFunctionGraphMeta({
        ...(typeof patch.axisColor === "string" ? { axisColor: patch.axisColor } : {}),
        ...(typeof patch.planeColor === "string" ? { planeColor: patch.planeColor } : {}),
      });
    },
    [updateSelectedFunctionGraphMeta]
  );

  const pushSelectedGraphFunctions = useCallback(
    (nextFunctions: GraphFunctionDraft[]) => {
      const sanitized = sanitizeFunctionGraphDrafts(nextFunctions, {
        ensureNonEmpty: false,
      });
      setGraphFunctionsDraft(sanitized);
      void commitSelectedFunctionGraphDraft(sanitized);
    },
    [commitSelectedFunctionGraphDraft, setGraphFunctionsDraft]
  );

  const commitSelectedLineEndpointLabel = useCallback(
    async (endpoint: "start" | "end", valueOverride?: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      if (target.meta?.lineKind !== "segment") return;
      const value =
        valueOverride ?? (endpoint === "start" ? selectedLineStartLabelDraft : selectedLineEndLabelDraft);
      const key = endpoint === "start" ? "startLabel" : "endLabel";
      const currentRaw = target.meta?.[key];
      const current = typeof currentRaw === "string" ? currentRaw : "";
      const next = value.slice(0, 12);
      if (next === current) return;
      await updateSelectedLineMeta({ [key]: next });
    },
    [
      boardObjects,
      selectedObjectId,
      selectedLineEndLabelDraft,
      selectedLineStartLabelDraft,
      updateSelectedLineMeta,
    ]
  );

  const commitSelectedLineWidth = useCallback(async () => {
    if (!selectedObjectId) return;
    const target = boardObjects.find((item) => item.id === selectedObjectId);
    if (!target || (target.type !== "line" && target.type !== "arrow")) return;
    const next = Math.max(1, Math.min(18, Math.round(lineWidthDraft)));
    const currentWidth = target.strokeWidth ?? 3;
    if (Math.abs(next - currentWidth) < 0.01) return;
    await updateSelectedLineObject({ strokeWidth: next });
  }, [boardObjects, lineWidthDraft, selectedObjectId, updateSelectedLineObject]);

  const appendSelectedGraphFunction = useCallback(
    (expressionOverride?: string) => {
      const selectedGraphObject =
        selectedObjectId != null
          ? boardObjects.find((item) => item.id === selectedObjectId)
          : null;
      if (!selectedGraphObject || selectedGraphObject.type !== "function_graph") return;
      const validation = validateFunctionExpression(
        expressionOverride ?? graphExpressionDraft
      );
      if (!validation.ok) {
        setGraphDraftError(validation.error ?? "Проверьте формулу.");
        return;
      }
      const nextFunctions = [
        ...graphFunctionsDraft,
        {
          id: generateId(),
          expression: validation.expression,
          color: GRAPH_FUNCTION_COLORS[graphFunctionsDraft.length % GRAPH_FUNCTION_COLORS.length],
          visible: true,
          dashed: false,
          width: 2,
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1,
        },
      ];
      pushSelectedGraphFunctions(nextFunctions);
      setGraphExpressionDraft("");
      setGraphDraftError(null);
    },
    [
      graphExpressionDraft,
      boardObjects,
      graphFunctionsDraft,
      pushSelectedGraphFunctions,
      selectedObjectId,
      setGraphDraftError,
      setGraphExpressionDraft,
    ]
  );

  const removeSelectedGraphFunction = useCallback(
    (id: string) => {
      if (graphFunctionsDraft.length <= 1) return;
      const nextFunctions = graphFunctionsDraft.filter((entry) => entry.id !== id);
      pushSelectedGraphFunctions(nextFunctions);
    },
    [graphFunctionsDraft, pushSelectedGraphFunctions]
  );

  const updateSelectedGraphFunction = useCallback(
    (id: string, patch: Partial<GraphFunctionDraft>) => {
      const nextFunctions = graphFunctionsDraft.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      );
      pushSelectedGraphFunctions(nextFunctions);
    },
    [graphFunctionsDraft, pushSelectedGraphFunctions]
  );

  const reflectGraphFunctionByAxis = useCallback(
    (id: string, axis: "x" | "y") => {
      const selectedGraphObject =
        selectedObjectId != null
          ? boardObjects.find((item) => item.id === selectedObjectId)
          : null;
      const applyToSelected = selectedGraphObject?.type === "function_graph";
      const applyReflection = (entry: GraphFunctionDraft): GraphFunctionDraft => {
        if (entry.id !== id) return entry;
        const scaleX = normalizeGraphScale(entry.scaleX ?? 1, 1);
        const scaleY = normalizeGraphScale(entry.scaleY ?? 1, 1);
        const offsetX = clampGraphOffset(entry.offsetX ?? 0);
        const offsetY = clampGraphOffset(entry.offsetY ?? 0);
        if (axis === "x") {
          return {
            ...entry,
            scaleY: normalizeGraphScale(-scaleY, scaleY),
            offsetY: clampGraphOffset(-offsetY),
          };
        }
        return {
          ...entry,
          scaleX: normalizeGraphScale(-scaleX, scaleX),
          offsetX: clampGraphOffset(-offsetX),
        };
      };

      if (applyToSelected) {
        const nextFunctions = graphFunctionsDraft.map(applyReflection);
        pushSelectedGraphFunctions(nextFunctions);
        return;
      }

      setGraphDraftFunctions((current) => current.map(applyReflection));
    },
    [
      boardObjects,
      graphFunctionsDraft,
      pushSelectedGraphFunctions,
      selectedObjectId,
      setGraphDraftFunctions,
    ]
  );

  const updateSelectedTextFormatting = useCallback(
    async (
      patch: Partial<WorkbookBoardObject>,
      metaPatch?: Partial<{
        textColor: string;
        textBackground: string;
        textFontFamily: string;
        textBold: boolean;
        textItalic: boolean;
        textUnderline: boolean;
        textAlign: "left" | "center" | "right";
      }>,
      options?: {
        trackHistory?: boolean;
        markDirty?: boolean;
      }
    ) => {
      if (!selectedObjectId || !canSelect) return;
      const selectedTextObject =
        boardObjectsRef.current.find((item) => item.id === selectedObjectId) ?? null;
      if (!selectedTextObject || selectedTextObject.type !== "text") return;
      await commitObjectUpdate(
        selectedTextObject.id,
        {
          ...patch,
          ...(metaPatch
            ? {
                meta: {
                  ...(selectedTextObject.meta ?? {}),
                  ...metaPatch,
                },
              }
            : {}),
        },
        options
      );
    },
    [boardObjectsRef, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const flushSelectedTextDraftCommit = useCallback(async (
    draftOverride?: string,
    options?: {
      trackHistory?: boolean;
    }
  ) => {
    if (!selectedObjectId) return;
    const draftObjectId = selectedTextDraftObjectIdRef.current;
    if (!draftObjectId || draftObjectId !== selectedObjectId) return;
    if (selectedTextDraftCommitTimerRef.current !== null) {
      window.clearTimeout(selectedTextDraftCommitTimerRef.current);
      selectedTextDraftCommitTimerRef.current = null;
    }
    const textValue = (draftOverride ?? selectedTextDraftValueRef.current).replace(
      /\r\n/g,
      "\n"
    );
    const selectedTextObject =
      boardObjectsRef.current.find((item) => item.id === selectedObjectId) ?? null;
    if (selectedTextObject?.type !== "text") return;
    const currentValue =
      typeof selectedTextObject.text === "string" ? selectedTextObject.text : "";
    if (currentValue === textValue) {
      selectedTextDraftDirtyRef.current = false;
      return;
    }
    await updateSelectedTextFormatting(
      { text: textValue },
      undefined,
      {
        trackHistory: options?.trackHistory ?? true,
        markDirty: true,
      }
    );
  }, [
    boardObjectsRef,
    selectedObjectId,
    selectedTextDraftCommitTimerRef,
    selectedTextDraftDirtyRef,
    selectedTextDraftObjectIdRef,
    selectedTextDraftValueRef,
    updateSelectedTextFormatting,
  ]);

  const scheduleSelectedTextDraftCommit = useCallback(
    (value: string) => {
      if (!selectedObjectId) return;
      const normalizedValue = value.replace(/\r\n/g, "\n");
      selectedTextDraftValueRef.current = normalizedValue;
      selectedTextDraftObjectIdRef.current = selectedObjectId;
      selectedTextDraftDirtyRef.current = true;
      if (selectedTextDraftCommitTimerRef.current !== null) {
        window.clearTimeout(selectedTextDraftCommitTimerRef.current);
      }
      const selectedTextObject =
        boardObjectsRef.current.find((item) => item.id === selectedObjectId) ?? null;
      const currentValue =
        selectedTextObject?.type === "text" && typeof selectedTextObject.text === "string"
          ? selectedTextObject.text
          : "";
      if (currentValue === normalizedValue) {
        selectedTextDraftDirtyRef.current = false;
        return;
      }
      applyLocalBoardObjects((current) =>
        applyWorkbookBoardObjectPatchById({
          objects: current,
          objectId: selectedObjectId,
          patch: { text: normalizedValue },
          index: boardObjectIndexByIdRef.current,
        }).nextObjects
      );
      selectedTextDraftCommitTimerRef.current = window.setTimeout(() => {
        void flushSelectedTextDraftCommit(normalizedValue, {
          trackHistory: false,
        });
      }, 180);
    },
    [
      applyLocalBoardObjects,
      boardObjectIndexByIdRef,
      boardObjectsRef,
      flushSelectedTextDraftCommit,
      selectedObjectId,
      selectedTextDraftCommitTimerRef,
      selectedTextDraftDirtyRef,
      selectedTextDraftObjectIdRef,
      selectedTextDraftValueRef,
    ]
  );

  const normalizeGraphExpressionDraft = useCallback(
    (id: string, rawExpression: string, selectedMode: boolean) => {
      const normalized = normalizeFunctionExpression(rawExpression);
      if (selectedMode) {
        setGraphFunctionsDraft((current) =>
          current.map((entry) =>
            entry.id === id ? { ...entry, expression: normalized } : entry
          )
        );
        return;
      }
      setGraphDraftFunctions((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, expression: normalized } : entry
        )
      );
    },
    [setGraphDraftFunctions, setGraphFunctionsDraft]
  );

  const commitSelectedGraphExpressions = useCallback(() => {
    const selectedGraphObject =
      selectedObjectId != null
        ? boardObjects.find((item) => item.id === selectedObjectId)
        : null;
    if (!selectedGraphObject || selectedGraphObject.type !== "function_graph") return;
    void commitSelectedFunctionGraphDraft(graphFunctionsDraft);
  }, [
    boardObjects,
    commitSelectedFunctionGraphDraft,
    graphFunctionsDraft,
    selectedObjectId,
  ]);

  return {
    updateSelectedLineMeta,
    updateSelectedObjectMeta,
    updateSelectedLineObject,
    updateSelectedFunctionGraphAppearance,
    appendSelectedGraphFunction,
    removeSelectedGraphFunction,
    updateSelectedGraphFunction,
    reflectGraphFunctionByAxis,
    updateSelectedTextFormatting,
    flushSelectedTextDraftCommit,
    scheduleSelectedTextDraftCommit,
    normalizeGraphExpressionDraft,
    commitSelectedGraphExpressions,
    commitSelectedLineEndpointLabel,
    commitSelectedLineWidth,
  };
};
