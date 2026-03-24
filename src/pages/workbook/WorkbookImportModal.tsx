import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
} from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
  WORKBOOK_IMAGE_IMPORT_MAX_BYTES,
  WORKBOOK_PDF_IMPORT_MAX_BYTES,
  formatFileSizeMb,
  isPdfUploadFile,
  normalizePdfDataUrl,
  optimizeImageDataUrl,
  readFileAsDataUrl,
  readFileExtension,
} from "@/features/workbook/model/media";
import { reportWorkbookImportEvent } from "@/features/workbook/model/workbookPerformance";
import { generateId } from "@/shared/lib/id";
import type { WorkbookPreparedDocumentImport } from "./useWorkbookSessionDocumentHandlers";
import { WorkbookPdfImportPreviewModal } from "./WorkbookPdfImportPreviewModal";
import { inspectWorkbookPdf } from "@/features/workbook/model/api";

type ImportModalState =
  | "idle"
  | "dragover"
  | "files_selected"
  | "validating"
  | "ready"
  | "processing"
  | "uploading"
  | "partially_failed"
  | "completed"
  | "failed";

type ImportFileStatus =
  | "waiting"
  | "invalid"
  | "ready"
  | "optimizing"
  | "uploading"
  | "inserting"
  | "success"
  | "failed";

type WorkbookImportItem = {
  id: string;
  file: File;
  name: string;
  mimeType: string;
  extension: string;
  size: number;
  isImage: boolean;
  isPdf: boolean;
  width?: number;
  height?: number;
  previewUrl?: string;
  preparedDataUrl?: string;
  pdfPageRange?: {
    from: number;
    to: number;
  };
  pdfPageCount?: number;
  warning?: string;
  error?: string;
  status: ImportFileStatus;
  progress: number;
};

type WorkbookImportModalProps = {
  open: boolean;
  sessionId: string;
  initialFiles: File[];
  container?: Element | null;
  onClose: () => void;
  onImportFile: (payload: WorkbookPreparedDocumentImport) => Promise<boolean>;
};

const SUPPORTED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_FILES_PER_BATCH = 9;
const SOFT_IMAGE_LIMIT_BYTES = Math.round(WORKBOOK_IMAGE_IMPORT_MAX_BYTES * 0.65);
const SOFT_PDF_LIMIT_BYTES = Math.round(WORKBOOK_PDF_IMPORT_MAX_BYTES * 0.67);
const MAX_IMAGE_PIXELS = 14_000_000;
const MAX_PDF_PAGES_PER_IMPORT = 12;

const readImageMeta = async (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: Math.max(1, image.naturalWidth || image.width),
        height: Math.max(1, image.naturalHeight || image.height),
      });
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = dataUrl;
  });

const isSupportedImageFile = (file: File) => {
  const extension = readFileExtension(file.name);
  const lowerMime = file.type.toLowerCase();
  return (
    SUPPORTED_IMAGE_EXTENSIONS.has(extension) ||
    SUPPORTED_IMAGE_MIME_TYPES.has(lowerMime)
  );
};

export function WorkbookImportModal({
  open,
  sessionId,
  initialFiles,
  container,
  onClose,
  onImportFile,
}: WorkbookImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fullscreenRestoreTargetRef = useRef<Element | null>(null);
  const fullscreenRestorePendingRef = useRef(false);
  const [modalState, setModalState] = useState<ImportModalState>("idle");
  const [items, setItems] = useState<WorkbookImportItem[]>([]);
  const [pdfPreviewItemId, setPdfPreviewItemId] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const dialogContainer =
    container ??
    (typeof document !== "undefined"
      ? document.fullscreenElement ?? document.body
      : undefined);

  const readyCount = useMemo(
    () => items.filter((item) => item.status === "ready").length,
    [items]
  );
  const hasFailures = useMemo(
    () => items.some((item) => item.status === "failed" || item.status === "invalid"),
    [items]
  );
  const progressValue = useMemo(() => {
    if (!items.length) return 0;
    const totalProgress = items.reduce((sum, item) => {
      if (item.status === "success" || item.status === "failed" || item.status === "invalid") {
        return sum + 100;
      }
      if (item.status === "uploading" || item.status === "inserting" || item.status === "optimizing") {
        return sum + Math.max(0, Math.min(100, item.progress));
      }
      return sum;
    }, 0);
    return Math.min(100, Math.round(totalProgress / items.length));
  }, [items]);
  const hasQueuedItems = items.length > 0;
  const pdfPreviewItem = useMemo(
    () => items.find((item) => item.id === pdfPreviewItemId && item.isPdf) ?? null,
    [items, pdfPreviewItemId]
  );

  const setItemPatch = useCallback((itemId: string, patch: Partial<WorkbookImportItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
  }, []);

  const setItemProgress = useCallback((itemId: string, progress: number) => {
    const normalized = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              progress: Math.max(item.progress, normalized),
            }
          : item
      )
    );
  }, []);

  const validateAndPrepareItems = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setModalState("validating");
      const safeFiles = files.slice(0, MAX_FILES_PER_BATCH);
      if (files.length > MAX_FILES_PER_BATCH) {
        setBatchError(
          `За раз можно загрузить не более ${MAX_FILES_PER_BATCH} файлов. Остальные пропущены.`
        );
        reportWorkbookImportEvent({
          name: "validation_failed",
          sessionId,
          reason: "batch_limit",
          counters: {
            selectedFiles: files.length,
            acceptedFiles: safeFiles.length,
            maxFilesPerBatch: MAX_FILES_PER_BATCH,
          },
        });
      } else {
        setBatchError(null);
      }
      const nextItems: WorkbookImportItem[] = [];
      for (const file of safeFiles) {
        const extension = readFileExtension(file.name);
        const lowerMime = file.type.toLowerCase();
        const isImage = isSupportedImageFile(file);
        const isPdf = isPdfUploadFile(file);
        const baseItem: WorkbookImportItem = {
          id: generateId(),
          file,
          name: file.name,
          mimeType: lowerMime || "unknown",
          extension,
          size: file.size,
          isImage,
          isPdf,
          status: "waiting",
          progress: 0,
        };
        if (!isImage && !isPdf) {
          nextItems.push({
            ...baseItem,
            status: "invalid",
            error: "Поддерживаются только JPG, JPEG, PNG, WEBP и PDF.",
          });
          continue;
        }
        const maxBytes = isImage
          ? WORKBOOK_IMAGE_IMPORT_MAX_BYTES
          : WORKBOOK_PDF_IMPORT_MAX_BYTES;
        if (file.size > maxBytes) {
          nextItems.push({
            ...baseItem,
            status: "invalid",
            error: `Файл превышает лимит ${formatFileSizeMb(maxBytes)}.`,
          });
          continue;
        }
        const softLimit = isImage ? SOFT_IMAGE_LIMIT_BYTES : SOFT_PDF_LIMIT_BYTES;
        const warning =
          file.size > softLimit
            ? `Большой файл (${formatFileSizeMb(file.size)}). Рекомендуется уменьшить размер.`
            : undefined;
        if (!isImage) {
          try {
            const sourceDataUrl = await readFileAsDataUrl(file);
            const normalizedPdfDataUrl = normalizePdfDataUrl(sourceDataUrl);
            const inspectedPdf = await inspectWorkbookPdf({
              fileName: file.name,
              dataUrl: normalizedPdfDataUrl,
            });
            const pageCount = Math.max(1, Math.trunc(inspectedPdf.pageCount || 1));
            const defaultTo = Math.max(1, Math.min(pageCount, MAX_PDF_PAGES_PER_IMPORT, 8));
            nextItems.push({
              ...baseItem,
              warning:
                pageCount > MAX_PDF_PAGES_PER_IMPORT
                  ? `Документ содержит ${pageCount} стр. За раз можно импортировать до ${MAX_PDF_PAGES_PER_IMPORT}.`
                  : warning,
              status: "waiting",
              preparedDataUrl: normalizedPdfDataUrl,
              pdfPageCount: pageCount,
              pdfPageRange: {
                from: 1,
                to: defaultTo,
              },
              error: "Перед загрузкой выберите страницы PDF для импорта.",
            });
          } catch {
            nextItems.push({
              ...baseItem,
              status: "invalid",
              error:
                "Не удалось подготовить PDF для импорта (не удалось определить страницы). Попробуйте другой файл.",
            });
          }
          continue;
        }
        try {
          setModalState("validating");
          reportWorkbookImportEvent({
            name: "optimization_started",
            sessionId,
            counters: { fileBytes: file.size },
          });
          const sourceDataUrl = await readFileAsDataUrl(file);
          const { width, height } = await readImageMeta(sourceDataUrl);
          const pixels = width * height;
          const needsAggressiveResize = pixels > MAX_IMAGE_PIXELS;
          const preparedDataUrl = await optimizeImageDataUrl(sourceDataUrl, {
            maxEdge: needsAggressiveResize ? 1_920 : 2_280,
            quality: needsAggressiveResize ? 0.8 : 0.86,
            maxChars: WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
          });
          reportWorkbookImportEvent({
            name: "optimization_finished",
            sessionId,
            counters: {
              sourceBytes: file.size,
              width,
              height,
              pixels,
            },
          });
          nextItems.push({
            ...baseItem,
            status: "ready",
            warning:
              needsAggressiveResize
                ? "Изображение очень большого разрешения. Применена безопасная оптимизация."
                : warning,
            previewUrl: preparedDataUrl,
            preparedDataUrl,
            width,
            height,
          });
        } catch {
          nextItems.push({
            ...baseItem,
            status: "invalid",
            error: "Не удалось обработать изображение. Выберите другой файл.",
          });
          reportWorkbookImportEvent({
            name: "validation_failed",
            sessionId,
            reason: "image_processing_failed",
            counters: { fileBytes: file.size },
          });
        }
      }
      setItems((current) => [...current, ...nextItems]);
      const firstPdfNeedingSetup = nextItems.find((item) => item.isPdf && item.status === "waiting");
      if (firstPdfNeedingSetup) {
        setPdfPreviewItemId(firstPdfNeedingSetup.id);
      }
      const validCount = nextItems.filter((item) => item.status === "ready").length;
      const pendingPdfCount = nextItems.filter((item) => item.status === "waiting").length;
      setModalState(validCount > 0 ? "ready" : pendingPdfCount > 0 ? "files_selected" : "failed");
      reportWorkbookImportEvent({
        name: "files_selected",
        sessionId,
        counters: {
          selectedFiles: files.length,
          acceptedFiles: safeFiles.length,
          readyFiles: validCount,
          rejectedFiles: nextItems.length - validCount,
        },
      });
    },
    [sessionId]
  );

  const handleCollectFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      void validateAndPrepareItems(files);
    },
    [validateAndPrepareItems]
  );

  const handleOpenPdfPreview = useCallback((itemId: string) => {
    setPdfPreviewItemId(itemId);
  }, []);

  const handleCancelPdfPreview = useCallback(() => {
    setPdfPreviewItemId(null);
  }, []);

  const handleConfirmPdfPreview = useCallback(
    (range: { from: number; to: number }) => {
      if (!pdfPreviewItemId) return;
      setItems((current) =>
        current.map((item) =>
          item.id === pdfPreviewItemId
            ? {
                ...item,
                status: "ready",
                error: undefined,
                pdfPageRange: range,
              }
            : item
        )
      );
      setPdfPreviewItemId(null);
      setModalState("ready");
    },
    [pdfPreviewItemId]
  );

  const restoreFullscreenAfterPicker = useCallback(() => {
    if (!fullscreenRestorePendingRef.current) return;
    fullscreenRestorePendingRef.current = false;
    const target = fullscreenRestoreTargetRef.current;
    fullscreenRestoreTargetRef.current = null;
    if (!target || typeof document === "undefined") return;
    if (document.fullscreenElement) return;
    if (typeof target.requestFullscreen !== "function") return;
    void target.requestFullscreen().catch(() => undefined);
  }, []);

  const requestFileDialog = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      const fullscreenTarget = document.fullscreenElement;
      fullscreenRestoreTargetRef.current = fullscreenTarget;
      fullscreenRestorePendingRef.current = true;
      if (typeof window !== "undefined") {
        window.addEventListener(
          "focus",
          () => {
            window.setTimeout(() => {
              restoreFullscreenAfterPicker();
            }, 0);
          },
          { once: true }
        );
      }
    }
    fileInputRef.current?.click();
  }, [restoreFullscreenAfterPicker]);

  const handleNativeFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      restoreFullscreenAfterPicker();
      handleCollectFiles(files);
    },
    [handleCollectFiles, restoreFullscreenAfterPicker]
  );

  const handleUpload = useCallback(async () => {
    if (isBusy) return;
    const queue = items.filter((item) => item.status === "ready");
    if (!queue.length) return;
    setIsBusy(true);
    setModalState("processing");
    setBatchError(null);
    let successCount = 0;
    let failureCount = 0;
    for (const item of queue) {
      try {
        let itemFailureMessage: string | null = null;
        setItemPatch(item.id, { status: "uploading", error: undefined });
        setItemProgress(item.id, 6);
        setModalState("uploading");
        reportWorkbookImportEvent({
          name: "upload_started",
          sessionId,
          counters: { fileBytes: item.size, totalFiles: queue.length },
        });
        const imported = await onImportFile({
          file: item.file,
          preparedDataUrl: item.preparedDataUrl,
          pdfPageRange: item.isPdf ? item.pdfPageRange : undefined,
          pdfPageCount: item.isPdf ? item.pdfPageCount : undefined,
          onProgress: (progress) => {
            setItemProgress(item.id, progress);
          },
          onErrorMessage: (message) => {
            itemFailureMessage = message;
          },
          onStage: (stage) => {
            if (stage !== "inserting") return;
            setItemPatch(item.id, { status: "inserting", progress: 82 });
            reportWorkbookImportEvent({
              name: "insert_started",
              sessionId,
              counters: {
                fileBytes: item.size,
              },
            });
          },
        });
        if (!imported) {
          failureCount += 1;
          setItemPatch(item.id, {
            status: "failed",
            error:
              itemFailureMessage && itemFailureMessage.trim().length > 0
                ? itemFailureMessage
                : "Файл не вставлен на доску из-за ошибки импорта.",
            progress: 100,
          });
          reportWorkbookImportEvent({
            name: "insert_failed",
            sessionId,
            counters: { fileBytes: item.size },
          });
          continue;
        }
        successCount += 1;
        setItemPatch(item.id, { status: "success", progress: 100 });
        reportWorkbookImportEvent({
          name: "upload_succeeded",
          sessionId,
          counters: { fileBytes: item.size },
        });
        reportWorkbookImportEvent({
          name: "insert_succeeded",
          sessionId,
          counters: { fileBytes: item.size },
        });
      } catch {
        failureCount += 1;
        setItemPatch(item.id, {
          status: "failed",
          error: "Ошибка загрузки или вставки. Попробуйте повторить.",
          progress: 100,
        });
        reportWorkbookImportEvent({
          name: "upload_failed",
          sessionId,
          counters: { fileBytes: item.size },
        });
      }
    }
    const hasAnyFailure = failureCount > 0 || hasFailures;
    setModalState(
      hasAnyFailure ? (successCount > 0 ? "partially_failed" : "failed") : "completed"
    );
    reportWorkbookImportEvent({
      name: hasAnyFailure ? "batch_partially_failed" : "batch_completed",
      sessionId,
      counters: {
        successCount,
        failureCount,
        totalFiles: queue.length,
      },
    });
    setIsBusy(false);
    onClose();
  }, [hasFailures, isBusy, items, onClose, onImportFile, sessionId, setItemPatch, setItemProgress]);

  const handleClose = useCallback(() => {
    if (isBusy) return;
    fullscreenRestorePendingRef.current = false;
    fullscreenRestoreTargetRef.current = null;
    setPdfPreviewItemId(null);
    onClose();
  }, [isBusy, onClose]);

  useEffect(() => {
    if (!open) {
      setModalState("idle");
      setItems([]);
      setPdfPreviewItemId(null);
      setBatchError(null);
      setIsBusy(false);
      return;
    }
    reportWorkbookImportEvent({
      name: "modal_opened",
      sessionId,
    });
  }, [open, sessionId]);

  useEffect(() => {
    if (!open || initialFiles.length === 0) return;
    handleCollectFiles(initialFiles);
  }, [handleCollectFiles, initialFiles, open]);

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        container={dialogContainer}
        fullWidth
        maxWidth={hasQueuedItems ? "md" : "sm"}
        className="workbook-session__import-modal"
        PaperProps={{
          className: `workbook-session__import-modal-paper${
            hasQueuedItems ? " workbook-session__import-modal-paper--expanded" : ""
          }`,
        }}
        disableEscapeKeyDown={isBusy}
      >
      <DialogTitle className="workbook-session__import-modal-title">
        <span>Импорт файлов в доску</span>
        <IconButton
          className="workbook-session__import-modal-close"
          onClick={handleClose}
          disabled={isBusy}
          aria-label="Закрыть окно импорта"
          size="small"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="workbook-session__import-modal-content">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="workbook-session__file-input"
          onChange={handleNativeFileSelect}
        />
        <Alert severity="info" className="workbook-session__import-modal-alert">
          Поддерживаются JPG/JPEG, PNG, WEBP и PDF. Перед вставкой изображения проходят
          безопасную оптимизацию.
        </Alert>
        {batchError ? (
          <Alert severity="warning" className="workbook-session__import-modal-alert">
            {batchError}
          </Alert>
        ) : null}
        <div
          className={`workbook-session__import-dropzone${
            modalState === "dragover" ? " is-dragover" : ""
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setModalState("dragover");
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setModalState("dragover");
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setModalState(items.length > 0 ? "files_selected" : "idle");
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const droppedFiles = Array.from(event.dataTransfer.files ?? []);
            setModalState("files_selected");
            handleCollectFiles(droppedFiles);
          }}
        >
          <UploadFileRoundedIcon fontSize="large" />
          <strong>Перетащите файлы сюда</strong>
          <span>или выберите вручную</span>
          <Button
            variant="outlined"
            onClick={requestFileDialog}
            disabled={isBusy}
          >
            Выбрать файлы
          </Button>
        </div>

        {items.length > 0 ? (
          <div className="workbook-session__import-list" role="list">
            {items.map((item) => (
              <article
                key={item.id}
                className={`workbook-session__import-item ${
                  item.status === "failed" || item.status === "invalid"
                    ? "is-error"
                    : item.status === "success"
                      ? "is-success"
                      : ""
                }`}
                role="listitem"
              >
                <div className="workbook-session__import-item-preview">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.name} loading="lazy" />
                  ) : item.isImage ? (
                    <ImageRoundedIcon fontSize="small" />
                  ) : (
                    <InsertDriveFileRoundedIcon fontSize="small" />
                  )}
                </div>
                <div className="workbook-session__import-item-meta">
                  <div className="workbook-session__import-item-headline">
                    <strong>{item.name}</strong>
                  </div>
                  <div className="workbook-session__import-item-details">
                    <span>{item.extension || item.mimeType}</span>
                    <span>{formatFileSizeMb(item.size)}</span>
                    {item.width && item.height ? (
                      <span>
                        {item.width}×{item.height}
                      </span>
                    ) : null}
                  </div>
                  {item.isPdf ? (
                    <div className="workbook-session__import-item-actions">
                      <span className="workbook-session__import-item-range">
                        Страницы: {item.pdfPageRange?.from ?? 1}-{item.pdfPageRange?.to ?? 1}
                        {item.pdfPageCount ? ` из ${item.pdfPageCount}` : ""}
                      </span>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleOpenPdfPreview(item.id)}
                        disabled={isBusy}
                      >
                        Выбрать страницы
                      </Button>
                    </div>
                  ) : null}
                  {item.warning ? (
                    <p className="workbook-session__import-item-warning">{item.warning}</p>
                  ) : null}
                  {item.error ? (
                    <p className="workbook-session__import-item-error">{item.error}</p>
                  ) : null}
                </div>
                <IconButton
                  className="workbook-session__import-item-remove"
                  aria-label={`Удалить ${item.name}`}
                  onClick={() => {
                    setItems((current) => current.filter((entry) => entry.id !== item.id));
                    setPdfPreviewItemId((current) => (current === item.id ? null : current));
                  }}
                  disabled={isBusy}
                >
                  <CloseRoundedIcon fontSize="inherit" />
                </IconButton>
              </article>
            ))}
          </div>
        ) : null}
        {(modalState === "uploading" || modalState === "processing") && items.length > 0 ? (
          <div className="workbook-session__import-progress">
            <LinearProgress
              variant="determinate"
              value={progressValue}
              className="workbook-session__import-progress-bar"
            />
            <span>{progressValue}%</span>
          </div>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          className="workbook-session__import-upload-btn"
          variant="contained"
          onClick={() => void handleUpload()}
          disabled={isBusy || readyCount === 0}
        >
          {isBusy ? (
            <CircularProgress
              size={16}
              thickness={5}
              className="workbook-session__import-upload-spinner"
            />
          ) : null}
          {isBusy ? "Загружаем..." : "Загрузить"}
        </Button>
      </DialogActions>
      </Dialog>
      <WorkbookPdfImportPreviewModal
        open={open && Boolean(pdfPreviewItem)}
        file={pdfPreviewItem?.file ?? null}
        pageCount={pdfPreviewItem?.pdfPageCount ?? null}
        initialRange={pdfPreviewItem?.pdfPageRange ?? null}
        maxPagesPerImport={MAX_PDF_PAGES_PER_IMPORT}
        container={dialogContainer}
        onCancel={handleCancelPdfPreview}
        onConfirm={handleConfirmPdfPreview}
      />
    </>
  );
}
