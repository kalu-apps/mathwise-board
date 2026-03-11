import { memo } from "react";
import { Button, IconButton } from "@mui/material";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import FilterCenterFocusRoundedIcon from "@mui/icons-material/FilterCenterFocusRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import type { WorkbookDocumentAsset } from "@/features/workbook/model/types";

type WorkbookSessionDocsWindowProps = {
  pinned: boolean;
  maximized: boolean;
  canInsertImage: boolean;
  uploadingDoc: boolean;
  uploadProgress: number;
  assets: WorkbookDocumentAsset[];
  activeAssetId: string | null;
  activeDocument?: WorkbookDocumentAsset;
  page: number;
  zoom: number;
  activeDocumentPageCount: number;
  annotationsCount: number;
  onTogglePinned: () => void;
  onToggleMaximized: () => void;
  onClose: () => void;
  onRequestUpload: () => void;
  onSnapshotToBoard: () => void;
  onAddAnnotation: () => void;
  onClearAnnotations: () => void;
  onSelectAsset: (assetId: string) => void;
  onChangePage: (page: number) => void;
  onChangeZoom: (zoom: number) => void;
};

export const WorkbookSessionDocsWindow = memo(function WorkbookSessionDocsWindow({
  pinned,
  maximized,
  canInsertImage,
  uploadingDoc,
  uploadProgress,
  assets,
  activeAssetId,
  activeDocument,
  page,
  zoom,
  activeDocumentPageCount,
  annotationsCount,
  onTogglePinned,
  onToggleMaximized,
  onClose,
  onRequestUpload,
  onSnapshotToBoard,
  onAddAnnotation,
  onClearAnnotations,
  onSelectAsset,
  onChangePage,
  onChangeZoom,
}: WorkbookSessionDocsWindowProps) {
  const activeDocumentImageUrl =
    activeDocument?.type === "pdf"
      ? activeDocument.renderedPages?.find((item) => item.page === page)?.imageUrl ??
        activeDocument.renderedPages?.[0]?.imageUrl
      : activeDocument?.type === "image"
        ? activeDocument.url
        : null;

  return (
    <div
      className={`workbook-session__docs-window ${maximized ? "is-maximized" : ""} ${
        pinned ? "is-pinned" : ""
      }`}
    >
      <header>
        <strong>Окно документов</strong>
        <div>
          <IconButton size="small" onClick={onTogglePinned} aria-label="Закрепить окно">
            {pinned ? <LockRoundedIcon /> : <LockOpenRoundedIcon />}
          </IconButton>
          <IconButton size="small" onClick={onToggleMaximized} aria-label="Изменить размер">
            <FilterCenterFocusRoundedIcon />
          </IconButton>
          <IconButton size="small" onClick={onClose} aria-label="Закрыть">
            <CloseRoundedIcon />
          </IconButton>
        </div>
      </header>

      <div className="workbook-session__docs-actions">
        <Button
          size="small"
          startIcon={<UploadFileRoundedIcon />}
          onClick={onRequestUpload}
          disabled={!canInsertImage}
        >
          Загрузить
        </Button>
        <Button
          size="small"
          startIcon={<PhotoCameraRoundedIcon />}
          onClick={onSnapshotToBoard}
          disabled={!activeDocument}
        >
          Снимок на доску
        </Button>
        <Button
          size="small"
          startIcon={<AutoFixHighRoundedIcon />}
          onClick={onAddAnnotation}
          disabled={!activeDocument}
        >
          Пометка
        </Button>
        <Button
          size="small"
          startIcon={<DeleteSweepRoundedIcon />}
          onClick={onClearAnnotations}
          disabled={annotationsCount === 0}
        >
          Стереть
        </Button>
      </div>

      {uploadingDoc ? (
        <p className="workbook-session__docs-progress">Передача файла: {uploadProgress}%</p>
      ) : null}

      <div className="workbook-session__docs-files">
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={asset.id === activeAssetId ? "is-active" : ""}
            onClick={() => onSelectAsset(asset.id)}
          >
            {asset.name}
          </button>
        ))}
      </div>

      <div className="workbook-session__docs-view">
        {activeDocument ? (
          activeDocument.type === "pdf" ? (
            activeDocumentImageUrl ? (
              <img src={activeDocumentImageUrl} alt={`${activeDocument.name} • стр ${page}`} />
            ) : (
              <div className="workbook-session__docs-pdf-fallback">
                <p>Серверный рендер PDF недоступен. Откройте файл в отдельной вкладке.</p>
                <a href={activeDocument.url} target="_blank" rel="noreferrer">
                  Открыть PDF
                </a>
              </div>
            )
          ) : activeDocument.type === "file" ? (
            <div className="workbook-session__docs-pdf-fallback">
              <p>Предпросмотр этого формата недоступен в доске.</p>
              <a href={activeDocument.url} target="_blank" rel="noreferrer">
                Открыть файл
              </a>
            </div>
          ) : (
            <img src={activeDocument.url} alt={activeDocument.name} />
          )
        ) : (
          <p>Откройте документ или изображение для аннотаций.</p>
        )}
      </div>

      <footer className="workbook-session__docs-footer">
        <div className="workbook-session__contextbar-inline">
          <label htmlFor="workbook-doc-page">Страница</label>
          <input
            id="workbook-doc-page"
            type="number"
            min={1}
            max={activeDocumentPageCount}
            value={page}
            onChange={(event) =>
              onChangePage(Math.min(activeDocumentPageCount, Math.max(1, Number(event.target.value) || 1)))
            }
          />
        </div>
        <div className="workbook-session__contextbar-inline">
          <label htmlFor="workbook-doc-zoom">Масштаб</label>
          <input
            id="workbook-doc-zoom"
            type="range"
            min={0.2}
            max={4}
            step={0.1}
            value={zoom}
            onChange={(event) => onChangeZoom(Number(event.target.value))}
          />
        </div>
      </footer>
    </div>
  );
});
