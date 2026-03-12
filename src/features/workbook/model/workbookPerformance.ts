import { reportLongTaskMetric } from "@/shared/lib/performanceMonitoring";

const WORKBOOK_FRAME_STALL_THRESHOLD_MS = 42;
const WORKBOOK_FRAME_STALL_COOLDOWN_MS = 2_000;

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
