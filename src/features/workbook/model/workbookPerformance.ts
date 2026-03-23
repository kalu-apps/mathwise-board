import { reportLongTaskMetric } from "@/shared/lib/performanceMonitoring";

const WORKBOOK_FRAME_STALL_THRESHOLD_MS = 42;
const WORKBOOK_FRAME_STALL_COOLDOWN_MS = 2_000;
const WORKBOOK_PHASE_METRIC_MIN_DURATION_MS = 8;
const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const isWorkbookDebugConsoleEnabled = () => {
  if (typeof import.meta === "undefined") return false;
  if (import.meta.env?.DEV) return true;
  const raw = String(import.meta.env?.VITE_WORKBOOK_DEBUG_LOGS ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
};

export const WORKBOOK_PERF_PHASE_EVENT = "workbook-performance-phase";
export const WORKBOOK_CORRECTNESS_EVENT = "workbook-correctness";
export const WORKBOOK_IMPORT_EVENT = "workbook-import";

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
  | "scene_render_entries_ms"
  | "page_switch_visible_scene_ms";

export type WorkbookRecoveryMode =
  | "bootstrapping"
  | "catching_up"
  | "live"
  | "degraded_without_snapshot"
  | "recovering";

export type WorkbookCorrectnessEventName =
  | "session_open_start"
  | "session_open_snapshot_seq"
  | "session_open_tail_applied_to_seq"
  | "resume_start"
  | "resume_known_seq"
  | "resume_snapshot_seq"
  | "resume_tail_applied_to_seq"
  | "page_apply_requested_seq"
  | "page_apply_accepted_seq"
  | "page_apply_rejected_as_stale"
  | "snapshot_apply_skipped_as_stale"
  | "recovery_mode_entered"
  | "recovery_mode_exited"
  | "realtime_event_skipped_as_stale";

export type WorkbookImportEventName =
  | "modal_opened"
  | "files_selected"
  | "validation_failed"
  | "optimization_started"
  | "optimization_finished"
  | "upload_started"
  | "upload_succeeded"
  | "upload_failed"
  | "insert_started"
  | "insert_succeeded"
  | "insert_failed"
  | "batch_completed"
  | "batch_partially_failed";

type WorkbookPerfPhaseMetricDetail = {
  name: WorkbookPerfPhaseName;
  durationMs: number;
  timestamp: string;
  counters?: Record<string, number>;
};

type WorkbookCorrectnessEventDetail = {
  name: WorkbookCorrectnessEventName;
  sessionId: string;
  timestamp: string;
  recoveryMode?: WorkbookRecoveryMode;
  reason?: string;
  seq?: number;
  snapshotSeq?: number;
  counters?: Record<string, number>;
};

type WorkbookImportEventDetail = {
  name: WorkbookImportEventName;
  sessionId?: string;
  timestamp: string;
  reason?: string;
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

export const reportWorkbookCorrectnessEvent = (params: {
  name: WorkbookCorrectnessEventName;
  sessionId: string;
  recoveryMode?: WorkbookRecoveryMode;
  reason?: string;
  seq?: number;
  snapshotSeq?: number;
  counters?: Record<string, number>;
}) => {
  if (!params.sessionId.trim()) return;
  const counters =
    params.counters &&
    Object.fromEntries(
      Object.entries(params.counters).filter(
        ([, value]) => typeof value === "number" && Number.isFinite(value)
      )
    );
  const detail: WorkbookCorrectnessEventDetail = {
    name: params.name,
    sessionId: params.sessionId,
    timestamp: new Date().toISOString(),
    recoveryMode: params.recoveryMode,
    reason: params.reason,
    seq:
      typeof params.seq === "number" && Number.isFinite(params.seq)
        ? Math.max(0, Math.trunc(params.seq))
        : undefined,
    snapshotSeq:
      typeof params.snapshotSeq === "number" && Number.isFinite(params.snapshotSeq)
        ? Math.max(0, Math.trunc(params.snapshotSeq))
        : undefined,
    counters:
      counters && Object.keys(counters).length > 0 ? counters : undefined,
  };
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<WorkbookCorrectnessEventDetail>(WORKBOOK_CORRECTNESS_EVENT, {
          detail,
        })
      );
    } catch {
      // ignore dispatch failures
    }
  }
  if (!isWorkbookDebugConsoleEnabled()) {
    return;
  }
  if (
    detail.name === "snapshot_apply_skipped_as_stale" ||
    detail.name === "page_apply_rejected_as_stale" ||
    detail.name === "realtime_event_skipped_as_stale"
  ) {
    console.warn("[sync-correctness]", detail.name, detail);
    return;
  }
  console.info("[sync-correctness]", detail.name, detail);
};

export const reportWorkbookImportEvent = (params: {
  name: WorkbookImportEventName;
  sessionId?: string;
  reason?: string;
  counters?: Record<string, number>;
}) => {
  const counters =
    params.counters &&
    Object.fromEntries(
      Object.entries(params.counters).filter(
        ([, value]) => typeof value === "number" && Number.isFinite(value)
      )
    );
  const detail: WorkbookImportEventDetail = {
    name: params.name,
    sessionId: params.sessionId?.trim() || undefined,
    timestamp: new Date().toISOString(),
    reason: params.reason,
    counters:
      counters && Object.keys(counters).length > 0 ? counters : undefined,
  };
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<WorkbookImportEventDetail>(WORKBOOK_IMPORT_EVENT, {
          detail,
        })
      );
    } catch {
      // ignore dispatch failures
    }
  }
  if (
    detail.name === "validation_failed" ||
    detail.name === "upload_failed" ||
    detail.name === "insert_failed" ||
    detail.name === "batch_partially_failed"
  ) {
    console.warn("[import-modal]", detail.name, detail);
    return;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    console.info("[import-modal]", detail.name, detail);
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
