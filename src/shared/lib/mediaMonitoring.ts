export const APP_MEDIA_EVENT = "app-media";

export type MediaMetricEventDetail = {
  scope: "workbook";
  subsystem: "livekit";
  phase:
    | "token_request"
    | "token_success"
    | "connect_start"
    | "connect_success"
    | "connect_failure"
    | "retry_scheduled"
    | "disconnect"
    | "connection_state";
  sessionId: string;
  timestamp: string;
  sessionKind?: string | null;
  attempt?: number;
  wsUrl?: string | null;
  roomName?: string | null;
  connectionState?: string | null;
  retryInMs?: number;
  errorName?: string | null;
  errorMessage?: string | null;
  errorReason?: string | null;
  errorStatus?: number | null;
};

const IS_DEV = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export const emitMediaMetric = (detail: MediaMetricEventDetail) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<MediaMetricEventDetail>(APP_MEDIA_EVENT, {
        detail,
      })
    );
  } catch {
    // ignore
  }

  if (!IS_DEV) return;
  if (detail.phase === "connect_failure") {
    console.warn("[media]", detail);
    return;
  }
  if (detail.phase === "retry_scheduled" || detail.phase === "connection_state") {
    console.info("[media]", detail);
  }
};
