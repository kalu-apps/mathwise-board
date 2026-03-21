import { useCallback, type MutableRefObject } from "react";
import { saveWorkbookSnapshot } from "@/features/workbook/model/api";
import { optimizeImageDataUrl } from "@/features/workbook/model/media";
import { WORKBOOK_IMAGE_ASSET_META_KEY } from "@/features/workbook/model/scene";
import { encodeWorkbookSceneSnapshots } from "@/features/workbook/model/workbookSceneCodec";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookLibraryState,
  WorkbookStroke,
  WorkbookTimerState,
} from "@/features/workbook/model/types";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";

const SNAPSHOT_OBJECT_IMAGE_MAX_DATA_URL_CHARS = 42_000;
const SNAPSHOT_ASSET_IMAGE_MAX_DATA_URL_CHARS = 56_000;
const SNAPSHOT_RENDERED_PAGE_IMAGE_MAX_DATA_URL_CHARS = 36_000;

interface UseWorkbookPersistSnapshotsParams {
  sessionId: string;
  boardStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  chatMessages: WorkbookChatMessage[];
  comments: WorkbookComment[];
  timerState: WorkbookTimerState;
  boardSettings: WorkbookBoardSettings;
  libraryState: WorkbookLibraryState;
  documentState: WorkbookDocumentState;
  annotationStrokes: WorkbookStroke[];
  latestSeq: number;
  authRequiredRef: MutableRefObject<boolean>;
  dirtyRef: MutableRefObject<boolean>;
  dirtyRevisionRef: MutableRefObject<number>;
  isSavingRef: MutableRefObject<boolean>;
  pendingAutosaveAfterSaveRef: MutableRefObject<boolean>;
  setSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setSaveSyncWarning: (message: string | null) => void;
  handleRealtimeAuthRequired: (status: number) => void;
  scheduleAutosave: (delayMs?: number) => void;
}

export function useWorkbookPersistSnapshots({
  sessionId,
  boardStrokes,
  boardObjects,
  constraints,
  chatMessages,
  comments,
  timerState,
  boardSettings,
  libraryState,
  documentState,
  annotationStrokes,
  latestSeq,
  authRequiredRef,
  dirtyRef,
  dirtyRevisionRef,
  isSavingRef,
  pendingAutosaveAfterSaveRef,
  setSaveState,
  setSaveSyncWarning,
  handleRealtimeAuthRequired,
  scheduleAutosave,
}: UseWorkbookPersistSnapshotsParams) {
  return useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      if (!sessionId) return false;
      if (authRequiredRef.current) return false;
      if (!options?.force && !dirtyRef.current) return true;
      if (isSavingRef.current) {
        pendingAutosaveAfterSaveRef.current = true;
        return true;
      }
      isSavingRef.current = true;
      pendingAutosaveAfterSaveRef.current = false;
      const revisionAtSaveStart = dirtyRevisionRef.current;
      if (!options?.silent) {
        setSaveState("saving");
      }
      const persistEncodedSnapshots = async (encodedSnapshots: {
        boardPayload: unknown;
        annotationPayload: unknown;
      }) => {
        await Promise.all([
          saveWorkbookSnapshot({
            sessionId,
            layer: "board",
            version: latestSeq,
            payload: encodedSnapshots.boardPayload,
          }),
          saveWorkbookSnapshot({
            sessionId,
            layer: "annotations",
            version: latestSeq,
            payload: encodedSnapshots.annotationPayload,
          }),
        ]);
      };
      const markSnapshotSaved = () => {
        if (dirtyRevisionRef.current === revisionAtSaveStart) {
          dirtyRef.current = false;
          setSaveState("saved");
          setSaveSyncWarning(null);
          return;
        }
        dirtyRef.current = true;
        pendingAutosaveAfterSaveRef.current = true;
        setSaveState("saving");
      };
      try {
        const encodedSnapshots = await encodeWorkbookSceneSnapshots({
          boardState: {
            strokes: boardStrokes,
            objects: boardObjects,
            constraints,
            chat: chatMessages,
            comments,
            timer: timerState,
            boardSettings,
            library: libraryState,
            document: documentState,
          },
          annotationState: {
            strokes: annotationStrokes,
            chat: [],
          },
        });
        await persistEncodedSnapshots(encodedSnapshots);
        markSnapshotSaved();
        return true;
      } catch (error) {
        let currentError = error;
        if (error instanceof ApiError && error.status === 413) {
          try {
            const referencedAssetIds = new Set<string>();
            boardObjects.forEach((object) => {
              if (!object.meta || typeof object.meta !== "object") return;
              const assetId = object.meta[WORKBOOK_IMAGE_ASSET_META_KEY];
              if (typeof assetId === "string" && assetId.length > 0) {
                referencedAssetIds.add(assetId);
              }
            });
            if (typeof documentState.activeAssetId === "string" && documentState.activeAssetId) {
              referencedAssetIds.add(documentState.activeAssetId);
            }
            const compactedObjects = await Promise.all(
              boardObjects.map(async (object) => {
                if (
                  object.type !== "image" ||
                  typeof object.imageUrl !== "string" ||
                  !object.imageUrl.startsWith("data:image/")
                ) {
                  return object;
                }
                const hasAssetReference =
                  Boolean(object.meta) &&
                  typeof object.meta === "object" &&
                  typeof object.meta[WORKBOOK_IMAGE_ASSET_META_KEY] === "string";
                if (hasAssetReference) {
                  return {
                    ...object,
                    imageUrl: undefined,
                  };
                }
                const compactedImageUrl = await optimizeImageDataUrl(object.imageUrl, {
                  maxEdge: 1_050,
                  quality: 0.6,
                  maxChars: SNAPSHOT_OBJECT_IMAGE_MAX_DATA_URL_CHARS,
                });
                if (compactedImageUrl === object.imageUrl) return object;
                return {
                  ...object,
                  imageUrl: compactedImageUrl,
                };
              })
            );
            const compactedAssets = await Promise.all(
              documentState.assets.map(async (asset) => {
                const shouldKeepImagePayload = referencedAssetIds.has(asset.id);
                if (!shouldKeepImagePayload) {
                  return {
                    ...asset,
                    url:
                      typeof asset.url === "string" && asset.url.startsWith("data:")
                        ? "data:,"
                        : asset.url,
                    renderedPages: undefined,
                  };
                }
                let nextUrl = asset.url;
                if (typeof nextUrl === "string" && nextUrl.startsWith("data:image/")) {
                  nextUrl = await optimizeImageDataUrl(nextUrl, {
                    maxEdge: 1_250,
                    quality: 0.64,
                    maxChars: SNAPSHOT_ASSET_IMAGE_MAX_DATA_URL_CHARS,
                  });
                }
                const nextRenderedPages = Array.isArray(asset.renderedPages)
                  ? await Promise.all(
                      asset.renderedPages.map(async (renderedPage) => {
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
                            quality: 0.58,
                            maxChars: SNAPSHOT_RENDERED_PAGE_IMAGE_MAX_DATA_URL_CHARS,
                          }
                        );
                        if (compactedRenderedImageUrl === renderedPage.imageUrl) {
                          return renderedPage;
                        }
                        return {
                          ...renderedPage,
                          imageUrl: compactedRenderedImageUrl,
                        };
                      })
                    )
                  : asset.renderedPages;
                return {
                  ...asset,
                  url: nextUrl,
                  renderedPages: nextRenderedPages,
                };
              })
            );

            const compactedEncodedSnapshots = await encodeWorkbookSceneSnapshots({
              boardState: {
                strokes: boardStrokes,
                objects: compactedObjects,
                constraints,
                chat: chatMessages,
                comments,
                timer: timerState,
                boardSettings,
                library: libraryState,
                document: {
                  ...documentState,
                  assets: compactedAssets,
                },
              },
              annotationState: {
                strokes: annotationStrokes,
                chat: [],
              },
            });
            await persistEncodedSnapshots(compactedEncodedSnapshots);
            markSnapshotSaved();
            setSaveSyncWarning(
              "Снимок доски сохранён в компактном режиме, чтобы избежать лимита размера."
            );
            return true;
          } catch (compactionError) {
            currentError = compactionError;
          }
        }
        if (
          currentError instanceof ApiError &&
          (currentError.status === 401 || currentError.status === 403 || currentError.status === 404)
        ) {
          handleRealtimeAuthRequired(currentError.status);
          return false;
        }
        if (isRecoverableApiError(currentError)) {
          setSaveState("saving");
          setSaveSyncWarning(
            "Связь нестабильна. Автосохранение продолжит синхронизацию при восстановлении соединения."
          );
          pendingAutosaveAfterSaveRef.current = true;
          return false;
        }

        setSaveState("error");
        setSaveSyncWarning(
          "Автосохранение временно недоступно. Не закрывайте вкладку: повторяем синхронизацию."
        );
        return false;
      } finally {
        isSavingRef.current = false;
        if (pendingAutosaveAfterSaveRef.current) {
          scheduleAutosave(1_400);
        }
      }
    },
    [
      annotationStrokes,
      authRequiredRef,
      boardObjects,
      boardSettings,
      boardStrokes,
      chatMessages,
      comments,
      constraints,
      dirtyRef,
      dirtyRevisionRef,
      documentState,
      handleRealtimeAuthRequired,
      isSavingRef,
      latestSeq,
      libraryState,
      pendingAutosaveAfterSaveRef,
      scheduleAutosave,
      sessionId,
      setSaveState,
      setSaveSyncWarning,
      timerState,
    ]
  );
}
