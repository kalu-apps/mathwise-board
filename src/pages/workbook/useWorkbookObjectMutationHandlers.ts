import { useCallback, type MutableRefObject } from "react";
import { optimizeImageDataUrl, WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS } from "@/features/workbook/model/media";
import { normalizeObjectPayload, WORKBOOK_IMAGE_ASSET_META_KEY } from "@/features/workbook/model/scene";
import {
  ensureWorkbookObjectZOrder,
  resolveWorkbookObjectReorderZOrder,
} from "@/features/workbook/model/objectZOrder";
import { uploadWorkbookAsset } from "@/features/workbook/model/api";
import {
  applyWorkbookBoardObjectPatchById,
  resolveWorkbookBoardObjectPosition,
} from "@/features/workbook/model/boardObjectStore";
import { observeWorkbookRealtimeVolatileDrop } from "@/features/workbook/model/realtimeObservability";
import {
  mergeBoardObjectPatches,
  mergeBoardObjectWithPatch,
} from "@/features/workbook/model/runtime";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookLibraryState,
} from "@/features/workbook/model/types";
import { generateId } from "@/shared/lib/id";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";
import {
  buildBoardObjectDiffPatch,
  clampBoardObjectToPageFrame,
  cloneSerializable,
} from "./WorkbookSessionPage.core";

type StateUpdater<T> = T | ((current: T) => T);
type SetState<T> = (updater: StateUpdater<T>) => void;

type AppendEventsAndApply = (
  events: WorkbookClientEventInput[],
  options?: {
    trackHistory?: boolean;
    markDirty?: boolean;
    historyEntry?: unknown;
  }
) => Promise<void>;

type UseWorkbookObjectMutationHandlersParams = {
  sessionId: string;
  canDraw: boolean;
  canSelect: boolean;
  canManageSession: boolean;
  currentBoardPage: number;
  activeSceneLayerId: string;
  pageFrameWidth: number;
  userId?: string;
  volatilePreviewQueueMax: number;
  realtimeBackpressureV2Enabled: boolean;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardObjectIndexByIdRef: MutableRefObject<Map<string, number>>;
  objectUpdateQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectUpdateDispatchOptionsRef: MutableRefObject<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >;
  objectUpdateHistoryBeforeRef: MutableRefObject<Map<string, WorkbookBoardObject>>;
  objectPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectPreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
  setSelectedObjectId: SetState<string | null>;
  setError: (value: string | null) => void;
  appendEventsAndApply: AppendEventsAndApply;
  sendWorkbookLiveEvents: (events: WorkbookClientEventInput[]) => void;
  upsertLibraryItem: (
    item: WorkbookLibraryState["items"][number],
    options?: {
      silent?: boolean;
      onError?: (error: unknown) => void;
    }
  ) => Promise<boolean> | boolean;
  commitInteractiveBoardObjects: (objects: WorkbookBoardObject[]) => void;
  handleRealtimeConflict: () => void;
  applyConstraintsForObject: (
    object: WorkbookBoardObject,
    allObjects: WorkbookBoardObject[]
  ) => WorkbookBoardObject;
  scheduleLocalPreviewBoardObjectPatch: (objectId: string, patch: Partial<WorkbookBoardObject>) => void;
  scheduleVolatileSyncFlush: () => void;
  flushQueuedObjectUpdate: (objectId: string) => void;
};

export const useWorkbookObjectMutationHandlers = ({
  sessionId,
  canDraw,
  canSelect,
  canManageSession,
  currentBoardPage,
  activeSceneLayerId,
  pageFrameWidth,
  userId,
  volatilePreviewQueueMax,
  realtimeBackpressureV2Enabled,
  boardObjectsRef,
  boardObjectIndexByIdRef,
  objectUpdateQueuedPatchRef,
  objectUpdateDispatchOptionsRef,
  objectUpdateHistoryBeforeRef,
  objectPreviewQueuedPatchRef,
  objectPreviewQueuedAtRef,
  setSelectedObjectId,
  setError,
  appendEventsAndApply,
  sendWorkbookLiveEvents,
  upsertLibraryItem,
  commitInteractiveBoardObjects,
  handleRealtimeConflict,
  applyConstraintsForObject,
  scheduleLocalPreviewBoardObjectPatch,
  scheduleVolatileSyncFlush,
  flushQueuedObjectUpdate,
}: UseWorkbookObjectMutationHandlersParams) => {
  const resolveImageMimeTypeFromDataUrl = (dataUrl: string) => {
    const match = /^data:([^;,]+)[;,]/i.exec(dataUrl.trim());
    return match?.[1]?.toLowerCase() || undefined;
  };

  const commitObjectCreate = useCallback(
    async (
      object: WorkbookBoardObject,
      options?: {
        auxiliaryEvents?: WorkbookClientEventInput[];
      }
    ) => {
      if (!sessionId || !canDraw) return false;
      const currentMeta =
        object.meta && typeof object.meta === "object" ? object.meta : {};
      let objectWithPage: WorkbookBoardObject = {
        ...object,
        page: object.page ?? currentBoardPage,
        meta: {
          ...currentMeta,
          sceneLayerId: activeSceneLayerId,
        },
      };
      if (
        objectWithPage.type === "image" &&
        typeof objectWithPage.imageUrl === "string" &&
        objectWithPage.imageUrl.startsWith("data:image/") &&
        objectWithPage.imageUrl.length > WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS
      ) {
        objectWithPage = {
          ...objectWithPage,
          imageUrl: await optimizeImageDataUrl(objectWithPage.imageUrl, {
            maxEdge: 1_200,
            quality: 0.72,
            maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
          }),
        };
      }
      if (
        objectWithPage.type === "image" &&
        typeof objectWithPage.imageUrl === "string" &&
        objectWithPage.imageUrl.startsWith("data:image/") &&
        objectWithPage.imageUrl.length > WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS
      ) {
        setError(
          "Не удалось подготовить изображение для доски. Уменьшите размер файла или добавьте его через окно документов."
        );
        return false;
      }
      if (
        objectWithPage.type === "image" &&
        typeof objectWithPage.imageUrl === "string" &&
        objectWithPage.imageUrl.startsWith("data:image/")
      ) {
        try {
          const uploadedAsset = await uploadWorkbookAsset({
            sessionId,
            fileName:
              objectWithPage.imageName ||
              `board-image-${objectWithPage.id || generateId()}.png`,
            dataUrl: objectWithPage.imageUrl,
            mimeType: resolveImageMimeTypeFromDataUrl(objectWithPage.imageUrl),
          });
          const currentMeta =
            objectWithPage.meta && typeof objectWithPage.meta === "object"
              ? objectWithPage.meta
              : {};
          objectWithPage = {
            ...objectWithPage,
            imageUrl: uploadedAsset.url,
            meta: {
              ...currentMeta,
              [WORKBOOK_IMAGE_ASSET_META_KEY]: uploadedAsset.assetId,
            },
          };
        } catch (error) {
          if (error instanceof ApiError && error.status === 413) {
            setError(
              "Не удалось добавить изображение: файл слишком большой для обработки. Уменьшите размер и повторите попытку."
            );
            return false;
          }
          if (isRecoverableApiError(error)) {
            setError(
              "Не удалось загрузить изображение в хранилище. Проверьте соединение и повторите попытку."
            );
            return false;
          }
          setError("Не удалось подготовить изображение для синхронизации.");
          return false;
        }
      }
      const normalizedObjectWithPage =
        normalizeObjectPayload(objectWithPage) ?? objectWithPage;
      const clampedObjectWithPage = clampBoardObjectToPageFrame(
        normalizedObjectWithPage,
        pageFrameWidth
      );
      const objectWithZOrder = ensureWorkbookObjectZOrder(
        clampedObjectWithPage,
        boardObjectsRef.current
      );
      const optimisticBoardObjects = boardObjectsRef.current.some(
        (item) => item.id === objectWithZOrder.id
      )
        ? boardObjectsRef.current
        : [...boardObjectsRef.current, objectWithZOrder];
      commitInteractiveBoardObjects(optimisticBoardObjects);
      const createEvent: WorkbookClientEventInput = {
        type: "board.object.create",
        payload: { object: objectWithZOrder },
        clientEventId: generateId(),
      };
      try {
        sendWorkbookLiveEvents([createEvent]);
        const persistEvents: WorkbookClientEventInput[] = [
          ...(options?.auxiliaryEvents ?? []),
          createEvent,
        ];
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await appendEventsAndApply(persistEvents);
            break;
          } catch (error) {
            const isConflict =
              error instanceof ApiError &&
              error.code === "conflict" &&
              error.status === 409;
            if (isConflict) {
              if (attempt === 0) {
                await new Promise<void>((resolve) => {
                  window.setTimeout(resolve, 180);
                });
                continue;
              }
              handleRealtimeConflict();
            }
            if (isRecoverableApiError(error) && attempt < 2) {
              await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 160 * (attempt + 1));
              });
              continue;
            }
            throw error;
          }
        }
        if (objectWithZOrder.type === "image" && objectWithZOrder.imageUrl) {
          const now = new Date().toISOString();
          void upsertLibraryItem({
            id: generateId(),
            name: objectWithZOrder.imageName || "Изображение с доски",
            type: "image",
            ownerUserId: userId ?? "unknown",
            sourceUrl: objectWithZOrder.imageUrl,
            createdAt: now,
            updatedAt: now,
            folderId: null,
          });
        }
        return true;
      } catch {
        const rolledBackBoardObjects = boardObjectsRef.current.filter(
          (item) => item.id !== objectWithZOrder.id
        );
        commitInteractiveBoardObjects(rolledBackBoardObjects);
        setSelectedObjectId((current) =>
          current === objectWithZOrder.id ? null : current
        );
      setError("Не удалось создать объект.");
        return false;
      }
    },
    [
      sessionId,
      canDraw,
      currentBoardPage,
      activeSceneLayerId,
      pageFrameWidth,
      commitInteractiveBoardObjects,
      setError,
      sendWorkbookLiveEvents,
      appendEventsAndApply,
      handleRealtimeConflict,
      upsertLibraryItem,
      userId,
      setSelectedObjectId,
      boardObjectsRef,
    ]
  );

  const commitObjectUpdate = useCallback(
    (
      objectId: string,
      patch: Partial<WorkbookBoardObject>,
      options?: {
        trackHistory?: boolean;
        markDirty?: boolean;
      }
    ) => {
      if (!sessionId || !canSelect) return;
      const objectsSnapshot = boardObjectsRef.current;
      const currentObjectPosition = resolveWorkbookBoardObjectPosition(
        objectsSnapshot,
        objectId,
        boardObjectIndexByIdRef.current
      );
      if (currentObjectPosition < 0) return;
      const currentObject = objectsSnapshot[currentObjectPosition];
      const isPreviewOnly =
        options?.trackHistory === false && options?.markDirty === false;
      const merged = mergeBoardObjectWithPatch(currentObject, patch);
      const constrained = applyConstraintsForObject(merged, objectsSnapshot);
      const shouldApplyGeometryPatch =
        patch.x !== undefined ||
        patch.y !== undefined ||
        patch.width !== undefined ||
        patch.height !== undefined;
      const constrainedPatch: Partial<WorkbookBoardObject> = shouldApplyGeometryPatch
        ? {
            ...patch,
            x: constrained.x,
            y: constrained.y,
            width: constrained.width,
            height: constrained.height,
          }
        : patch;
      const clampedObject = clampBoardObjectToPageFrame(
        mergeBoardObjectWithPatch(currentObject, constrainedPatch),
        pageFrameWidth
      );
      const normalizedPatch = buildBoardObjectDiffPatch(currentObject, clampedObject);
      if (!normalizedPatch) return;
      const applyPatchToBoardObjects = (source: WorkbookBoardObject[]) =>
        applyWorkbookBoardObjectPatchById({
          objects: source,
          objectId,
          patch: normalizedPatch,
          index: boardObjectIndexByIdRef.current,
        }).nextObjects;
      if (isPreviewOnly) {
        scheduleLocalPreviewBoardObjectPatch(objectId, normalizedPatch);
        const now = Date.now();
        const pendingPatch = objectPreviewQueuedPatchRef.current.get(objectId) ?? {};
        objectPreviewQueuedPatchRef.current.set(
          objectId,
          mergeBoardObjectPatches(pendingPatch, normalizedPatch)
        );
        objectPreviewQueuedAtRef.current.set(objectId, now);
        if (objectPreviewQueuedPatchRef.current.size > volatilePreviewQueueMax) {
          const overflow = objectPreviewQueuedPatchRef.current.size - volatilePreviewQueueMax;
          const ordered = Array.from(objectPreviewQueuedAtRef.current.entries())
            .sort((left, right) => left[1] - right[1])
            .slice(0, overflow);
          if (overflow > 0 && sessionId && realtimeBackpressureV2Enabled) {
            observeWorkbookRealtimeVolatileDrop({
              sessionId,
              channel: "live",
              droppedCount: overflow,
              reason: "object_preview_queue_trim",
              eventTypes: ["board.object.preview"],
            });
          }
          ordered.forEach(([expiredObjectId]) => {
            objectPreviewQueuedAtRef.current.delete(expiredObjectId);
            objectPreviewQueuedPatchRef.current.delete(expiredObjectId);
          });
        }
        scheduleVolatileSyncFlush();
        return;
      }
      if (
        options?.trackHistory !== false &&
        !objectUpdateHistoryBeforeRef.current.has(objectId)
      ) {
        objectUpdateHistoryBeforeRef.current.set(objectId, cloneSerializable(currentObject));
      }
      const optimisticBoardObjects = applyPatchToBoardObjects(boardObjectsRef.current);
      commitInteractiveBoardObjects(optimisticBoardObjects);
      const pendingPatch = objectUpdateQueuedPatchRef.current.get(objectId) ?? {};
      objectUpdateQueuedPatchRef.current.set(
        objectId,
        mergeBoardObjectPatches(pendingPatch, normalizedPatch)
      );
      const pendingDispatchOptions =
        objectUpdateDispatchOptionsRef.current.get(objectId) ?? null;
      const nextDispatchOptions = {
        trackHistory:
          (pendingDispatchOptions?.trackHistory ?? false) ||
          (options?.trackHistory ?? true),
        markDirty:
          (pendingDispatchOptions?.markDirty ?? false) || (options?.markDirty ?? true),
      };
      objectUpdateDispatchOptionsRef.current.set(objectId, nextDispatchOptions);
      flushQueuedObjectUpdate(objectId);
    },
    [
      applyConstraintsForObject,
      canSelect,
      commitInteractiveBoardObjects,
      flushQueuedObjectUpdate,
      realtimeBackpressureV2Enabled,
      scheduleLocalPreviewBoardObjectPatch,
      scheduleVolatileSyncFlush,
      sessionId,
      pageFrameWidth,
      volatilePreviewQueueMax,
      boardObjectsRef,
      boardObjectIndexByIdRef,
      objectPreviewQueuedAtRef,
      objectPreviewQueuedPatchRef,
      objectUpdateDispatchOptionsRef,
      objectUpdateHistoryBeforeRef,
      objectUpdateQueuedPatchRef,
    ]
  );

  const commitObjectPin = useCallback(
    async (objectId: string, pinned: boolean) => {
      if (!sessionId || !canManageSession) return;
      try {
        await appendEventsAndApply([
          {
            type: "board.object.pin",
            payload: { objectId, pinned },
          },
        ]);
      } catch {
        setError("Не удалось изменить закрепление объекта.");
      }
    },
    [appendEventsAndApply, canManageSession, sessionId, setError]
  );

  const commitObjectReorder = useCallback(
    async (objectId: string, direction: "front" | "back") => {
      if (!sessionId || !canSelect) return;
      const currentBoardObjects = boardObjectsRef.current;
      const target = currentBoardObjects.find((item) => item.id === objectId) ?? null;
      if (!target || target.type !== "image" || target.locked) return;
      const nextZOrder = resolveWorkbookObjectReorderZOrder({
        objects: currentBoardObjects,
        targetObjectId: objectId,
        direction,
      });
      if (nextZOrder === null) return;
      const optimisticBoardObjects = currentBoardObjects.map((item) =>
        item.id === objectId ? { ...item, zOrder: nextZOrder } : item
      );
      commitInteractiveBoardObjects(optimisticBoardObjects);
      try {
        await appendEventsAndApply([
          {
            type: "board.object.reorder",
            payload: { objectId, zOrder: nextZOrder },
          },
        ]);
      } catch (error) {
        commitInteractiveBoardObjects(currentBoardObjects);
        if (
          error instanceof ApiError &&
          error.code === "conflict" &&
          error.status === 409
        ) {
          handleRealtimeConflict();
          return;
        }
        setError("Не удалось изменить порядок изображения.");
      }
    },
    [
      appendEventsAndApply,
      canSelect,
      commitInteractiveBoardObjects,
      handleRealtimeConflict,
      sessionId,
      setError,
      boardObjectsRef,
    ]
  );

  return {
    commitObjectCreate,
    commitObjectUpdate,
    commitObjectPin,
    commitObjectReorder,
  };
};
