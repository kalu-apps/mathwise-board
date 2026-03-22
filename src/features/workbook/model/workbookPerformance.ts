import { reportLongTaskMetric } from "@/shared/lib/performanceMonitoring";

const WORKBOOK_FRAME_STALL_THRESHOLD_MS = 42;
const WORKBOOK_FRAME_STALL_COOLDOWN_MS = 2_000;
const WORKBOOK_PHASE_METRIC_MIN_DURATION_MS = 8;
const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export const WORKBOOK_PERF_PHASE_EVENT = "workbook-performance-phase";

export type WorkbookLoadStageMetricName =
  | "session_open_ms"
  | "snapshot_decode_ms"
  | "snapshot_hydrate_ms"
  | "first_interactive_ms";

export type WorkbookPerfPhaseName =
  | "incoming_apply_ms"
  | "scene_index_rebuild_ms"
  | "scene_access_rebuild_ms"
  | "scene_graph_state_ms"
  | "scene_render_entries_ms";

type WorkbookPerfPhaseMetricDetail = {
  name: WorkbookPerfPhaseName;
  durationMs: number;
  timestamp: string;
  counters?: Record<string, number>;
};

export const reportWorkbookPerfPhaseMetric = (params: {
  name: WorkbookPerfPhaseName;
  durationMs: number;
  counters?: Record<string, number>;
}) => {
  const roundedDurationMs = Math.max(
    0,
    Math.round(Number(params.durationMs) * 10) / 10
  );
  if (
    !Number.isFinite(roundedDurationMs) ||
    roundedDurationMs < WORKBOOK_PHASE_METRIC_MIN_DURATION_MS
  ) {
    return;
  }
  const counters =
    params.counters &&
    Object.fromEntries(
      Object.entries(params.counters).filter(
        ([, value]) => typeof value === "number" && Number.isFinite(value)
      )
    );
  const detail: WorkbookPerfPhaseMetricDetail = {
    name: params.name,
    durationMs: roundedDurationMs,
    timestamp: new Date().toISOString(),
    counters:
      counters && Object.keys(counters).length > 0 ? counters : undefined,
  };
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<WorkbookPerfPhaseMetricDetail>(
          WORKBOOK_PERF_PHASE_EVENT,
          {
            detail,
          }
        )
      );
    } catch {
      // ignore dispatch failures
    }
  }
  if (roundedDurationMs >= 32) {
    console.warn("[perf-phase]", detail.name, detail.durationMs, detail.counters ?? {});
    return;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    console.info("[perf-phase]", detail.name, detail.durationMs, detail.counters ?? {});
  }
};

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
