import { useCallback, useEffect, useRef } from "react";
import type { RealtimeMetricChannel } from "@/shared/lib/realtimeMonitoring";
import { observeWorkbookRealtimeApply } from "./realtimeObservability";
import { createWorkbookRealtimeApplyQueue } from "./realtimeApplyQueue";
import type { WorkbookEvent } from "./types";

type IncomingRealtimeApplyBatch = {
  channel: RealtimeMetricChannel;
  latestSeq: number;
  events: WorkbookEvent[];
};

export const useWorkbookRealtimeApplyQueue = (params: {
  sessionId: string | null;
  applyIncomingEvents: (events: WorkbookEvent[]) => void;
}) => {
  const sessionIdRef = useRef(params.sessionId);
  const applyIncomingEventsRef = useRef(params.applyIncomingEvents);
  const queueRef = useRef<ReturnType<typeof createWorkbookRealtimeApplyQueue> | null>(null);

  useEffect(() => {
    sessionIdRef.current = params.sessionId;
  }, [params.sessionId]);

  useEffect(() => {
    applyIncomingEventsRef.current = params.applyIncomingEvents;
  }, [params.applyIncomingEvents]);

  useEffect(() => {
    const queue = createWorkbookRealtimeApplyQueue({
      applyEvents: (events) => {
        applyIncomingEventsRef.current(events);
      },
      onBatchApplied: (batch) => {
        const currentSessionId = sessionIdRef.current;
        if (!currentSessionId || batch.events.length === 0) return;
        observeWorkbookRealtimeApply({
          sessionId: currentSessionId,
          channel: batch.channel,
          latestSeq: batch.latestSeq,
          events: batch.events,
        });
      },
      frameBudgetMs: 6,
      criticalFrameBudgetMs: 4,
      volatileFrameBudgetMs: 2,
      maxEventsPerFrame: 120,
      maxCriticalEventsPerFrame: 72,
      maxVolatileEventsPerFrame: 36,
      maxCriticalChunkEvents: 12,
      maxVolatileChunkEvents: 6,
      maxVolatileQueuedEvents: 1_440,
    });
    queueRef.current = queue;
    return () => {
      if (queueRef.current === queue) {
        queueRef.current = null;
      }
      queue.destroy();
    };
  }, []);

  const enqueueIncomingRealtimeApply = useCallback((batch: IncomingRealtimeApplyBatch) => {
    if (batch.events.length === 0) return;
    const queue = queueRef.current;
    if (queue) {
      queue.enqueue(batch);
      return;
    }
    applyIncomingEventsRef.current(batch.events);
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;
    observeWorkbookRealtimeApply({
      sessionId: currentSessionId,
      channel: batch.channel,
      latestSeq: batch.latestSeq,
      events: batch.events,
    });
  }, []);

  const clearIncomingRealtimeApplyQueue = useCallback(() => {
    queueRef.current?.clear();
  }, []);

  return {
    enqueueIncomingRealtimeApply,
    clearIncomingRealtimeApplyQueue,
  };
};
