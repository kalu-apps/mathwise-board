import { isVolatileWorkbookEventType } from "./events";
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
  criticalFrameBudgetMs?: number;
  volatileFrameBudgetMs?: number;
  maxEventsPerFrame?: number;
  maxCriticalEventsPerFrame?: number;
  maxVolatileEventsPerFrame?: number;
  maxCriticalChunkEvents?: number;
  maxVolatileChunkEvents?: number;
  maxVolatileQueuedEvents?: number;
};

const DEFAULT_FRAME_BUDGET_MS = 6;
const DEFAULT_CRITICAL_FRAME_BUDGET_MS = 4;
const DEFAULT_VOLATILE_FRAME_BUDGET_MS = 2;
const DEFAULT_MAX_EVENTS_PER_FRAME = 120;
const DEFAULT_MAX_CRITICAL_EVENTS_PER_FRAME = 72;
const DEFAULT_MAX_VOLATILE_EVENTS_PER_FRAME = 28;
const DEFAULT_MAX_CRITICAL_CHUNK_EVENTS = 16;
const DEFAULT_MAX_VOLATILE_CHUNK_EVENTS = 8;
const DEFAULT_MAX_VOLATILE_QUEUED_EVENTS = 720;

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const normalizeFinite = (value: unknown, fallback: number, min = 1) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.floor(value));
};

const getQueuedEventsCount = (queue: WorkbookRealtimeApplyBatch[]) =>
  queue.reduce((sum, batch) => sum + batch.events.length, 0);

const appendBatchToQueue = (queue: WorkbookRealtimeApplyBatch[], batch: WorkbookRealtimeApplyBatch) => {
  const tail = queue[queue.length - 1];
  if (tail && tail.channel === batch.channel) {
    tail.latestSeq = Math.max(tail.latestSeq, batch.latestSeq);
    tail.events.push(...batch.events);
    return;
  }
  queue.push({
    channel: batch.channel,
    latestSeq: batch.latestSeq,
    events: batch.events.slice(),
  });
};

const trimVolatileQueue = (
  queue: WorkbookRealtimeApplyBatch[],
  maxVolatileQueuedEvents: number
) => {
  let overflow = getQueuedEventsCount(queue) - maxVolatileQueuedEvents;
  while (overflow > 0 && queue.length > 0) {
    const head = queue[0];
    if (!head || head.events.length === 0) {
      queue.shift();
      continue;
    }
    if (head.events.length <= overflow) {
      overflow -= head.events.length;
      queue.shift();
      continue;
    }
    head.events.splice(0, overflow);
    overflow = 0;
  }
};

const drainQueueWithBudget = (params: {
  queue: WorkbookRealtimeApplyBatch[];
  maxEvents: number;
  maxChunkEvents: number;
  deadlineMs: number;
  applyEvents: (events: WorkbookEvent[]) => void;
  onBatchApplied?: (batch: WorkbookRealtimeApplyBatch) => void;
}) => {
  if (params.maxEvents <= 0) return 0;
  let processedEvents = 0;

  while (params.queue.length > 0 && processedEvents < params.maxEvents) {
    if (nowMs() >= params.deadlineMs) break;
    const head = params.queue[0];
    if (!head || head.events.length === 0) {
      params.queue.shift();
      continue;
    }

    const remainingCapacity = params.maxEvents - processedEvents;
    const chunkSize = Math.max(
      1,
      Math.min(remainingCapacity, head.events.length, params.maxChunkEvents)
    );
    const chunkEvents = head.events.splice(0, chunkSize);
    if (chunkEvents.length > 0) {
      params.applyEvents(chunkEvents);
      params.onBatchApplied?.({
        channel: head.channel,
        latestSeq: head.latestSeq,
        events: chunkEvents,
      });
      processedEvents += chunkEvents.length;
    }

    if (head.events.length === 0) {
      params.queue.shift();
    }
  }

  return processedEvents;
};

export const createWorkbookRealtimeApplyQueue = (
  options: WorkbookRealtimeApplyQueueOptions
) => {
  const frameBudgetMs = normalizeFinite(options.frameBudgetMs, DEFAULT_FRAME_BUDGET_MS, 2);
  const maxEventsPerFrame = normalizeFinite(
    options.maxEventsPerFrame,
    DEFAULT_MAX_EVENTS_PER_FRAME,
    8
  );
  const criticalFrameBudgetMs = normalizeFinite(
    options.criticalFrameBudgetMs,
    DEFAULT_CRITICAL_FRAME_BUDGET_MS,
    1
  );
  const volatileFrameBudgetMs = normalizeFinite(
    options.volatileFrameBudgetMs,
    DEFAULT_VOLATILE_FRAME_BUDGET_MS,
    1
  );
  const maxCriticalEventsPerFrame = normalizeFinite(
    options.maxCriticalEventsPerFrame,
    Math.floor(maxEventsPerFrame * 0.65) || DEFAULT_MAX_CRITICAL_EVENTS_PER_FRAME,
    1
  );
  const maxVolatileEventsPerFrame = normalizeFinite(
    options.maxVolatileEventsPerFrame,
    Math.floor(maxEventsPerFrame * 0.35) || DEFAULT_MAX_VOLATILE_EVENTS_PER_FRAME,
    1
  );
  const maxCriticalChunkEvents = normalizeFinite(
    options.maxCriticalChunkEvents,
    DEFAULT_MAX_CRITICAL_CHUNK_EVENTS,
    1
  );
  const maxVolatileChunkEvents = normalizeFinite(
    options.maxVolatileChunkEvents,
    DEFAULT_MAX_VOLATILE_CHUNK_EVENTS,
    1
  );
  const maxVolatileQueuedEvents = normalizeFinite(
    options.maxVolatileQueuedEvents,
    DEFAULT_MAX_VOLATILE_QUEUED_EVENTS,
    48
  );

  let criticalQueue: WorkbookRealtimeApplyBatch[] = [];
  let volatileQueue: WorkbookRealtimeApplyBatch[] = [];
  let frameId: number | null = null;
  let disposed = false;

  const clearScheduledFrame = () => {
    if (frameId === null || typeof window === "undefined") return;
    window.cancelAnimationFrame(frameId);
    frameId = null;
  };

  const flushFrame = () => {
    frameId = null;
    if (disposed) return;
    if (criticalQueue.length === 0 && volatileQueue.length === 0) return;

    const frameStartedAt = nowMs();
    const totalDeadline = frameStartedAt + frameBudgetMs;
    const criticalDeadline = Math.min(totalDeadline, frameStartedAt + criticalFrameBudgetMs);
    const criticalEventsBudget = Math.max(0, Math.min(maxEventsPerFrame, maxCriticalEventsPerFrame));

    const processedCriticalEvents = drainQueueWithBudget({
      queue: criticalQueue,
      maxEvents: criticalEventsBudget,
      maxChunkEvents: maxCriticalChunkEvents,
      deadlineMs: criticalDeadline,
      applyEvents: options.applyEvents,
      onBatchApplied: options.onBatchApplied,
    });

    const remainingFrameEventsBudget = Math.max(0, maxEventsPerFrame - processedCriticalEvents);

    if (nowMs() < totalDeadline && volatileQueue.length > 0 && remainingFrameEventsBudget > 0) {
      const volatileWindowStartedAt = nowMs();
      const volatileDeadline = Math.min(
        totalDeadline,
        volatileWindowStartedAt + volatileFrameBudgetMs
      );
      const volatileEventsBudget = Math.min(
        remainingFrameEventsBudget,
        maxVolatileEventsPerFrame
      );
      drainQueueWithBudget({
        queue: volatileQueue,
        maxEvents: volatileEventsBudget,
        maxChunkEvents: maxVolatileChunkEvents,
        deadlineMs: volatileDeadline,
        applyEvents: options.applyEvents,
        onBatchApplied: options.onBatchApplied,
      });
    }

    if (!disposed && (criticalQueue.length > 0 || volatileQueue.length > 0)) {
      if (typeof window === "undefined") {
        flushFrame();
        return;
      }
      frameId = window.requestAnimationFrame(flushFrame);
    }
  };

  const scheduleFlush = () => {
    if (disposed || frameId !== null) return;
    if (criticalQueue.length === 0 && volatileQueue.length === 0) return;
    if (typeof window === "undefined") {
      flushFrame();
      return;
    }
    frameId = window.requestAnimationFrame(flushFrame);
  };

  return {
    enqueue(batch: WorkbookRealtimeApplyBatch) {
      if (disposed || !batch || batch.events.length === 0) return;

      const criticalEvents: WorkbookEvent[] = [];
      const volatileEvents: WorkbookEvent[] = [];
      batch.events.forEach((event) => {
        if (isVolatileWorkbookEventType(event.type)) {
          volatileEvents.push(event);
          return;
        }
        criticalEvents.push(event);
      });

      if (criticalEvents.length > 0) {
        appendBatchToQueue(criticalQueue, {
          channel: batch.channel,
          latestSeq: batch.latestSeq,
          events: criticalEvents,
        });
      }

      if (volatileEvents.length > 0) {
        appendBatchToQueue(volatileQueue, {
          channel: batch.channel,
          latestSeq: batch.latestSeq,
          events: volatileEvents,
        });
        trimVolatileQueue(volatileQueue, maxVolatileQueuedEvents);
      }

      scheduleFlush();
    },
    clear() {
      criticalQueue = [];
      volatileQueue = [];
      clearScheduledFrame();
    },
    flushNow() {
      if (disposed) return;
      clearScheduledFrame();
      while (criticalQueue.length > 0) {
        const head = criticalQueue.shift();
        if (!head || head.events.length === 0) continue;
        options.applyEvents(head.events);
        options.onBatchApplied?.(head);
      }
      while (volatileQueue.length > 0) {
        const head = volatileQueue.shift();
        if (!head || head.events.length === 0) continue;
        options.applyEvents(head.events);
        options.onBatchApplied?.(head);
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      criticalQueue = [];
      volatileQueue = [];
      clearScheduledFrame();
    },
    size() {
      return getQueuedEventsCount(criticalQueue) + getQueuedEventsCount(volatileQueue);
    },
  };
};
