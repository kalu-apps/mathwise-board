import { useCallback, type MutableRefObject } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import {
  extractWorkbookBoardPageVisualSettingsPatch,
  normalizeWorkbookBoardPageVisualSettings,
  normalizeWorkbookBoardPageVisualSettingsByPage,
  remapWorkbookBoardPageVisualSettingsByPageAfterDelete,
  resolveWorkbookBoardPageVisualDefaults,
  resolveWorkbookBoardPageVisualSettings,
} from "@/features/workbook/model/boardPageSettings";
import { normalizeWorkbookPageFrameWidth } from "@/features/workbook/model/pageFrame";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";
import {
  buildBoardSettingsDiffPatch,
  cloneSerializable,
  normalizeWorkbookPageOrder,
  normalizeWorkbookPageTitles,
  resolveMaxKnownWorkbookPage,
  toSafeWorkbookPage,
} from "./WorkbookSessionPage.core";
import { normalizeSceneLayersForBoard, type WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

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

type UseWorkbookBoardSettingsPagesParams = {
  canManageSharedBoardSettings: boolean;
  canDelete: boolean;
  isBoardPageMutationPending: boolean;
  currentBoardPage: number;
  appendEventsAndApply: AppendEventsAndApply;
  boardSettingsRef: MutableRefObject<WorkbookBoardSettings>;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  queuedBoardSettingsCommitRef: MutableRefObject<WorkbookBoardSettings | null>;
  queuedBoardSettingsHistoryBeforeRef: MutableRefObject<WorkbookBoardSettings | null>;
  boardSettingsCommitTimerRef: MutableRefObject<number | null>;
  boardSettingsCommitInFlightRef: MutableRefObject<boolean>;
  setBoardSettings: SetState<WorkbookBoardSettings>;
  setError: (value: string | null) => void;
  setIsBoardPageMutationPending: SetState<boolean>;
};

const isBoardSettingsPageNavigationPatch = (
  patch: Partial<WorkbookBoardSettings> | null
) => {
  if (!patch) return false;
  const changedKeys = Object.keys(patch);
  return changedKeys.length === 1 && changedKeys[0] === "currentPage";
};

export const useWorkbookBoardSettingsPages = ({
  canManageSharedBoardSettings,
  canDelete,
  isBoardPageMutationPending,
  currentBoardPage,
  appendEventsAndApply,
  boardSettingsRef,
  boardObjectsRef,
  boardStrokesRef,
  annotationStrokesRef,
  queuedBoardSettingsCommitRef,
  queuedBoardSettingsHistoryBeforeRef,
  boardSettingsCommitTimerRef,
  boardSettingsCommitInFlightRef,
  setBoardSettings,
  setError,
  setIsBoardPageMutationPending,
}: UseWorkbookBoardSettingsPagesParams) => {
  const flushQueuedBoardSettingsCommit = useCallback(async () => {
    if (!canManageSharedBoardSettings || boardSettingsCommitInFlightRef.current) return;
    const nextSettings = queuedBoardSettingsCommitRef.current;
    if (!nextSettings) return;
    const historyBefore = queuedBoardSettingsHistoryBeforeRef.current;
    const forwardPatch = historyBefore
      ? buildBoardSettingsDiffPatch(historyBefore, nextSettings)
      : null;
    const inversePatch = historyBefore
      ? buildBoardSettingsDiffPatch(nextSettings, historyBefore)
      : null;
    const historyEntry: WorkbookHistoryEntry | null =
      forwardPatch && inversePatch
        ? {
            forward: [{ kind: "patch_board_settings", patch: forwardPatch }],
            inverse: [{ kind: "patch_board_settings", patch: inversePatch }],
            page: toSafeWorkbookPage(currentBoardPage),
            createdAt: new Date().toISOString(),
          }
        : null;
    const isNavigationOnlyCommit = isBoardSettingsPageNavigationPatch(forwardPatch);
    let deferNavigationRetry = false;
    queuedBoardSettingsCommitRef.current = null;
    boardSettingsCommitInFlightRef.current = true;
    try {
      const persistEvents: WorkbookClientEventInput[] = [
        {
          type: "board.settings.update",
          payload: {
            boardSettings: nextSettings,
          },
        },
      ];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await appendEventsAndApply(persistEvents, {
            historyEntry,
            markDirty: !isNavigationOnlyCommit,
          });
          break;
        } catch (error) {
          const isConflict =
            error instanceof ApiError &&
            error.code === "conflict" &&
            error.status === 409;
          if (isConflict && attempt < 2) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, 170 * (attempt + 1));
            });
            continue;
          }
          if (isRecoverableApiError(error) && attempt < 2) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, 220 * (attempt + 1));
            });
            continue;
          }
          throw error;
        }
      }
      queuedBoardSettingsHistoryBeforeRef.current = null;
    } catch {
      if (historyBefore && !isNavigationOnlyCommit) {
        boardSettingsRef.current = historyBefore;
        setBoardSettings(historyBefore);
      }
      if (!isNavigationOnlyCommit) {
        setError("Не удалось сохранить настройки доски.");
      } else if (typeof window !== "undefined") {
        deferNavigationRetry = true;
        queuedBoardSettingsCommitRef.current = nextSettings;
        if (boardSettingsCommitTimerRef.current !== null) {
          window.clearTimeout(boardSettingsCommitTimerRef.current);
        }
        boardSettingsCommitTimerRef.current = window.setTimeout(() => {
          boardSettingsCommitTimerRef.current = null;
          void flushQueuedBoardSettingsCommit();
        }, 600);
      }
    } finally {
      boardSettingsCommitInFlightRef.current = false;
      if (queuedBoardSettingsCommitRef.current && !deferNavigationRetry) {
        void flushQueuedBoardSettingsCommit();
      }
    }
  }, [
    appendEventsAndApply,
    boardSettingsRef,
    boardSettingsCommitInFlightRef,
    boardSettingsCommitTimerRef,
    canManageSharedBoardSettings,
    currentBoardPage,
    queuedBoardSettingsCommitRef,
    queuedBoardSettingsHistoryBeforeRef,
    setBoardSettings,
    setError,
  ]);

  const scheduleBoardSettingsCommit = useCallback(
    (nextSettings: WorkbookBoardSettings) => {
      if (!canManageSharedBoardSettings || typeof window === "undefined") return;
      queuedBoardSettingsCommitRef.current = nextSettings;
      if (boardSettingsCommitTimerRef.current !== null) {
        window.clearTimeout(boardSettingsCommitTimerRef.current);
      }
      boardSettingsCommitTimerRef.current = window.setTimeout(() => {
        boardSettingsCommitTimerRef.current = null;
        void flushQueuedBoardSettingsCommit();
      }, 220);
    },
    [
      boardSettingsCommitTimerRef,
      canManageSharedBoardSettings,
      flushQueuedBoardSettingsCommit,
      queuedBoardSettingsCommitRef,
    ]
  );

  const handleSharedBoardSettingsChange = useCallback(
    (patch: Partial<WorkbookBoardSettings>) => {
      if (!canManageSharedBoardSettings || isBoardPageMutationPending) return;
      setBoardSettings((current) => {
        if (!queuedBoardSettingsHistoryBeforeRef.current) {
          queuedBoardSettingsHistoryBeforeRef.current = cloneSerializable(current);
        }
        const pageVisualPatch = extractWorkbookBoardPageVisualSettingsPatch(patch);
        const hasPageVisualPatch = Object.keys(pageVisualPatch).length > 0;
        const merged: WorkbookBoardSettings = {
          ...current,
          ...patch,
        };
        if (hasPageVisualPatch) {
          const targetPage = toSafeWorkbookPage(currentBoardPage);
          const currentPageVisualSettings = resolveWorkbookBoardPageVisualSettings(
            current,
            targetPage
          );
          const nextPageVisualSettings = normalizeWorkbookBoardPageVisualSettings(
            {
              ...currentPageVisualSettings,
              ...pageVisualPatch,
            },
            currentPageVisualSettings
          );
          merged.pageBoardSettingsByPage = {
            ...(current.pageBoardSettingsByPage ?? {}),
            [String(targetPage)]: nextPageVisualSettings,
          };
          // Keep root defaults stable; page-specific values are stored in pageBoardSettingsByPage.
          merged.showGrid = current.showGrid;
          merged.gridSize = current.gridSize;
          merged.gridColor = current.gridColor;
          merged.backgroundColor = current.backgroundColor;
          merged.snapToGrid = current.snapToGrid;
        }
        const normalizedLayers = normalizeSceneLayersForBoard(
          merged.sceneLayers,
          merged.activeSceneLayerId
        );
        const nextPagesCount = Math.max(1, Math.round(merged.pagesCount || 1));
        const maxKnownPage = resolveMaxKnownWorkbookPage({
          pagesCount: nextPagesCount,
          boardObjects: boardObjectsRef.current,
          boardStrokes: boardStrokesRef.current,
          annotationStrokes: annotationStrokesRef.current,
        });
        const safePagesCount = Math.max(nextPagesCount, maxKnownPage);
        const normalizedPageOrder = normalizeWorkbookPageOrder(
          merged.pageOrder,
          safePagesCount
        );
        const normalizedPageTitles = normalizeWorkbookPageTitles(
          merged.pageTitles,
          safePagesCount
        );
        const nextSettings: WorkbookBoardSettings = {
          ...merged,
          sceneLayers: normalizedLayers.sceneLayers,
          activeSceneLayerId: normalizedLayers.activeSceneLayerId,
          title: typeof merged.title === "string" ? merged.title : current.title,
          gridSize: Math.max(
            8,
            Math.min(96, Math.round(merged.gridSize || current.gridSize))
          ),
          currentPage: Math.max(
            1,
            Math.min(
              safePagesCount,
              Math.round(merged.currentPage || current.currentPage || 1)
            )
          ),
          pagesCount: safePagesCount,
          pageOrder: normalizedPageOrder,
          pageTitles: normalizedPageTitles,
          pageFrameWidth: normalizeWorkbookPageFrameWidth(
            merged.pageFrameWidth ?? current.pageFrameWidth
          ),
          dividerStep: Math.max(
            320,
            Math.min(2400, Math.round(merged.dividerStep || current.dividerStep || 320))
          ),
        };
        const fallbackPageVisualSettings =
          resolveWorkbookBoardPageVisualDefaults(nextSettings);
        nextSettings.pageBoardSettingsByPage =
          normalizeWorkbookBoardPageVisualSettingsByPage(
            merged.pageBoardSettingsByPage,
            fallbackPageVisualSettings,
            safePagesCount
          );
        scheduleBoardSettingsCommit(nextSettings);
        return nextSettings;
      });
    },
    [
      annotationStrokesRef,
      boardObjectsRef,
      boardStrokesRef,
      canManageSharedBoardSettings,
      currentBoardPage,
      isBoardPageMutationPending,
      queuedBoardSettingsHistoryBeforeRef,
      scheduleBoardSettingsCommit,
      setBoardSettings,
    ]
  );

  const handleSelectBoardPage = useCallback(
    (page: number) => {
      if (!canManageSharedBoardSettings || isBoardPageMutationPending) return;
      const maxKnownPage = resolveMaxKnownWorkbookPage({
        pagesCount: boardSettingsRef.current.pagesCount,
        boardObjects: boardObjectsRef.current,
        boardStrokes: boardStrokesRef.current,
        annotationStrokes: annotationStrokesRef.current,
      });
      const pageOrder = normalizeWorkbookPageOrder(boardSettingsRef.current.pageOrder, maxKnownPage);
      const safeNextPage = Math.min(maxKnownPage, toSafeWorkbookPage(page));
      if (!pageOrder.includes(safeNextPage)) return;
      const currentPage = toSafeWorkbookPage(boardSettingsRef.current.currentPage);
      if (safeNextPage === currentPage) return;
      handleSharedBoardSettingsChange({
        currentPage: safeNextPage,
        pagesCount: Math.max(
          toSafeWorkbookPage(boardSettingsRef.current.pagesCount),
          safeNextPage
        ),
      });
    },
    [
      annotationStrokesRef,
      boardObjectsRef,
      boardSettingsRef,
      boardStrokesRef,
      canManageSharedBoardSettings,
      handleSharedBoardSettingsChange,
      isBoardPageMutationPending,
    ]
  );

  const handleRenameBoardPage = useCallback(
    (page: number, title: string) => {
      if (!canManageSharedBoardSettings || isBoardPageMutationPending) return;
      const maxKnownPage = resolveMaxKnownWorkbookPage({
        pagesCount: boardSettingsRef.current.pagesCount,
        boardObjects: boardObjectsRef.current,
        boardStrokes: boardStrokesRef.current,
        annotationStrokes: annotationStrokesRef.current,
      });
      const safePage = Math.min(maxKnownPage, toSafeWorkbookPage(page));
      const normalizedTitles = normalizeWorkbookPageTitles(
        boardSettingsRef.current.pageTitles,
        maxKnownPage
      );
      const nextTitle = title.trim().slice(0, 96);
      const currentTitle = (normalizedTitles[String(safePage)] ?? "").trim();
      if (nextTitle === currentTitle) return;
      if (nextTitle.length > 0) {
        normalizedTitles[String(safePage)] = nextTitle;
      } else {
        delete normalizedTitles[String(safePage)];
      }
      handleSharedBoardSettingsChange({
        pageTitles: normalizedTitles,
      });
    },
    [
      annotationStrokesRef,
      boardObjectsRef,
      boardSettingsRef,
      boardStrokesRef,
      canManageSharedBoardSettings,
      handleSharedBoardSettingsChange,
      isBoardPageMutationPending,
    ]
  );

  const handleReorderBoardPages = useCallback(
    (nextOrder: number[]) => {
      if (!canManageSharedBoardSettings || isBoardPageMutationPending) return;
      const maxKnownPage = resolveMaxKnownWorkbookPage({
        pagesCount: boardSettingsRef.current.pagesCount,
        boardObjects: boardObjectsRef.current,
        boardStrokes: boardStrokesRef.current,
        annotationStrokes: annotationStrokesRef.current,
      });
      const currentOrder = normalizeWorkbookPageOrder(boardSettingsRef.current.pageOrder, maxKnownPage);
      const normalizedNextOrder = normalizeWorkbookPageOrder(nextOrder, maxKnownPage);
      if (
        currentOrder.length === normalizedNextOrder.length
        && currentOrder.every((pageId, index) => pageId === normalizedNextOrder[index])
      ) {
        return;
      }
      const currentPage = toSafeWorkbookPage(boardSettingsRef.current.currentPage);
      const safeCurrentPage = normalizedNextOrder.includes(currentPage)
        ? currentPage
        : normalizedNextOrder[0] ?? 1;
      handleSharedBoardSettingsChange({
        pageOrder: normalizedNextOrder,
        currentPage: safeCurrentPage,
        pagesCount: Math.max(toSafeWorkbookPage(boardSettingsRef.current.pagesCount), maxKnownPage),
      });
    },
    [
      annotationStrokesRef,
      boardObjectsRef,
      boardSettingsRef,
      boardStrokesRef,
      canManageSharedBoardSettings,
      handleSharedBoardSettingsChange,
      isBoardPageMutationPending,
    ]
  );

  const handleAddBoardPage = useCallback(() => {
    if (!canManageSharedBoardSettings || isBoardPageMutationPending) return false;
    const maxKnownPage = resolveMaxKnownWorkbookPage({
      pagesCount: boardSettingsRef.current.pagesCount,
      boardObjects: boardObjectsRef.current,
      boardStrokes: boardStrokesRef.current,
      annotationStrokes: annotationStrokesRef.current,
    });
    const nextPage = maxKnownPage + 1;
    const fallbackPageVisualSettings = resolveWorkbookBoardPageVisualDefaults(
      boardSettingsRef.current
    );
    const nextPageVisualSettings = normalizeWorkbookBoardPageVisualSettings(
      {
        ...fallbackPageVisualSettings,
        showGrid: true,
      },
      fallbackPageVisualSettings
    );
    const currentOrder = normalizeWorkbookPageOrder(boardSettingsRef.current.pageOrder, maxKnownPage);
    handleSharedBoardSettingsChange({
      pagesCount: nextPage,
      currentPage: nextPage,
      pageOrder: [...currentOrder, nextPage],
      pageBoardSettingsByPage: {
        ...(boardSettingsRef.current.pageBoardSettingsByPage ?? {}),
        [String(nextPage)]: nextPageVisualSettings,
      },
    });
    return true;
  }, [
    annotationStrokesRef,
    boardObjectsRef,
    boardSettingsRef,
    boardStrokesRef,
    canManageSharedBoardSettings,
    handleSharedBoardSettingsChange,
    isBoardPageMutationPending,
  ]);

  const handleDeleteBoardPage = useCallback(
    async (targetPage: number) => {
      if (!canManageSharedBoardSettings || !canDelete || isBoardPageMutationPending) return false;
      if (boardSettingsCommitInFlightRef.current) {
        setError("Дождитесь завершения синхронизации настроек и повторите попытку.");
        return false;
      }

      const boardSettingsSnapshot = boardSettingsRef.current;
      const boardObjectsSnapshot = cloneSerializable(boardObjectsRef.current);
      const boardStrokesSnapshot = cloneSerializable(boardStrokesRef.current);
      const annotationStrokesSnapshot = cloneSerializable(annotationStrokesRef.current);
      const maxKnownPage = resolveMaxKnownWorkbookPage({
        pagesCount: boardSettingsSnapshot.pagesCount,
        boardObjects: boardObjectsSnapshot,
        boardStrokes: boardStrokesSnapshot,
        annotationStrokes: annotationStrokesSnapshot,
      });

      if (maxKnownPage <= 1) {
        setError("Нельзя удалить единственную страницу доски.");
        return false;
      }

      const safeTargetPage = Math.min(maxKnownPage, toSafeWorkbookPage(targetPage));
      setIsBoardPageMutationPending(true);
      try {
        if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
          window.clearTimeout(boardSettingsCommitTimerRef.current);
          boardSettingsCommitTimerRef.current = null;
        }
        if (queuedBoardSettingsCommitRef.current) {
          await flushQueuedBoardSettingsCommit();
        }

        const events: WorkbookClientEventInput[] = [];
        boardObjectsSnapshot.forEach((object) => {
          const page = toSafeWorkbookPage(object.page);
          if (page === safeTargetPage) {
            events.push({
              type: "board.object.delete",
              payload: { objectId: object.id },
            });
            return;
          }
          if (page > safeTargetPage) {
            events.push({
              type: "board.object.update",
              payload: {
                objectId: object.id,
                patch: { page: page - 1 },
              },
            });
          }
        });

        boardStrokesSnapshot.forEach((stroke) => {
          const page = toSafeWorkbookPage(stroke.page);
          if (page === safeTargetPage) {
            events.push({
              type: "board.stroke.delete",
              payload: { strokeId: stroke.id },
            });
            return;
          }
          if (page > safeTargetPage) {
            events.push({
              type: "board.stroke.delete",
              payload: { strokeId: stroke.id },
            });
            events.push({
              type: "board.stroke",
              payload: {
                stroke: {
                  ...stroke,
                  page: page - 1,
                },
              },
            });
          }
        });

        annotationStrokesSnapshot.forEach((stroke) => {
          const page = toSafeWorkbookPage(stroke.page);
          if (page === safeTargetPage) {
            events.push({
              type: "annotations.stroke.delete",
              payload: { strokeId: stroke.id },
            });
            return;
          }
          if (page > safeTargetPage) {
            events.push({
              type: "annotations.stroke.delete",
              payload: { strokeId: stroke.id },
            });
            events.push({
              type: "annotations.stroke",
              payload: {
                stroke: {
                  ...stroke,
                  page: page - 1,
                },
              },
            });
          }
        });

        const nextPagesCount = Math.max(1, maxKnownPage - 1);
        const currentPage = toSafeWorkbookPage(boardSettingsSnapshot.currentPage);
        const nextCurrentPage =
          currentPage > safeTargetPage
            ? currentPage - 1
            : Math.min(currentPage, nextPagesCount);
        const currentPageOrder = normalizeWorkbookPageOrder(
          boardSettingsSnapshot.pageOrder,
          maxKnownPage
        );
        const nextPageOrder = normalizeWorkbookPageOrder(
          currentPageOrder
            .filter((pageId) => pageId !== safeTargetPage)
            .map((pageId) => (pageId > safeTargetPage ? pageId - 1 : pageId)),
          nextPagesCount
        );
        const nextPageTitles = normalizeWorkbookPageTitles(
          boardSettingsSnapshot.pageTitles,
          maxKnownPage
        );
        const shiftedPageTitles: Record<string, string> = {};
        Object.entries(nextPageTitles).forEach(([key, value]) => {
          const parsedPage = Number.parseInt(key, 10);
          if (!Number.isFinite(parsedPage) || parsedPage === safeTargetPage) return;
          const shiftedPage = parsedPage > safeTargetPage ? parsedPage - 1 : parsedPage;
          shiftedPageTitles[String(shiftedPage)] = value;
        });
        const fallbackPageVisualSettings =
          resolveWorkbookBoardPageVisualDefaults(boardSettingsSnapshot);
        const shiftedPageBoardSettingsByPage =
          remapWorkbookBoardPageVisualSettingsByPageAfterDelete({
            source: boardSettingsSnapshot.pageBoardSettingsByPage,
            targetPage: safeTargetPage,
            fallback: fallbackPageVisualSettings,
            maxKnownPage: nextPagesCount,
          });
        events.push({
          type: "board.settings.update",
          payload: {
            boardSettings: {
              pagesCount: nextPagesCount,
              currentPage: nextCurrentPage,
              pageOrder: nextPageOrder,
              pageTitles: shiftedPageTitles,
              pageBoardSettingsByPage: shiftedPageBoardSettingsByPage,
            },
          },
        });

        await appendEventsAndApply(events);
        return true;
      } catch {
        setError("Не удалось удалить страницу доски.");
        return false;
      } finally {
        setIsBoardPageMutationPending(false);
      }
    },
    [
      annotationStrokesRef,
      appendEventsAndApply,
      boardObjectsRef,
      boardSettingsCommitInFlightRef,
      boardSettingsCommitTimerRef,
      boardSettingsRef,
      boardStrokesRef,
      canDelete,
      canManageSharedBoardSettings,
      flushQueuedBoardSettingsCommit,
      isBoardPageMutationPending,
      queuedBoardSettingsCommitRef,
      setError,
      setIsBoardPageMutationPending,
    ]
  );

  return {
    handleSharedBoardSettingsChange,
    handleSelectBoardPage,
    handleRenameBoardPage,
    handleReorderBoardPages,
    handleAddBoardPage,
    handleDeleteBoardPage,
  };
};
