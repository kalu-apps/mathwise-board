import { useCallback, type ChangeEvent, type MutableRefObject } from "react";
import { renderWorkbookPdfPages } from "@/features/workbook/model/api";
import { buildWorkbookBoardObjectIndex } from "@/features/workbook/model/boardObjectStore";
import {
  buildWorkbookDocumentAsset,
  buildWorkbookDocumentBoardObject,
  buildWorkbookSnapshotBoardObject,
  buildWorkbookSyncedDocumentAsset,
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
} from "@/features/workbook/model/media";
import { normalizeScenePayload } from "@/features/workbook/model/scene";
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

const WORKBOOK_DOCUMENT_SYNC_IMAGE_MAX_DATA_URL_CHARS = 96_000;
const WORKBOOK_DOCUMENT_SYNC_RENDERED_IMAGE_MAX_DATA_URL_CHARS = 64_000;

type UseWorkbookSessionDocumentHandlersParams = {
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
    item: WorkbookLibraryState["items"][number]
  ) => Promise<void> | void;
  persistSnapshots: (options?: { silent?: boolean; force?: boolean }) => Promise<boolean>;
};

export const useWorkbookSessionDocumentHandlers = ({
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
      const compactAssetForSync = async (
        sourceAsset: WorkbookDocumentAssetLike
      ): Promise<WorkbookDocumentAssetLike> => {
        let changed = false;
        let compactedUrl = sourceAsset.url;
        if (typeof compactedUrl === "string" && compactedUrl.startsWith("data:image/")) {
          const nextUrl = await optimizeImageDataUrl(compactedUrl, {
            maxEdge: 1_200,
            quality: 0.64,
            maxChars: WORKBOOK_DOCUMENT_SYNC_IMAGE_MAX_DATA_URL_CHARS,
          });
          if (nextUrl.length < compactedUrl.length) {
            compactedUrl = nextUrl;
            changed = true;
          }
        }
        let compactedRenderedPages = sourceAsset.renderedPages;
        if (Array.isArray(sourceAsset.renderedPages) && sourceAsset.renderedPages.length > 0) {
          const nextRenderedPages = await Promise.all(
            sourceAsset.renderedPages.map(async (renderedPage) => {
              if (
                typeof renderedPage.imageUrl !== "string" ||
                !renderedPage.imageUrl.startsWith("data:image/")
              ) {
                return renderedPage;
              }
              const compactedRenderedImageUrl = await optimizeImageDataUrl(
                renderedPage.imageUrl,
                {
                  maxEdge: 980,
                  quality: 0.6,
                  maxChars: WORKBOOK_DOCUMENT_SYNC_RENDERED_IMAGE_MAX_DATA_URL_CHARS,
                }
              );
              if (compactedRenderedImageUrl.length < renderedPage.imageUrl.length) {
                changed = true;
                return {
                  ...renderedPage,
                  imageUrl: compactedRenderedImageUrl,
                };
              }
              return renderedPage;
            })
          );
          compactedRenderedPages = nextRenderedPages;
        }
        if (!changed) return sourceAsset;
        return {
          ...sourceAsset,
          url: compactedUrl,
          renderedPages: compactedRenderedPages,
        };
      };

      let syncAsset = asset;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await appendEventsAndApply(buildSyncEvents(syncAsset));
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
          if (error instanceof ApiError && error.status === 413) {
            const compactedAsset = await compactAssetForSync(syncAsset);
            if (compactedAsset !== syncAsset) {
              syncAsset = compactedAsset;
              if (attempt >= 3) {
                throw error;
              }
              await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 120);
              });
              continue;
            }
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

  const handleDocsUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !canInsertImage) return;
      event.target.value = "";
      try {
        setUploadingDoc(true);
        setUploadProgress(20);
        let renderedPages: WorkbookDocumentAssetLike["renderedPages"] = undefined;
        const isPdf = isPdfUploadFile(file);
        const isImage = isImageUploadFile(file);
        if (!isPdf && !isImage) {
          setError(
            "Не удалось добавить файл: поддерживаются PDF и изображения (PNG, JPG, WEBP, SVG, AVIF, TIFF и другие)."
          );
          return;
        }
        if (isPdf && file.size > WORKBOOK_PDF_IMPORT_MAX_BYTES) {
          setError(
            `Не удалось добавить PDF: размер файла ${formatFileSizeMb(file.size)} превышает лимит ${formatFileSizeMb(
              WORKBOOK_PDF_IMPORT_MAX_BYTES
            )}.`
          );
          return;
        }
        if (isImage && file.size > WORKBOOK_IMAGE_IMPORT_MAX_BYTES) {
          setError(
            `Не удалось добавить изображение: размер файла ${formatFileSizeMb(
              file.size
            )} превышает лимит ${formatFileSizeMb(WORKBOOK_IMAGE_IMPORT_MAX_BYTES)}.`
          );
          return;
        }
        const sourceDataUrl = await readFileAsDataUrl(file);
        const documentAssetUrl = isImage
          ? await optimizeImageDataUrl(sourceDataUrl, {
              maxEdge: 1_600,
              quality: 0.82,
              maxChars: WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
            })
          : sourceDataUrl;
        if (isPdf) {
          setUploadProgress(45);
          const rendered = await renderWorkbookPdfPages({
            fileName: file.name,
            dataUrl: documentAssetUrl,
            dpi: 128,
            maxPages: 8,
          });
          renderedPages = rendered.pages.slice(0, 8);
          if (!renderedPages.length) {
            setError(
              "Не удалось добавить PDF: документ не удалось обработать. Проверьте файл или загрузите другую версию."
            );
            return;
          }
        }
        setUploadProgress(68);
        const insertPosition = resolveWorkbookBoardInsertPosition(
          canvasViewport,
          boardObjectCount
        );
        const renderedPage = isPdf
          ? resolvePrimaryDocumentRenderedPage(renderedPages, 1)
          : null;
        const objectImageUrl = isImage
          ? await optimizeImageDataUrl(sourceDataUrl, {
              maxEdge: 1_200,
              quality: 0.74,
              maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
            })
          : renderedPage?.imageUrl
            ? await optimizeImageDataUrl(renderedPage.imageUrl, {
                maxEdge: 1_100,
                quality: 0.72,
                maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
              })
            : undefined;
        if (isImage && !objectImageUrl) {
          setError(
            "Не удалось добавить изображение: браузер не смог обработать файл. Попробуйте другой формат или меньший размер."
          );
          return;
        }
        const assetId = generateId();
        const uploadedAt = new Date().toISOString();
        const asset = buildWorkbookDocumentAsset({
          assetId,
          fileName: file.name,
          type: isPdf ? "pdf" : isImage ? "image" : "file",
          url: documentAssetUrl,
          uploadedBy: userId ?? "unknown",
          uploadedAt,
          renderedPages,
        });
        const syncedAsset = buildWorkbookSyncedDocumentAsset({
          asset,
          syncedUrl: isImage ? documentAssetUrl : objectImageUrl || "data:,",
          renderedPage,
          imageUrl: objectImageUrl,
        });
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
        if (!created) return;
        try {
          await syncUploadedDocumentAsset(assetId, syncedAsset);
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
        void upsertLibraryItem({
          id: generateId(),
          name: file.name,
          type: isPdf ? "pdf" : isImage ? "image" : "office",
          ownerUserId: userId ?? "unknown",
          sourceUrl: isImage ? documentAssetUrl : objectImageUrl ?? documentAssetUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          folderId: null,
        });
        setUploadProgress(100);
      } catch (error) {
        if (error instanceof ApiError && error.status === 413) {
          setError(
            "Не удалось добавить файл: объём слишком большой для обработки. Уменьшите размер файла и повторите попытку."
          );
        } else if (error instanceof ApiError && error.status === 503) {
          setError(
            "Не удалось обработать PDF на сервере. Попробуйте позже или загрузите изображение."
          );
        } else if (
          error instanceof Error &&
          (error.message === "image_decode_failed" || error.message === "read_failed")
        ) {
          setError(
            "Не удалось прочитать файл. Проверьте целостность файла или выберите другое расширение."
          );
        } else {
          setError(
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
      setError,
      setUploadProgress,
      setUploadingDoc,
      syncUploadedDocumentAsset,
      upsertLibraryItem,
      userId,
    ]
  );

  const handleDocumentSnapshotToBoard = useCallback(async () => {
    const active = documentState.assets.find((asset) => asset.id === documentState.activeAssetId);
    if (!active) return;
    const insertPosition = resolveWorkbookBoardInsertPosition(canvasViewport, boardObjectCount);
    const renderedPage =
      active.type === "pdf"
        ? resolvePrimaryDocumentRenderedPage(active.renderedPages, documentState.page)
        : null;
    const snapshotImageUrl =
      active.type === "image"
        ? active.url.length <= WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS
          ? active.url
          : await optimizeImageDataUrl(active.url, {
              maxEdge: 1_200,
              quality: 0.74,
              maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
            })
        : renderedPage
          ? await optimizeImageDataUrl(renderedPage.imageUrl, {
              maxEdge: 1_100,
              quality: 0.72,
              maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
            })
          : undefined;
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
    handleDocsUpload,
    handleDocumentSnapshotToBoard,
    handleAddDocumentAnnotation,
    handleClearDocumentAnnotations,
    handleLoadBoardFile,
  };
};

type WorkbookDocumentAssetLike = WorkbookDocumentState["assets"][number];
