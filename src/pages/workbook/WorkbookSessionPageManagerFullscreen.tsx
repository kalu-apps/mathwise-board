import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragCancelEvent, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { WorkbookBoardObject, WorkbookStroke } from "@/features/workbook/model/types";
import type { WorkbookBoardPageOption } from "./WorkbookSessionBoardSettingsPanel";
import type { WorkbookPagePreviewData } from "./useWorkbookPagePreviewMap";
import { useWorkbookPagePreviewMap } from "./useWorkbookPagePreviewMap";
import { WorkbookSessionPagePreview } from "./WorkbookSessionPagePreview";

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
  onReorderPages: (nextOrder: number[]) => void;
};

type PageCardPreviewProps = {
  pageOption: WorkbookBoardPageOption;
  pagePosition: number;
  isCurrent: boolean;
  previewData: WorkbookPagePreviewData | null;
  imageAssetUrls: Record<string, string>;
  boardBackgroundColor?: string;
  boardGridColor?: string;
  boardGridSize?: number;
};

type SortablePageCardProps = PageCardPreviewProps & {
  isDropTarget: boolean;
  isDragDisabled: boolean;
  isAnyDragActive: boolean;
  shouldSuppressClick: () => boolean;
  registerCardNode: (page: number, node: HTMLDivElement | null) => void;
  onActivate: (page: number) => void;
};

const toSafePageId = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
};

const areSameOrder = (left: number[], right: number[]) =>
  left.length === right.length && left.every((pageId, index) => pageId === right[index]);

const PageCardPreview = ({
  pageOption,
  pagePosition,
  isCurrent,
  previewData,
  imageAssetUrls,
  boardBackgroundColor,
  boardGridColor,
  boardGridSize,
}: PageCardPreviewProps) => (
  <div className="workbook-session__page-card-preview" aria-hidden="true">
    <WorkbookSessionPagePreview
      pageId={pageOption.page}
      previewData={previewData}
      imageAssetUrls={imageAssetUrls}
      backgroundColor={boardBackgroundColor}
      gridColor={boardGridColor}
      gridSize={boardGridSize}
    />
    <span className="workbook-session__page-card-number">#{pagePosition}</span>
    {isCurrent ? <span className="workbook-session__page-card-current">Текущая</span> : null}
  </div>
);

function SortablePageCard({
  pageOption,
  pagePosition,
  isCurrent,
  previewData,
  imageAssetUrls,
  boardBackgroundColor,
  boardGridColor,
  boardGridSize,
  isDropTarget,
  isDragDisabled,
  isAnyDragActive,
  shouldSuppressClick,
  registerCardNode,
  onActivate,
}: SortablePageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pageOption.page,
    disabled: isDragDisabled,
  });

  const handleCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      registerCardNode(pageOption.page, node);
    },
    [pageOption.page, registerCardNode, setNodeRef]
  );

  const style = useMemo<CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 2 : undefined,
    }),
    [isDragging, transform, transition]
  );

  return (
    <div
      {...attributes}
      {...listeners}
      data-page-id={pageOption.page}
      role="listitem"
      tabIndex={0}
      ref={handleCardRef}
      style={style}
      className={`workbook-session__page-card${isCurrent ? " is-current" : ""}${
        isDragging ? " is-dragging" : ""
      }${
        isDropTarget && !isDragging ? " is-drop-target" : ""
      }`}
      onClick={() => {
        if (isAnyDragActive || shouldSuppressClick()) return;
        onActivate(pageOption.page);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (isAnyDragActive || shouldSuppressClick()) return;
        onActivate(pageOption.page);
      }}
    >
      <PageCardPreview
        pageOption={pageOption}
        pagePosition={pagePosition}
        isCurrent={isCurrent}
        previewData={previewData}
        imageAssetUrls={imageAssetUrls}
        boardBackgroundColor={boardBackgroundColor}
        boardGridColor={boardGridColor}
        boardGridSize={boardGridSize}
      />
    </div>
  );
}

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
  onReorderPages,
}: WorkbookSessionPageManagerFullscreenProps) {
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const suppressCardClickUntilTsRef = useRef(0);
  const displayOrderPageIdsRef = useRef<number[]>([]);
  const [displayOrderPageIds, setDisplayOrderPageIds] = useState<number[]>([]);
  const [activeDragPageId, setActiveDragPageId] = useState<number | null>(null);
  const [overDragPageId, setOverDragPageId] = useState<number | null>(null);
  const [dragOverlaySize, setDragOverlaySize] = useState<{ width: number; height: number } | null>(
    null
  );

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 10,
      },
    })
  );

  useEffect(() => {
    if (activeDragPageId !== null) return;
    setDisplayOrderPageIds(orderedPageIds);
  }, [activeDragPageId, orderedPageIds]);

  useEffect(() => {
    displayOrderPageIdsRef.current = displayOrderPageIds;
  }, [displayOrderPageIds]);

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

  const registerCardNode = useCallback((page: number, node: HTMLDivElement | null) => {
    if (node) {
      cardRefs.current.set(page, node);
      return;
    }
    cardRefs.current.delete(page);
  }, []);

  const shouldSuppressClick = useCallback(
    () => Date.now() < suppressCardClickUntilTsRef.current,
    []
  );

  const handleActivatePage = useCallback(
    (page: number) => {
      onSelectPage(page);
      onClose();
    },
    [onClose, onSelectPage]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activePage = toSafePageId(event.active.id);
    if (activePage === null) return;
    const initialRect = event.active.rect.current.initial;
    setActiveDragPageId(activePage);
    setOverDragPageId(activePage);
    if (initialRect) {
      setDragOverlaySize({
        width: Math.max(1, Math.round(initialRect.width)),
        height: Math.max(1, Math.round(initialRect.height)),
      });
      return;
    }
    setDragOverlaySize(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const activePage = toSafePageId(event.active.id);
    const overPage = toSafePageId(event.over?.id);
    if (activePage === null || overPage === null) {
      setOverDragPageId(null);
      return;
    }
    setOverDragPageId(overPage);
    if (activePage === overPage) return;
    setDisplayOrderPageIds((current) => {
      const oldIndex = current.indexOf(activePage);
      const newIndex = current.indexOf(overPage);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, []);

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      setActiveDragPageId(null);
      setOverDragPageId(null);
      setDragOverlaySize(null);
      setDisplayOrderPageIds(orderedPageIds);
    },
    [orderedPageIds]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const nextOrder = displayOrderPageIdsRef.current;
      const didReorder = !areSameOrder(nextOrder, orderedPageIds);
      const canPersistReorder =
        didReorder &&
        nextOrder.length === orderedPageIds.length &&
        nextOrder.every((pageId) => orderedPageIds.includes(pageId));

      if (canPersistReorder) {
        suppressCardClickUntilTsRef.current = Date.now() + 320;
        onReorderPages([...nextOrder]);
      } else {
        setDisplayOrderPageIds(orderedPageIds);
      }

      setActiveDragPageId(null);
      setOverDragPageId(null);
      setDragOverlaySize(null);
    },
    [onReorderPages, orderedPageIds]
  );

  const activeDragOption =
    activeDragPageId !== null ? (pageOptionByPage.get(activeDragPageId) ?? null) : null;
  const activeDragPosition =
    activeDragPageId !== null
      ? Math.max(1, displayOrderPageIdsRef.current.indexOf(activeDragPageId) + 1)
      : 1;
  const activeDragPreviewData =
    activeDragOption ? (pagePreviewMap.get(activeDragOption.page) ?? null) : null;

  return (
    <Dialog
      open={open}
      fullScreen
      container={overlayContainer}
      className="workbook-session__page-manager"
      onClose={onClose}
    >
      <DialogTitle className="workbook-session__page-manager-head">
        <div className="workbook-session__page-manager-title-wrap">
          <h2>Менеджер страниц</h2>
        </div>
        <IconButton
          onClick={onClose}
          className="workbook-session__page-manager-close"
          aria-label="Закрыть менеджер страниц"
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className="workbook-session__page-manager-content">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={displayOrderPageIds} strategy={rectSortingStrategy}>
            <div
              className="workbook-session__page-manager-grid"
              role="list"
              aria-label="Страницы сессии"
            >
              {displayOrderPageIds.map((pageId, orderIndex) => {
                const option = pageOptionByPage.get(pageId);
                if (!option) return null;
                return (
                  <SortablePageCard
                    key={option.page}
                    pageOption={option}
                    pagePosition={orderIndex + 1}
                    isCurrent={option.page === currentPage}
                    previewData={pagePreviewMap.get(option.page) ?? null}
                    imageAssetUrls={imageAssetUrls}
                    boardBackgroundColor={boardBackgroundColor}
                    boardGridColor={boardGridColor}
                    boardGridSize={boardGridSize}
                    isDropTarget={
                      overDragPageId === option.page && activeDragPageId !== option.page
                    }
                    isDragDisabled={!canManageBoardPages || isBoardPageMutationPending}
                    isAnyDragActive={activeDragPageId !== null}
                    shouldSuppressClick={shouldSuppressClick}
                    registerCardNode={registerCardNode}
                    onActivate={handleActivatePage}
                  />
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={{
              duration: 190,
              easing: "cubic-bezier(0.2, 0, 0, 1)",
            }}
          >
            {activeDragOption ? (
              <div
                className="workbook-session__page-card is-dragging is-overlay"
                style={
                  dragOverlaySize
                    ? {
                        width: `${dragOverlaySize.width}px`,
                        height: `${dragOverlaySize.height}px`,
                      }
                    : undefined
                }
              >
                <PageCardPreview
                  pageOption={activeDragOption}
                  pagePosition={activeDragPosition}
                  isCurrent={activeDragOption.page === currentPage}
                  previewData={activeDragPreviewData}
                  imageAssetUrls={imageAssetUrls}
                  boardBackgroundColor={boardBackgroundColor}
                  boardGridColor={boardGridColor}
                  boardGridSize={boardGridSize}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </DialogContent>
    </Dialog>
  );
}
