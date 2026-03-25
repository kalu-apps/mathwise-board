import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { WorkbookBoardPageOption } from "./WorkbookSessionBoardSettingsPanel";
import type {
  WorkbookBoardObject,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import { WorkbookSessionPagePreview } from "./WorkbookSessionPagePreview";
import { useWorkbookPagePreviewMap } from "./useWorkbookPagePreviewMap";

type WorkbookSessionPageManagerFullscreenProps = {
  open: boolean;
  overlayContainer?: Element | null;
  pageOptions: WorkbookBoardPageOption[];
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  imageAssetUrls: Record<string, string>;
  boardBackgroundColor?: string;
  boardGridColor?: string;
  boardGridSize?: number;
  currentPage: number;
  canManageBoardPages: boolean;
  isBoardPageMutationPending: boolean;
  onClose: () => void;
  onSelectPage: (page: number) => void;
  onRenamePage: (page: number, title: string) => void;
  onReorderPages: (nextOrder: number[]) => void;
};

const reorderPages = (pages: number[], sourcePage: number, targetPage: number) => {
  if (sourcePage === targetPage) return pages;
  const sourceIndex = pages.indexOf(sourcePage);
  const targetIndex = pages.indexOf(targetPage);
  if (sourceIndex < 0 || targetIndex < 0) return pages;
  const next = [...pages];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const sanitizePageTitle = (title: string) => title.trim().slice(0, 96);

export function WorkbookSessionPageManagerFullscreen({
  open,
  overlayContainer,
  pageOptions,
  boardObjects,
  boardStrokes,
  annotationStrokes,
  imageAssetUrls,
  boardBackgroundColor,
  boardGridColor,
  boardGridSize,
  currentPage,
  canManageBoardPages,
  isBoardPageMutationPending,
  onClose,
  onSelectPage,
  onRenamePage,
  onReorderPages,
}: WorkbookSessionPageManagerFullscreenProps) {
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const suppressCardClickUntilTsRef = useRef(0);
  const renameAutosaveTimersRef = useRef<Map<number, number>>(new Map());
  const displayOrderPageIdsRef = useRef<number[]>([]);
  const pointerDragStateRef = useRef<{
    pointerId: number;
    sourcePage: number;
    startX: number;
    startY: number;
    active: boolean;
    targetPage: number | null;
  } | null>(null);
  const [dragPageId, setDragPageId] = useState<number | null>(null);
  const [dragTargetPageId, setDragTargetPageId] = useState<number | null>(null);
  const [titleDraftByPage, setTitleDraftByPage] = useState<Record<number, string>>({});
  const [displayOrderPageIds, setDisplayOrderPageIds] = useState<number[]>([]);

  const orderedPageIds = useMemo(() => pageOptions.map((option) => option.page), [pageOptions]);
  const pageOptionByPage = useMemo(
    () => new Map(pageOptions.map((option) => [option.page, option])),
    [pageOptions]
  );
  const pagePreviewMap = useWorkbookPagePreviewMap({
    pageOptions,
    boardObjects,
    boardStrokes,
    annotationStrokes,
  });

  const clearRenameAutosaveTimer = useCallback((page: number) => {
    const currentTimerId = renameAutosaveTimersRef.current.get(page);
    if (!currentTimerId) return;
    window.clearTimeout(currentTimerId);
    renameAutosaveTimersRef.current.delete(page);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTitleDraftByPage(
      Object.fromEntries(pageOptions.map((option) => [option.page, option.title])) as Record<number, string>
    );
  }, [open, pageOptions]);

  useEffect(() => {
    if (dragPageId !== null) return;
    setDisplayOrderPageIds(orderedPageIds);
  }, [dragPageId, orderedPageIds]);

  useEffect(() => {
    displayOrderPageIdsRef.current = displayOrderPageIds;
  }, [displayOrderPageIds]);

  useEffect(
    () => () => {
      renameAutosaveTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      renameAutosaveTimersRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const targetCard = cardRefs.current.get(currentPage);
    if (!targetCard) return;
    const rafId = window.requestAnimationFrame(() => {
      targetCard.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [currentPage, open, pageOptions]);

  const commitTitle = useCallback((page: number, draftOverride?: string) => {
    const nextTitle = sanitizePageTitle(draftOverride ?? titleDraftByPage[page] ?? "");
    const currentOption = pageOptions.find((option) => option.page === page);
    const currentTitle = sanitizePageTitle(currentOption?.title ?? "");
    if (nextTitle.length === 0) {
      onRenamePage(page, "");
      setTitleDraftByPage((current) => ({
        ...current,
        [page]: currentOption?.title ?? "",
      }));
      return;
    }
    if (nextTitle === currentTitle) return;
    onRenamePage(page, nextTitle);
  }, [onRenamePage, pageOptions, titleDraftByPage]);

  const flushPendingTitleDrafts = useCallback(() => {
    renameAutosaveTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    renameAutosaveTimersRef.current.clear();
    pageOptions.forEach((option) => {
      const nextTitle = sanitizePageTitle(titleDraftByPage[option.page] ?? option.title);
      const currentTitle = sanitizePageTitle(option.title);
      if (nextTitle === currentTitle) return;
      onRenamePage(option.page, nextTitle);
    });
  }, [onRenamePage, pageOptions, titleDraftByPage]);

  const handleCloseWithPersist = useCallback(() => {
    flushPendingTitleDrafts();
    onClose();
  }, [flushPendingTitleDrafts, onClose]);

  const queueRenameAutosave = useCallback((page: number, draft: string) => {
    clearRenameAutosaveTimer(page);
    const timerId = window.setTimeout(() => {
      renameAutosaveTimersRef.current.delete(page);
      commitTitle(page, draft);
    }, 360);
    renameAutosaveTimersRef.current.set(page, timerId);
  }, [clearRenameAutosaveTimer, commitTitle]);

  const clearPointerDragState = useCallback(() => {
    pointerDragStateRef.current = null;
    setDragPageId(null);
    setDragTargetPageId(null);
  }, []);

  const resolveDropTargetPage = useCallback((x: number, y: number) => {
    if (typeof document === "undefined") return null;
    const targetElement = document.elementFromPoint(x, y) as HTMLElement | null;
    const cardElement = targetElement?.closest<HTMLElement>(".workbook-session__page-card[data-page-id]");
    if (!cardElement) return null;
    const pageId = Number.parseInt(cardElement.dataset.pageId ?? "", 10);
    return Number.isFinite(pageId) ? pageId : null;
  }, []);

  const handleCardPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, sourcePage: number) => {
      if (!canManageBoardPages || isBoardPageMutationPending) return;
      if (event.button !== 0) return;
      pointerDragStateRef.current = {
        pointerId: event.pointerId,
        sourcePage,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        targetPage: null,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canManageBoardPages, isBoardPageMutationPending]
  );

  const handleCardPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = pointerDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
      if (!dragState.active && distance < 6) return;
      if (!dragState.active) {
        dragState.active = true;
        setDragPageId(dragState.sourcePage);
      }
      const dropTargetPage = resolveDropTargetPage(event.clientX, event.clientY);
      dragState.targetPage = dropTargetPage;
      setDragTargetPageId(dropTargetPage);
      if (
        Number.isFinite(dropTargetPage) &&
        typeof dropTargetPage === "number" &&
        dropTargetPage !== dragState.sourcePage
      ) {
        setDisplayOrderPageIds((current) => {
          const next = reorderPages(current, dragState.sourcePage, dropTargetPage);
          if (
            current.length === next.length &&
            current.every((pageId, index) => pageId === next[index])
          ) {
            return current;
          }
          return next;
        });
      }
      event.preventDefault();
    },
    [resolveDropTargetPage]
  );

  const handleCardPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = pointerDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const sourcePage = dragState.sourcePage;
      const targetPage =
        dragState.targetPage ?? resolveDropTargetPage(event.clientX, event.clientY);
      const wasActiveDrag = dragState.active;
      clearPointerDragState();
      if (!wasActiveDrag) return;
      suppressCardClickUntilTsRef.current = Date.now() + 320;
      const currentDisplayOrder = displayOrderPageIdsRef.current;
      const nextOrder =
        Number.isFinite(targetPage) && targetPage !== sourcePage
          ? reorderPages(currentDisplayOrder, sourcePage, targetPage as number)
          : currentDisplayOrder;
      if (
        orderedPageIds.length === nextOrder.length &&
        orderedPageIds.every((pageId, index) => pageId === nextOrder[index])
      ) {
        return;
      }
      onReorderPages(nextOrder);
    },
    [clearPointerDragState, onReorderPages, orderedPageIds, resolveDropTargetPage]
  );

  return (
    <Dialog
      open={open}
      fullScreen
      container={overlayContainer}
      className="workbook-session__page-manager"
      onClose={handleCloseWithPersist}
    >
      <DialogTitle className="workbook-session__page-manager-head">
        <div className="workbook-session__page-manager-title-wrap">
          <h2>Менеджер страниц</h2>
        </div>
        <IconButton
          onClick={handleCloseWithPersist}
          className="workbook-session__page-manager-close"
          aria-label="Закрыть менеджер страниц"
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className="workbook-session__page-manager-content">
        <div className="workbook-session__page-manager-grid" role="list" aria-label="Страницы сессии">
          {displayOrderPageIds.map((pageId, orderIndex) => {
            const option = pageOptionByPage.get(pageId);
            if (!option) return null;
            const isCurrent = option.page === currentPage;
            const titleDraft = titleDraftByPage[option.page] ?? option.title;
            const currentPosition = orderIndex + 1;
            return (
              <div
                key={option.page}
                data-page-id={option.page}
                role="listitem"
                tabIndex={0}
                ref={(node) => {
                  if (node) {
                    cardRefs.current.set(option.page, node);
                  } else {
                    cardRefs.current.delete(option.page);
                  }
                }}
                className={`workbook-session__page-card${isCurrent ? " is-current" : ""}${
                  dragPageId === option.page ? " is-dragging" : ""
                }${
                  dragTargetPageId === option.page && dragPageId !== option.page ? " is-drop-target" : ""
                }`}
                onClick={() => {
                  if (Date.now() < suppressCardClickUntilTsRef.current) return;
                  flushPendingTitleDrafts();
                  onSelectPage(option.page);
                  onClose();
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  flushPendingTitleDrafts();
                  onSelectPage(option.page);
                  onClose();
                }}
                onPointerDown={(event) => handleCardPointerDown(event, option.page)}
                onPointerMove={handleCardPointerMove}
                onPointerUp={handleCardPointerUp}
                onPointerCancel={clearPointerDragState}
              >
                <div className="workbook-session__page-card-preview" aria-hidden="true">
                  <WorkbookSessionPagePreview
                    pageId={option.page}
                    previewData={pagePreviewMap.get(option.page) ?? null}
                    imageAssetUrls={imageAssetUrls}
                    backgroundColor={boardBackgroundColor}
                    gridColor={boardGridColor}
                    gridSize={boardGridSize}
                  />
                  <span className="workbook-session__page-card-number">#{currentPosition}</span>
                  {isCurrent ? (
                    <span className="workbook-session__page-card-current">
                      Текущая
                    </span>
                  ) : null}
                </div>
                <div
                  className="workbook-session__page-card-meta"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <input
                    type="text"
                    className="workbook-session__page-card-title-input"
                    value={titleDraft}
                    onChange={(event) => {
                      const nextTitle = event.target.value.slice(0, 96);
                      setTitleDraftByPage((current) => ({
                        ...current,
                        [option.page]: nextTitle,
                      }));
                      queueRenameAutosave(option.page, nextTitle);
                    }}
                    onBlur={() => {
                      clearRenameAutosaveTimer(option.page);
                      commitTitle(option.page);
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        clearRenameAutosaveTimer(option.page);
                        setTitleDraftByPage((current) => ({
                          ...current,
                          [option.page]: option.title,
                        }));
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder={`Страница ${currentPosition}`}
                    aria-label={`Название страницы ${currentPosition}`}
                    disabled={!canManageBoardPages || isBoardPageMutationPending}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
