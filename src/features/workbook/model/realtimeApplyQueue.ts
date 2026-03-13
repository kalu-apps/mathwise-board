import type { WorkbookEvent } from "./types";
import type { RealtimeMetricChannel } from "@/shared/lib/realtimeMonitoring";

export type WorkbookRealtimeApplyBatch = {
  channel: RealtimeMetricChannel;
  latestSeq: number;
  events: WorkbookEvent[];
};

type WorkbookRealtimeApplyQueueOptions = {
  applyEvents: (events: WorkbookEvent[]) => void;
  onBatchApplied?: (batch: WorkbookRealtimeApplyBatch) => void;
  frameBudgetMs?: number;
  maxEventsPerFrame?: number;
};

const DEFAULT_FRAME_BUDGET_MS = 6;
const DEFAULT_MAX_EVENTS_PER_FRAME = 120;

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const normalizeFinite = (value: unknown, fallback: number, min = 1) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.floor(value));
};

const resolveBackpressureMultiplier = (queuedEvents: number) => {
  if (queuedEvents >= 4_000) return 4;
  if (queuedEvents >= 1_500) return 2;
  return 1;
};

export const createWorkbookRealtimeApplyQueue = (
  options: WorkbookRealtimeApplyQueueOptions
) => {
  const frameBudgetMs = normalizeFinite(
    options.frameBudgetMs,
    DEFAULT_FRAME_BUDGET_MS,
    1
  );
  const maxEventsPerFrame = normalizeFinite(
    options.maxEventsPerFrame,
    DEFAULT_MAX_EVENTS_PER_FRAME,
    8
  );

  let queue: WorkbookRealtimeApplyBatch[] = [];
  let frameId: number | null = null;
  let disposed = false;

  const getQueuedEventsCount = () =>
    queue.reduce((sum, batch) => sum + batch.events.length, 0);

  const clearScheduledFrame = () => {
    if (frameId === null || typeof window === "undefined") return;
    window.cancelAnimationFrame(frameId);
    frameId = null;
  };

  const flushFrame = () => {
    frameId = null;
    if (disposed || queue.length === 0) return;
    const queuedEvents = getQueuedEventsCount();
    const backpressureMultiplier = resolveBackpressureMultiplier(queuedEvents);
    const effectiveFrameBudgetMs = frameBudgetMs * backpressureMultiplier;
    const effectiveMaxEventsPerFrame = maxEventsPerFrame * backpressureMultiplier;
    const frameStartedAt = nowMs();
    let processedEvents = 0;

    while (queue.length > 0) {
      const head = queue[0];
      if (!head || head.events.length === 0) {
        queue.shift();
        continue;
      }
      const remainingCapacity = effectiveMaxEventsPerFrame - processedEvents;
      if (remainingCapacity <= 0) break;

      const chunkSize = Math.max(1, Math.min(remainingCapacity, head.events.length));
      const chunkEvents = head.events.splice(0, chunkSize);
      if (chunkEvents.length > 0) {
        options.applyEvents(chunkEvents);
        options.onBatchApplied?.({
          channel: head.channel,
          latestSeq: head.latestSeq,
          events: chunkEvents,
        });
        processedEvents += chunkEvents.length;
      }
      if (head.events.length === 0) {
        queue.shift();
      }
      if (nowMs() - frameStartedAt >= effectiveFrameBudgetMs) break;
    }

    if (!disposed && queue.length > 0) {
      if (typeof window === "undefined") {
        flushFrame();
        return;
      }
      frameId = window.requestAnimationFrame(flushFrame);
    }
  };

  const scheduleFlush = () => {
    if (disposed || frameId !== null || queue.length === 0) return;
    if (typeof window === "undefined") {
      flushFrame();
      return;
    }
    frameId = window.requestAnimationFrame(flushFrame);
  };

  return {
    enqueue(batch: WorkbookRealtimeApplyBatch) {
      if (disposed || !batch || batch.events.length === 0) return;
      const lastBatch = queue[queue.length - 1];
      if (lastBatch && lastBatch.channel === batch.channel) {
        lastBatch.latestSeq = Math.max(lastBatch.latestSeq, batch.latestSeq);
        lastBatch.events.push(...batch.events);
      } else {
        queue.push({
          channel: batch.channel,
          latestSeq: batch.latestSeq,
          events: batch.events.slice(),
        });
      }
      scheduleFlush();
    },
    clear() {
      queue = [];
      clearScheduledFrame();
    },
    flushNow() {
      if (disposed) return;
      clearScheduledFrame();
      while (queue.length > 0) {
        const head = queue.shift();
        if (!head || head.events.length === 0) continue;
        options.applyEvents(head.events);
        options.onBatchApplied?.(head);
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      queue = [];
      clearScheduledFrame();
    },
    size() {
      return getQueuedEventsCount();
    },
  };
};
