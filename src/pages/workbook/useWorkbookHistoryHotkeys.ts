import { useCallback, useEffect, type MutableRefObject } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookTool } from "@/features/workbook/model/types";

type HistoryEntryLike = {
  inverse: unknown[];
  forward: unknown[];
};

type UseWorkbookHistoryHotkeysParams = {
  canUseUndo: boolean;
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
  const handleUndo = useCallback(async () => {
    if (!canUseUndo || undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    if (!entry) return;
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, entry].slice(-80);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
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
      setError("Не удалось выполнить отмену действия.");
    }
  }, [
    appendEventsAndApply,
    applyHistoryOperations,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    markDirty,
    redoStackRef,
    setError,
    setRedoDepth,
    setUndoDepth,
    undoStackRef,
  ]);

  const handleRedo = useCallback(async () => {
    if (!canUseUndo || redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    if (!entry) return;
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, entry].slice(-80);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
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
      setError("Не удалось повторить действие.");
    }
  }, [
    appendEventsAndApply,
    applyHistoryOperations,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    markDirty,
    redoStackRef,
    setError,
    setRedoDepth,
    setUndoDepth,
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
