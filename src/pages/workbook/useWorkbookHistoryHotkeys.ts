import { useCallback, useEffect, type MutableRefObject } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookTool } from "@/features/workbook/model/types";
import type { WorkbookHistoryOperation } from "./WorkbookSessionPage.geometry";

type HistoryEntryLike = {
  inverse: WorkbookHistoryOperation[];
  forward: WorkbookHistoryOperation[];
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
  clearLocalPreviewPatchRuntime: () => void;
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: () => void;
  clearIncomingEraserPreviewRuntime: () => void;
  setUndoDepth: (value: number) => void;
  setRedoDepth: (value: number) => void;
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
  clearLocalPreviewPatchRuntime,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  setUndoDepth,
  setRedoDepth,
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

  const handleUndo = useCallback(async () => {
    if (!canUseUndo || undoStackRef.current.length === 0) return;
    const safePage = toSafePage(currentBoardPage);
    if (countEntriesForPage(undoStackRef.current, safePage) <= 0) return;
    clearLocalPreviewPatchRuntime();
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    try {
      await appendEventsAndApply(
        [
          {
            type: "board.undo",
            payload: {
              page: safePage,
            },
          },
        ],
        { trackHistory: false, markDirty: false }
      );
    } catch {
      setError("Не удалось выполнить отмену действия.");
    }
  }, [
    appendEventsAndApply,
    canUseUndo,
    clearLocalPreviewPatchRuntime,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    countEntriesForPage,
    currentBoardPage,
    setError,
    toSafePage,
    undoStackRef,
  ]);

  const handleRedo = useCallback(async () => {
    if (!canUseUndo || redoStackRef.current.length === 0) return;
    const safePage = toSafePage(currentBoardPage);
    if (countEntriesForPage(redoStackRef.current, safePage) <= 0) return;
    clearLocalPreviewPatchRuntime();
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    try {
      await appendEventsAndApply(
        [
          {
            type: "board.redo",
            payload: {
              page: safePage,
            },
          },
        ],
        { trackHistory: false, markDirty: false }
      );
    } catch {
      setError("Не удалось повторить действие.");
    }
  }, [
    appendEventsAndApply,
    canUseUndo,
    clearLocalPreviewPatchRuntime,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    countEntriesForPage,
    currentBoardPage,
    redoStackRef,
    setError,
    toSafePage,
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
