import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { buildWorkbookBoardObjectIndex } from "@/features/workbook/model/boardObjectStore";
import {
  isHistoryTrackedWorkbookEventType,
  type WorkbookClientEventInput,
} from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookEvent,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import {
  clampBoardObjectToPageFrame,
} from "./WorkbookSessionPage.core";
import { normalizeWorkbookPageFrameWidth } from "@/features/workbook/model/pageFrame";
import {
  normalizeWorkbookBoardPageVisualSettingsByPage,
  resolveWorkbookBoardPageVisualDefaults,
} from "@/features/workbook/model/boardPageSettings";
import {
  type WorkbookHistoryEntry,
  type WorkbookSceneSnapshot,
  normalizeSceneLayersForBoard,
} from "./WorkbookSessionPage.geometry";
import { buildWorkbookHistoryEntryFromEvents } from "./workbookSessionHistoryEntry";

const isPlainSerializableObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const areSerializableValuesStructurallyEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null) return left === right;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!areSerializableValuesStructurallyEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }
  if (!isPlainSerializableObject(left) || !isPlainSerializableObject(right)) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) return false;
    if (!areSerializableValuesStructurallyEqual(left[leftKey], right[rightKey])) {
      return false;
    }
  }
  return true;
};

type UseWorkbookSessionHistoryRuntimeParams = {
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardObjectIndexByIdRef: MutableRefObject<Map<string, number>>;
  setBoardStrokes: Dispatch<SetStateAction<WorkbookStroke[]>>;
  setBoardObjects: Dispatch<SetStateAction<WorkbookBoardObject[]>>;
  setConstraints: Dispatch<SetStateAction<WorkbookConstraint[]>>;
  setAnnotationStrokes: Dispatch<SetStateAction<WorkbookStroke[]>>;
  setChatMessages: Dispatch<SetStateAction<unknown[]>>;
  setComments: Dispatch<SetStateAction<unknown[]>>;
  setTimerState: Dispatch<SetStateAction<unknown>>;
  setBoardSettings: Dispatch<SetStateAction<WorkbookBoardSettings>>;
  setLibraryState: Dispatch<SetStateAction<unknown>>;
  setDocumentState: Dispatch<SetStateAction<WorkbookDocumentState>>;
  autosaveDebounceRef: MutableRefObject<number | null>;
  persistSnapshotsRef: MutableRefObject<
    ((options?: { silent?: boolean; force?: boolean }) => Promise<boolean>) | null
  >;
  dirtyRef: MutableRefObject<boolean>;
  dirtyRevisionRef: MutableRefObject<number>;
  pendingAutosaveAfterSaveRef: MutableRefObject<boolean>;
  setSaveState: Dispatch<SetStateAction<"idle" | "saving" | "error">>;
  undoStackRef: MutableRefObject<WorkbookHistoryEntry[]>;
  redoStackRef: MutableRefObject<WorkbookHistoryEntry[]>;
  setUndoDepth: Dispatch<SetStateAction<number>>;
  setRedoDepth: Dispatch<SetStateAction<number>>;
  currentBoardPageRef: MutableRefObject<number>;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  constraintsRef: MutableRefObject<WorkbookConstraint[]>;
  boardSettingsRef: MutableRefObject<WorkbookBoardSettings>;
  documentStateRef: MutableRefObject<WorkbookDocumentState>;
};

export const useWorkbookSessionHistoryRuntime = ({
  boardObjectsRef,
  boardObjectIndexByIdRef,
  setBoardStrokes,
  setBoardObjects,
  setConstraints,
  setAnnotationStrokes,
  setChatMessages,
  setComments,
  setTimerState,
  setBoardSettings,
  setLibraryState,
  setDocumentState,
  autosaveDebounceRef,
  persistSnapshotsRef,
  dirtyRef,
  dirtyRevisionRef,
  pendingAutosaveAfterSaveRef,
  setSaveState,
  undoStackRef,
  redoStackRef,
  setUndoDepth,
  setRedoDepth,
  currentBoardPageRef,
  boardStrokesRef,
  annotationStrokesRef,
  constraintsRef,
  boardSettingsRef,
  documentStateRef,
}: UseWorkbookSessionHistoryRuntimeParams) => {
  const toSafePage = useCallback(
    (value: number | null | undefined) => Math.max(1, Math.round(value || 1)),
    []
  );

  const resolveEntryPage = useCallback(
    (entry: WorkbookHistoryEntry) => toSafePage(entry.page ?? currentBoardPageRef.current),
    [currentBoardPageRef, toSafePage]
  );

  const countEntriesForPage = useCallback(
    (entries: WorkbookHistoryEntry[], page: number) => {
      const safePage = toSafePage(page);
      return entries.reduce((count, entry) => {
        const entryPage = resolveEntryPage(entry);
        return entryPage === safePage ? count + 1 : count;
      }, 0);
    },
    [resolveEntryPage, toSafePage]
  );

  const findLastEntryIndexForPage = useCallback(
    (entries: WorkbookHistoryEntry[], page: number) => {
      const safePage = toSafePage(page);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry) continue;
        if (resolveEntryPage(entry) === safePage) {
          return index;
        }
      }
      return -1;
    },
    [resolveEntryPage, toSafePage]
  );

  const restoreSceneSnapshot = useCallback((snapshot: WorkbookSceneSnapshot) => {
    const normalizedBoardObjects = snapshot.boardObjects.map((object) =>
      clampBoardObjectToPageFrame(object, snapshot.boardSettings.pageFrameWidth)
    );
    setBoardStrokes(snapshot.boardStrokes);
    boardObjectsRef.current = normalizedBoardObjects;
    boardObjectIndexByIdRef.current = buildWorkbookBoardObjectIndex(normalizedBoardObjects);
    setBoardObjects(normalizedBoardObjects);
    setConstraints(snapshot.constraints);
    setAnnotationStrokes(snapshot.annotationStrokes);
    setChatMessages(snapshot.chatMessages);
    setComments(snapshot.comments);
    setTimerState(snapshot.timerState);
    setBoardSettings((current) => {
      const next = normalizeSceneLayersForBoard(
        snapshot.boardSettings.sceneLayers,
        snapshot.boardSettings.activeSceneLayerId
      );
      const normalizedSettings: WorkbookBoardSettings = {
        ...current,
        ...snapshot.boardSettings,
        pageFrameWidth: normalizeWorkbookPageFrameWidth(snapshot.boardSettings.pageFrameWidth),
        sceneLayers: next.sceneLayers,
        activeSceneLayerId: next.activeSceneLayerId,
      };
      const fallbackPageVisual = resolveWorkbookBoardPageVisualDefaults(normalizedSettings);
      normalizedSettings.pageBoardSettingsByPage =
        normalizeWorkbookBoardPageVisualSettingsByPage(
          snapshot.boardSettings.pageBoardSettingsByPage,
          fallbackPageVisual
        );
      return normalizedSettings;
    });
    setLibraryState(snapshot.libraryState);
    setDocumentState(snapshot.documentState);
  }, [
    boardObjectIndexByIdRef,
    boardObjectsRef,
    setAnnotationStrokes,
    setBoardObjects,
    setBoardSettings,
    setBoardStrokes,
    setChatMessages,
    setComments,
    setConstraints,
    setDocumentState,
    setLibraryState,
    setTimerState,
  ]);

  const scheduleAutosave = useCallback((delayMs = 1100) => {
    if (autosaveDebounceRef.current !== null) {
      window.clearTimeout(autosaveDebounceRef.current);
      autosaveDebounceRef.current = null;
    }
    autosaveDebounceRef.current = window.setTimeout(() => {
      autosaveDebounceRef.current = null;
      void persistSnapshotsRef.current?.({ force: true });
    }, Math.max(200, delayMs));
  }, [autosaveDebounceRef, persistSnapshotsRef]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    dirtyRevisionRef.current += 1;
    pendingAutosaveAfterSaveRef.current = true;
    setSaveState("saving");
    scheduleAutosave();
  }, [
    dirtyRef,
    dirtyRevisionRef,
    pendingAutosaveAfterSaveRef,
    scheduleAutosave,
    setSaveState,
  ]);

  const pushHistoryEntry = useCallback(
    (entry: WorkbookHistoryEntry, options?: { clearRedo?: boolean }) => {
      const safeEntryPage = toSafePage(entry.page ?? currentBoardPageRef.current);
      const shouldClearRedo = options?.clearRedo !== false;
      const nextUndo = [
        ...undoStackRef.current,
        {
          ...entry,
          page: safeEntryPage,
        },
      ];
      undoStackRef.current = nextUndo.slice(-80);
      if (shouldClearRedo) {
        redoStackRef.current = [];
      }
      const activePage = toSafePage(currentBoardPageRef.current);
      setUndoDepth(countEntriesForPage(undoStackRef.current, activePage));
      setRedoDepth(countEntriesForPage(redoStackRef.current, activePage));
    },
    [
      countEntriesForPage,
      currentBoardPageRef,
      redoStackRef,
      setRedoDepth,
      setUndoDepth,
      toSafePage,
      undoStackRef,
    ]
  );

  const findMatchingEntryIndexForPage = useCallback(
    (
      entries: WorkbookHistoryEntry[],
      page: number,
      operations: unknown[] | null,
      mode: "undo" | "redo"
    ) => {
      const fallbackIndex = findLastEntryIndexForPage(entries, page);
      if (!operations || operations.length === 0) {
        return fallbackIndex;
      }
      const safePage = toSafePage(page);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry) continue;
        if (resolveEntryPage(entry) !== safePage) continue;
        const expectedOperations = mode === "undo" ? entry.inverse : entry.forward;
        if (areSerializableValuesStructurallyEqual(expectedOperations, operations)) {
          return index;
        }
      }
      return fallbackIndex;
    },
    [findLastEntryIndexForPage, resolveEntryPage, toSafePage]
  );

  const syncHistoryStacksFromIncomingUndoRedoEvent = useCallback(
    (event: WorkbookEvent) => {
      if (event.type !== "board.undo" && event.type !== "board.redo") return;
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as { operations?: unknown; page?: unknown })
          : {};
      const targetPage =
        typeof payload.page === "number" && Number.isFinite(payload.page)
          ? toSafePage(payload.page)
          : toSafePage(currentBoardPageRef.current);
      const operations = Array.isArray(payload.operations) ? payload.operations : null;
      if (event.type === "board.undo") {
        const targetIndex = findMatchingEntryIndexForPage(
          undoStackRef.current,
          targetPage,
          operations,
          "undo"
        );
        if (targetIndex < 0) return;
        const entry = undoStackRef.current[targetIndex];
        if (!entry) return;
        undoStackRef.current = [
          ...undoStackRef.current.slice(0, targetIndex),
          ...undoStackRef.current.slice(targetIndex + 1),
        ];
        redoStackRef.current = [...redoStackRef.current, entry].slice(-80);
      } else {
        const targetIndex = findMatchingEntryIndexForPage(
          redoStackRef.current,
          targetPage,
          operations,
          "redo"
        );
        if (targetIndex < 0) return;
        const entry = redoStackRef.current[targetIndex];
        if (!entry) return;
        redoStackRef.current = [
          ...redoStackRef.current.slice(0, targetIndex),
          ...redoStackRef.current.slice(targetIndex + 1),
        ];
        undoStackRef.current = [...undoStackRef.current, entry].slice(-80);
      }
      const activePage = toSafePage(currentBoardPageRef.current);
      setUndoDepth(countEntriesForPage(undoStackRef.current, activePage));
      setRedoDepth(countEntriesForPage(redoStackRef.current, activePage));
    },
    [
      countEntriesForPage,
      currentBoardPageRef,
      findMatchingEntryIndexForPage,
      redoStackRef,
      setRedoDepth,
      setUndoDepth,
      toSafePage,
      undoStackRef,
    ]
  );

  const rollbackHistoryEntry = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    const activePage = toSafePage(currentBoardPageRef.current);
    setUndoDepth(countEntriesForPage(undoStackRef.current, activePage));
  }, [
    countEntriesForPage,
    currentBoardPageRef,
    setUndoDepth,
    toSafePage,
    undoStackRef,
  ]);

  const buildHistoryEntryFromEvents = useCallback(
    (events: WorkbookClientEventInput[]) => {
      const historyEntry = buildWorkbookHistoryEntryFromEvents({
        events,
        currentBoardStrokes: boardStrokesRef.current,
        currentAnnotationStrokes: annotationStrokesRef.current,
        currentObjects: boardObjectsRef.current,
        currentConstraints: constraintsRef.current,
        currentBoardSettings: boardSettingsRef.current,
        currentDocumentState: documentStateRef.current,
      });
      if (!historyEntry) return null;
      const historyEntryPage =
        typeof historyEntry.page === "number" && Number.isFinite(historyEntry.page)
          ? historyEntry.page
          : currentBoardPageRef.current;
      return {
        ...historyEntry,
        page: toSafePage(historyEntryPage),
      };
    },
    [
      annotationStrokesRef,
      boardObjectsRef,
      boardSettingsRef,
      boardStrokesRef,
      constraintsRef,
      currentBoardPageRef,
      documentStateRef,
      toSafePage,
    ]
  );

  const pushIncomingHistoryEntryFromEvent = useCallback(
    (event: WorkbookEvent, localUserId?: string) => {
      if (!isHistoryTrackedWorkbookEventType(event.type)) return;
      if (localUserId && event.authorUserId === localUserId) return;
      const historyEvent = {
        type: event.type,
        payload: event.payload,
      } as WorkbookClientEventInput;
      const entry = buildHistoryEntryFromEvents([historyEvent]);
      if (!entry) return;
      pushHistoryEntry(entry, { clearRedo: true });
    },
    [buildHistoryEntryFromEvents, pushHistoryEntry]
  );

  return {
    restoreSceneSnapshot,
    scheduleAutosave,
    markDirty,
    pushHistoryEntry,
    rollbackHistoryEntry,
    buildHistoryEntryFromEvents,
    pushIncomingHistoryEntryFromEvent,
    syncHistoryStacksFromIncomingUndoRedoEvent,
  };
};
