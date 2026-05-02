import { startTransition, useCallback } from "react";
import {
  getWorkbookEvents,
  getWorkbookSession,
  getWorkbookSnapshot,
  openWorkbookSession,
} from "@/features/workbook/model/api";
import {
  reportWorkbookCorrectnessEvent,
  reportWorkbookLoadStageMetric,
  type WorkbookRecoveryMode,
} from "@/features/workbook/model/workbookPerformance";
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
  lastAppliedSeqRef,
  lastAppliedBoardSettingsSeqRef,
  recoveryModeRef,
  processedEventIdsRef,
  applyIncomingEvents,
  filterUnseenWorkbookEvents,
  dirtyRef,
  undoStackRef,
  redoStackRef,
  focusResetTimersByUserRef,
  boardObjectsRef,
  boardObjectIndexByIdRef,
}: WorkbookSessionLoadParams) => {
  const loadSession = useCallback(
    async (options?: {
      background?: boolean;
      reason?: "initial" | "resume" | "rejoin" | "conflict" | "resync";
    }) => {
      if (!sessionId || isWorkbookSessionAuthLost) return;
      const isBackground = options?.background === true;
      const reason = options?.reason ?? (isBackground ? "resync" : "initial");
      const loadStartedAtMs = getNowMs();
      const loadRequestId = loadSessionRequestIdRef.current + 1;
      loadSessionRequestIdRef.current = loadRequestId;
      const isStaleLoadRequest = () => loadSessionRequestIdRef.current !== loadRequestId;
      const setRecoveryMode = (nextMode: WorkbookRecoveryMode) => {
        const previousMode = recoveryModeRef.current;
        if (previousMode === nextMode) return;
        reportWorkbookCorrectnessEvent({
          name: "recovery_mode_exited",
          sessionId,
          reason,
          recoveryMode: previousMode,
          seq: lastAppliedSeqRef.current,
        });
        recoveryModeRef.current = nextMode;
        reportWorkbookCorrectnessEvent({
          name: "recovery_mode_entered",
          sessionId,
          reason,
          recoveryMode: nextMode,
          seq: lastAppliedSeqRef.current,
        });
      };
      setRecoveryMode(isBackground ? "recovering" : "bootstrapping");
      reportWorkbookCorrectnessEvent({
        name: isBackground ? "resume_start" : "session_open_start",
        sessionId,
        reason,
        recoveryMode: recoveryModeRef.current,
        seq: lastAppliedSeqRef.current,
      });
      reportWorkbookCorrectnessEvent({
        name: isBackground ? "resume_known_seq" : "session_open_snapshot_seq",
        sessionId,
        reason,
        recoveryMode: recoveryModeRef.current,
        seq: lastAppliedSeqRef.current,
        snapshotSeq: latestSeqRef.current,
      });
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
      clearLocalPreviewPatchRuntime();
      if (!isBackground) {
        clearIncomingRealtimeApplyQueue();
        setBootstrapReady(false);
        firstInteractiveMetricReportedRef.current = false;
        setLoading(true);
        setError(null);
        clearStrokePreviewRuntime();
        clearIncomingEraserPreviewRuntime();
      }
      let degradedWithoutSnapshot = false;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          degradedWithoutSnapshot = false;
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
          const boardSnapshotLoadError =
            boardSnapshotResult.status === "rejected" ? boardSnapshotResult.reason : null;
          const annotationSnapshotLoadError =
            annotationSnapshotResult.status === "rejected"
              ? annotationSnapshotResult.reason
              : null;
          const currentLatestSeq = latestSeqRef.current;
          const currentAppliedSeq = lastAppliedSeqRef.current;
          const knownFreshSeq = Math.max(currentLatestSeq, currentAppliedSeq);
          const boardSnapshotVersion =
            boardSnapshot && typeof boardSnapshot.version === "number"
              ? Math.max(0, Math.trunc(boardSnapshot.version))
              : 0;
          const annotationSnapshotVersion =
            annotationSnapshot && typeof annotationSnapshot.version === "number"
              ? Math.max(0, Math.trunc(annotationSnapshot.version))
              : 0;
          const shouldApplyEmptyBoardSnapshot =
            !isBackground &&
            boardSnapshotResult.status === "fulfilled" &&
            boardSnapshotResult.value === null;
          const shouldApplyEmptyAnnotationSnapshot =
            !isBackground &&
            annotationSnapshotResult.status === "fulfilled" &&
            annotationSnapshotResult.value === null;
          const hasFreshBoardSnapshot =
            !isBackground &&
            boardSnapshot !== null;
          const hasFreshAnnotationSnapshot =
            !isBackground &&
            annotationSnapshot !== null;
          const shouldApplyBoardSnapshot = hasFreshBoardSnapshot || shouldApplyEmptyBoardSnapshot;
          const shouldApplyAnnotationSnapshot =
            hasFreshAnnotationSnapshot || shouldApplyEmptyAnnotationSnapshot;
          const shouldDecodeSnapshots = shouldApplyBoardSnapshot || shouldApplyAnnotationSnapshot;
          if (
            isBackground &&
            boardSnapshot &&
            boardSnapshotVersion <= knownFreshSeq
          ) {
            reportWorkbookCorrectnessEvent({
              name: "snapshot_apply_skipped_as_stale",
              sessionId,
              reason,
              recoveryMode: recoveryModeRef.current,
              seq: knownFreshSeq,
              snapshotSeq: boardSnapshotVersion,
            });
          }
          if (
            isBackground &&
            annotationSnapshot &&
            annotationSnapshotVersion <= knownFreshSeq
          ) {
            reportWorkbookCorrectnessEvent({
              name: "snapshot_apply_skipped_as_stale",
              sessionId,
              reason,
              recoveryMode: recoveryModeRef.current,
              seq: knownFreshSeq,
              snapshotSeq: annotationSnapshotVersion,
            });
          }
          if (isBackground && shouldDecodeSnapshots) {
            setRecoveryMode("catching_up");
          }
          if (!isBackground && shouldDecodeSnapshots) {
            clearIncomingRealtimeApplyQueue();
          }
          if (boardSnapshotLoadError || annotationSnapshotLoadError) {
            const hasSnapshotAccessIssue =
              (boardSnapshotLoadError instanceof ApiError &&
                (boardSnapshotLoadError.status === 403 || boardSnapshotLoadError.status === 404)) ||
              (annotationSnapshotLoadError instanceof ApiError &&
                (annotationSnapshotLoadError.status === 403 || annotationSnapshotLoadError.status === 404));
            if (hasSnapshotAccessIssue) {
              degradedWithoutSnapshot = true;
              setRecoveryMode("degraded_without_snapshot");
              setSaveSyncWarning(null);
            }
          }
          setSession(sessionData);
          queuedBoardSettingsCommitRef.current = null;
          queuedBoardSettingsHistoryBeforeRef.current = null;
          if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
            window.clearTimeout(boardSettingsCommitTimerRef.current);
            boardSettingsCommitTimerRef.current = null;
          }

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
                  const clamped = clampBoardObjectToPageFrame(
                    item,
                    normalizedBoard.boardSettings.pageFrameWidth
                  );
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
          let loadedLatestSeq = latestSeqRef.current;
          if (normalizedBoard || normalizedAnnotations) {
            loadedLatestSeq = Math.max(
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
            if (shouldApplyBoardSnapshot) {
              lastAppliedBoardSettingsSeqRef.current = Math.max(
                lastAppliedBoardSettingsSeqRef.current,
                boardSnapshotVersion
              );
              reportWorkbookCorrectnessEvent({
                name: isBackground ? "resume_snapshot_seq" : "session_open_snapshot_seq",
                sessionId,
                reason,
                recoveryMode: recoveryModeRef.current,
                seq: lastAppliedSeqRef.current,
                snapshotSeq: boardSnapshotVersion,
              });
            }
            if (!isBackground) {
              processedEventIdsRef.current.clear();
            }
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
          if (!isBackground) {
            setLoading(false);
          }
          setRecoveryMode("catching_up");
          try {
            const MAX_TAIL_BATCHES = 8;
            let tailCursor = Math.max(0, latestSeqRef.current);
            let tailEventsCount = 0;
            let tailAppliedCount = 0;
            let tailBatchCount = 0;
            while (tailBatchCount < MAX_TAIL_BATCHES) {
              tailBatchCount += 1;
              const tailResponse = await getWorkbookEvents(sessionId, tailCursor);
              if (isStaleLoadRequest()) return;
              const unseenTailEvents = filterUnseenWorkbookEvents(tailResponse.events, {
                ignoreSeqGuard: true,
              })
                .slice()
                .sort((left, right) => {
                  const leftSeq =
                    typeof left?.seq === "number" && Number.isFinite(left.seq)
                      ? left.seq
                      : Number.POSITIVE_INFINITY;
                  const rightSeq =
                    typeof right?.seq === "number" && Number.isFinite(right.seq)
                      ? right.seq
                      : Number.POSITIVE_INFINITY;
                  return leftSeq - rightSeq;
                });
              tailEventsCount += unseenTailEvents.length;
              const freshTailEvents = unseenTailEvents.filter((event) => {
                if (typeof event?.seq !== "number" || !Number.isFinite(event.seq)) {
                  return true;
                }
                if (event.seq <= lastAppliedSeqRef.current) {
                  reportWorkbookCorrectnessEvent({
                    name: "realtime_event_skipped_as_stale",
                    sessionId,
                    reason,
                    recoveryMode: recoveryModeRef.current,
                    seq: event.seq,
                    snapshotSeq: lastAppliedSeqRef.current,
                  });
                  return false;
                }
                return true;
              });
              if (freshTailEvents.length > 0) {
                applyIncomingEvents(freshTailEvents);
                tailAppliedCount += freshTailEvents.length;
              }
              const responseMaxSeq = tailResponse.events.reduce((maxSeq, event) => {
                if (typeof event?.seq !== "number" || !Number.isFinite(event.seq)) {
                  return maxSeq;
                }
                return Math.max(maxSeq, Math.max(0, Math.trunc(event.seq)));
              }, tailCursor);
              if (responseMaxSeq > tailCursor) {
                tailCursor = responseMaxSeq;
                if (tailCursor > latestSeqRef.current) {
                  latestSeqRef.current = tailCursor;
                  setLatestSeq(tailCursor);
                }
              }
              const reachedTailEnd =
                tailResponse.events.length === 0 || tailCursor >= tailResponse.latestSeq;
              if (reachedTailEnd) {
                break;
              }
            }
            reportWorkbookCorrectnessEvent({
              name: isBackground ? "resume_tail_applied_to_seq" : "session_open_tail_applied_to_seq",
              sessionId,
              reason,
              recoveryMode: recoveryModeRef.current,
              seq: lastAppliedSeqRef.current,
              snapshotSeq: loadedLatestSeq,
              counters: {
                tailEvents: tailEventsCount,
                tailApplied: tailAppliedCount,
                tailBatches: tailBatchCount,
              },
            });
          } catch (tailError) {
            if (
              tailError instanceof ApiError &&
              (tailError.status === 401 || tailError.status === 403 || tailError.status === 404)
            ) {
              emitAccessError(tailError.status, isBackground);
              if (!isBackground) {
                setSession(null);
                setBootstrapReady(false);
                setLoading(false);
              }
              return;
            }
            setError("Лента событий временно недоступна. Повторяем синхронизацию.");
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
          setRecoveryMode("live");
          setBootstrapReady(true);
          authRequiredRef.current = false;
          if (!degradedWithoutSnapshot) {
            setSaveSyncWarning(null);
          }
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
            setSaveSyncWarning(
              "Синхронизация доски заметно задерживается. Проверьте сеть, VPN или прокси. Мы продолжаем восстановление автоматически."
            );
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
      lastAppliedSeqRef, lastAppliedBoardSettingsSeqRef, recoveryModeRef, processedEventIdsRef,
      applyIncomingEvents, filterUnseenWorkbookEvents, dirtyRef,
      undoStackRef, redoStackRef, focusResetTimersByUserRef, boardObjectsRef, boardObjectIndexByIdRef,
    ]
  );

  return loadSession;
};
