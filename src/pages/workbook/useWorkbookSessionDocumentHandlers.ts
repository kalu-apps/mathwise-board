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
import { normalizeSceneLayersForBoard } from "./WorkbookSessionPage.geometry";

type SetState<T> = (value: T | ((current: T) => T)) => void;

export type WorkbookDocumentImportStage = "uploading" | "inserting";

export type WorkbookPreparedDocumentImport = {
  file: File;
  preparedDataUrl?: string;
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
      historyEntry?: unknown;
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
        let renderedPages: WorkbookDocumentAssetLike["renderedPages"] = undefined;
        let renderedPageAssetIds: string[] = [];
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
        if (isPdf) {
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
          const pageTo = safeFrom + pageCount - 1;
          reportProgress(45);
          const rendered = await renderWorkbookPdfPages({
            fileName: file.name,
            sourceId,
            file: sourceId ? undefined : file,
            dpi: 128,
            maxPages: pageCount,
            pageFrom: safeFrom,
            pageTo,
          });
          renderedPages = rendered.pages.slice(0, pageCount).map((page, index) => ({
            ...page,
            page: index + 1,
          }));
          if (!renderedPages.length) {
            return failImport(
              "Не удалось добавить PDF: документ не удалось обработать. Проверьте файл или загрузите другую версию."
            );
          }
        }
        onStage?.("uploading");
        reportProgress(56);
        let uploadedDocumentAsset:
          | {
              assetId: string;
              url: string;
              mimeType: string;
              sizeBytes: number;
            }
          | null = null;
        let nonBlockingPdfSourceWarning: string | null = null;
        if (isPdf) {
          try {
            uploadedDocumentAsset = await uploadWorkbookAssetFile({
              sessionId,
              fileName: file.name,
              file,
              mimeType: file.type || "application/pdf",
            });
          } catch (error) {
            if (error instanceof ApiError && error.status === 413) {
              if (error.message === "workbook_asset_too_large") {
                nonBlockingPdfSourceWarning =
                  "PDF импортирован как изображения страниц. Оригинал PDF не сохранён в библиотеке из-за лимита размера ассета.";
              } else if (error.message === "request_body_too_large") {
                nonBlockingPdfSourceWarning =
                  "PDF импортирован как изображения страниц. Оригинал PDF не сохранён из-за транспортного лимита.";
              }
            }
          }
        } else {
          uploadedDocumentAsset = await uploadWorkbookAsset({
            sessionId,
            fileName: file.name,
            dataUrl: documentAssetDataUrl,
            mimeType: file.type || (isImage ? "image/jpeg" : undefined),
          });
        }
        let syncedRenderedPages = renderedPages;
        if (Array.isArray(renderedPages) && renderedPages.length > 0) {
          const uploadedRenderedPages: NonNullable<WorkbookDocumentAssetLike["renderedPages"]> = [];
          const uploadedRenderedPageAssetIds: string[] = [];
          for (let index = 0; index < renderedPages.length; index += 1) {
            const renderedPage = renderedPages[index];
            const uploadedPageAsset = await uploadWorkbookAsset({
              sessionId,
              fileName: `${file.name}-page-${renderedPage.page}.jpg`,
              dataUrl: renderedPage.imageUrl,
              mimeType: "image/jpeg",
            });
            uploadedRenderedPages.push({
              ...renderedPage,
              imageUrl: uploadedPageAsset.url,
            });
            uploadedRenderedPageAssetIds.push(uploadedPageAsset.assetId);
            const progress = 58 + Math.round(((index + 1) / renderedPages.length) * 14);
            reportProgress(Math.min(72, progress));
          }
          syncedRenderedPages = uploadedRenderedPages;
          renderedPageAssetIds = uploadedRenderedPageAssetIds;
        }
        reportProgress(72);
        const insertPosition = resolveWorkbookBoardInsertPosition(
          canvasViewport,
          boardObjectCount
        );
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
        const assetId = generateId();
        const uploadedAt = new Date().toISOString();
        const documentAssetUrl =
          uploadedDocumentAsset?.url || objectImageUrl || "";
        const asset = buildWorkbookDocumentAsset({
          assetId,
          fileName: file.name,
          type: isPdf ? "pdf" : isImage ? "image" : "file",
          url: documentAssetUrl,
          uploadedBy: userId ?? "unknown",
          uploadedAt,
          renderedPages: syncedRenderedPages,
        });
        onStage?.("inserting");
        if (isPdf && Array.isArray(syncedRenderedPages) && syncedRenderedPages.length > 0) {
          const pageCount = syncedRenderedPages.length;
          const gridColumns = pageCount <= 2 ? pageCount : pageCount <= 8 ? 4 : 4;
          const compactHeight = pageCount >= 7 ? 186 : 206;
          const primaryPage = syncedRenderedPages[0];
          const primaryRatio =
            typeof primaryPage?.width === "number" &&
            Number.isFinite(primaryPage.width) &&
            primaryPage.width > 0 &&
            typeof primaryPage?.height === "number" &&
            Number.isFinite(primaryPage.height) &&
            primaryPage.height > 0
              ? primaryPage.width / primaryPage.height
              : 0.707;
          const compactWidth = Math.max(
            126,
            Math.min(216, Math.round(compactHeight * primaryRatio))
          );
          const itemGapX = 18;
          const itemGapY = 22;
          for (let index = 0; index < pageCount; index += 1) {
            const page = syncedRenderedPages[index];
            const column = index % gridColumns;
            const row = Math.floor(index / gridColumns);
            const object = buildWorkbookDocumentBoardObject({
              objectId: generateId(),
              assetId: renderedPageAssetIds[index] ?? assetId,
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
                [WORKBOOK_IMAGE_ASSET_META_KEY]: renderedPageAssetIds[index] ?? assetId,
              },
            };
            const created = await commitObjectCreate(pageImageObject);
            if (!created) return false;
          }
        } else {
          const object = buildWorkbookDocumentBoardObject({
            objectId: generateId(),
            assetId,
            fileName: file.name,
            authorUserId: userId ?? "unknown",
            createdAt: uploadedAt,
            insertPosition,
            imageUrl: objectImageUrl,
            renderedPage,
            type: isPdf ? "pdf" : isImage ? "image" : "file",
          });
          const created = await commitObjectCreate(object);
          if (!created) return false;
        }
        try {
          await syncUploadedDocumentAsset(assetId, asset);
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
        if (nonBlockingPdfSourceWarning) {
          setError(nonBlockingPdfSourceWarning);
        }
        reportProgress(100);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 413) {
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
    } else if (renderedPage) {
      snapshotImageUrl = renderedPage.imageUrl.startsWith("data:image/")
        ? await optimizeImageDataUrl(renderedPage.imageUrl, {
            maxEdge: 1_100,
            quality: 0.72,
            maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
          })
        : renderedPage.imageUrl;
    }
    const object = buildWorkbookSnapshotBoardObject({
      objectId: generateId(),
      asset: active,
      page: documentState.page,
      authorUserId: userId ?? "unknown",
      createdAt: new Date().toISOString(),
      insertPosition,
      imageUrl: snapshotImageUrl,
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
              color: "#ff8e3c",
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
