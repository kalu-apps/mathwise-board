import { startTransition, useCallback } from "react";
import {
  getWorkbookEvents,
  getWorkbookSession,
  getWorkbookSnapshot,
  openWorkbookSession,
} from "@/features/workbook/model/api";
import { reportWorkbookLoadStageMetric } from "@/features/workbook/model/workbookPerformance";
import { decodeWorkbookSceneSnapshots } from "@/features/workbook/model/workbookSceneCodec";
import { processWorkbookItemsInChunks } from "@/features/workbook/model/workbookSceneHydration";
import type {
  WorkbookBoardObject,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookLibraryState,
  WorkbookStroke,
  WorkbookTimerState,
} from "@/features/workbook/model/types";
import { ApiError } from "@/shared/api/client";
import { DEFAULT_SMART_INK_OPTIONS } from "./workbookBoardSettingsModel";
import {
  DEFAULT_BOARD_SETTINGS,
  DEFAULT_LIBRARY,
  SNAPSHOT_CONSTRAINT_PREP_CHUNK_SIZE,
  SNAPSHOT_OBJECT_PREP_CHUNK_SIZE,
  SNAPSHOT_STROKE_PREP_CHUNK_SIZE,
  clampBoardObjectToPageFrame,
  getNowMs,
} from "./WorkbookSessionPage.core";
import { normalizeSceneLayersForBoard } from "./WorkbookSessionPage.geometry";
import type { WorkbookSessionLoadParams } from "./useWorkbookSessionLoadAuthTypes";
import {
  applyWorkbookSessionAccessError,
  reportWorkbookFirstInteractiveMetric,
} from "./workbookSessionLoadHelpers";

export const useWorkbookSessionLoadSession = ({
  sessionId,
  isWorkbookSessionAuthLost,
  clearIncomingRealtimeApplyQueue,
  clearLocalPreviewPatchRuntime,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  recoverChatMessagesFromEvents,
  setSaveState,
  setError,
  setSaveSyncWarning,
  setBootstrapReady,
  setLoading,
  setSession,
  setBoardStrokes,
  setBoardObjects,
  setConstraints,
  setBoardSettings,
  setAnnotationStrokes,
  setLatestSeq,
  setUndoDepth,
  setRedoDepth,
  setFocusPoint,
  setPointerPoint,
  setFocusPointsByUser,
  setPointerPointsByUser,
  setChatMessages,
  setComments,
  setTimerState,
  setLibraryState,
  setDocumentState,
  authRequiredRef,
  loadSessionRequestIdRef,
  firstInteractiveMetricReportedRef,
  queuedBoardSettingsCommitRef,
  queuedBoardSettingsHistoryBeforeRef,
  boardSettingsCommitTimerRef,
  latestSeqRef,
  processedEventIdsRef,
  smartInkStrokeBufferRef,
  smartInkProcessedStrokeIdsRef,
  dirtyRef,
  undoStackRef,
  redoStackRef,
  focusResetTimersByUserRef,
  boardObjectsRef,
  boardObjectIndexByIdRef,
}: WorkbookSessionLoadParams) => {
  const loadSession = useCallback(
    async (options?: { background?: boolean }) => {
      if (!sessionId || isWorkbookSessionAuthLost) return;
      const isBackground = options?.background === true;
      const loadStartedAtMs = getNowMs();
      const loadRequestId = loadSessionRequestIdRef.current + 1;
      loadSessionRequestIdRef.current = loadRequestId;
      const isStaleLoadRequest = () => loadSessionRequestIdRef.current !== loadRequestId;
      const emitAccessError = (status: 401 | 403 | 404, backgroundMode: boolean) => {
        applyWorkbookSessionAccessError({
          status,
          backgroundMode,
          sessionId,
          authRequiredRef,
          setSaveState,
          setError,
          setSaveSyncWarning,
        });
      };
      clearIncomingRealtimeApplyQueue();
      clearLocalPreviewPatchRuntime();
      if (!isBackground) {
        setBootstrapReady(false);
        firstInteractiveMetricReportedRef.current = false;
        setLoading(true);
        setError(null);
        clearStrokePreviewRuntime();
        clearIncomingEraserPreviewRuntime();
      }
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const [sessionResult, boardSnapshotResult, annotationSnapshotResult] =
            await Promise.allSettled([
              getWorkbookSession(sessionId),
              getWorkbookSnapshot(sessionId, "board"),
              getWorkbookSnapshot(sessionId, "annotations"),
            ]);
          if (isStaleLoadRequest()) return;
          if (sessionResult.status !== "fulfilled") {
            throw sessionResult.reason;
          }
          const sessionData = sessionResult.value;
          const boardSnapshot =
            boardSnapshotResult.status === "fulfilled" ? boardSnapshotResult.value : null;
          const annotationSnapshot =
            annotationSnapshotResult.status === "fulfilled" ? annotationSnapshotResult.value : null;
          const currentLatestSeq = latestSeqRef.current;
          const boardSnapshotVersion =
            boardSnapshot && typeof boardSnapshot.version === "number"
              ? Math.max(0, Math.trunc(boardSnapshot.version))
              : 0;
          const annotationSnapshotVersion =
            annotationSnapshot && typeof annotationSnapshot.version === "number"
              ? Math.max(0, Math.trunc(annotationSnapshot.version))
              : 0;
          const shouldApplyBoardSnapshot = !isBackground
            ? true
            : boardSnapshot !== null && boardSnapshotVersion > currentLatestSeq;
          const shouldApplyAnnotationSnapshot = !isBackground
            ? true
            : annotationSnapshot !== null && annotationSnapshotVersion > currentLatestSeq;
          setSession(sessionData);
          queuedBoardSettingsCommitRef.current = null;
          queuedBoardSettingsHistoryBeforeRef.current = null;
          if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
            window.clearTimeout(boardSettingsCommitTimerRef.current);
            boardSettingsCommitTimerRef.current = null;
          }

          const shouldDecodeSnapshots = shouldApplyBoardSnapshot || shouldApplyAnnotationSnapshot;
          const snapshotDecodeStartedAtMs = shouldDecodeSnapshots ? getNowMs() : null;
          const decodedSnapshots = shouldDecodeSnapshots
            ? await decodeWorkbookSceneSnapshots({
                decodeBoard: shouldApplyBoardSnapshot,
                decodeAnnotations: shouldApplyAnnotationSnapshot,
                boardPayload: boardSnapshot?.payload,
                annotationPayload: annotationSnapshot?.payload,
              })
            : { boardState: null, annotationState: null };
          const normalizedBoard = decodedSnapshots.boardState;
          const normalizedAnnotations = decodedSnapshots.annotationState;
          if (snapshotDecodeStartedAtMs !== null && !isStaleLoadRequest()) {
            reportWorkbookLoadStageMetric({
              sessionId,
              name: "snapshot_decode_ms",
              durationMs: getNowMs() - snapshotDecodeStartedAtMs,
              startedAtMs: snapshotDecodeStartedAtMs,
            });
          }
          if (isStaleLoadRequest()) return;

          const snapshotHydrateStartedAtMs =
            normalizedBoard || normalizedAnnotations ? getNowMs() : null;
          let preparedBoardObjects: WorkbookBoardObject[] | null = null;
          let preparedBoardObjectIndex: Map<string, number> | null = null;
          let preparedBoardStrokes: WorkbookStroke[] | null = null;
          let preparedBoardConstraints: WorkbookConstraint[] | null = null;
          let preparedAnnotationStrokes: WorkbookStroke[] | null = null;
          let deferredBoardState:
            | {
                chat: WorkbookChatMessage[];
                comments: WorkbookComment[];
                timer: WorkbookTimerState | null;
                library: WorkbookLibraryState;
                document: WorkbookDocumentState;
              }
            | null = null;

          if (normalizedBoard) {
            const nextBoardObjects: WorkbookBoardObject[] = [];
            const nextBoardObjectIndex = new Map<string, number>();
            const nextBoardStrokes: WorkbookStroke[] = [];
            const nextConstraints: WorkbookConstraint[] = [];

            const preparedObjects = await processWorkbookItemsInChunks({
              items: normalizedBoard.objects,
              chunkSize: SNAPSHOT_OBJECT_PREP_CHUNK_SIZE,
              isCancelled: isStaleLoadRequest,
              processChunk: (chunk) => {
                chunk.forEach((item) => {
                  if (item.layer !== "board") return;
                  const clamped = clampBoardObjectToPageFrame(item);
                  const nextPosition = nextBoardObjects.length;
                  nextBoardObjects.push(clamped);
                  nextBoardObjectIndex.set(clamped.id, nextPosition);
                });
              },
            });
            if (!preparedObjects || isStaleLoadRequest()) return;

            const preparedBoardStrokeChunks = await processWorkbookItemsInChunks({
              items: normalizedBoard.strokes,
              chunkSize: SNAPSHOT_STROKE_PREP_CHUNK_SIZE,
              isCancelled: isStaleLoadRequest,
              processChunk: (chunk) => {
                chunk.forEach((stroke) => {
                  if (stroke.layer === "board") {
                    nextBoardStrokes.push(stroke);
                  }
                });
              },
            });
            if (!preparedBoardStrokeChunks || isStaleLoadRequest()) return;

            const preparedConstraintChunks = await processWorkbookItemsInChunks({
              items: normalizedBoard.constraints,
              chunkSize: SNAPSHOT_CONSTRAINT_PREP_CHUNK_SIZE,
              isCancelled: isStaleLoadRequest,
              processChunk: (chunk) => {
                nextConstraints.push(...chunk);
              },
            });
            if (!preparedConstraintChunks || isStaleLoadRequest()) return;

            preparedBoardObjects = nextBoardObjects;
            preparedBoardObjectIndex = nextBoardObjectIndex;
            preparedBoardStrokes = nextBoardStrokes;
            preparedBoardConstraints = nextConstraints;
            deferredBoardState = {
              chat: normalizedBoard.chat,
              comments: normalizedBoard.comments,
              timer: normalizedBoard.timer,
              library: {
                ...DEFAULT_LIBRARY,
                ...normalizedBoard.library,
              },
              document: normalizedBoard.document,
            };
          }

          if (normalizedAnnotations) {
            const nextAnnotationLayerStrokes: WorkbookStroke[] = [];
            const preparedAnnotationStrokeChunks = await processWorkbookItemsInChunks({
              items: normalizedAnnotations.strokes,
              chunkSize: SNAPSHOT_STROKE_PREP_CHUNK_SIZE,
              isCancelled: isStaleLoadRequest,
              processChunk: (chunk) => {
                chunk.forEach((stroke) => {
                  if (stroke.layer === "annotations") {
                    nextAnnotationLayerStrokes.push(stroke);
                  }
                });
              },
            });
            if (!preparedAnnotationStrokeChunks || isStaleLoadRequest()) return;
            preparedAnnotationStrokes = nextAnnotationLayerStrokes;
          }

          if (snapshotHydrateStartedAtMs !== null && !isStaleLoadRequest()) {
            reportWorkbookLoadStageMetric({
              sessionId,
              name: "snapshot_hydrate_ms",
              durationMs: getNowMs() - snapshotHydrateStartedAtMs,
              startedAtMs: snapshotHydrateStartedAtMs,
            });
          }
          if (isStaleLoadRequest()) return;

          if (preparedBoardStrokes) {
            setBoardStrokes(preparedBoardStrokes);
          }
          if (preparedBoardObjects && preparedBoardObjectIndex) {
            boardObjectsRef.current = preparedBoardObjects;
            boardObjectIndexByIdRef.current = preparedBoardObjectIndex;
            setBoardObjects(preparedBoardObjects);
          }
          if (preparedBoardConstraints) {
            setConstraints(preparedBoardConstraints);
          }
          if (normalizedBoard) {
            setBoardSettings(() => {
              const normalizedLayers = normalizeSceneLayersForBoard(
                normalizedBoard.boardSettings.sceneLayers,
                normalizedBoard.boardSettings.activeSceneLayerId
              );
              return {
                ...DEFAULT_BOARD_SETTINGS,
                ...normalizedBoard.boardSettings,
                ...normalizedLayers,
                smartInk: DEFAULT_SMART_INK_OPTIONS,
                title:
                  normalizedBoard.boardSettings.title ||
                  sessionData.title ||
                  DEFAULT_BOARD_SETTINGS.title,
              };
            });
          }
          if (preparedAnnotationStrokes) {
            setAnnotationStrokes(preparedAnnotationStrokes);
          }
          if (normalizedBoard || normalizedAnnotations) {
            const loadedLatestSeq = Math.max(
              latestSeqRef.current,
              shouldApplyBoardSnapshot
                ? boardSnapshot?.version ?? latestSeqRef.current
                : latestSeqRef.current,
              shouldApplyAnnotationSnapshot
                ? annotationSnapshot?.version ?? latestSeqRef.current
                : latestSeqRef.current
            );
            setLatestSeq(loadedLatestSeq);
            latestSeqRef.current = loadedLatestSeq;
            processedEventIdsRef.current.clear();
            smartInkStrokeBufferRef.current = [];
            smartInkProcessedStrokeIdsRef.current = new Set();
            clearObjectSyncRuntime();
            clearStrokePreviewRuntime();
            clearIncomingEraserPreviewRuntime();
            dirtyRef.current = false;
            undoStackRef.current = [];
            redoStackRef.current = [];
            setUndoDepth(0);
            setRedoDepth(0);
            setSaveState("saved");
            setFocusPoint(null);
            setPointerPoint(null);
            setFocusPointsByUser({});
            setPointerPointsByUser({});
            focusResetTimersByUserRef.current.forEach((timerId) => {
              window.clearTimeout(timerId);
            });
            focusResetTimersByUserRef.current.clear();
          }
          if (deferredBoardState) {
            startTransition(() => {
              if (isStaleLoadRequest()) return;
              setChatMessages(deferredBoardState.chat);
              setComments(deferredBoardState.comments);
              setTimerState(deferredBoardState.timer);
              setLibraryState(deferredBoardState.library);
              setDocumentState(deferredBoardState.document);
            });
          }
          if (!isBackground) {
            setLoading(false);
          }
          setBootstrapReady(true);
          authRequiredRef.current = false;
          setSaveSyncWarning(null);
          reportWorkbookFirstInteractiveMetric({
            sessionId,
            isBackground,
            firstInteractiveMetricReportedRef,
            loadStartedAtMs,
            isStaleLoadRequest,
          });

          const recoverChatFromHistory = Boolean(normalizedBoard && normalizedBoard.chat.length === 0);
          void (async () => {
            const sessionOpenStartedAtMs = getNowMs();
            try {
              await openWorkbookSession(sessionId);
            } catch (openError) {
              if (
                !isStaleLoadRequest() &&
                openError instanceof ApiError &&
                (openError.status === 401 || openError.status === 403 || openError.status === 404)
              ) {
                emitAccessError(openError.status, isBackground);
                if (!isBackground) {
                  setSession(null);
                  setBootstrapReady(false);
                }
              }
              return;
            } finally {
              if (!isStaleLoadRequest()) {
                reportWorkbookLoadStageMetric({
                  sessionId,
                  name: "session_open_ms",
                  durationMs: getNowMs() - sessionOpenStartedAtMs,
                  startedAtMs: sessionOpenStartedAtMs,
                });
              }
            }
            if (!recoverChatFromHistory || isStaleLoadRequest()) return;
            try {
              const history = await getWorkbookEvents(sessionId, 0);
              if (isStaleLoadRequest()) return;
              const recoveredChat = recoverChatMessagesFromEvents(history.events);
              if (recoveredChat.length > 0) {
                startTransition(() => {
                  if (isStaleLoadRequest()) return;
                  setChatMessages(recoveredChat);
                });
              }
            } catch {
              // ignore chat history recovery errors
            }
          })();

          return;
        } catch (error) {
          if (isStaleLoadRequest()) return;
          const recoverable =
            error instanceof ApiError &&
            (error.code === "server_unavailable" ||
              error.code === "network_error" ||
              error.code === "timeout" ||
              error.code === "rate_limited" ||
              error.status === 502 ||
              error.status === 503 ||
              error.status === 504);
          if (recoverable && attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, attempt * 250));
            if (isStaleLoadRequest()) return;
            continue;
          }
          if (
            error instanceof ApiError &&
            (error.status === 401 || error.status === 403 || error.status === 404)
          ) {
            emitAccessError(error.status, isBackground);
          } else if (isBackground) {
            setError("Связь с доской нестабильна. Продолжаем работу и повторяем синхронизацию.");
          } else {
            setError("Не удалось открыть сессию. Проверьте подключение и повторите попытку.");
          }
          if (!isBackground) {
            setSession(null);
            setLoading(false);
            setBootstrapReady(false);
          }
          return;
        }
      }
      if (!isBackground) {
        setLoading(false);
        setBootstrapReady(false);
      }
    },
    [
      sessionId, isWorkbookSessionAuthLost, clearIncomingRealtimeApplyQueue,
      clearLocalPreviewPatchRuntime, setSaveState, setError, setSaveSyncWarning,
      setBootstrapReady, setLoading, clearStrokePreviewRuntime, clearIncomingEraserPreviewRuntime,
      setSession, setBoardStrokes, setBoardObjects, setConstraints, setBoardSettings,
      setAnnotationStrokes, setLatestSeq, clearObjectSyncRuntime, setUndoDepth, setRedoDepth,
      setFocusPoint, setPointerPoint, setFocusPointsByUser, setPointerPointsByUser,
      setChatMessages, setComments, setTimerState, setLibraryState, setDocumentState,
      recoverChatMessagesFromEvents, authRequiredRef, loadSessionRequestIdRef,
      firstInteractiveMetricReportedRef, queuedBoardSettingsCommitRef,
      queuedBoardSettingsHistoryBeforeRef, boardSettingsCommitTimerRef, latestSeqRef,
      processedEventIdsRef, smartInkStrokeBufferRef, smartInkProcessedStrokeIdsRef, dirtyRef,
      undoStackRef, redoStackRef, focusResetTimersByUserRef, boardObjectsRef, boardObjectIndexByIdRef,
    ]
  );

  return loadSession;
};
