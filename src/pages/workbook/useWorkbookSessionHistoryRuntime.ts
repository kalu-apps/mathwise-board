import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { buildWorkbookBoardObjectIndex } from "@/features/workbook/model/boardObjectStore";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
  WorkbookDocumentState,
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

  const countEntriesForPage = useCallback(
    (entries: WorkbookHistoryEntry[], page: number) => {
      const safePage = toSafePage(page);
      return entries.reduce((count, entry) => {
        const entryPage = toSafePage(entry.page);
        return entryPage === safePage ? count + 1 : count;
      }, 0);
    },
    [toSafePage]
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

  const pushHistoryEntry = useCallback((entry: WorkbookHistoryEntry) => {
    const nextUndo = [
      ...undoStackRef.current,
      {
        ...entry,
        page: toSafePage(entry.page ?? currentBoardPageRef.current),
      },
    ];
    undoStackRef.current = nextUndo.slice(-80);
    redoStackRef.current = [];
    const activePage = toSafePage(currentBoardPageRef.current);
    setUndoDepth(countEntriesForPage(undoStackRef.current, activePage));
    setRedoDepth(0);
  }, [
    countEntriesForPage,
    currentBoardPageRef,
    redoStackRef,
    setRedoDepth,
    setUndoDepth,
    toSafePage,
    undoStackRef,
  ]);

  const rollbackHistoryEntry = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    const activePage = toSafePage(currentBoardPageRef.current);
    setUndoDepth(countEntriesForPage(undoStackRef.current, activePage));
  }, [countEntriesForPage, currentBoardPageRef, setUndoDepth, toSafePage, undoStackRef]);

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
      return {
        ...historyEntry,
        page: toSafePage(currentBoardPageRef.current),
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

  return {
    restoreSceneSnapshot,
    scheduleAutosave,
    markDirty,
    pushHistoryEntry,
    rollbackHistoryEntry,
    buildHistoryEntryFromEvents,
  };
};
