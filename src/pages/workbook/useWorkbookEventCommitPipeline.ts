import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { appendWorkbookEvents, appendWorkbookLiveEvents } from "@/features/workbook/model/api";
import {
  isDirtyWorkbookEventType,
  isHistoryTrackedWorkbookEventType,
  isVolatileWorkbookEventType,
  type WorkbookClientEventInput,
} from "@/features/workbook/model/events";
import {
  observeWorkbookRealtimePersistAck,
  observeWorkbookRealtimeSend,
  observeWorkbookRealtimeVolatileDrop,
} from "@/features/workbook/model/realtimeObservability";
import { withWorkbookClientEventIds } from "@/features/workbook/model/runtime";
import type { WorkbookEvent } from "@/features/workbook/model/types";
import { ApiError } from "@/shared/api/client";
import type { WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

type RealtimeChannel = "persist" | "live" | "stream" | "poll";

const VOLATILE_FALLBACK_FLUSH_INTERVAL_MS = 180;
const VOLATILE_FALLBACK_MAX_EVENTS = 160;

type EnqueueIncomingRealtimeApply = (batch: {
  channel: RealtimeChannel;
  latestSeq: number;
  events: WorkbookEvent[];
}) => void;

type UseWorkbookEventCommitPipelineParams = {
  sessionId: string;
  isWorkbookLiveConnected: boolean;
  realtimeBackpressureV2Enabled: boolean;
  workbookLiveSendRef: MutableRefObject<((events: WorkbookClientEventInput[]) => boolean) | null>;
  latestSeqRef: MutableRefObject<number>;
  processedEventIdsRef: MutableRefObject<Set<string>>;
  setLatestSeq: (value: number) => void;
  buildHistoryEntryFromEvents: (
    events: WorkbookClientEventInput[]
  ) => WorkbookHistoryEntry | null;
  filterUnseenWorkbookEvents: (
    events: WorkbookEvent[],
    options?: { allowLiveReplay?: boolean; ignoreSeqGuard?: boolean }
  ) => WorkbookEvent[];
  markDirty: () => void;
  handleRealtimeAuthRequired: (status: 401 | 403 | 404) => void;
  handleRealtimeConflict: () => void;
  pushHistoryEntry: (entry: WorkbookHistoryEntry) => void;
  rollbackHistoryEntry: () => void;
  enqueueIncomingRealtimeApply: EnqueueIncomingRealtimeApply;
};

export const useWorkbookEventCommitPipeline = ({
  sessionId,
  isWorkbookLiveConnected,
  realtimeBackpressureV2Enabled,
  workbookLiveSendRef,
  latestSeqRef,
  setLatestSeq,
  buildHistoryEntryFromEvents,
  filterUnseenWorkbookEvents,
  markDirty,
  handleRealtimeAuthRequired,
  handleRealtimeConflict,
  pushHistoryEntry,
  rollbackHistoryEntry,
  enqueueIncomingRealtimeApply,
}: UseWorkbookEventCommitPipelineParams) => {
  const volatileFallbackQueueRef = useRef<Map<string, WorkbookClientEventInput>>(
    new Map()
  );
  const volatileFallbackTimerRef = useRef<number | null>(null);
  const volatileFallbackFlushInFlightRef = useRef(false);

  const clearVolatileFallbackTimer = useCallback(() => {
    if (volatileFallbackTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(volatileFallbackTimerRef.current);
    volatileFallbackTimerRef.current = null;
  }, []);

  const resolveVolatileFallbackEventKey = useCallback(
    (event: WorkbookClientEventInput, index: number) => {
      const typeKey = event.type;
      if (event.type === "board.object.preview") {
        const objectId =
          event.payload &&
          typeof event.payload === "object" &&
          typeof (event.payload as { objectId?: unknown }).objectId === "string"
            ? (event.payload as { objectId: string }).objectId.trim()
            : "";
        if (objectId) {
          return `${typeKey}:${objectId}`;
        }
      }
      if (
        event.type === "board.stroke.preview" ||
        event.type === "annotations.stroke.preview"
      ) {
        const strokeId =
          event.payload &&
          typeof event.payload === "object" &&
          typeof (event.payload as { stroke?: { id?: unknown } }).stroke?.id === "string"
            ? String((event.payload as { stroke: { id: string } }).stroke.id).trim()
            : "";
        if (strokeId) {
          return `${typeKey}:${strokeId}`;
        }
      }
      if (event.type === "board.eraser.preview") {
        const gestureId =
          event.payload &&
          typeof event.payload === "object" &&
          typeof (event.payload as { gestureId?: unknown }).gestureId === "string"
            ? (event.payload as { gestureId: string }).gestureId.trim()
            : "";
        if (gestureId) {
          return `${typeKey}:${gestureId}`;
        }
      }
      if (event.type === "board.viewport.sync") {
        return `${typeKey}:viewport`;
      }
      if (event.type === "teacher.cursor") {
        return `${typeKey}:cursor`;
      }
      return `${typeKey}:${index}`;
    },
    []
  );

  const queueVolatileFallbackEvents = useCallback(
    (events: WorkbookClientEventInput[]) => {
      if (events.length === 0) return;
      const queue = volatileFallbackQueueRef.current;
      const droppedEventTypes: string[] = [];

      events.forEach((event, index) => {
        const key = resolveVolatileFallbackEventKey(event, index);
        if (queue.has(key)) {
          queue.delete(key);
        }
        queue.set(key, event);
      });

      while (queue.size > VOLATILE_FALLBACK_MAX_EVENTS) {
        const oldestKey = queue.keys().next().value as string | undefined;
        if (!oldestKey) break;
        const dropped = queue.get(oldestKey);
        if (dropped) {
          droppedEventTypes.push(dropped.type);
        }
        queue.delete(oldestKey);
      }

      if (droppedEventTypes.length > 0 && realtimeBackpressureV2Enabled) {
        observeWorkbookRealtimeVolatileDrop({
          sessionId,
          channel: "live",
          droppedCount: droppedEventTypes.length,
          reason: "volatile_fallback_queue_trim",
          eventTypes: droppedEventTypes,
        });
      }
    },
    [realtimeBackpressureV2Enabled, resolveVolatileFallbackEventKey, sessionId]
  );

  const flushVolatileFallbackQueue = useCallback(() => {
    if (volatileFallbackFlushInFlightRef.current) return;
    const queue = volatileFallbackQueueRef.current;
    if (queue.size === 0) return;
    const batch = Array.from(queue.values());
    queue.clear();
    volatileFallbackFlushInFlightRef.current = true;
    void appendWorkbookLiveEvents({ sessionId, events: batch })
      .catch(() => {
        if (realtimeBackpressureV2Enabled) {
          observeWorkbookRealtimeVolatileDrop({
            sessionId,
            channel: "live",
            droppedCount: batch.length,
            reason: "volatile_fallback_failed",
            eventTypes: batch.map((event) => event.type),
          });
        }
      })
      .finally(() => {
        volatileFallbackFlushInFlightRef.current = false;
      });
  }, [realtimeBackpressureV2Enabled, sessionId]);

  const scheduleVolatileFallbackFlush = useCallback(
    (delayMs = VOLATILE_FALLBACK_FLUSH_INTERVAL_MS) => {
      if (volatileFallbackTimerRef.current !== null) return;
      if (typeof window === "undefined") {
        flushVolatileFallbackQueue();
        return;
      }
      volatileFallbackTimerRef.current = window.setTimeout(() => {
        volatileFallbackTimerRef.current = null;
        flushVolatileFallbackQueue();
      }, Math.max(0, Math.floor(delayMs)));
    },
    [flushVolatileFallbackQueue]
  );

  useEffect(() => {
    if (!isWorkbookLiveConnected) return;
    clearVolatileFallbackTimer();
    flushVolatileFallbackQueue();
  }, [clearVolatileFallbackTimer, flushVolatileFallbackQueue, isWorkbookLiveConnected]);

  useEffect(() => {
    volatileFallbackQueueRef.current.clear();
    clearVolatileFallbackTimer();
    volatileFallbackFlushInFlightRef.current = false;
  }, [clearVolatileFallbackTimer, sessionId]);

  useEffect(
    () => () => {
      volatileFallbackQueueRef.current.clear();
      clearVolatileFallbackTimer();
      volatileFallbackFlushInFlightRef.current = false;
    },
    [clearVolatileFallbackTimer]
  );

  const sendWorkbookLiveEvents = useCallback(
    (events: WorkbookClientEventInput[]) => {
      if (!sessionId || events.length === 0) return;
      observeWorkbookRealtimeSend({
        sessionId,
        channel: "live",
        events,
      });
      const sent = workbookLiveSendRef.current?.(events) ?? false;
      if (sent) return;
      const volatileOnly = events.every((event) => isVolatileWorkbookEventType(event.type));
      if (volatileOnly && realtimeBackpressureV2Enabled && !isWorkbookLiveConnected) {
        queueVolatileFallbackEvents(events);
        scheduleVolatileFallbackFlush();
        return;
      }
      void appendWorkbookLiveEvents({ sessionId, events }).catch(() => {
        if (volatileOnly && realtimeBackpressureV2Enabled) {
          observeWorkbookRealtimeVolatileDrop({
            sessionId,
            channel: "live",
            droppedCount: events.length,
            reason: "volatile_fallback_failed",
            eventTypes: events.map((event) => event.type),
          });
        }
      });
    },
    [
      isWorkbookLiveConnected,
      queueVolatileFallbackEvents,
      realtimeBackpressureV2Enabled,
      scheduleVolatileFallbackFlush,
      sessionId,
      workbookLiveSendRef,
    ]
  );

  const appendEventsAndApply = useCallback(
    async (
      events: WorkbookClientEventInput[],
      options?: {
        trackHistory?: boolean;
        markDirty?: boolean;
        historyEntry?: WorkbookHistoryEntry | null;
      }
    ) => {
      if (!sessionId) return;
      const trackHistory =
        options?.trackHistory ??
        events.some((event) => isHistoryTrackedWorkbookEventType(event.type));
      const shouldMarkDirty =
        options?.markDirty ?? events.some((event) => isDirtyWorkbookEventType(event.type));
      const historyEntry =
        options && Object.prototype.hasOwnProperty.call(options, "historyEntry")
          ? options.historyEntry ?? null
          : trackHistory
            ? buildHistoryEntryFromEvents(events)
            : null;
      const preparedEvents = withWorkbookClientEventIds(events);
      observeWorkbookRealtimeSend({
        sessionId,
        channel: "persist",
        events: preparedEvents,
      });
      // Do not pre-mark optimistic event ids as processed here.
      // Some flows (e.g. point merge create+delete batch) do not apply
      // local optimistic create before server ack, so pre-marking drops create.
      if (historyEntry) {
        pushHistoryEntry(historyEntry);
      }
      try {
        const response = await appendWorkbookEvents({
          sessionId,
          events: preparedEvents,
        });
        observeWorkbookRealtimePersistAck({
          sessionId,
          latestSeq: response.latestSeq,
          events: response.events,
        });
        const unseenEvents = filterUnseenWorkbookEvents(response.events, {
          // Persist-ack is authoritative for our own write; do not drop it by seq race.
          ignoreSeqGuard: true,
        });
        if (unseenEvents.length > 0) {
          enqueueIncomingRealtimeApply({
            channel: "persist",
            latestSeq: response.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = response.events.reduce((maxSeq, event) => {
          if (typeof event?.seq !== "number" || !Number.isFinite(event.seq)) {
            return maxSeq;
          }
          return Math.max(maxSeq, Math.max(0, Math.trunc(event.seq)));
        }, latestSeqRef.current);
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
        if (shouldMarkDirty) {
          markDirty();
        }
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403 || error.status === 404)
        ) {
          handleRealtimeAuthRequired(error.status);
        }
        if (error instanceof ApiError && error.code === "conflict" && error.status === 409) {
          handleRealtimeConflict();
        }
        if (historyEntry) {
          rollbackHistoryEntry();
        }
        throw error;
      }
    },
    [
      sessionId,
      buildHistoryEntryFromEvents,
      enqueueIncomingRealtimeApply,
      filterUnseenWorkbookEvents,
      handleRealtimeAuthRequired,
      handleRealtimeConflict,
      latestSeqRef,
      markDirty,
      pushHistoryEntry,
      rollbackHistoryEntry,
      setLatestSeq,
    ]
  );

  return {
    sendWorkbookLiveEvents,
    appendEventsAndApply,
  };
};
