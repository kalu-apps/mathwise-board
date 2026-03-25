import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import type { WorkbookBoardPageOption } from "./WorkbookSessionBoardSettingsPanel";

type WorkbookSessionPageManagerFullscreenProps = {
  open: boolean;
  overlayContainer?: Element | null;
  pageOptions: WorkbookBoardPageOption[];
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
  currentPage,
  canManageBoardPages,
  isBoardPageMutationPending,
  onClose,
  onSelectPage,
  onRenamePage,
  onReorderPages,
}: WorkbookSessionPageManagerFullscreenProps) {
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [dragPageId, setDragPageId] = useState<number | null>(null);
  const [titleDraftByPage, setTitleDraftByPage] = useState<Record<number, string>>({});

  const orderedPageIds = useMemo(() => pageOptions.map((option) => option.page), [pageOptions]);

  useEffect(() => {
    if (!open) return;
    setTitleDraftByPage(
      Object.fromEntries(pageOptions.map((option) => [option.page, option.title])) as Record<number, string>
    );
  }, [open, pageOptions]);

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

  const commitTitle = (page: number) => {
    const nextTitle = sanitizePageTitle(titleDraftByPage[page] ?? "");
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
  };

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
          <p>Быстрый переход, rename и reorder страниц сессии.</p>
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
        <div className="workbook-session__page-manager-grid" role="list" aria-label="Страницы сессии">
          {pageOptions.map((option) => {
            const isCurrent = option.page === currentPage;
            const titleDraft = titleDraftByPage[option.page] ?? option.title;
            const previewIntensity = Math.max(
              1,
              option.preview.objectCount + option.preview.strokeCount + option.preview.annotationCount
            );
            const previewRows = Math.min(4, Math.max(1, Math.round(Math.log2(previewIntensity + 1))));
            return (
              <div
                key={option.page}
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
                }`}
                onClick={() => {
                  onSelectPage(option.page);
                  onClose();
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSelectPage(option.page);
                  onClose();
                }}
                draggable={canManageBoardPages && !isBoardPageMutationPending}
                onDragStart={(event) => {
                  if (!canManageBoardPages || isBoardPageMutationPending) return;
                  setDragPageId(option.page);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(option.page));
                }}
                onDragEnd={() => setDragPageId(null)}
                onDragOver={(event) => {
                  if (!canManageBoardPages || isBoardPageMutationPending) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  if (!canManageBoardPages || isBoardPageMutationPending) return;
                  event.preventDefault();
                  const rawSourcePage =
                    event.dataTransfer.getData("text/plain") ||
                    (typeof dragPageId === "number" ? String(dragPageId) : "");
                  const sourcePage = Number.parseInt(rawSourcePage, 10);
                  if (!Number.isFinite(sourcePage)) {
                    setDragPageId(null);
                    return;
                  }
                  const nextOrder = reorderPages(orderedPageIds, sourcePage, option.page);
                  setDragPageId(null);
                  onReorderPages(nextOrder);
                }}
              >
                <div className="workbook-session__page-card-preview" aria-hidden="true">
                  {option.preview.imageUrl ? (
                    <img src={option.preview.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="workbook-session__page-card-preview-fallback">
                      {Array.from({ length: previewRows }, (_, index) => (
                        <span
                          key={`${option.page}-preview-${index}`}
                          style={{ width: `${62 + ((index + option.page) % 4) * 9}%` }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="workbook-session__page-card-number">#{option.position}</span>
                  {isCurrent ? (
                    <span className="workbook-session__page-card-current">
                      <CheckCircleRoundedIcon fontSize="inherit" />
                      Текущая
                    </span>
                  ) : null}
                </div>
                <div
                  className="workbook-session__page-card-meta"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="workbook-session__page-card-drag-row">
                    <Tooltip title="Перетащите для изменения порядка" placement="top" arrow>
                      <span className="workbook-session__page-card-drag-icon" aria-hidden="true">
                        <DragIndicatorRoundedIcon fontSize="inherit" />
                      </span>
                    </Tooltip>
                    <span className="workbook-session__page-card-content-hint">
                      {option.hasContent ? "Есть контент" : "Пустая"}
                    </span>
                  </div>
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
                    }}
                    onBlur={() => commitTitle(option.page)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setTitleDraftByPage((current) => ({
                          ...current,
                          [option.page]: option.title,
                        }));
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder={`Страница ${option.position}`}
                    aria-label={`Название страницы ${option.position}`}
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
