import { reportLongTaskMetric } from "@/shared/lib/performanceMonitoring";

const WORKBOOK_FRAME_STALL_THRESHOLD_MS = 42;
const WORKBOOK_FRAME_STALL_COOLDOWN_MS = 2_000;
const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export type WorkbookLoadStageMetricName =
  | "session_open_ms"
  | "snapshot_decode_ms"
  | "snapshot_hydrate_ms"
  | "first_interactive_ms";

export const reportWorkbookLoadStageMetric = (params: {
  sessionId: string;
  name: WorkbookLoadStageMetricName;
  durationMs: number;
  startedAtMs?: number;
}) => {
  if (!params.sessionId.trim()) return;
  const durationMs = Math.max(0, Math.round(params.durationMs));
  reportLongTaskMetric(durationMs, {
    interactionType: params.name,
    target: `workbook:${params.sessionId}`,
    durationMs,
    startTimeMs:
      typeof params.startedAtMs === "number" && Number.isFinite(params.startedAtMs)
        ? params.startedAtMs
        : Math.max(0, nowMs() - durationMs),
  });
};

export const startWorkbookPerformanceSession = (sessionId: string) => {
  if (typeof window === "undefined" || !sessionId.trim()) {
    return () => undefined;
  }

  let lastFrameAt = 0;
  let lastReportedAt = 0;
  let frameId = 0;

  const tick = (now: number) => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      lastFrameAt = now;
      frameId = window.requestAnimationFrame(tick);
      return;
    }

    if (lastFrameAt > 0) {
      const frameGap = now - lastFrameAt;
      if (
        frameGap >= WORKBOOK_FRAME_STALL_THRESHOLD_MS &&
        now - lastReportedAt >= WORKBOOK_FRAME_STALL_COOLDOWN_MS
      ) {
        lastReportedAt = now;
        reportLongTaskMetric(frameGap, {
          interactionType: "workbook_frame_stall",
          target: `workbook:${sessionId}`,
          durationMs: Math.round(frameGap),
          startTimeMs: Math.max(0, now - frameGap),
        });
      }
    }

    lastFrameAt = now;
    frameId = window.requestAnimationFrame(tick);
  };

  frameId = window.requestAnimationFrame(tick);

  return () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
  };
};
