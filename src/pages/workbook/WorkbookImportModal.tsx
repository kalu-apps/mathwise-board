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
  WORKBOOK_PDF_SOURCE_MAX_BYTES,
  formatFileSizeMb,
  isPdfUploadFile,
  optimizeImageDataUrl,
  readFileAsDataUrl,
  readFileExtension,
} from "@/features/workbook/model/media";
import { reportWorkbookImportEvent } from "@/features/workbook/model/workbookPerformance";
import { generateId } from "@/shared/lib/id";
import type { WorkbookPreparedDocumentImport } from "./useWorkbookSessionDocumentHandlers";
import { WorkbookImageImportCropModal } from "./WorkbookImageImportCropModal";
import { WorkbookPdfImportPreviewModal } from "./WorkbookPdfImportPreviewModal";
import { createWorkbookPdfSource, inspectWorkbookPdf } from "@/features/workbook/model/api";
import { ApiError } from "@/shared/api/client";
import {
  DEFAULT_WORKBOOK_IMPORT_CROP_RECT,
  cropWorkbookImageDataUrl,
  isWorkbookImportCropRectDefault,
  normalizeWorkbookImportCropRect,
  type WorkbookImportCropRect,
} from "./workbookImageImportCrop";

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
  | "preparing_pdf_source"
  | "inspecting_pdf"
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
  basePreparedDataUrl?: string;
  cropRect?: WorkbookImportCropRect;
  isCropped?: boolean;
  pdfPageRange?: {
    from: number;
    to: number;
  };
  pdfPageCount?: number;
  pdfSourceId?: string;
  baseWarning?: string;
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

const isPdfPreparationStatus = (status: ImportFileStatus) =>
  status === "preparing_pdf_source" || status === "inspecting_pdf";

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
  const [imageCropItemId, setImageCropItemId] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const dialogContainer =
    container ??
    (typeof document !== "undefined" ? document.body : undefined);

  const readyCount = useMemo(
    () => items.filter((item) => item.status === "ready").length,
    [items]
  );
  const preparingPdfCount = useMemo(
    () => items.filter((item) => isPdfPreparationStatus(item.status)).length,
    [items]
  );
  const isPreparingPdf = preparingPdfCount > 0;
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
  const imageCropItem = useMemo(
    () =>
      items.find(
        (item) =>
          item.id === imageCropItemId &&
          item.isImage &&
          typeof item.basePreparedDataUrl === "string" &&
          item.basePreparedDataUrl.length > 0
      ) ?? null,
    [imageCropItemId, items]
  );
  const pdfPreviewContainer = useMemo(() => {
    if (!open || !pdfPreviewItemId || typeof document === "undefined") return undefined;
    return document.fullscreenElement ?? document.body;
  }, [open, pdfPreviewItemId]);

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
      const imagePreparationJobs: Array<Promise<void>> = [];
      const pdfPreparationJobs: Array<Promise<void>> = [];
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
          : WORKBOOK_PDF_SOURCE_MAX_BYTES;
        if (file.size > maxBytes) {
          nextItems.push({
            ...baseItem,
            status: "invalid",
            error: isPdf
              ? `Не удалось добавить PDF: размер файла ${formatFileSizeMb(file.size)} превышает лимит ${formatFileSizeMb(
                  maxBytes
                )}. Этот документ слишком большой даже как источник для выбора страниц.`
              : `Файл превышает лимит ${formatFileSizeMb(maxBytes)}.`,
          });
          continue;
        }
        const softLimit = isImage ? SOFT_IMAGE_LIMIT_BYTES : SOFT_PDF_LIMIT_BYTES;
        const warning =
          file.size > softLimit
            ? `Большой файл (${formatFileSizeMb(file.size)}). Рекомендуется уменьшить размер.`
            : undefined;
        if (!isImage) {
          const stagedPdfItem: WorkbookImportItem = {
            ...baseItem,
            status: "preparing_pdf_source",
            warning,
            pdfPageRange: {
              from: 1,
              to: 1,
            },
            progress: 6,
          };
          nextItems.push(stagedPdfItem);
          pdfPreparationJobs.push(
            (async () => {
              let pdfSourceId: string | null = null;
              try {
                const uploadedPdfSource = await createWorkbookPdfSource({
                  fileName: file.name,
                  file,
                });
                pdfSourceId = uploadedPdfSource.sourceId;
                setItemPatch(stagedPdfItem.id, {
                  pdfSourceId: uploadedPdfSource.sourceId,
                  status: "inspecting_pdf",
                  progress: 34,
                });
                const inspectedPdf = await inspectWorkbookPdf({
                  fileName: file.name,
                  sourceId: uploadedPdfSource.sourceId,
                });
                const pageCount = Math.max(1, Math.trunc(inspectedPdf.pageCount || 1));
                const defaultTo = Math.max(
                  1,
                  Math.min(pageCount, MAX_PDF_PAGES_PER_IMPORT)
                );
                setItemPatch(stagedPdfItem.id, {
                  pdfSourceId: uploadedPdfSource.sourceId,
                  warning:
                    pageCount > MAX_PDF_PAGES_PER_IMPORT
                      ? `Документ содержит ${pageCount} стр. За раз можно импортировать до ${MAX_PDF_PAGES_PER_IMPORT}.`
                      : warning,
                  status: "waiting",
                  pdfPageCount: pageCount,
                  pdfPageRange: {
                    from: 1,
                    to: defaultTo,
                  },
                  progress: 100,
                });
              } catch (error) {
                let message =
                  "Не удалось подготовить PDF для импорта (не удалось определить страницы). Попробуйте другой файл.";
                let keepAsWaiting = Boolean(pdfSourceId);
                let fallbackWarning: string | undefined;
                if (error instanceof ApiError && error.status === 413) {
                  const normalizedError = String(error.message ?? "").toLowerCase();
                  const isIngress413 =
                    normalizedError.includes("request entity too large") ||
                    normalizedError.includes("content too large");
                  if (error.message === "pdf_too_large") {
                    message = `Не удалось добавить PDF: размер файла ${formatFileSizeMb(
                      file.size
                    )} превышает лимит ${formatFileSizeMb(WORKBOOK_PDF_SOURCE_MAX_BYTES)}.`;
                  } else if (error.message === "request_body_too_large") {
                    message =
                      "Не удалось загрузить PDF-источник: превышен транспортный лимит запроса.";
                    keepAsWaiting = false;
                  } else if (isIngress413) {
                    message =
                      "Не удалось загрузить PDF-источник: ingress/proxy отклонил upload (413 до backend). Увеличьте nginx client_max_body_size.";
                    keepAsWaiting = false;
                  } else {
                    message =
                      "Не удалось подготовить PDF: объём payload превысил лимит сервера.";
                    keepAsWaiting = Boolean(pdfSourceId);
                    fallbackWarning = pdfSourceId
                      ? "Документ загружен как источник, но проинспектировать страницы не удалось. Выберите диапазон вручную."
                      : undefined;
                  }
                } else if (error instanceof ApiError && error.status === 404) {
                  message =
                    "Не удалось подготовить PDF: временный источник документа не найден. Выберите файл заново.";
                  keepAsWaiting = false;
                } else if (error instanceof ApiError && error.status === 503) {
                  message =
                    "Не удалось подготовить PDF для импорта: серверный рендер PDF временно недоступен.";
                  keepAsWaiting = Boolean(pdfSourceId);
                  fallbackWarning = pdfSourceId
                    ? "Сервер временно не ответил на inspect. Можно выбрать диапазон вручную и повторить импорт."
                    : undefined;
                }
                if (keepAsWaiting) {
                  setItemPatch(stagedPdfItem.id, {
                    pdfSourceId: pdfSourceId ?? undefined,
                    status: "waiting",
                    warning: fallbackWarning ?? warning,
                    pdfPageRange: {
                      from: 1,
                      to: 1,
                    },
                    progress: 100,
                  });
                } else {
                  setItemPatch(stagedPdfItem.id, {
                    status: "invalid",
                    error: message,
                    progress: 100,
                  });
                }
              }
            })()
          );
          continue;
        }
        const stagedImageItem: WorkbookImportItem = {
          ...baseItem,
          status: "optimizing",
          warning,
          progress: 8,
        };
        nextItems.push(stagedImageItem);
        imagePreparationJobs.push(
          (async () => {
            try {
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
              setItemPatch(stagedImageItem.id, {
                status: "ready",
                warning:
                  needsAggressiveResize
                    ? "Изображение очень большого разрешения. Применена безопасная оптимизация."
                    : warning,
                previewUrl: preparedDataUrl,
                preparedDataUrl,
                basePreparedDataUrl: preparedDataUrl,
                baseWarning: warning,
                width,
                height,
                cropRect: DEFAULT_WORKBOOK_IMPORT_CROP_RECT,
                isCropped: false,
                progress: 100,
              });
            } catch {
              setItemPatch(stagedImageItem.id, {
                status: "invalid",
                error: "Не удалось обработать изображение. Выберите другой файл.",
                progress: 100,
              });
              reportWorkbookImportEvent({
                name: "validation_failed",
                sessionId,
                reason: "image_processing_failed",
                counters: { fileBytes: file.size },
              });
            }
          })()
        );
      }
      setItems((current) => [...current, ...nextItems]);
      const firstPdfNeedingSetup = nextItems.find((item) => item.isPdf);
      if (firstPdfNeedingSetup) {
        setPdfPreviewItemId((current) => current ?? firstPdfNeedingSetup.id);
      }
      const firstImageNeedingCrop = nextItems.find(
        (item) => item.isImage && item.status !== "invalid"
      );
      if (!firstPdfNeedingSetup && firstImageNeedingCrop) {
        setImageCropItemId((current) => current ?? firstImageNeedingCrop.id);
      }
      const validCount = nextItems.filter((item) => item.status === "ready").length;
      const hasProcessableItems = nextItems.some((item) => item.status !== "invalid");
      setModalState(validCount > 0 ? "ready" : hasProcessableItems ? "files_selected" : "failed");
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
      void Promise.allSettled([...imagePreparationJobs, ...pdfPreparationJobs]);
    },
    [sessionId, setItemPatch]
  );

  const handleCollectFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      void validateAndPrepareItems(files);
    },
    [validateAndPrepareItems]
  );

  const canReopenItemPreview = useCallback(
    (item: WorkbookImportItem) => {
      if (isBusy) return false;
      if (item.isPdf) return true;
      if (item.isImage) {
        return Boolean(item.basePreparedDataUrl) && item.status !== "invalid";
      }
      return false;
    },
    [isBusy]
  );

  const handleReopenItemPreview = useCallback(
    (item: WorkbookImportItem) => {
      if (!canReopenItemPreview(item)) return;
      if (item.isPdf) {
        setImageCropItemId(null);
        setPdfPreviewItemId(item.id);
        return;
      }
      if (item.isImage) {
        setPdfPreviewItemId(null);
        setImageCropItemId(item.id);
      }
    },
    [canReopenItemPreview]
  );

  const handleOpenPdfPreview = useCallback((itemId: string) => {
    setImageCropItemId(null);
    setPdfPreviewItemId(itemId);
  }, []);

  const handleCancelPdfPreview = useCallback(() => {
    setPdfPreviewItemId(null);
  }, []);

  const handleConfirmPdfPreview = useCallback(
    (range: { from: number; to: number }) => {
      if (!pdfPreviewItemId) return;
      const hasReadyAfterConfirm = items.some(
        (item) =>
          (item.id !== pdfPreviewItemId && item.status === "ready") ||
          (item.id === pdfPreviewItemId && item.status !== "invalid")
      );
      setItems((current) => {
        return current.map((item) => {
          if (item.id !== pdfPreviewItemId) return item;
          if (item.status === "invalid") {
            return {
              ...item,
              pdfPageRange: range,
            };
          }
          return {
            ...item,
            status: "ready",
            error: undefined,
            pdfPageRange: range,
          };
        });
      });
      setPdfPreviewItemId(null);
      setModalState(hasReadyAfterConfirm ? "ready" : "files_selected");
    },
    [items, pdfPreviewItemId]
  );

  const handleCancelImageCrop = useCallback(() => {
    setImageCropItemId(null);
  }, []);

  const handleConfirmImageCrop = useCallback(
    async (nextCropRect: WorkbookImportCropRect) => {
      const targetId = imageCropItemId;
      if (!targetId) return;
      const target = items.find((item) => item.id === targetId && item.isImage) ?? null;
      if (!target || typeof target.basePreparedDataUrl !== "string") {
        setImageCropItemId(null);
        return;
      }
      const normalizedCropRect = normalizeWorkbookImportCropRect(nextCropRect);
      const isDefaultCrop = isWorkbookImportCropRectDefault(normalizedCropRect);
      setItemPatch(target.id, {
        status: "optimizing",
        progress: 12,
        error: undefined,
      });
      try {
        const baseDataUrl = target.basePreparedDataUrl;
        let nextPreparedDataUrl = baseDataUrl;
        let nextWarning = target.baseWarning;
        if (!isDefaultCrop) {
          const cropped = await cropWorkbookImageDataUrl({
            dataUrl: baseDataUrl,
            cropRect: normalizedCropRect,
          });
          const needsAggressiveResize = cropped.width * cropped.height > MAX_IMAGE_PIXELS;
          nextPreparedDataUrl = await optimizeImageDataUrl(cropped.dataUrl, {
            maxEdge: needsAggressiveResize ? 1_920 : 2_280,
            quality: needsAggressiveResize ? 0.8 : 0.86,
            maxChars: WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
          });
          if (needsAggressiveResize) {
            nextWarning = "Обрезанный фрагмент очень большой. Применена безопасная оптимизация.";
          }
        }
        const nextMeta = await readImageMeta(nextPreparedDataUrl);
        setItemPatch(target.id, {
          status: "ready",
          previewUrl: nextPreparedDataUrl,
          preparedDataUrl: nextPreparedDataUrl,
          width: nextMeta.width,
          height: nextMeta.height,
          cropRect: normalizedCropRect,
          isCropped: !isDefaultCrop,
          baseWarning: target.baseWarning,
          warning: nextWarning,
          error: undefined,
          progress: 100,
        });
      } catch {
        setItemPatch(target.id, {
          status: "ready",
          error: "Не удалось применить обрезку. Попробуйте снова.",
          progress: 100,
        });
      } finally {
        setImageCropItemId(null);
      }
    },
    [imageCropItemId, items, setItemPatch]
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
    for (const [queueIndex, item] of queue.entries()) {
      try {
        let itemFailureMessage = "";
        setItemPatch(item.id, { status: "uploading", error: undefined });
        setItemProgress(item.id, 6);
        setModalState("uploading");
        if (item.isPdf && (!item.pdfSourceId || item.pdfSourceId.trim().length === 0)) {
          failureCount += 1;
          setItemPatch(item.id, {
            status: "failed",
            error: "PDF-источник не подготовлен. Выберите файл заново.",
            progress: 100,
          });
          continue;
        }
        reportWorkbookImportEvent({
          name: "upload_started",
          sessionId,
          counters: { fileBytes: item.size, totalFiles: queue.length },
        });
        const imported = await onImportFile({
          file: item.file,
          preparedDataUrl: item.preparedDataUrl,
          imageWidth: item.isImage ? item.width : undefined,
          imageHeight: item.isImage ? item.height : undefined,
          batchInsertIndex: queueIndex,
          pdfSourceId: item.isPdf ? item.pdfSourceId : undefined,
          pdfPageRange: item.isPdf ? item.pdfPageRange : undefined,
          pdfPageCount: item.isPdf ? item.pdfPageCount : undefined,
          onProgress: (progress) => {
            setItemProgress(item.id, progress);
          },
          onErrorMessage: (message) => {
            itemFailureMessage = typeof message === "string" ? message : "";
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
          const normalizedFailureMessage = itemFailureMessage.trim();
          setItemPatch(item.id, {
            status: "failed",
            error:
              normalizedFailureMessage.length > 0
                ? normalizedFailureMessage
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
    setImageCropItemId(null);
    onClose();
  }, [isBusy, onClose]);

  useEffect(() => {
    if (!open) {
      setModalState("idle");
      setItems([]);
      setPdfPreviewItemId(null);
      setImageCropItemId(null);
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
        {isPreparingPdf ? (
          <Alert severity="info" className="workbook-session__import-modal-alert">
            <span className="workbook-session__import-preparing-status">
              <CircularProgress size={14} thickness={5} />
              <span>Подготавливаем PDF: загружаем источник и определяем количество страниц…</span>
            </span>
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
          <span className="workbook-session__import-dropzone-caption">
            Перетащите файл сюда или выберите вручную
          </span>
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
            {items.map((item) => {
              const isPreviewOpenable = canReopenItemPreview(item);
              return (
                <article
                  key={item.id}
                  className={`workbook-session__import-item ${
                    item.status === "failed" || item.status === "invalid"
                      ? "is-error"
                      : item.status === "success"
                        ? "is-success"
                        : ""
                  }${isPreviewOpenable ? " is-preview-openable" : ""}`}
                  role="listitem"
                  tabIndex={isPreviewOpenable ? 0 : undefined}
                  aria-label={isPreviewOpenable ? `Открыть предпросмотр ${item.name}` : undefined}
                  onClick={isPreviewOpenable ? () => handleReopenItemPreview(item) : undefined}
                  onKeyDown={
                    isPreviewOpenable
                      ? (event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          handleReopenItemPreview(item);
                        }
                      : undefined
                  }
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
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenPdfPreview(item.id);
                          }}
                          disabled={isBusy}
                        >
                          Выбрать страницы
                        </Button>
                      </div>
                    ) : item.isImage ? (
                      <div className="workbook-session__import-item-actions">
                        <span className="workbook-session__import-item-range">
                          {item.isCropped ? "Обрезка: сохранена" : "Обрезка: весь кадр"}
                        </span>
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setItems((current) => current.filter((entry) => entry.id !== item.id));
                      setPdfPreviewItemId((current) => (current === item.id ? null : current));
                      setImageCropItemId((current) => (current === item.id ? null : current));
                    }}
                    disabled={isBusy}
                  >
                    <CloseRoundedIcon fontSize="inherit" />
                  </IconButton>
                </article>
              );
            })}
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
            disabled={isBusy || isPreparingPdf || readyCount === 0}
          >
          {isBusy || isPreparingPdf ? (
            <CircularProgress
              size={16}
              thickness={5}
              className="workbook-session__import-upload-spinner"
            />
          ) : null}
          {isBusy ? "Загружаем..." : isPreparingPdf ? "Подготовка PDF..." : "Загрузить"}
        </Button>
      </DialogActions>
      </Dialog>
      <WorkbookPdfImportPreviewModal
        open={open && Boolean(pdfPreviewItem)}
        file={pdfPreviewItem?.file ?? null}
        fileSizeBytes={pdfPreviewItem?.size ?? null}
        pageCount={pdfPreviewItem?.pdfPageCount ?? null}
        maxFileBytes={WORKBOOK_PDF_IMPORT_MAX_BYTES}
        initialRange={pdfPreviewItem?.pdfPageRange ?? null}
        maxPagesPerImport={MAX_PDF_PAGES_PER_IMPORT}
        blockedReason={pdfPreviewItem?.status === "invalid" ? pdfPreviewItem.error ?? null : null}
        isPreparing={pdfPreviewItem ? isPdfPreparationStatus(pdfPreviewItem.status) : false}
        preparingMessage={
          pdfPreviewItem?.status === "inspecting_pdf"
            ? "Определяем количество страниц…"
            : "Подготавливаем PDF-источник…"
        }
        container={pdfPreviewContainer}
        onCancel={handleCancelPdfPreview}
        onConfirm={handleConfirmPdfPreview}
      />
      <WorkbookImageImportCropModal
        open={open && Boolean(imageCropItem)}
        sourceDataUrl={imageCropItem?.basePreparedDataUrl ?? null}
        fileName={imageCropItem?.name}
        initialCropRect={imageCropItem?.cropRect ?? DEFAULT_WORKBOOK_IMPORT_CROP_RECT}
        container={dialogContainer}
        onCancel={handleCancelImageCrop}
        onConfirm={(cropRect) => {
          void handleConfirmImageCrop(cropRect);
        }}
      />
    </>
  );
}
