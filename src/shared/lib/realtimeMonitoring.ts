export const APP_REALTIME_EVENT = "app-realtime";

export type RealtimeMetricPhase =
  | "send"
  | "persist_ack"
  | "receive"
  | "apply"
  | "connection_state"
  | "connection_error"
  | "poll_error"
  | "fallback"
  | "warning"
  | "resync"
  | "gap"
  | "drop";

export type RealtimeMetricChannel = "persist" | "live" | "stream" | "poll";

export type RealtimeMetricEventDetail = {
  scope: "workbook";
  phase: RealtimeMetricPhase;
  channel: RealtimeMetricChannel;
  sessionId: string;
  eventCount: number;
  eventTypes: string[];
  timestamp: string;
  latestSeq?: number;
  averageLatencyMs?: number;
  maxLatencyMs?: number;
  gapFromSeq?: number;
  gapToSeq?: number;
  dropReason?: string;
  connectionState?: "connected" | "disconnected";
  errorName?: string | null;
  errorMessage?: string | null;
  errorStatus?: number | null;
  errorCode?: string | null;
  retryable?: boolean;
  errorStreak?: number;
  fallbackHealthy?: boolean;
  elapsedMs?: number;
  reason?: string;
};

const IS_DEV = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export const emitRealtimeMetric = (detail: RealtimeMetricEventDetail) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<RealtimeMetricEventDetail>(APP_REALTIME_EVENT, {
        detail,
      })
    );
  } catch {
    // ignore
  }

  if (!IS_DEV) return;
  if (
    detail.phase === "gap" ||
    detail.phase === "drop" ||
    detail.phase === "connection_error" ||
    detail.phase === "poll_error" ||
    detail.phase === "warning" ||
    (detail.maxLatencyMs ?? 0) >= 800
  ) {
    console.warn("[realtime]", detail);
    return;
  }
  if (
    detail.phase === "connection_state" ||
    detail.phase === "fallback" ||
    detail.phase === "resync" ||
    (detail.maxLatencyMs ?? 0) >= 250
  ) {
    console.info("[realtime]", detail);
  }
};
