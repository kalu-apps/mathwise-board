import type { MutableRefObject } from "react";
import { compactWorkbookObjectUpdateEvents } from "@/features/workbook/model/runtime";
import { applyWorkbookIncomingRealtimeEvent } from "@/features/workbook/model/incomingRealtime";
import { applyWorkbookIncomingSessionMetaEvent } from "@/features/workbook/model/incomingSessionMeta";
import {
  isHistoryTrackedWorkbookEventType,
  isLiveReplayableWorkbookEventType,
  isVolatileWorkbookEventType,
} from "@/features/workbook/model/events";
import {
  reportWorkbookCorrectnessEvent,
  reportWorkbookPerfPhaseMetric,
} from "@/features/workbook/model/workbookPerformance";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookEvent,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookSessionStoreActions } from "@/features/workbook/model/workbookSessionStoreTypes";
import { generateId } from "@/shared/lib/id";
import type { useWorkbookIncomingRuntimeController } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { useWorkbookSessionRefs } from "./workbookSessionRefs";
import type { useWorkbookSessionHistoryRuntime } from "./useWorkbookSessionHistoryRuntime";
import type { useWorkbookSessionLocalRuntime } from "./useWorkbookSessionLocalRuntime";
import type { WorkbookHistoryOperation } from "./WorkbookSessionPage.geometry";
import { normalizeSceneLayersForBoard } from "./WorkbookSessionPage.geometry";
import {
  ERASER_PREVIEW_END_EXPIRY_MS,
  ERASER_PREVIEW_EXPIRY_MS,
  ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX,
  VIEWPORT_SYNC_EPSILON,
} from "./WorkbookSessionPage.core";

type IncomingRuntimeControllerResult = ReturnType<typeof useWorkbookIncomingRuntimeController>;
type WorkbookSessionRefs = ReturnType<typeof useWorkbookSessionRefs>;
type RestoreSceneSnapshot = ReturnType<typeof useWorkbookSessionHistoryRuntime>["restoreSceneSnapshot"];
type PushIncomingHistoryEntryFromEventsBatch = ReturnType<
  typeof useWorkbookSessionHistoryRuntime
>["pushIncomingHistoryEntryFromEventsBatch"];
type SyncHistoryStacksFromIncomingUndoRedoEvent = ReturnType<
  typeof useWorkbookSessionHistoryRuntime
>["syncHistoryStacksFromIncomingUndoRedoEvent"];
type AreParticipantsEqual = ReturnType<typeof useWorkbookSessionLocalRuntime>["areParticipantsEqual"];

type ApplyWorkbookIncomingEventsBatchParams = {
  sessionId: string;
  events: WorkbookEvent[];
  userId: string | undefined;
  currentBoardPageRef: MutableRefObject<number>;
  selectedObjectId: string | null;
  awaitingClearRequest: {
    requestId: string;
    targetLayer: "board" | "annotations";
    authorUserId: string;
  } | null;
  lastAppliedSeqRef: MutableRefObject<number>;
  lastAppliedBoardSettingsSeqRef: MutableRefObject<number>;
  refs: WorkbookSessionRefs;
  actions: WorkbookSessionStoreActions;
  areParticipantsEqual: AreParticipantsEqual;
  restoreSceneSnapshot: RestoreSceneSnapshot;
  pushIncomingHistoryEntryFromEventsBatch: PushIncomingHistoryEntryFromEventsBatch;
  syncHistoryStacksFromIncomingUndoRedoEvent: SyncHistoryStacksFromIncomingUndoRedoEvent;
  onUndoRedoApplyMismatch: (payload: {
    eventType: "board.undo" | "board.redo";
    expectedOperations: number;
    appliedOperations: number;
  }) => void;
  clearLocalPreviewPatchRuntime: () => void;
  clearObjectSyncRuntime: (options?: { cancelIncomingFrame?: boolean }) => void;
  clearStrokePreviewRuntime: (options?: {
    clearFinalized?: boolean;
    cancelIncomingFrame?: boolean;
  }) => void;
  clearIncomingEraserPreviewRuntime: () => void;
  scheduleIncomingEraserPreviewExpiry: IncomingRuntimeControllerResult["scheduleIncomingEraserPreviewExpiry"];
  queueIncomingStrokePreview: IncomingRuntimeControllerResult["queueIncomingStrokePreview"];
  finalizeStrokePreview: (strokeId: string) => void;
  queueIncomingPreviewPatch: IncomingRuntimeControllerResult["queueIncomingPreviewPatch"];
  applyLocalBoardObjects: IncomingRuntimeControllerResult["applyLocalBoardObjects"];
};

export const applyWorkbookIncomingEventsBatch = ({
  sessionId,
  events,
  userId,
  currentBoardPageRef,
  selectedObjectId,
  awaitingClearRequest,
  lastAppliedSeqRef,
  lastAppliedBoardSettingsSeqRef,
  refs,
  actions,
  areParticipantsEqual,
  restoreSceneSnapshot,
  pushIncomingHistoryEntryFromEventsBatch,
  syncHistoryStacksFromIncomingUndoRedoEvent,
  onUndoRedoApplyMismatch,
  clearLocalPreviewPatchRuntime,
  clearObjectSyncRuntime,
  clearStrokePreviewRuntime,
  clearIncomingEraserPreviewRuntime,
  scheduleIncomingEraserPreviewExpiry,
  queueIncomingStrokePreview,
  finalizeStrokePreview,
  queueIncomingPreviewPatch,
  applyLocalBoardObjects,
}: ApplyWorkbookIncomingEventsBatchParams): void => {
  if (events.length === 0) return;
  const startedAtMs =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const compactedEvents = compactWorkbookObjectUpdateEvents(events);
  const orderedEvents = compactedEvents
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const leftSeq = Number.isFinite(left.event.seq) ? left.event.seq : Number.POSITIVE_INFINITY;
      const rightSeq = Number.isFinite(right.event.seq) ? right.event.seq : Number.POSITIVE_INFINITY;
      if (leftSeq !== rightSeq) {
        return leftSeq - rightSeq;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.event);
  let realtimeEventsApplied = 0;
  let sessionMetaEventsApplied = 0;
  let staleEventsSkipped = 0;
  let pageApplyRequested = 0;
  let pageApplyAccepted = 0;
  let pageApplyRejected = 0;
  let maxAppliedSeq = lastAppliedSeqRef.current;
  let pendingIncomingHistoryEvents: WorkbookEvent[] = [];
  let pendingIncomingHistoryBatchKey: string | null = null;
  let pendingIncomingHistorySourceState:
    | {
        currentBoardStrokes: WorkbookStroke[];
        currentAnnotationStrokes: WorkbookStroke[];
        currentObjects: WorkbookBoardObject[];
        currentConstraints: WorkbookConstraint[];
        currentBoardSettings: WorkbookBoardSettings;
        currentDocumentState: WorkbookDocumentState;
      }
    | null = null;
  const flushIncomingHistoryBatch = () => {
    if (pendingIncomingHistoryEvents.length === 0) return;
    pushIncomingHistoryEntryFromEventsBatch(
      pendingIncomingHistoryEvents,
      userId,
      pendingIncomingHistorySourceState ?? undefined
    );
    pendingIncomingHistoryEvents = [];
    pendingIncomingHistoryBatchKey = null;
    pendingIncomingHistorySourceState = null;
  };
  const resolveIncomingHistoryBatchKey = (event: WorkbookEvent, eventSeq: number | null) => {
    const authorUserId =
      typeof event.authorUserId === "string" ? event.authorUserId.trim() : "";
    const createdAt = typeof event.createdAt === "string" ? event.createdAt.trim() : "";
    if (authorUserId && createdAt) {
      return `${authorUserId}::${createdAt}`;
    }
    return `seq:${Math.max(0, Math.trunc(eventSeq ?? 0))}`;
  };
  const markEventProcessed = (event: WorkbookEvent) => {
    if (!event?.id) return;
    const processedEventIds = refs.processedEventIdsRef.current;
    processedEventIds.add(event.id);
    if (processedEventIds.size <= 50_000) return;
    const idsToKeep = Array.from(processedEventIds).slice(-2_000);
    processedEventIds.clear();
    idsToKeep.forEach((id) => {
      processedEventIds.add(id);
    });
  };
  orderedEvents.forEach((event) => {
    try {
      const eventSeq =
        typeof event?.seq === "number" && Number.isFinite(event.seq)
          ? Math.max(0, Math.trunc(event.seq))
          : null;
      const isPageSettingsUpdate = event.type === "board.settings.update";
      if (isPageSettingsUpdate) {
        pageApplyRequested += 1;
        reportWorkbookCorrectnessEvent({
          name: "page_apply_requested_seq",
          sessionId,
          seq: eventSeq ?? lastAppliedSeqRef.current,
          snapshotSeq: lastAppliedSeqRef.current,
        });
      }
      const isVolatileEvent = isVolatileWorkbookEventType(event.type);
      const isLiveReplayableEvent = isLiveReplayableWorkbookEventType(event.type);
      const canApplyLatePageSettingsEvent =
        isPageSettingsUpdate &&
        eventSeq !== null &&
        eventSeq > lastAppliedBoardSettingsSeqRef.current;
      if (
        eventSeq !== null &&
        !isVolatileEvent &&
        !isLiveReplayableEvent &&
        eventSeq <= lastAppliedSeqRef.current &&
        !canApplyLatePageSettingsEvent
      ) {
        staleEventsSkipped += 1;
        if (isPageSettingsUpdate) {
          pageApplyRejected += 1;
          reportWorkbookCorrectnessEvent({
            name: "page_apply_rejected_as_stale",
            sessionId,
            seq: eventSeq,
            snapshotSeq: lastAppliedSeqRef.current,
          });
        }
        return;
      }
      if (event?.id && refs.processedEventIdsRef.current.has(event.id)) {
        staleEventsSkipped += 1;
        return;
      }
      const parsedEventTs = Date.parse(event.createdAt);
      const eventTimestamp = Number.isFinite(parsedEventTs) ? parsedEventTs : Date.now();
      if (event.type === "board.undo" || event.type === "board.redo") {
        flushIncomingHistoryBatch();
      } else if (isHistoryTrackedWorkbookEventType(event.type)) {
        const batchKey = resolveIncomingHistoryBatchKey(event, eventSeq);
        if (pendingIncomingHistoryBatchKey !== null && batchKey !== pendingIncomingHistoryBatchKey) {
          flushIncomingHistoryBatch();
        }
        if (pendingIncomingHistoryEvents.length === 0) {
          pendingIncomingHistorySourceState = {
            currentBoardStrokes: refs.boardStrokesRef.current,
            currentAnnotationStrokes: refs.annotationStrokesRef.current,
            currentObjects: refs.boardObjectsRef.current,
            currentConstraints: refs.constraintsRef.current,
            currentBoardSettings: refs.boardSettingsRef.current,
            currentDocumentState: refs.documentStateRef.current,
          };
        }
        pendingIncomingHistoryEvents.push(event);
        pendingIncomingHistoryBatchKey = batchKey;
      } else {
        flushIncomingHistoryBatch();
      }
      if (
        applyWorkbookIncomingRealtimeEvent({
          event,
          eventTimestamp,
          userId,
          currentBoardPageRef,
          selectedObjectId,
          selectedTextDraftDirty: refs.selectedTextDraftDirtyRef.current,
          selectedTextDraftObjectId: refs.selectedTextDraftObjectIdRef.current,
          awaitingClearRequest,
          areParticipantsEqual,
          applyHistoryOperations: (operations, options) =>
            refs.applyHistoryOperationsRef.current(
              operations as WorkbookHistoryOperation[],
              options
            ),
          onUndoRedoApplyMismatch,
          restoreSceneSnapshot,
          clearLocalPreviewPatchRuntime,
          clearObjectSyncRuntime,
          clearStrokePreviewRuntime,
          clearIncomingEraserPreviewRuntime,
          scheduleIncomingEraserPreviewExpiry,
          queueIncomingStrokePreview,
          finalizeStrokePreview,
          queueIncomingPreviewPatch,
          applyLocalBoardObjects,
          boardSettingsRef: refs.boardSettingsRef,
          boardObjectsRef: refs.boardObjectsRef,
          setSession: actions.setSession,
          setCanvasViewport: actions.setCanvasViewport,
          setIncomingEraserPreviews: actions.setIncomingEraserPreviews,
          setBoardStrokes: actions.setBoardStrokes,
          setAnnotationStrokes: actions.setAnnotationStrokes,
          setConstraints: actions.setConstraints,
          setSelectedObjectId: actions.setSelectedObjectId,
          setSelectedConstraintId: actions.setSelectedConstraintId,
          setPendingClearRequest: actions.setPendingClearRequest,
          setAwaitingClearRequest: actions.setAwaitingClearRequest,
          setConfirmedClearRequest: actions.setConfirmedClearRequest,
          setFocusPoint: actions.setFocusPoint,
          setPointerPoint: actions.setPointerPoint,
          setFocusPointsByUser: actions.setFocusPointsByUser,
          setPointerPointsByUser: actions.setPointerPointsByUser,
          viewportLastReceivedAtRef: refs.viewportLastReceivedAtRef,
          finalizedStrokePreviewIdsRef: refs.finalizedStrokePreviewIdsRef,
          incomingStrokePreviewVersionRef: refs.incomingStrokePreviewVersionRef,
          objectLastCommittedEventAtRef: refs.objectLastCommittedEventAtRef,
          incomingPreviewQueuedPatchRef: refs.incomingPreviewQueuedPatchRef,
          incomingPreviewVersionByAuthorObjectRef: refs.incomingPreviewVersionByAuthorObjectRef,
          objectUpdateQueuedPatchRef: refs.objectUpdateQueuedPatchRef,
          objectUpdateDispatchOptionsRef: refs.objectUpdateDispatchOptionsRef,
          objectUpdateHistoryBeforeRef: refs.objectUpdateHistoryBeforeRef,
          objectPreviewQueuedPatchRef: refs.objectPreviewQueuedPatchRef,
          objectUpdateInFlightRef: refs.objectUpdateInFlightRef,
          objectPreviewVersionRef: refs.objectPreviewVersionRef,
          objectUpdateTimersRef: refs.objectUpdateTimersRef,
          focusResetTimersByUserRef: refs.focusResetTimersByUserRef,
          generateId,
          eraserPreviewPointMergeMinDistancePx: ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX,
          eraserPreviewExpiryMs: ERASER_PREVIEW_EXPIRY_MS,
          eraserPreviewEndExpiryMs: ERASER_PREVIEW_END_EXPIRY_MS,
          viewportSyncEpsilon: VIEWPORT_SYNC_EPSILON,
        })
      ) {
        syncHistoryStacksFromIncomingUndoRedoEvent(event);
        realtimeEventsApplied += 1;
        markEventProcessed(event);
        if (eventSeq !== null) {
          maxAppliedSeq = Math.max(maxAppliedSeq, eventSeq);
        }
        return;
      }
      if (
        applyWorkbookIncomingSessionMetaEvent({
          event,
          normalizeSceneLayersForBoard,
          setDocumentState: actions.setDocumentState,
          setConstraints: actions.setConstraints,
          setSelectedConstraintId: actions.setSelectedConstraintId,
          setBoardSettings: actions.setBoardSettings,
          setLibraryState: actions.setLibraryState,
          setComments: actions.setComments,
          setTimerState: actions.setTimerState,
          setSession: actions.setSession,
          setChatMessages: actions.setChatMessages,
        })
      ) {
        sessionMetaEventsApplied += 1;
        markEventProcessed(event);
        if (eventSeq !== null) {
          maxAppliedSeq = Math.max(maxAppliedSeq, eventSeq);
        }
        if (isPageSettingsUpdate && eventSeq !== null) {
          pageApplyAccepted += 1;
          lastAppliedBoardSettingsSeqRef.current = Math.max(
            lastAppliedBoardSettingsSeqRef.current,
            eventSeq
          );
          reportWorkbookCorrectnessEvent({
            name: "page_apply_accepted_seq",
            sessionId,
            seq: eventSeq,
            snapshotSeq: lastAppliedSeqRef.current,
          });
        }
        return;
      }
      if (eventSeq !== null) {
        markEventProcessed(event);
        maxAppliedSeq = Math.max(maxAppliedSeq, eventSeq);
      }
    } catch (error) {
      console.warn("Workbook event apply failed", event.type, error);
    }
  });
  flushIncomingHistoryBatch();
  if (maxAppliedSeq > lastAppliedSeqRef.current) {
    lastAppliedSeqRef.current = maxAppliedSeq;
  }
  if (maxAppliedSeq > refs.latestSeqRef.current) {
    refs.latestSeqRef.current = maxAppliedSeq;
    actions.setLatestSeq(maxAppliedSeq);
  }
  if (staleEventsSkipped > 0) {
    reportWorkbookCorrectnessEvent({
      name: "realtime_event_skipped_as_stale",
      sessionId,
      seq: lastAppliedSeqRef.current,
      counters: {
        staleEventsSkipped,
      },
    });
  }
  const finishedAtMs =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  reportWorkbookPerfPhaseMetric({
    name: "incoming_apply_ms",
    durationMs: finishedAtMs - startedAtMs,
    counters: {
      eventsInBatch: events.length,
      compactedEvents: compactedEvents.length,
      orderedEvents: orderedEvents.length,
      realtimeEventsApplied,
      sessionMetaEventsApplied,
      staleEventsSkipped,
      pageApplyRequested,
      pageApplyAccepted,
      pageApplyRejected,
    },
  });
};
