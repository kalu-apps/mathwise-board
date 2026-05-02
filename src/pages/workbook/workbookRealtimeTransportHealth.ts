import {
  observeWorkbookRealtimeFallback,
  observeWorkbookRealtimeWarning,
} from "@/features/workbook/model/realtimeObservability";

const REALTIME_TRANSPORT_WARNING_DELAY_MS = 30_000;
const REALTIME_TRANSPORT_RESYNC_DELAY_MS = 30_000;
const REALTIME_POLL_FALLBACK_HEALTHY_MS = 20_000;
const REALTIME_TRANSPORT_WARNING_MESSAGE =
  "Синхронизация доски заметно задерживается. Проверьте сеть, VPN или прокси. Мы продолжаем восстановление автоматически.";

export const REALTIME_TRANSPORT_CHECK_INTERVAL_MS = 2_500;
export type WorkbookRealtimeFallbackState =
  | "poll_fallback_healthy"
  | "poll_fallback_unhealthy"
  | null;

export const evaluateWorkbookRealtimeTransportHealth = (params: {
  sessionId: string;
  startedAt: number;
  now: number;
  authBlocked: boolean;
  lastPollSuccessAt: number;
  lastFallbackState: WorkbookRealtimeFallbackState;
  lastServerUnavailableAt: number;
  lastForcedResyncAt: number;
  notifyAuthRequired: () => void;
  setFallbackState: (state: WorkbookRealtimeFallbackState) => void;
  setRealtimeSyncWarning: (message: string | null) => void;
  triggerSessionResync: (reason: string) => void;
}) => {
  const elapsed = params.now - params.startedAt;
  const pollFallbackHealthy =
    params.lastPollSuccessAt > 0 &&
    params.now - params.lastPollSuccessAt <= REALTIME_POLL_FALLBACK_HEALTHY_MS;

  if (elapsed >= REALTIME_TRANSPORT_WARNING_DELAY_MS) {
    if (params.authBlocked) {
      params.notifyAuthRequired();
    } else if (pollFallbackHealthy) {
      params.setRealtimeSyncWarning(null);
      if (params.lastFallbackState !== "poll_fallback_healthy") {
        params.setFallbackState("poll_fallback_healthy");
        observeWorkbookRealtimeFallback({
          sessionId: params.sessionId,
          healthy: true,
          elapsedMs: elapsed,
          reason: "stream_and_live_disconnected_poll_healthy",
        });
      }
    } else if (params.lastFallbackState !== "poll_fallback_unhealthy") {
      params.setFallbackState("poll_fallback_unhealthy");
      observeWorkbookRealtimeWarning({
        sessionId: params.sessionId,
        elapsedMs: elapsed,
        reason: "stream_and_live_disconnected_poll_unhealthy",
      });
      params.setRealtimeSyncWarning(REALTIME_TRANSPORT_WARNING_MESSAGE);
    }
  }

  if (
    !params.authBlocked &&
    !(params.lastServerUnavailableAt > 0 && params.now - params.lastServerUnavailableAt < 25_000) &&
    !pollFallbackHealthy &&
    elapsed >= REALTIME_TRANSPORT_RESYNC_DELAY_MS &&
    params.now - params.lastForcedResyncAt >= 20_000
  ) {
    params.triggerSessionResync("stream_and_live_disconnected_poll_unhealthy");
  }
};
