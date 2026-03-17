export const APP_REALTIME_EVENT = "app-realtime";

export type RealtimeMetricPhase =
  | "send"
  | "persist_ack"
  | "receive"
  | "apply"
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
  if (detail.phase === "gap" || detail.phase === "drop" || (detail.maxLatencyMs ?? 0) >= 800) {
    console.warn("[realtime]", detail);
    return;
  }
  if ((detail.maxLatencyMs ?? 0) >= 250) {
    console.info("[realtime]", detail);
  }
};
