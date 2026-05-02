import { useCallback, useRef, type MutableRefObject } from "react";
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

type SnapshotCompactionLevel = "moderate" | "aggressive" | "minimal";

const SNAPSHOT_OBJECT_IMAGE_MAX_DATA_URL_CHARS = 42_000;
const SNAPSHOT_ASSET_IMAGE_MAX_DATA_URL_CHARS = 56_000;
const SNAPSHOT_RENDERED_PAGE_IMAGE_MAX_DATA_URL_CHARS = 36_000;
const SNAPSHOT_OBJECT_IMAGE_AGGRESSIVE_MAX_DATA_URL_CHARS = 18_000;
const SNAPSHOT_ASSET_IMAGE_AGGRESSIVE_MAX_DATA_URL_CHARS = 24_000;
const SNAPSHOT_RENDERED_PAGE_IMAGE_AGGRESSIVE_MAX_DATA_URL_CHARS = 12_000;
const SNAPSHOT_OBJECT_IMAGE_MINIMAL_MAX_DATA_URL_CHARS = 8_000;
const SNAPSHOT_PREEMPTIVE_COMPACTION_DATA_URL_CHARS = 160_000;
const SNAPSHOT_MIN_AUTOSAVE_GAP_MS = 2_600;
const SNAPSHOT_SYNC_WARNING_FAILURE_WINDOW_MS = 45_000;
const SNAPSHOT_SYNC_WARNING_MIN_FAILURES = 3;
const SNAPSHOT_SYNC_WARNING_COOLDOWN_MS = 90_000;
const SNAPSHOT_SYNC_WARNING_MESSAGE =
  "Резервное сохранение доски заметно задерживается. Проверьте сеть или VPN. Работа на доске продолжается.";

const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:image/");

const isDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:");

const resolveSnapshotCompactionProfile = (level: SnapshotCompactionLevel) => {
  if (level === "minimal") {
    return {
      object: { maxEdge: 560, quality: 0.44, maxChars: SNAPSHOT_OBJECT_IMAGE_MINIMAL_MAX_DATA_URL_CHARS },
      asset: { maxEdge: 820, quality: 0.46, maxChars: SNAPSHOT_OBJECT_IMAGE_MINIMAL_MAX_DATA_URL_CHARS },
      renderedPage: {
        maxEdge: 620,
        quality: 0.42,
        maxChars: SNAPSHOT_OBJECT_IMAGE_MINIMAL_MAX_DATA_URL_CHARS,
      },
      dropAssetPayloadForAll: true,
      warning:
        "Снимок доски сохранён в минимальном компактном режиме, чтобы избежать переполнения.",
    };
  }

  if (level === "aggressive") {
    return {
      object: { maxEdge: 860, quality: 0.52, maxChars: SNAPSHOT_OBJECT_IMAGE_AGGRESSIVE_MAX_DATA_URL_CHARS },
      asset: { maxEdge: 980, quality: 0.54, maxChars: SNAPSHOT_ASSET_IMAGE_AGGRESSIVE_MAX_DATA_URL_CHARS },
      renderedPage: {
        maxEdge: 760,
        quality: 0.48,
        maxChars: SNAPSHOT_RENDERED_PAGE_IMAGE_AGGRESSIVE_MAX_DATA_URL_CHARS,
      },
      dropAssetPayloadForAll: false,
      warning:
        "Снимок доски сохранён в усиленном компактном режиме из-за большого объёма данных.",
    };
  }

  return {
    object: { maxEdge: 1_050, quality: 0.6, maxChars: SNAPSHOT_OBJECT_IMAGE_MAX_DATA_URL_CHARS },
    asset: { maxEdge: 1_250, quality: 0.64, maxChars: SNAPSHOT_ASSET_IMAGE_MAX_DATA_URL_CHARS },
    renderedPage: {
      maxEdge: 980,
      quality: 0.58,
      maxChars: SNAPSHOT_RENDERED_PAGE_IMAGE_MAX_DATA_URL_CHARS,
    },
    dropAssetPayloadForAll: false,
    warning: "Снимок доски сохранён в компактном режиме, чтобы избежать лимита размера.",
  };
};

const collectReferencedAssetIds = (boardObjects: WorkbookBoardObject[]) => {
  const referencedAssetIds = new Set<string>();
  boardObjects.forEach((object) => {
    if (!object.meta || typeof object.meta !== "object") return;
    const assetId = object.meta[WORKBOOK_IMAGE_ASSET_META_KEY];
    if (typeof assetId === "string" && assetId.trim().length > 0) {
      referencedAssetIds.add(assetId.trim());
    }
  });
  return referencedAssetIds;
};

const estimateEmbeddedDataUrlChars = (
  boardObjects: WorkbookBoardObject[],
  documentState: WorkbookDocumentState
) => {
  const objectChars = boardObjects.reduce((sum, object) => {
    if (object.type !== "image") return sum;
    return sum + (isImageDataUrl(object.imageUrl) ? object.imageUrl.length : 0);
  }, 0);
  const assetChars = documentState.assets.reduce((sum, asset) => {
    const assetUrlChars = isDataUrl(asset.url) ? asset.url.length : 0;
    const renderedPagesChars = Array.isArray(asset.renderedPages)
      ? asset.renderedPages.reduce(
          (renderedSum, renderedPage) =>
            renderedSum + (isImageDataUrl(renderedPage.imageUrl) ? renderedPage.imageUrl.length : 0),
          0
        )
      : 0;
    return sum + assetUrlChars + renderedPagesChars;
  }, 0);
  return objectChars + assetChars;
};

const compactSnapshotState = async (params: {
  boardObjects: WorkbookBoardObject[];
  documentState: WorkbookDocumentState;
  level: SnapshotCompactionLevel;
}) => {
  const profile = resolveSnapshotCompactionProfile(params.level);
  const referencedAssetIds = collectReferencedAssetIds(params.boardObjects);
  const resolvableAssetIds = new Set(
    params.documentState.assets
      .filter((asset) => typeof asset.url === "string" && asset.url.trim().length > 0)
      .map((asset) => asset.id)
  );
  const compactedObjects = await Promise.all(
    params.boardObjects.map(async (object) => {
      if (object.type !== "image" || !isImageDataUrl(object.imageUrl)) {
        return object;
      }
      const referencedAssetId =
        Boolean(object.meta) &&
        typeof object.meta === "object" &&
        typeof object.meta[WORKBOOK_IMAGE_ASSET_META_KEY] === "string"
          ? String(object.meta[WORKBOOK_IMAGE_ASSET_META_KEY]).trim()
          : "";
      // Drop inline image payload only when the linked asset can actually be resolved from document assets.
      if (referencedAssetId && resolvableAssetIds.has(referencedAssetId)) {
        return {
          ...object,
          imageUrl: undefined,
        };
      }
      const compactedImageUrl = await optimizeImageDataUrl(object.imageUrl, profile.object);
      if (compactedImageUrl === object.imageUrl) return object;
      return {
        ...object,
        imageUrl: compactedImageUrl,
      };
    })
  );
  const compactedAssets = await Promise.all(
    params.documentState.assets.map(async (asset) => {
      const shouldKeepImagePayload =
        !profile.dropAssetPayloadForAll && referencedAssetIds.has(asset.id);
      if (!shouldKeepImagePayload) {
        return {
          ...asset,
          url: isDataUrl(asset.url) ? "data:," : asset.url,
          renderedPages: undefined,
        };
      }
      let nextUrl = asset.url;
      if (isImageDataUrl(nextUrl)) {
        nextUrl = await optimizeImageDataUrl(nextUrl, profile.asset);
      } else if (isDataUrl(nextUrl)) {
        nextUrl = "data:,";
      }
      const nextRenderedPages = Array.isArray(asset.renderedPages)
        ? await Promise.all(
            asset.renderedPages.map(async (renderedPage) => {
              if (!isImageDataUrl(renderedPage.imageUrl)) {
                return renderedPage;
              }
              const compactedRenderedImageUrl = await optimizeImageDataUrl(
                renderedPage.imageUrl,
                profile.renderedPage
              );
              if (
                compactedRenderedImageUrl === renderedPage.imageUrl &&
                params.level === "minimal"
              ) {
                return {
                  ...renderedPage,
                  imageUrl: "data:,",
                };
              }
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

  return {
    objects: compactedObjects,
    document: {
      ...params.documentState,
      assets: compactedAssets,
    },
    warning: profile.warning,
  };
};

interface UseWorkbookPersistSnapshotsParams {
  sessionId: string;
  boardStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  chatMessages: WorkbookChatMessage[];
  comments: WorkbookComment[];
  timerState: WorkbookTimerState | null;
  boardSettings: WorkbookBoardSettings;
  libraryState: WorkbookLibraryState;
  documentState: WorkbookDocumentState;
  annotationStrokes: WorkbookStroke[];
  latestSeq: number;
  lastAppliedSeqRef: MutableRefObject<number>;
  authRequiredRef: MutableRefObject<boolean>;
  dirtyRef: MutableRefObject<boolean>;
  dirtyRevisionRef: MutableRefObject<number>;
  isSavingRef: MutableRefObject<boolean>;
  pendingAutosaveAfterSaveRef: MutableRefObject<boolean>;
  setSaveState: (state: "saved" | "unsaved" | "saving" | "error") => void;
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
  lastAppliedSeqRef,
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
  const lastPersistCompletedAtRef = useRef(0);
  const recoverableSnapshotIssueRef = useRef({
    firstFailureAtMs: 0,
    failureCount: 0,
    lastWarningAtMs: 0,
  });
  const clearRecoverableSnapshotIssue = useCallback(() => {
    recoverableSnapshotIssueRef.current.firstFailureAtMs = 0;
    recoverableSnapshotIssueRef.current.failureCount = 0;
  }, []);
  const noteRecoverableSnapshotIssue = useCallback(() => {
    const now = Date.now();
    const state = recoverableSnapshotIssueRef.current;
    if (
      state.firstFailureAtMs <= 0 ||
      now - state.firstFailureAtMs > SNAPSHOT_SYNC_WARNING_FAILURE_WINDOW_MS
    ) {
      state.firstFailureAtMs = now;
      state.failureCount = 1;
      return;
    }
    state.failureCount += 1;
    if (
      state.failureCount >= SNAPSHOT_SYNC_WARNING_MIN_FAILURES &&
      now - state.lastWarningAtMs >= SNAPSHOT_SYNC_WARNING_COOLDOWN_MS
    ) {
      state.lastWarningAtMs = now;
      setSaveSyncWarning(SNAPSHOT_SYNC_WARNING_MESSAGE);
    }
  }, [setSaveSyncWarning]);

  return useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      if (!sessionId) return false;
      if (authRequiredRef.current) return false;
      if (!options?.force && !dirtyRef.current) return true;
      if (isSavingRef.current) {
        pendingAutosaveAfterSaveRef.current = true;
        return true;
      }
      if (
        options?.force &&
        !options?.silent &&
        lastPersistCompletedAtRef.current > 0
      ) {
        const elapsedMs = Date.now() - lastPersistCompletedAtRef.current;
        if (elapsedMs < SNAPSHOT_MIN_AUTOSAVE_GAP_MS) {
          pendingAutosaveAfterSaveRef.current = true;
          scheduleAutosave(SNAPSHOT_MIN_AUTOSAVE_GAP_MS - elapsedMs + 120);
          return true;
        }
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
        const safeAppliedSeq = Math.max(
          1,
          Number.isFinite(lastAppliedSeqRef.current)
            ? Math.trunc(lastAppliedSeqRef.current)
            : 1
        );
        const safeLatestSeq = Math.max(
          1,
          Number.isFinite(latestSeq) ? Math.trunc(latestSeq) : 1
        );
        const snapshotVersion = Math.min(safeAppliedSeq, safeLatestSeq);
        await Promise.all([
          saveWorkbookSnapshot({
            sessionId,
            layer: "board",
            version: snapshotVersion,
            payload: encodedSnapshots.boardPayload,
          }),
          saveWorkbookSnapshot({
            sessionId,
            layer: "annotations",
            version: snapshotVersion,
            payload: encodedSnapshots.annotationPayload,
          }),
        ]);
      };
      const markSnapshotSaved = () => {
        lastPersistCompletedAtRef.current = Date.now();
        clearRecoverableSnapshotIssue();
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
      const persistStateSnapshots = async (
        nextBoardObjects: WorkbookBoardObject[],
        nextDocumentState: WorkbookDocumentState
      ) => {
        const encodedSnapshots = await encodeWorkbookSceneSnapshots({
          boardState: {
            strokes: boardStrokes,
            objects: nextBoardObjects,
            constraints,
            chat: chatMessages,
            comments,
            timer: timerState,
            boardSettings,
            library: libraryState,
            document: nextDocumentState,
          },
          annotationState: {
            strokes: annotationStrokes,
            chat: [],
          },
        });
        await persistEncodedSnapshots(encodedSnapshots);
      };

      const persistCompactedSnapshots = async (
        levels: SnapshotCompactionLevel[]
      ): Promise<{ warning: string } | null> => {
        let lastError: unknown = null;
        for (const level of levels) {
          try {
            const compacted = await compactSnapshotState({
              boardObjects,
              documentState,
              level,
            });
            await persistStateSnapshots(compacted.objects, compacted.document);
            return { warning: compacted.warning };
          } catch (error) {
            lastError = error;
            if (error instanceof ApiError && error.status === 413) {
              continue;
            }
            throw error;
          }
        }
        if (lastError) {
          throw lastError;
        }
        return null;
      };

      let compactionAttempted = false;
      try {
        const shouldPreemptiveCompact =
          estimateEmbeddedDataUrlChars(boardObjects, documentState) >=
          SNAPSHOT_PREEMPTIVE_COMPACTION_DATA_URL_CHARS;
        if (shouldPreemptiveCompact) {
          compactionAttempted = true;
          const compacted = await persistCompactedSnapshots(["moderate", "aggressive", "minimal"]);
          if (compacted) {
            markSnapshotSaved();
            return true;
          }
        }

        await persistStateSnapshots(boardObjects, documentState);
        markSnapshotSaved();
        return true;
      } catch (error) {
        let currentError = error;
        if (error instanceof ApiError && error.status === 413 && !compactionAttempted) {
          try {
            const compacted = await persistCompactedSnapshots([
              "moderate",
              "aggressive",
              "minimal",
            ]);
            if (compacted) {
              markSnapshotSaved();
              return true;
            }
          } catch (compactionError) {
            currentError = compactionError;
          }
        }
        if (currentError instanceof ApiError && currentError.status === 401) {
          handleRealtimeAuthRequired(currentError.status);
          return false;
        }
        if (
          currentError instanceof ApiError &&
          (currentError.status === 403 || currentError.status === 404)
        ) {
          // Snapshot persistence can be temporarily blocked by ACL/storage routing.
          // Keep collaborative sync alive and avoid forcing auth-loss mode.
          dirtyRef.current = false;
          pendingAutosaveAfterSaveRef.current = false;
          setSaveState("saved");
          setSaveSyncWarning(null);
          return true;
        }
        if (isRecoverableApiError(currentError)) {
          setSaveState("saving");
          noteRecoverableSnapshotIssue();
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
      clearRecoverableSnapshotIssue,
      dirtyRef,
      dirtyRevisionRef,
      documentState,
      handleRealtimeAuthRequired,
      isSavingRef,
      latestSeq,
      lastAppliedSeqRef,
      libraryState,
      noteRecoverableSnapshotIssue,
      pendingAutosaveAfterSaveRef,
      scheduleAutosave,
      sessionId,
      setSaveState,
      setSaveSyncWarning,
      timerState,
    ]
  );
}
