import { useCallback, useEffect, type MutableRefObject } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookTool } from "@/features/workbook/model/types";

type HistoryEntryLike = {
  inverse: unknown[];
  forward: unknown[];
  page?: number;
  authorUserId?: string;
};

type UseWorkbookHistoryHotkeysParams = {
  canUseUndo: boolean;
  currentBoardPage: number;
  tool: WorkbookTool;
  areaSelectionHasContent: boolean;
  appendEventsAndApply: (
    events: WorkbookClientEventInput[],
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
      historyEntry?: unknown;
    }
  ) => Promise<void>;
  setError: (value: string | null) => void;
  undoStackRef: MutableRefObject<HistoryEntryLike[]>;
  redoStackRef: MutableRefObject<HistoryEntryLike[]>;
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: () => void;
  clearIncomingEraserPreviewRuntime: () => void;
  setUndoDepth: (value: number) => void;
  setRedoDepth: (value: number) => void;
  applyHistoryOperations: (operations: unknown[]) => void;
  markDirty: () => void;
  deleteAreaSelectionObjects: () => void | Promise<void>;
  copyAreaSelectionObjects: () => void | Promise<void>;
  cutAreaSelectionObjects: () => void | Promise<void>;
  pasteAreaSelectionObjects: () => void | Promise<void>;
};

export const useWorkbookHistoryHotkeys = ({
  canUseUndo,
  currentBoardPage,
  tool,
  areaSelectionHasContent,
  appendEventsAndApply,
  setError,
  undoStackRef,
  redoStackRef,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  setUndoDepth,
  setRedoDepth,
  applyHistoryOperations,
  markDirty,
  deleteAreaSelectionObjects,
  copyAreaSelectionObjects,
  cutAreaSelectionObjects,
  pasteAreaSelectionObjects,
}: UseWorkbookHistoryHotkeysParams) => {
  const toSafePage = useCallback(
    (value: number | null | undefined) => Math.max(1, Math.round(value || 1)),
    []
  );

  const resolveEntryPage = useCallback(
    (entry: HistoryEntryLike) => toSafePage(entry.page ?? currentBoardPage),
    [currentBoardPage, toSafePage]
  );

  const countEntriesForPage = useCallback(
    (entries: HistoryEntryLike[], page: number) => {
      const safePage = toSafePage(page);
      return entries.reduce((count, entry) => {
        const entryPage = resolveEntryPage(entry);
        return entryPage === safePage ? count + 1 : count;
      }, 0);
    },
    [resolveEntryPage, toSafePage]
  );

  const findLastEntryIndexForPage = useCallback(
    (entries: HistoryEntryLike[], page: number) => {
      const safePage = toSafePage(page);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry) continue;
        const entryPage = resolveEntryPage(entry);
        if (entryPage === safePage) {
          return index;
        }
      }
      return -1;
    },
    [resolveEntryPage, toSafePage]
  );

  const handleUndo = useCallback(async () => {
    if (!canUseUndo || undoStackRef.current.length === 0) return;
    const targetIndex = findLastEntryIndexForPage(undoStackRef.current, currentBoardPage);
    if (targetIndex < 0) return;
    const entry = undoStackRef.current[targetIndex];
    if (!entry) return;
    const safePage = toSafePage(currentBoardPage);
    const previousUndoStack = undoStackRef.current;
    const previousRedoStack = redoStackRef.current;
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    undoStackRef.current = [
      ...undoStackRef.current.slice(0, targetIndex),
      ...undoStackRef.current.slice(targetIndex + 1),
    ];
    redoStackRef.current = [...redoStackRef.current, entry].slice(-80);
    setUndoDepth(countEntriesForPage(undoStackRef.current, safePage));
    setRedoDepth(countEntriesForPage(redoStackRef.current, safePage));
    applyHistoryOperations(entry.inverse);
    markDirty();
    try {
      await appendEventsAndApply(
        [
          {
            type: "board.undo",
            payload: {
              operations: entry.inverse,
            },
          },
        ],
        { trackHistory: false, markDirty: false }
      );
    } catch {
      applyHistoryOperations(entry.forward);
      undoStackRef.current = previousUndoStack;
      redoStackRef.current = previousRedoStack;
      setUndoDepth(countEntriesForPage(previousUndoStack, safePage));
      setRedoDepth(countEntriesForPage(previousRedoStack, safePage));
      setError("Не удалось выполнить отмену действия.");
    }
  }, [
    appendEventsAndApply,
    applyHistoryOperations,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    countEntriesForPage,
    currentBoardPage,
    findLastEntryIndexForPage,
    markDirty,
    redoStackRef,
    setError,
    setRedoDepth,
    setUndoDepth,
    toSafePage,
    undoStackRef,
  ]);

  const handleRedo = useCallback(async () => {
    if (!canUseUndo || redoStackRef.current.length === 0) return;
    const targetIndex = findLastEntryIndexForPage(redoStackRef.current, currentBoardPage);
    if (targetIndex < 0) return;
    const entry = redoStackRef.current[targetIndex];
    if (!entry) return;
    const safePage = toSafePage(currentBoardPage);
    const previousUndoStack = undoStackRef.current;
    const previousRedoStack = redoStackRef.current;
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    redoStackRef.current = [
      ...redoStackRef.current.slice(0, targetIndex),
      ...redoStackRef.current.slice(targetIndex + 1),
    ];
    undoStackRef.current = [...undoStackRef.current, entry].slice(-80);
    setUndoDepth(countEntriesForPage(undoStackRef.current, safePage));
    setRedoDepth(countEntriesForPage(redoStackRef.current, safePage));
    applyHistoryOperations(entry.forward);
    markDirty();
    try {
      await appendEventsAndApply(
        [
          {
            type: "board.redo",
            payload: {
              operations: entry.forward,
            },
          },
        ],
        { trackHistory: false, markDirty: false }
      );
    } catch {
      applyHistoryOperations(entry.inverse);
      undoStackRef.current = previousUndoStack;
      redoStackRef.current = previousRedoStack;
      setUndoDepth(countEntriesForPage(previousUndoStack, safePage));
      setRedoDepth(countEntriesForPage(previousRedoStack, safePage));
      setError("Не удалось повторить действие.");
    }
  }, [
    appendEventsAndApply,
    applyHistoryOperations,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    countEntriesForPage,
    currentBoardPage,
    findLastEntryIndexForPage,
    markDirty,
    redoStackRef,
    setError,
    setRedoDepth,
    setUndoDepth,
    toSafePage,
    undoStackRef,
  ]);

  useEffect(() => {
    const safePage = toSafePage(currentBoardPage);
    setUndoDepth(countEntriesForPage(undoStackRef.current, safePage));
    setRedoDepth(countEntriesForPage(redoStackRef.current, safePage));
  }, [
    countEntriesForPage,
    currentBoardPage,
    redoStackRef,
    setRedoDepth,
    setUndoDepth,
    toSafePage,
    undoStackRef,
  ]);

  useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
      );
      if (isTypingTarget) return;
      const withModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (
        tool === "area_select" &&
        areaSelectionHasContent &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        void deleteAreaSelectionObjects();
        return;
      }

      if (tool === "area_select" && withModifier && key === "c") {
        event.preventDefault();
        void copyAreaSelectionObjects();
        return;
      }

      if (tool === "area_select" && withModifier && key === "x") {
        event.preventDefault();
        void cutAreaSelectionObjects();
        return;
      }

      if (tool === "area_select" && withModifier && key === "v") {
        event.preventDefault();
        void pasteAreaSelectionObjects();
        return;
      }

      if (!withModifier) return;
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (key === "z" && event.shiftKey) {
        void handleRedo();
        return;
      }
      if (key === "z") {
        void handleUndo();
        return;
      }
      if (key === "y") {
        void handleRedo();
      }
    };

    window.addEventListener("keydown", onHotkey);
    return () => window.removeEventListener("keydown", onHotkey);
  }, [
    areaSelectionHasContent,
    copyAreaSelectionObjects,
    cutAreaSelectionObjects,
    deleteAreaSelectionObjects,
    handleRedo,
    handleUndo,
    pasteAreaSelectionObjects,
    tool,
  ]);

  return {
    handleUndo,
    handleRedo,
  };
};
