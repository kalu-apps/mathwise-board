import { useCallback, type ChangeEvent, type MutableRefObject } from "react";
import {
  renderWorkbookPdfPages,
  uploadWorkbookAsset,
  uploadWorkbookAssetFile,
} from "@/features/workbook/model/api";
import { buildWorkbookBoardObjectIndex } from "@/features/workbook/model/boardObjectStore";
import {
  buildWorkbookDocumentAsset,
  buildWorkbookDocumentBoardObject,
  buildWorkbookSnapshotBoardObject,
  resolvePrimaryDocumentRenderedPage,
  resolveWorkbookBoardInsertPosition,
  resolveWorkbookImportedImageFrameSize,
} from "@/features/workbook/model/documentAssets";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import {
  formatFileSizeMb,
  isImageUploadFile,
  isPdfUploadFile,
  optimizeImageDataUrl,
  readFileAsDataUrl,
  WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
  WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
  WORKBOOK_IMAGE_IMPORT_MAX_BYTES,
  WORKBOOK_PDF_IMPORT_MAX_BYTES,
  WORKBOOK_PDF_SOURCE_MAX_BYTES,
} from "@/features/workbook/model/media";
import {
  resolveWorkbookImageAspectRatioFromDimensions,
  withWorkbookImageAspectRatioMeta,
} from "@/features/workbook/model/imageGeometry";
import { normalizeScenePayload, WORKBOOK_IMAGE_ASSET_META_KEY } from "@/features/workbook/model/scene";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookLibraryState,
  WorkbookTimerState,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";
import { generateId } from "@/shared/lib/id";
import {
  DEFAULT_BOARD_SETTINGS,
  DEFAULT_LIBRARY,
  clampBoardObjectToPageFrame,
} from "./WorkbookSessionPage.core";
import { normalizeSceneLayersForBoard, type WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

type SetState<T> = (value: T | ((current: T) => T)) => void;

export type WorkbookDocumentImportStage = "uploading" | "inserting";

export type WorkbookPreparedDocumentImport = {
  file: File;
  preparedDataUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  batchInsertIndex?: number;
  pdfSourceId?: string;
  pdfPageRange?: {
    from: number;
    to: number;
  };
  pdfPageCount?: number;
  onStage?: (stage: WorkbookDocumentImportStage) => void;
  onProgress?: (progress: number) => void;
  onErrorMessage?: (message: string) => void;
};

type UseWorkbookSessionDocumentHandlersParams = {
  sessionId: string | null;
  canInsertImage: boolean;
  userId?: string;
  canvasViewport: {
    x: number;
    y: number;
    zoom: number;
  };
  boardObjectCount: number;
  documentState: WorkbookDocumentState;
  setError: (value: string | null) => void;
  setUploadingDoc: (value: boolean) => void;
  setUploadProgress: (value: number) => void;
  setBoardStrokes: SetState<WorkbookStroke[]>;
  setBoardObjects: SetState<WorkbookBoardObject[]>;
  setConstraints: SetState<WorkbookConstraint[]>;
  setChatMessages: SetState<WorkbookChatMessage[]>;
  setComments: SetState<WorkbookComment[]>;
  setTimerState: SetState<WorkbookTimerState | null>;
  setBoardSettings: SetState<WorkbookBoardSettings>;
  setLibraryState: SetState<WorkbookLibraryState>;
  setDocumentState: SetState<WorkbookDocumentState>;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardObjectIndexByIdRef: MutableRefObject<Map<string, number>>;
  appendEventsAndApply: (
    events: WorkbookClientEventInput[],
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
      historyEntry?: WorkbookHistoryEntry | null;
    }
  ) => Promise<void>;
  commitObjectCreate: (
    object: WorkbookBoardObject,
    options?: {
      auxiliaryEvents?: WorkbookClientEventInput[];
    }
  ) => Promise<boolean>;
  upsertLibraryItem: (
    item: WorkbookLibraryState["items"][number],
    options?: {
      silent?: boolean;
      onError?: (error: unknown) => void;
    }
  ) => Promise<boolean> | boolean;
  persistSnapshots: (options?: { silent?: boolean; force?: boolean }) => Promise<boolean>;
};

const PDF_IMPORT_RENDER_CHUNK_SIZE = 3;
const PDF_IMPORT_UPLOAD_CONCURRENCY = 3;
const IMAGE_IMPORT_BATCH_COLUMNS = 3;
const IMAGE_IMPORT_BATCH_STEP_X = 440;
const IMAGE_IMPORT_BATCH_STEP_Y = 320;
const PDF_IMPORT_BATCH_COLUMNS = 2;
const PDF_IMPORT_BATCH_STEP_X = 980;
const PDF_IMPORT_BATCH_STEP_Y = 760;

const resolveWorkbookImportBatchInsertPosition = (params: {
  basePosition: { x: number; y: number };
  batchIndex?: number;
  isPdf: boolean;
}) => {
  const rawIndex = Number(params.batchIndex);
  if (!Number.isFinite(rawIndex)) {
    return params.basePosition;
  }
  const batchIndex = Math.max(0, Math.trunc(rawIndex));
  if (batchIndex === 0) {
    return params.basePosition;
  }
  const columns = params.isPdf ? PDF_IMPORT_BATCH_COLUMNS : IMAGE_IMPORT_BATCH_COLUMNS;
  const stepX = params.isPdf ? PDF_IMPORT_BATCH_STEP_X : IMAGE_IMPORT_BATCH_STEP_X;
  const stepY = params.isPdf ? PDF_IMPORT_BATCH_STEP_Y : IMAGE_IMPORT_BATCH_STEP_Y;
  const column = batchIndex % columns;
  const row = Math.floor(batchIndex / columns);
  return {
    x: params.basePosition.x + column * stepX,
    y: params.basePosition.y + row * stepY,
  };
};

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

type WorkbookPdfImportRenderProfile = {
  dpi: number;
  imageFormat: "jpeg";
  jpegQuality: number;
};

const clampInt = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.trunc(value)));

const resolvePdfImportRenderProfile = (params: {
  selectedPages: number;
  totalPages: number | null;
  fileBytes: number;
  byteLimitBytes: number;
}): WorkbookPdfImportRenderProfile => {
  const selectedPages = Math.max(1, Math.trunc(params.selectedPages));
  let dpi: number;
  let jpegQuality: number;
  if (selectedPages <= 1) {
    dpi = 156;
    jpegQuality = 88;
  } else if (selectedPages <= 2) {
    dpi = 148;
    jpegQuality = 88;
  } else if (selectedPages <= 3) {
    dpi = 142;
    jpegQuality = 87;
  } else if (selectedPages <= 5) {
    dpi = 134;
    jpegQuality = 86;
  } else if (selectedPages <= 8) {
    dpi = 124;
    jpegQuality = 85;
  } else {
    dpi = 116;
    jpegQuality = 84;
  }

  const totalPages =
    typeof params.totalPages === "number" && Number.isFinite(params.totalPages)
      ? Math.max(selectedPages, Math.trunc(params.totalPages))
      : null;
  const fileBytes =
    typeof params.fileBytes === "number" && Number.isFinite(params.fileBytes)
      ? Math.max(0, Math.trunc(params.fileBytes))
      : 0;
  const byteLimitBytes =
    typeof params.byteLimitBytes === "number" && Number.isFinite(params.byteLimitBytes)
      ? Math.max(1, Math.trunc(params.byteLimitBytes))
      : WORKBOOK_PDF_IMPORT_MAX_BYTES;

  if (totalPages && fileBytes > 0) {
    const selectedShare = Math.max(0.05, Math.min(1, selectedPages / totalPages));
    const estimatedRangeBytes = fileBytes * selectedShare * 1.35;
    const budgetRatio = estimatedRangeBytes / byteLimitBytes;

    if (budgetRatio >= 0.95) {
      dpi -= 20;
      jpegQuality -= 4;
    } else if (budgetRatio >= 0.8) {
      dpi -= 14;
      jpegQuality -= 3;
    } else if (budgetRatio >= 0.65) {
      dpi -= 8;
      jpegQuality -= 2;
    } else if (budgetRatio >= 0.5) {
      dpi -= 4;
      jpegQuality -= 1;
    }
  }

  return {
    dpi: clampInt(dpi, 96, 176),
    imageFormat: "jpeg",
    jpegQuality: clampInt(jpegQuality, 78, 90),
  };
};

const resolvePdfImportInsertSize = (pageCount: number) => {
  const safePageCount = Math.max(1, Math.trunc(pageCount));
  const baseCompactHeight =
    safePageCount <= 2 ? 312 : safePageCount <= 4 ? 286 : safePageCount <= 8 ? 252 : 224;
  const compactHeight = Math.round(baseCompactHeight * 2);
  return {
    compactHeight,
    minWidth: Math.max(150, Math.round(compactHeight * 0.58)),
    maxWidth: Math.max(250, Math.round(compactHeight * 1.48)),
    itemGapX: Math.max(18, Math.round(compactHeight * 0.11)),
    itemGapY: Math.max(20, Math.round(compactHeight * 0.12)),
  };
};

const resolveApiErrorLimitBytes = (error: ApiError) => {
  if (!error || typeof error !== "object") return null;
  const details = error.details as { limitBytes?: unknown } | null | undefined;
  if (!details || typeof details !== "object") return null;
  const limitBytes = details.limitBytes;
  if (typeof limitBytes !== "number" || !Number.isFinite(limitBytes) || limitBytes <= 0) {
    return null;
  }
  return Math.floor(limitBytes);
};

export const useWorkbookSessionDocumentHandlers = ({
  sessionId,
  canInsertImage,
  userId,
  canvasViewport,
  boardObjectCount,
  documentState,
  setError,
  setUploadingDoc,
  setUploadProgress,
  setBoardStrokes,
  setBoardObjects,
  setConstraints,
  setChatMessages,
  setComments,
  setTimerState,
  setBoardSettings,
  setLibraryState,
  setDocumentState,
  boardObjectsRef,
  boardObjectIndexByIdRef,
  appendEventsAndApply,
  commitObjectCreate,
  upsertLibraryItem,
  persistSnapshots,
}: UseWorkbookSessionDocumentHandlersParams) => {
  const updateDocumentState = useCallback(
    async (patch: Partial<WorkbookDocumentState>) => {
      try {
        await appendEventsAndApply([
          {
            type: "document.state.update",
            payload: patch,
          },
        ]);
      } catch {
        setError("Не удалось обновить окно документов.");
      }
    },
    [appendEventsAndApply, setError]
  );

  const syncUploadedDocumentAsset = useCallback(
    async (assetId: string, asset: WorkbookDocumentAssetLike) => {
      const buildSyncEvents = (
        syncAsset: WorkbookDocumentAssetLike
      ): WorkbookClientEventInput[] => [
        {
          type: "document.asset.add",
          payload: { asset: syncAsset },
        },
        {
          type: "document.state.update",
          payload: {
            activeAssetId: assetId,
            page: 1,
          },
        },
      ];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await appendEventsAndApply(buildSyncEvents(asset));
          return;
        } catch (error) {
          const isConflict =
            error instanceof ApiError &&
            error.code === "conflict" &&
            error.status === 409;
          if (isConflict && attempt < 2) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, 180 * (attempt + 1));
            });
            continue;
          }
          if (isRecoverableApiError(error) && attempt < 3) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, 220 * (attempt + 1));
            });
            continue;
          }
          throw error;
        }
      }
    },
    [appendEventsAndApply]
  );

  const importDocumentFile = useCallback(
    async ({
      file,
      preparedDataUrl,
      imageWidth,
      imageHeight,
      batchInsertIndex,
      pdfSourceId,
      pdfPageRange,
      pdfPageCount,
      onStage,
      onProgress,
      onErrorMessage,
    }: WorkbookPreparedDocumentImport) => {
      if (!file || !canInsertImage || !sessionId) return false;
      const failImport = (message: string) => {
        setError(message);
        onErrorMessage?.(message);
        return false;
      };
      const reportProgress = (value: number) => {
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
        setUploadProgress(normalized);
        onProgress?.(normalized);
      };
      try {
        setUploadingDoc(true);
        reportProgress(20);
        let syncedRenderedPages: WorkbookDocumentAssetLike["renderedPages"] = undefined;
        let renderedPageAssetIds: string[] = [];
        let pdfObjectsInserted = false;
        const isPdf = isPdfUploadFile(file);
        const isImage = isImageUploadFile(file);
        if (!isPdf && !isImage) {
          return failImport(
            "Не удалось добавить файл: поддерживаются PDF и изображения (PNG, JPG, WEBP, SVG, AVIF, TIFF и другие)."
          );
        }
        if (isPdf && file.size > WORKBOOK_PDF_SOURCE_MAX_BYTES) {
          return failImport(
            `Не удалось добавить PDF: размер файла ${formatFileSizeMb(file.size)} превышает лимит ${formatFileSizeMb(
              WORKBOOK_PDF_SOURCE_MAX_BYTES
            )}.`
          );
        }
        if (isImage && file.size > WORKBOOK_IMAGE_IMPORT_MAX_BYTES) {
          return failImport(
            `Не удалось добавить изображение: размер файла ${formatFileSizeMb(
              file.size
            )} превышает лимит ${formatFileSizeMb(WORKBOOK_IMAGE_IMPORT_MAX_BYTES)}.`
          );
        }
        const sourceDataUrl = isImage
          ? preparedDataUrl || (await readFileAsDataUrl(file))
          : "";
        const documentAssetDataUrl = isImage
          ? preparedDataUrl ||
            (await optimizeImageDataUrl(sourceDataUrl, {
              maxEdge: 1_600,
              quality: 0.82,
              maxChars: WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
            }))
          : "";
        const resolvedImageMeta = isImage
          ? Number.isFinite(imageWidth) &&
            Number.isFinite(imageHeight) &&
            Number(imageWidth) > 0 &&
            Number(imageHeight) > 0
            ? {
                width: Number(imageWidth),
                height: Number(imageHeight),
              }
            : await readImageMeta(documentAssetDataUrl || sourceDataUrl).catch(() => null)
          : null;
        const documentAssetId = generateId();
        const uploadedAt = new Date().toISOString();
        let uploadedDocumentAsset:
          | {
              assetId: string;
              url: string;
              mimeType: string;
              sizeBytes: number;
            }
          | null = null;
        if (isPdf) {
          onStage?.("uploading");
          const sourceId =
            typeof pdfSourceId === "string" && pdfSourceId.trim().length > 0
              ? pdfSourceId.trim()
              : undefined;
          const totalPages =
            typeof pdfPageCount === "number" && Number.isFinite(pdfPageCount)
              ? Math.max(1, Math.trunc(pdfPageCount))
              : null;
          const safeFrom =
            typeof pdfPageRange?.from === "number" && Number.isFinite(pdfPageRange.from)
              ? Math.max(1, Math.trunc(pdfPageRange.from))
              : 1;
          const requestedTo =
            typeof pdfPageRange?.to === "number" && Number.isFinite(pdfPageRange.to)
              ? Math.max(safeFrom, Math.trunc(pdfPageRange.to))
              : safeFrom + 7;
          if (totalPages !== null && safeFrom > totalPages) {
            return failImport("Не удалось добавить PDF: выбранная стартовая страница отсутствует в документе.");
          }
          const safeTo = totalPages !== null ? Math.min(totalPages, requestedTo) : requestedTo;
          const pageCount = Math.max(1, Math.min(12, safeTo - safeFrom + 1));
          reportProgress(28);
          const insertPosition = resolveWorkbookImportBatchInsertPosition({
            basePosition: resolveWorkbookBoardInsertPosition(canvasViewport, boardObjectCount),
            batchIndex: batchInsertIndex,
            isPdf: true,
          });
          const renderProfile = resolvePdfImportRenderProfile({
            selectedPages: pageCount,
            totalPages,
            fileBytes: file.size,
            byteLimitBytes: WORKBOOK_PDF_IMPORT_MAX_BYTES,
          });
          const gridColumns = pageCount <= 2 ? pageCount : 4;
          const { compactHeight, minWidth, maxWidth, itemGapX, itemGapY } =
            resolvePdfImportInsertSize(pageCount);
          const renderedPagesAccumulator: NonNullable<WorkbookDocumentAssetLike["renderedPages"]> = [];
          const renderedAssetIdsAccumulator: string[] = [];
          const chunkSize = Math.max(1, Math.min(PDF_IMPORT_RENDER_CHUNK_SIZE, pageCount));
          let insertedPages = 0;
          for (
            let chunkRelativeStart = 0;
            chunkRelativeStart < pageCount;
            chunkRelativeStart += chunkSize
          ) {
            const chunkPageCount = Math.min(chunkSize, pageCount - chunkRelativeStart);
            const chunkAbsoluteFrom = safeFrom + chunkRelativeStart;
            const chunkAbsoluteTo = chunkAbsoluteFrom + chunkPageCount - 1;
            const renderedChunk = await renderWorkbookPdfPages({
              fileName: file.name,
              sourceId,
              file: sourceId ? undefined : file,
              dpi: renderProfile.dpi,
              imageFormat: renderProfile.imageFormat,
              jpegQuality: renderProfile.jpegQuality,
              maxPages: chunkPageCount,
              pageFrom: chunkAbsoluteFrom,
              pageTo: chunkAbsoluteTo,
            });
            const normalizedChunkPages = renderedChunk.pages.slice(0, chunkPageCount).map((page, index) => ({
              ...page,
              page: chunkRelativeStart + index + 1,
            }));
            if (!normalizedChunkPages.length) {
              return failImport(
                "Не удалось добавить PDF: документ не удалось обработать. Проверьте файл или загрузите другую версию."
              );
            }
            const uploadWindowSize = Math.max(1, Math.min(PDF_IMPORT_UPLOAD_CONCURRENCY, normalizedChunkPages.length));
            const uploadedChunkPages: Array<{
              page: NonNullable<WorkbookDocumentAssetLike["renderedPages"]>[number];
              assetId: string;
            }> = [];
            for (let index = 0; index < normalizedChunkPages.length; index += uploadWindowSize) {
              const batch = normalizedChunkPages.slice(index, index + uploadWindowSize);
              const uploadedBatch = await Promise.all(
                batch.map(async (page) => {
                  const uploadedPageAsset = await uploadWorkbookAsset({
                    sessionId,
                    fileName: `${file.name}-page-${page.page}.jpg`,
                    dataUrl: page.imageUrl,
                    mimeType: "image/jpeg",
                  });
                  return {
                    page: {
                      ...page,
                      imageUrl: uploadedPageAsset.url,
                    },
                    assetId: uploadedPageAsset.assetId,
                  };
                })
              );
              uploadedChunkPages.push(...uploadedBatch);
            }
            uploadedChunkPages.sort((left, right) => left.page.page - right.page.page);
            for (const uploadedChunkPage of uploadedChunkPages) {
              if (!pdfObjectsInserted) {
                onStage?.("inserting");
                pdfObjectsInserted = true;
              }
              const pageIndex = uploadedChunkPage.page.page - 1;
              const column = pageIndex % gridColumns;
              const row = Math.floor(pageIndex / gridColumns);
              const pageRatio =
                typeof uploadedChunkPage.page.width === "number" &&
                Number.isFinite(uploadedChunkPage.page.width) &&
                uploadedChunkPage.page.width > 0 &&
                typeof uploadedChunkPage.page.height === "number" &&
                Number.isFinite(uploadedChunkPage.page.height) &&
                uploadedChunkPage.page.height > 0
                  ? uploadedChunkPage.page.width / uploadedChunkPage.page.height
                  : 0.707;
              const compactWidth = Math.max(
                minWidth,
                Math.min(maxWidth, Math.round(compactHeight * pageRatio))
              );
              const object = buildWorkbookDocumentBoardObject({
                objectId: generateId(),
                assetId: uploadedChunkPage.assetId,
                fileName: `${file.name} · стр. ${uploadedChunkPage.page.page}`,
                authorUserId: userId ?? "unknown",
                createdAt: uploadedAt,
                insertPosition: {
                  x: insertPosition.x + column * (compactWidth + itemGapX),
                  y: insertPosition.y + row * (compactHeight + itemGapY),
                },
                imageUrl: uploadedChunkPage.page.imageUrl,
                renderedPage: uploadedChunkPage.page,
                type: "image",
              });
              const pageImageObject: WorkbookBoardObject = {
                ...object,
                width: compactWidth,
                height: compactHeight,
                meta: {
                  ...(object.meta ?? {}),
                  [WORKBOOK_IMAGE_ASSET_META_KEY]: uploadedChunkPage.assetId,
                },
              };
              const created = await commitObjectCreate(
                withWorkbookImageAspectRatioMeta(pageImageObject, pageRatio)
              );
              if (!created) return false;
              renderedPagesAccumulator.push(uploadedChunkPage.page);
              renderedAssetIdsAccumulator.push(uploadedChunkPage.assetId);
              insertedPages += 1;
              const progress = 34 + Math.round((insertedPages / pageCount) * 54);
              reportProgress(Math.min(88, progress));
            }
          }
          syncedRenderedPages = renderedPagesAccumulator;
          renderedPageAssetIds = renderedAssetIdsAccumulator;
          if (!syncedRenderedPages.length) {
            return failImport(
              "Не удалось добавить PDF: не удалось получить изображения выбранных страниц."
            );
          }
          reportProgress(90);
          try {
            uploadedDocumentAsset = await uploadWorkbookAssetFile({
              sessionId,
              fileName: file.name,
              file,
              mimeType: file.type || "application/pdf",
            });
          } catch (error) {
            if (error instanceof ApiError && error.status === 413) {
              // Non-blocking case: original PDF source is not persisted as library asset,
              // but rendered pages have already been uploaded and inserted to the board.
            }
          }
        } else {
          onStage?.("uploading");
          reportProgress(56);
          uploadedDocumentAsset = await uploadWorkbookAsset({
            sessionId,
            fileName: file.name,
            dataUrl: documentAssetDataUrl,
            mimeType: file.type || (isImage ? "image/jpeg" : undefined),
          });
          reportProgress(72);
        }
        const insertPosition = resolveWorkbookImportBatchInsertPosition({
          basePosition: resolveWorkbookBoardInsertPosition(canvasViewport, boardObjectCount),
          batchIndex: batchInsertIndex,
          isPdf,
        });
        const renderedPage = isPdf
          ? resolvePrimaryDocumentRenderedPage(syncedRenderedPages, 1)
          : null;
        const objectImageUrl = isImage
          ? uploadedDocumentAsset?.url
          : renderedPage?.imageUrl;
        if (isImage && !objectImageUrl) {
          return failImport(
            "Не удалось добавить изображение: браузер не смог обработать файл. Попробуйте другой формат или меньший размер."
          );
        }
        if (isPdf && !objectImageUrl) {
          return failImport(
            "Не удалось добавить PDF: не удалось получить изображения выбранных страниц."
          );
        }
        const documentAssetUrl =
          uploadedDocumentAsset?.url || objectImageUrl || "";
        const asset = buildWorkbookDocumentAsset({
          assetId: documentAssetId,
          fileName: file.name,
          type: isPdf ? "pdf" : isImage ? "image" : "file",
          url: documentAssetUrl,
          uploadedBy: userId ?? "unknown",
          uploadedAt,
          renderedPages: syncedRenderedPages,
        });
        if (
          isPdf &&
          !pdfObjectsInserted &&
          Array.isArray(syncedRenderedPages) &&
          syncedRenderedPages.length > 0
        ) {
          onStage?.("inserting");
          const pageCount = syncedRenderedPages.length;
          const gridColumns = pageCount <= 2 ? pageCount : 4;
          const { compactHeight, minWidth, maxWidth, itemGapX, itemGapY } =
            resolvePdfImportInsertSize(pageCount);
          for (let index = 0; index < pageCount; index += 1) {
            const page = syncedRenderedPages[index];
            const column = index % gridColumns;
            const row = Math.floor(index / gridColumns);
            const pageRatio =
              typeof page?.width === "number" &&
              Number.isFinite(page.width) &&
              page.width > 0 &&
              typeof page?.height === "number" &&
              Number.isFinite(page.height) &&
              page.height > 0
                ? page.width / page.height
                : 0.707;
            const compactWidth = Math.max(
              minWidth,
              Math.min(maxWidth, Math.round(compactHeight * pageRatio))
            );
            const object = buildWorkbookDocumentBoardObject({
              objectId: generateId(),
              assetId: renderedPageAssetIds[index] ?? documentAssetId,
              fileName: `${file.name} · стр. ${page.page}`,
              authorUserId: userId ?? "unknown",
              createdAt: uploadedAt,
              insertPosition: {
                x: insertPosition.x + column * (compactWidth + itemGapX),
                y: insertPosition.y + row * (compactHeight + itemGapY),
              },
              imageUrl: page.imageUrl,
              renderedPage: page,
              type: "image",
            });
            const pageImageObject: WorkbookBoardObject = {
              ...object,
              width: compactWidth,
              height: compactHeight,
              meta: {
                ...(object.meta ?? {}),
                [WORKBOOK_IMAGE_ASSET_META_KEY]:
                  renderedPageAssetIds[index] ?? documentAssetId,
              },
            };
            const created = await commitObjectCreate(
              withWorkbookImageAspectRatioMeta(pageImageObject, pageRatio)
            );
            if (!created) return false;
          }
        } else if (!isPdf) {
          onStage?.("inserting");
          const object = buildWorkbookDocumentBoardObject({
            objectId: generateId(),
            assetId: documentAssetId,
            fileName: file.name,
            authorUserId: userId ?? "unknown",
            createdAt: uploadedAt,
            insertPosition,
            imageUrl: objectImageUrl,
            renderedPage,
            sourceWidth: resolvedImageMeta?.width,
            sourceHeight: resolvedImageMeta?.height,
            type: isPdf ? "pdf" : isImage ? "image" : "file",
          });
          const objectWithFrameSize =
            isImage && object.type === "image"
              ? {
                  ...object,
                  ...resolveWorkbookImportedImageFrameSize({
                    sourceWidth: resolvedImageMeta?.width,
                    sourceHeight: resolvedImageMeta?.height,
                  }),
                }
              : object;
          const objectWithAspectRatio = withWorkbookImageAspectRatioMeta(
            objectWithFrameSize,
            resolveWorkbookImageAspectRatioFromDimensions({
              width: resolvedImageMeta?.width,
              height: resolvedImageMeta?.height,
            })
          );
          const created = await commitObjectCreate(objectWithAspectRatio);
          if (!created) return false;
        }
        try {
          await syncUploadedDocumentAsset(documentAssetId, asset);
        } catch (error) {
          if (error instanceof ApiError && error.status === 413) {
            setError(
              "Изображение добавлено на доску, но объём данных для окна документов оказался слишком большим."
            );
          } else if (error instanceof ApiError && error.status === 409) {
            setError(
              "Изображение добавлено на доску, но синхронизация окна документов столкнулась с конфликтом. Повторите действие."
            );
          } else {
            setError(
              "Изображение добавлено на доску, но не удалось синхронизировать его в окне документов."
            );
          }
        }
        void upsertLibraryItem(
          {
            id: generateId(),
            name: file.name,
            type: isPdf ? "pdf" : isImage ? "image" : "office",
            ownerUserId: userId ?? "unknown",
            sourceUrl: isImage
              ? uploadedDocumentAsset?.url ?? objectImageUrl ?? ""
              : uploadedDocumentAsset?.url ?? objectImageUrl ?? "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            folderId: null,
          },
          { silent: true }
        );
        reportProgress(100);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 413) {
          const normalizedError = String(error.message ?? "").toLowerCase();
          const isIngress413 =
            normalizedError.includes("request entity too large") ||
            normalizedError.includes("content too large");
          if (error.message === "pdf_too_large") {
            const limitBytes = resolveApiErrorLimitBytes(error) ?? WORKBOOK_PDF_SOURCE_MAX_BYTES;
            return failImport(
              `Не удалось добавить PDF: серверный лимит обработки ${formatFileSizeMb(
                limitBytes
              )}. Уменьшите размер файла или разделите документ.`
            );
          }
          if (error.message === "pdf_selected_range_too_large") {
            const limitBytes = resolveApiErrorLimitBytes(error) ?? WORKBOOK_PDF_IMPORT_MAX_BYTES;
            return failImport(
              `Не удалось добавить PDF: выбранный диапазон страниц превышает лимит импорта ${formatFileSizeMb(
                limitBytes
              )}. Уменьшите диапазон и повторите попытку.`
            );
          }
          if (error.message === "request_body_too_large") {
            return failImport(
              "Не удалось добавить PDF: превышен транспортный лимит запроса. Загрузите меньший файл или повторите попытку позже."
            );
          }
          if (isIngress413) {
            return failImport(
              "Не удалось добавить PDF: ingress/proxy отклонил upload (413 до backend). Увеличьте nginx client_max_body_size."
            );
          }
          if (error.message === "workbook_asset_too_large") {
            return failImport(
              "Не удалось добавить файл: ассет превышает допустимый размер хранилища. Уменьшите файл и повторите попытку."
            );
          }
          return failImport(
            "Не удалось добавить файл: объём слишком большой для обработки. Уменьшите размер файла и повторите попытку."
          );
        } else if (error instanceof ApiError && error.status === 404) {
          if (error.message === "pdf_source_not_found") {
            return failImport(
              "Не удалось добавить PDF: временный источник не найден или истёк. Выберите PDF заново."
            );
          }
          return failImport("Не удалось добавить файл: ресурс не найден. Повторите попытку.");
        } else if (error instanceof ApiError && error.code === "timeout") {
          return failImport(
            "Не удалось добавить PDF: сервер обрабатывает документ слишком долго. Уменьшите файл или повторите попытку позже."
          );
        } else if (error instanceof ApiError && error.status === 503) {
          return failImport(
            "Не удалось обработать PDF на сервере. Попробуйте позже или загрузите изображение."
          );
        } else if (
          error instanceof Error &&
          (error.message === "image_decode_failed" || error.message === "read_failed")
        ) {
          return failImport(
            "Не удалось прочитать файл. Проверьте целостность файла или выберите другое расширение."
          );
        } else {
          return failImport(
            "Импорт завершился с ошибкой. Проверьте формат/размер файла и повторите попытку."
          );
        }
      } finally {
        setUploadingDoc(false);
        setUploadProgress(0);
      }
    },
    [
      boardObjectCount,
      canInsertImage,
      canvasViewport,
      commitObjectCreate,
      sessionId,
      setError,
      setUploadProgress,
      setUploadingDoc,
      syncUploadedDocumentAsset,
      upsertLibraryItem,
      userId,
    ]
  );

  const handleDocsUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      void importDocumentFile({ file });
    },
    [importDocumentFile]
  );

  const handleDocumentSnapshotToBoard = useCallback(async () => {
    const active = documentState.assets.find((asset) => asset.id === documentState.activeAssetId);
    if (!active) return;
    const insertPosition = resolveWorkbookBoardInsertPosition(canvasViewport, boardObjectCount);
    const renderedPage =
      active.type === "pdf"
        ? resolvePrimaryDocumentRenderedPage(active.renderedPages, documentState.page)
        : null;
    let snapshotImageUrl: string | undefined;
    let snapshotImageWidth: number | undefined;
    let snapshotImageHeight: number | undefined;
    if (active.type === "image") {
      snapshotImageUrl = active.url.startsWith("data:image/")
        ? active.url.length <= WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS
          ? active.url
          : await optimizeImageDataUrl(active.url, {
              maxEdge: 1_200,
              quality: 0.74,
              maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
            })
        : active.url;
      if (snapshotImageUrl) {
        const meta = await readImageMeta(snapshotImageUrl).catch(() => null);
        snapshotImageWidth = meta?.width;
        snapshotImageHeight = meta?.height;
      }
    } else if (renderedPage) {
      snapshotImageUrl = renderedPage.imageUrl.startsWith("data:image/")
        ? await optimizeImageDataUrl(renderedPage.imageUrl, {
            maxEdge: 1_100,
            quality: 0.72,
            maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
          })
        : renderedPage.imageUrl;
      snapshotImageWidth = renderedPage.width;
      snapshotImageHeight = renderedPage.height;
    }
    const object = buildWorkbookSnapshotBoardObject({
      objectId: generateId(),
      asset: active,
      page: documentState.page,
      authorUserId: userId ?? "unknown",
      createdAt: new Date().toISOString(),
      insertPosition,
      imageUrl: snapshotImageUrl,
      sourceWidth: snapshotImageWidth,
      sourceHeight: snapshotImageHeight,
    });
    await commitObjectCreate(object);
  }, [boardObjectCount, canvasViewport, commitObjectCreate, documentState.activeAssetId, documentState.assets, documentState.page, userId]);

  const handleAddDocumentAnnotation = useCallback(async () => {
    if (!documentState.activeAssetId) return;
    try {
      await appendEventsAndApply([
        {
          type: "document.annotation.add",
          payload: {
            annotation: {
              id: generateId(),
              page: documentState.page,
              color: "#c4872f",
              width: 3,
              points: [
                { x: 24, y: 24 },
                { x: 190, y: 24 },
              ],
              authorUserId: userId ?? "unknown",
              createdAt: new Date().toISOString(),
            },
          },
        },
      ]);
    } catch {
      setError("Не удалось добавить пометку.");
    }
  }, [appendEventsAndApply, documentState.activeAssetId, documentState.page, setError, userId]);

  const handleClearDocumentAnnotations = useCallback(async () => {
    try {
      await appendEventsAndApply([{ type: "document.annotation.clear", payload: {} }]);
    } catch {
      setError("Не удалось очистить пометки документа.");
    }
  }, [appendEventsAndApply, setError]);

  const handleLoadBoardFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw) as unknown;
        const normalized = normalizeScenePayload(parsed);
        const normalizedObjects = normalized.objects.map(clampBoardObjectToPageFrame);
        setBoardStrokes(normalized.strokes.filter((stroke) => stroke.layer === "board"));
        boardObjectsRef.current = normalizedObjects;
        boardObjectIndexByIdRef.current = buildWorkbookBoardObjectIndex(normalizedObjects);
        setBoardObjects(normalizedObjects);
        setConstraints(normalized.constraints);
        setChatMessages(normalized.chat);
        setComments(normalized.comments);
        setTimerState(normalized.timer);
        setBoardSettings(() => {
          const normalizedLayers = normalizeSceneLayersForBoard(
            normalized.boardSettings.sceneLayers,
            normalized.boardSettings.activeSceneLayerId
          );
          return {
            ...DEFAULT_BOARD_SETTINGS,
            ...normalized.boardSettings,
            ...normalizedLayers,
          };
        });
        setLibraryState({
          ...DEFAULT_LIBRARY,
          ...normalized.library,
        });
        setDocumentState(normalized.document);
        await persistSnapshots();
      } catch {
        setError("Не удалось открыть файл рабочей тетради.");
      }
    },
    [
      boardObjectIndexByIdRef,
      boardObjectsRef,
      persistSnapshots,
      setBoardObjects,
      setBoardSettings,
      setBoardStrokes,
      setChatMessages,
      setComments,
      setConstraints,
      setDocumentState,
      setError,
      setLibraryState,
      setTimerState,
    ]
  );

  return {
    updateDocumentState,
    importDocumentFile,
    handleDocsUpload,
    handleDocumentSnapshotToBoard,
    handleAddDocumentAnnotation,
    handleClearDocumentAnnotations,
    handleLoadBoardFile,
  };
};

type WorkbookDocumentAssetLike = WorkbookDocumentState["assets"][number];
