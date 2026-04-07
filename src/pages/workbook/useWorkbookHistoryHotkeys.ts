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
  historyActorUserId: string;
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
  historyActorUserId,
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
  applyHistoryOperations: _applyHistoryOperations,
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

  const toSafeHistoryActorUserId = useCallback((value: string | null | undefined) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized.length > 0 ? normalized : "unknown";
  }, []);

  const resolveCurrentActorUserId = useCallback(
    () => toSafeHistoryActorUserId(historyActorUserId),
    [historyActorUserId, toSafeHistoryActorUserId]
  );

  const resolveEntryPage = useCallback(
    (entry: HistoryEntryLike) => toSafePage(entry.page ?? currentBoardPage),
    [currentBoardPage, toSafePage]
  );

  const resolveEntryActorUserId = useCallback(
    (entry: HistoryEntryLike, actorUserId: string) =>
      toSafeHistoryActorUserId(entry.authorUserId ?? actorUserId),
    [toSafeHistoryActorUserId]
  );

  const countEntriesForPage = useCallback(
    (entries: HistoryEntryLike[], page: number, actorUserId: string) => {
      const safePage = toSafePage(page);
      const safeActorUserId = toSafeHistoryActorUserId(actorUserId);
      return entries.reduce((count, entry) => {
        const entryPage = resolveEntryPage(entry);
        const entryActorUserId = resolveEntryActorUserId(entry, safeActorUserId);
        return entryPage === safePage && entryActorUserId === safeActorUserId ? count + 1 : count;
      }, 0);
    },
    [resolveEntryActorUserId, resolveEntryPage, toSafeHistoryActorUserId, toSafePage]
  );

  const findLastEntryIndexForPage = useCallback(
    (entries: HistoryEntryLike[], page: number, actorUserId: string) => {
      const safePage = toSafePage(page);
      const safeActorUserId = toSafeHistoryActorUserId(actorUserId);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry) continue;
        const entryPage = resolveEntryPage(entry);
        const entryActorUserId = resolveEntryActorUserId(entry, safeActorUserId);
        if (entryPage === safePage && entryActorUserId === safeActorUserId) {
          return index;
        }
      }
      return -1;
    },
    [resolveEntryActorUserId, resolveEntryPage, toSafeHistoryActorUserId, toSafePage]
  );

  const handleUndo = useCallback(async () => {
    if (!canUseUndo || undoStackRef.current.length === 0) return;
    const currentActorUserId = resolveCurrentActorUserId();
    const targetIndex = findLastEntryIndexForPage(
      undoStackRef.current,
      currentBoardPage,
      currentActorUserId
    );
    if (targetIndex < 0) return;
    const entry = undoStackRef.current[targetIndex];
    if (!entry) return;
    const safePage = toSafePage(currentBoardPage);
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
      clearObjectSyncRuntime();
      clearStrokePreviewRuntime();
      clearIncomingEraserPreviewRuntime();
      undoStackRef.current = [
        ...undoStackRef.current.slice(0, targetIndex),
        ...undoStackRef.current.slice(targetIndex + 1),
      ];
      redoStackRef.current = [...redoStackRef.current, entry].slice(-80);
      setUndoDepth(countEntriesForPage(undoStackRef.current, safePage, currentActorUserId));
      setRedoDepth(countEntriesForPage(redoStackRef.current, safePage, currentActorUserId));
      markDirty();
    } catch {
      setError("Не удалось выполнить отмену действия.");
    }
  }, [
    appendEventsAndApply,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    countEntriesForPage,
    currentBoardPage,
    findLastEntryIndexForPage,
    resolveCurrentActorUserId,
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
    const currentActorUserId = resolveCurrentActorUserId();
    const targetIndex = findLastEntryIndexForPage(
      redoStackRef.current,
      currentBoardPage,
      currentActorUserId
    );
    if (targetIndex < 0) return;
    const entry = redoStackRef.current[targetIndex];
    if (!entry) return;
    const safePage = toSafePage(currentBoardPage);
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
      clearObjectSyncRuntime();
      clearStrokePreviewRuntime();
      clearIncomingEraserPreviewRuntime();
      redoStackRef.current = [
        ...redoStackRef.current.slice(0, targetIndex),
        ...redoStackRef.current.slice(targetIndex + 1),
      ];
      undoStackRef.current = [...undoStackRef.current, entry].slice(-80);
      setUndoDepth(countEntriesForPage(undoStackRef.current, safePage, currentActorUserId));
      setRedoDepth(countEntriesForPage(redoStackRef.current, safePage, currentActorUserId));
      markDirty();
    } catch {
      setError("Не удалось повторить действие.");
    }
  }, [
    appendEventsAndApply,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    countEntriesForPage,
    currentBoardPage,
    findLastEntryIndexForPage,
    resolveCurrentActorUserId,
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
    const currentActorUserId = resolveCurrentActorUserId();
    setUndoDepth(countEntriesForPage(undoStackRef.current, safePage, currentActorUserId));
    setRedoDepth(countEntriesForPage(redoStackRef.current, safePage, currentActorUserId));
  }, [
    countEntriesForPage,
    currentBoardPage,
    resolveCurrentActorUserId,
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
