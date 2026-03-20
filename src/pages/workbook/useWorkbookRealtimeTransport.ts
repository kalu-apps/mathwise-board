import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { ApiError } from "@/shared/api/client";
import {
  getWorkbookEvents,
  subscribeWorkbookEventsStream,
  subscribeWorkbookLiveSocket,
} from "@/features/workbook/model/api";
import {
  hasWorkbookEventGap,
  resolveNextLatestSeq,
} from "@/features/workbook/model/runtime";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
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
  events: WorkbookClientEventInput[]
) => boolean;

type UseWorkbookRealtimeTransportParams = {
  sessionId: string | null;
  enabled: boolean;
  bootstrapReady: boolean;
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
  adaptivePollingEnabled: boolean;
  adaptivePollingMinMs: number;
  adaptivePollingMaxMs: number;
  isMediaAudioConnected: boolean;
  onAuthRequired?: () => void;
};

export const useWorkbookRealtimeTransport = ({
  sessionId,
  enabled,
  bootstrapReady,
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
  adaptivePollingEnabled,
  adaptivePollingMinMs,
  adaptivePollingMaxMs,
  isMediaAudioConnected,
  onAuthRequired,
}: UseWorkbookRealtimeTransportParams) => {
  const authBlockedRef = useRef(false);
  const authRequiredNotifiedRef = useRef(false);
  const lastServerUnavailableAtRef = useRef(0);
  const clearAuthBlock = useCallback(() => {
    authBlockedRef.current = false;
    authRequiredNotifiedRef.current = false;
    lastServerUnavailableAtRef.current = 0;
  }, []);
  const notifyAuthRequired = useCallback(() => {
    if (!authRequiredNotifiedRef.current) {
      authRequiredNotifiedRef.current = true;
      onAuthRequired?.();
    }
    setRealtimeSyncWarning("Сессия недоступна: требуется повторная авторизация.");
  }, [onAuthRequired, setRealtimeSyncWarning]);

  useEffect(() => {
    if (sessionId) return;
    clearAuthBlock();
  }, [clearAuthBlock, sessionId]);

  useEffect(() => {
    if (enabled) return;
    workbookLiveSendRef.current = null;
    clearIncomingRealtimeApplyQueue();
    realtimeDisconnectSinceRef.current = null;
    setIsWorkbookStreamConnected(false);
    setIsWorkbookLiveConnected(false);
    setRealtimeSyncWarning(null);
  }, [
    clearIncomingRealtimeApplyQueue,
    enabled,
    realtimeDisconnectSinceRef,
    setIsWorkbookLiveConnected,
    setIsWorkbookStreamConnected,
    setRealtimeSyncWarning,
    workbookLiveSendRef,
  ]);

  const triggerSessionResync = useCallback(() => {
    const now = Date.now();
    if (!enabled) return;
    if (!bootstrapReady) return;
    if (authBlockedRef.current) return;
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
    enabled,
    bootstrapReady,
    lastForcedResyncAtRef,
    loadSession,
    resyncMinIntervalMs,
    sessionResyncInFlightRef,
  ]);

  useEffect(() => {
    if (!enabled) return;
    void loadSession();
  }, [enabled, loadSession]);

  useEffect(() => {
    if (!enabled || !sessionId || !bootstrapReady) return;
    let active = true;
    let pollTimerId: number | null = null;
    let pollErrorStreak = 0;
    let idlePollStreak = 0;
    let inFlight = false;

    const clearPollTimer = () => {
      if (pollTimerId === null) return;
      window.clearTimeout(pollTimerId);
      pollTimerId = null;
    };

    const schedulePoll = (
      reason:
        | "event"
        | "idle"
        | "error"
        | "server_error"
        | "auth_error"
        | "bootstrap"
    ) => {
      if (!active) return;
      const connected = isWorkbookStreamConnected || isWorkbookLiveConnected;
      const baseInterval = connected ? pollIntervalStreamConnectedMs : pollIntervalMs;
      if (!adaptivePollingEnabled) {
        const fallbackDelay =
          reason === "auth_error"
            ? Math.max(15_000, baseInterval)
            : reason === "server_error"
              ? Math.max(8_000, baseInterval * 2)
              : Math.max(40, baseInterval);
        clearPollTimer();
        pollTimerId = window.setTimeout(() => {
          void poll();
        }, fallbackDelay);
        return;
      }

      let nextInterval = baseInterval;
      if (reason === "event") {
        idlePollStreak = 0;
        pollErrorStreak = 0;
        nextInterval = Math.max(adaptivePollingMinMs, Math.floor(baseInterval * 0.6));
      } else if (reason === "server_error") {
        pollErrorStreak += 1;
        const outageMaxMs = Math.max(adaptivePollingMaxMs, 25_000);
        const aggressiveBackoff = Math.floor(baseInterval * 2 ** Math.max(2, pollErrorStreak));
        nextInterval = Math.max(
          Math.max(adaptivePollingMinMs, 1_000),
          Math.min(outageMaxMs, aggressiveBackoff)
        );
      } else if (reason === "error") {
        pollErrorStreak += 1;
        const backoff = Math.min(
          adaptivePollingMaxMs,
          Math.floor(baseInterval * 1.5 ** Math.max(1, pollErrorStreak))
        );
        nextInterval = Math.max(adaptivePollingMinMs, backoff);
      } else if (reason === "auth_error") {
        pollErrorStreak = 0;
        idlePollStreak = 0;
        nextInterval = Math.max(15_000, Math.min(adaptivePollingMaxMs, baseInterval * 4));
      } else if (reason === "idle") {
        pollErrorStreak = 0;
        idlePollStreak += 1;
        const idleMultiplier = connected
          ? Math.min(8, 1 + idlePollStreak * 0.55)
          : Math.min(4, 1 + idlePollStreak * 0.35);
        nextInterval = Math.min(adaptivePollingMaxMs, Math.floor(baseInterval * idleMultiplier));
      } else {
        pollErrorStreak = 0;
        idlePollStreak = 0;
        nextInterval = Math.max(adaptivePollingMinMs, baseInterval);
      }

      if (isMediaAudioConnected && connected) {
        nextInterval = Math.min(adaptivePollingMaxMs, Math.floor(nextInterval * 1.25));
      }

      const jitter = Math.floor(nextInterval * 0.12 * Math.random());
      clearPollTimer();
      pollTimerId = window.setTimeout(() => {
        void poll();
      }, Math.max(adaptivePollingMinMs, nextInterval + jitter));
    };

    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const response = await getWorkbookEvents(sessionId, latestSeqRef.current);
        clearAuthBlock();
        lastServerUnavailableAtRef.current = 0;
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
          schedulePoll("event");
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
        schedulePoll(unseenEvents.length > 0 ? "event" : "idle");
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403 || error.status === 404)
        ) {
          authBlockedRef.current = true;
          notifyAuthRequired();
          schedulePoll("auth_error");
          return;
        }
        if (
          error instanceof ApiError &&
          (error.status >= 500 ||
            error.code === "server_unavailable" ||
            error.code === "timeout" ||
            error.code === "network_error" ||
            error.code === "network_offline")
        ) {
          lastServerUnavailableAtRef.current = Date.now();
          schedulePoll("server_error");
          return;
        }
        schedulePoll("error");
      } finally {
        inFlight = false;
      }
    };
    void poll();
    schedulePoll("bootstrap");
    return () => {
      active = false;
      clearPollTimer();
    };
  }, [
    adaptivePollingEnabled,
    adaptivePollingMaxMs,
    adaptivePollingMinMs,
    clearAuthBlock,
    enqueueIncomingRealtimeApply,
    filterUnseenWorkbookEvents,
    isMediaAudioConnected,
    isWorkbookLiveConnected,
    isWorkbookStreamConnected,
    latestSeqRef,
    notifyAuthRequired,
    pollIntervalMs,
    pollIntervalStreamConnectedMs,
    sessionId,
    enabled,
    bootstrapReady,
    setLatestSeq,
    triggerSessionResync,
  ]);

  useEffect(() => {
    if (!enabled || !sessionId || !bootstrapReady) {
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
        if (authBlockedRef.current) {
          notifyAuthRequired();
        } else {
          setRealtimeSyncWarning(
            "Realtime-канал нестабилен. Продолжаем синхронизацию через резервные механизмы."
          );
        }
      }
      if (
        !authBlockedRef.current &&
        !(
          lastServerUnavailableAtRef.current > 0 &&
          Date.now() - lastServerUnavailableAtRef.current < 25_000
        ) &&
        elapsed >= 30_000 &&
        Date.now() - lastForcedResyncAtRef.current >= 20_000
      ) {
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
    notifyAuthRequired,
    enabled,
    bootstrapReady,
    realtimeDisconnectSinceRef,
    sessionId,
    setRealtimeSyncWarning,
    triggerSessionResync,
  ]);

  useEffect(() => {
    if (!enabled || !sessionId || !bootstrapReady) return;
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
      onConnectionChange: (connected) => {
        setIsWorkbookStreamConnected(connected);
        if (!connected) return;
        clearAuthBlock();
        setRealtimeSyncWarning(null);
      },
    });
    return () => {
      setIsWorkbookStreamConnected(false);
      unsubscribe();
    };
  }, [
    clearAuthBlock,
    enqueueIncomingRealtimeApply,
    filterUnseenWorkbookEvents,
    latestSeqRef,
    enabled,
    bootstrapReady,
    sessionId,
    setIsWorkbookStreamConnected,
    setLatestSeq,
    setRealtimeSyncWarning,
    triggerSessionResync,
  ]);

  useEffect(() => {
    if (!enabled || !sessionId || !bootstrapReady) {
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
      onConnectionChange: (connected) => {
        setIsWorkbookLiveConnected(connected);
        if (!connected) return;
        clearAuthBlock();
        setRealtimeSyncWarning(null);
      },
    });
    workbookLiveSendRef.current = connection.sendEvents;
    return () => {
      workbookLiveSendRef.current = null;
      setIsWorkbookLiveConnected(false);
      connection.close();
    };
  }, [
    clearAuthBlock,
    clearIncomingRealtimeApplyQueue,
    enqueueIncomingRealtimeApply,
    filterUnseenWorkbookEvents,
    latestSeqRef,
    enabled,
    bootstrapReady,
    sessionId,
    setIsWorkbookLiveConnected,
    setLatestSeq,
    setRealtimeSyncWarning,
    workbookLiveSendRef,
  ]);
};
