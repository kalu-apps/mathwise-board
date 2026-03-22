import { useCallback, type MutableRefObject } from "react";
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
        observeWorkbookRealtimeVolatileDrop({
          sessionId,
          channel: "live",
          droppedCount: events.length,
          reason: "live_socket_disconnected",
          eventTypes: events.map((event) => event.type),
        });
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
    [isWorkbookLiveConnected, realtimeBackpressureV2Enabled, sessionId, workbookLiveSendRef]
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
