import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  getWorkbookEvents,
  subscribeWorkbookEventsStream,
  subscribeWorkbookLiveSocket,
} from "@/features/workbook/model/api";
import {
  hasWorkbookEventGap,
  resolveNextLatestSeq,
} from "@/features/workbook/model/runtime";
import {
  observeWorkbookRealtimeGap,
  observeWorkbookRealtimeReceive,
} from "@/features/workbook/model/realtimeObservability";
import type { WorkbookEvent } from "@/features/workbook/model/types";
import type { RealtimeMetricChannel } from "@/shared/lib/realtimeMonitoring";

type EnqueueIncomingRealtimeApply = (batch: {
  channel: RealtimeMetricChannel;
  latestSeq: number;
  events: WorkbookEvent[];
}) => void;

type WorkbookLiveSend = (
  events: Array<{ type: WorkbookEvent["type"]; payload: unknown }>
) => boolean;

type UseWorkbookRealtimeTransportParams = {
  sessionId: string | null;
  loadSession: (options?: { background?: boolean }) => Promise<void> | void;
  clearIncomingRealtimeApplyQueue: () => void;
  enqueueIncomingRealtimeApply: EnqueueIncomingRealtimeApply;
  filterUnseenWorkbookEvents: (
    events: WorkbookEvent[],
    options?: { allowLiveReplay?: boolean }
  ) => WorkbookEvent[];
  latestSeqRef: MutableRefObject<number>;
  sessionResyncInFlightRef: MutableRefObject<boolean>;
  realtimeDisconnectSinceRef: MutableRefObject<number | null>;
  lastForcedResyncAtRef: MutableRefObject<number>;
  workbookLiveSendRef: MutableRefObject<WorkbookLiveSend | null>;
  setLatestSeq: Dispatch<SetStateAction<number>>;
  setRealtimeSyncWarning: Dispatch<SetStateAction<string | null>>;
  isWorkbookStreamConnected: boolean;
  isWorkbookLiveConnected: boolean;
  setIsWorkbookStreamConnected: Dispatch<SetStateAction<boolean>>;
  setIsWorkbookLiveConnected: Dispatch<SetStateAction<boolean>>;
  pollIntervalMs: number;
  pollIntervalStreamConnectedMs: number;
  resyncMinIntervalMs: number;
};

export const useWorkbookRealtimeTransport = ({
  sessionId,
  loadSession,
  clearIncomingRealtimeApplyQueue,
  enqueueIncomingRealtimeApply,
  filterUnseenWorkbookEvents,
  latestSeqRef,
  sessionResyncInFlightRef,
  realtimeDisconnectSinceRef,
  lastForcedResyncAtRef,
  workbookLiveSendRef,
  setLatestSeq,
  setRealtimeSyncWarning,
  isWorkbookStreamConnected,
  isWorkbookLiveConnected,
  setIsWorkbookStreamConnected,
  setIsWorkbookLiveConnected,
  pollIntervalMs,
  pollIntervalStreamConnectedMs,
  resyncMinIntervalMs,
}: UseWorkbookRealtimeTransportParams) => {
  const triggerSessionResync = useCallback(() => {
    const now = Date.now();
    if (sessionResyncInFlightRef.current) return;
    if (now - lastForcedResyncAtRef.current < resyncMinIntervalMs) return;
    sessionResyncInFlightRef.current = true;
    lastForcedResyncAtRef.current = now;
    clearIncomingRealtimeApplyQueue();
    void Promise.resolve(loadSession({ background: true })).finally(() => {
      sessionResyncInFlightRef.current = false;
    });
  }, [
    clearIncomingRealtimeApplyQueue,
    lastForcedResyncAtRef,
    loadSession,
    resyncMinIntervalMs,
    sessionResyncInFlightRef,
  ]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await getWorkbookEvents(sessionId, latestSeqRef.current);
        if (!active) return;
        const unseenEvents = filterUnseenWorkbookEvents(response.events);
        if (hasWorkbookEventGap(latestSeqRef.current, unseenEvents)) {
          observeWorkbookRealtimeGap({
            sessionId,
            channel: "poll",
            latestSeq: latestSeqRef.current,
            nextSeq: unseenEvents[0]?.seq ?? response.latestSeq,
          });
          triggerSessionResync();
          return;
        }
        if (unseenEvents.length > 0) {
          observeWorkbookRealtimeReceive({
            sessionId,
            channel: "poll",
            latestSeq: response.latestSeq,
            events: unseenEvents,
          });
          enqueueIncomingRealtimeApply({
            channel: "poll",
            latestSeq: response.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = resolveNextLatestSeq(
          latestSeqRef.current,
          response.latestSeq,
          unseenEvents
        );
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
      } catch {
        // ignore transient polling errors
      }
    };
    void poll();
    const intervalMs = isWorkbookStreamConnected || isWorkbookLiveConnected
      ? pollIntervalStreamConnectedMs
      : pollIntervalMs;
    const intervalId = window.setInterval(() => {
      void poll();
    }, intervalMs);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    enqueueIncomingRealtimeApply,
    filterUnseenWorkbookEvents,
    isWorkbookLiveConnected,
    isWorkbookStreamConnected,
    latestSeqRef,
    pollIntervalMs,
    pollIntervalStreamConnectedMs,
    sessionId,
    setLatestSeq,
    triggerSessionResync,
  ]);

  useEffect(() => {
    if (!sessionId) {
      realtimeDisconnectSinceRef.current = null;
      setRealtimeSyncWarning(null);
      return;
    }
    const disconnected = !isWorkbookStreamConnected && !isWorkbookLiveConnected;
    if (!disconnected) {
      realtimeDisconnectSinceRef.current = null;
      setRealtimeSyncWarning(null);
      return;
    }
    if (!realtimeDisconnectSinceRef.current) {
      realtimeDisconnectSinceRef.current = Date.now();
    }
    const timerId = window.setInterval(() => {
      const startedAt = realtimeDisconnectSinceRef.current;
      if (!startedAt) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 12_000) {
        setRealtimeSyncWarning(
          "Realtime-канал нестабилен. Продолжаем синхронизацию через резервные механизмы."
        );
      }
      if (elapsed >= 30_000 && Date.now() - lastForcedResyncAtRef.current >= 20_000) {
        triggerSessionResync();
      }
    }, 2_500);
    return () => {
      window.clearInterval(timerId);
    };
  }, [
    isWorkbookLiveConnected,
    isWorkbookStreamConnected,
    lastForcedResyncAtRef,
    realtimeDisconnectSinceRef,
    sessionId,
    setRealtimeSyncWarning,
    triggerSessionResync,
  ]);

  useEffect(() => {
    if (!sessionId) return;
    const unsubscribe = subscribeWorkbookEventsStream({
      sessionId,
      onEvents: (payload) => {
        if (payload.sessionId !== sessionId) return;
        const unseenEvents = filterUnseenWorkbookEvents(payload.events);
        if (hasWorkbookEventGap(latestSeqRef.current, unseenEvents)) {
          observeWorkbookRealtimeGap({
            sessionId,
            channel: "stream",
            latestSeq: latestSeqRef.current,
            nextSeq: unseenEvents[0]?.seq ?? payload.latestSeq,
          });
          triggerSessionResync();
          return;
        }
        if (unseenEvents.length > 0) {
          observeWorkbookRealtimeReceive({
            sessionId,
            channel: "stream",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
          enqueueIncomingRealtimeApply({
            channel: "stream",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = resolveNextLatestSeq(
          latestSeqRef.current,
          payload.latestSeq,
          unseenEvents
        );
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
      },
      onConnectionChange: setIsWorkbookStreamConnected,
    });
    return () => {
      setIsWorkbookStreamConnected(false);
      unsubscribe();
    };
  }, [
    enqueueIncomingRealtimeApply,
    filterUnseenWorkbookEvents,
    latestSeqRef,
    sessionId,
    setIsWorkbookStreamConnected,
    setLatestSeq,
    triggerSessionResync,
  ]);

  useEffect(() => {
    if (!sessionId) {
      workbookLiveSendRef.current = null;
      clearIncomingRealtimeApplyQueue();
      return;
    }
    const connection = subscribeWorkbookLiveSocket({
      sessionId,
      onEvents: (payload) => {
        if (payload.sessionId !== sessionId) return;
        const unseenEvents = filterUnseenWorkbookEvents(payload.events, {
          allowLiveReplay: true,
        });
        if (hasWorkbookEventGap(latestSeqRef.current, unseenEvents)) {
          observeWorkbookRealtimeGap({
            sessionId,
            channel: "live",
            latestSeq: latestSeqRef.current,
            nextSeq: unseenEvents[0]?.seq ?? payload.latestSeq,
          });
          return;
        }
        if (unseenEvents.length > 0) {
          observeWorkbookRealtimeReceive({
            sessionId,
            channel: "live",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
          enqueueIncomingRealtimeApply({
            channel: "live",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = resolveNextLatestSeq(
          latestSeqRef.current,
          payload.latestSeq,
          unseenEvents
        );
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
      },
      onConnectionChange: setIsWorkbookLiveConnected,
    });
    workbookLiveSendRef.current = connection.sendEvents;
    return () => {
      workbookLiveSendRef.current = null;
      setIsWorkbookLiveConnected(false);
      connection.close();
    };
  }, [
    clearIncomingRealtimeApplyQueue,
    enqueueIncomingRealtimeApply,
    filterUnseenWorkbookEvents,
    latestSeqRef,
    sessionId,
    setIsWorkbookLiveConnected,
    setLatestSeq,
    workbookLiveSendRef,
  ]);
};
