import {
  isVolatileWorkbookEventType,
  type WorkbookClientEventInput,
} from "./events";
import type { WorkbookEvent } from "./types";
import {
  emitRealtimeMetric,
  type RealtimeMetricChannel,
} from "@/shared/lib/realtimeMonitoring";

type PendingPersistTrace = {
  sentAt: number;
};

const PENDING_TRACE_TTL_MS = 60_000;
const VOLATILE_EMIT_THROTTLE_MS = 1_000;

const pendingPersistTraces = new Map<string, PendingPersistTrace>();
const volatileEmitAtByKey = new Map<string, number>();

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const prunePendingPersistTraces = (now = nowMs()) => {
  pendingPersistTraces.forEach((trace, clientEventId) => {
    if (now - trace.sentAt > PENDING_TRACE_TTL_MS) {
      pendingPersistTraces.delete(clientEventId);
    }
  });
};

const summarizeEventTypes = (eventTypes: string[]) =>
  Array.from(new Set(eventTypes.filter((type) => typeof type === "string" && type.length > 0))).slice(0, 6);

const shouldEmitBatch = (
  phase: "send" | "receive" | "apply",
  channel: RealtimeMetricChannel,
  eventTypes: string[],
  now = nowMs()
) => {
  if (eventTypes.length === 0) return false;
  const isVolatileOnly = eventTypes.every((type) => isVolatileWorkbookEventType(type));
  if (!isVolatileOnly) return true;
  const key = `${phase}:${channel}:${eventTypes.slice().sort().join(",")}`;
  const lastEmittedAt = volatileEmitAtByKey.get(key) ?? 0;
  if (now - lastEmittedAt < VOLATILE_EMIT_THROTTLE_MS) {
    return false;
  }
  volatileEmitAtByKey.set(key, now);
  return true;
};

const summarizeCreatedAtLatency = (events: WorkbookEvent[]) => {
  const latencies = events.reduce<number[]>((acc, event) => {
    const parsedCreatedAt = Date.parse(event.createdAt);
    if (!Number.isFinite(parsedCreatedAt)) return acc;
    acc.push(Math.max(0, Date.now() - parsedCreatedAt));
    return acc;
  }, []);
  if (latencies.length === 0) return null;
  const total = latencies.reduce((sum, value) => sum + value, 0);
  return {
    averageLatencyMs: Math.round(total / latencies.length),
    maxLatencyMs: Math.max(...latencies),
  };
};

export const observeWorkbookRealtimeSend = (params: {
  sessionId: string;
  channel: RealtimeMetricChannel;
  events: WorkbookClientEventInput[];
}) => {
  if (!params.sessionId || params.events.length === 0) return;
  const now = nowMs();
  prunePendingPersistTraces(now);
  if (params.channel === "persist") {
    params.events.forEach((event) => {
      if (typeof event.clientEventId !== "string" || !event.clientEventId.trim()) return;
      pendingPersistTraces.set(event.clientEventId.trim(), { sentAt: now });
    });
  }
  const eventTypes = summarizeEventTypes(params.events.map((event) => event.type));
  if (!shouldEmitBatch("send", params.channel, eventTypes, now)) return;
  emitRealtimeMetric({
    scope: "workbook",
    phase: "send",
    channel: params.channel,
    sessionId: params.sessionId,
    eventCount: params.events.length,
    eventTypes,
    timestamp: new Date().toISOString(),
  });
};

export const observeWorkbookRealtimePersistAck = (params: {
  sessionId: string;
  latestSeq: number;
  events: WorkbookEvent[];
}) => {
  if (!params.sessionId || params.events.length === 0) return;
  const now = nowMs();
  prunePendingPersistTraces(now);
  const latencies = params.events.reduce<number[]>((acc, event) => {
    const trace = pendingPersistTraces.get(event.id);
    if (!trace) return acc;
    pendingPersistTraces.delete(event.id);
    acc.push(Math.max(0, now - trace.sentAt));
    return acc;
  }, []);
  if (latencies.length === 0) return;
  const total = latencies.reduce((sum, value) => sum + value, 0);
  emitRealtimeMetric({
    scope: "workbook",
    phase: "persist_ack",
    channel: "persist",
    sessionId: params.sessionId,
    eventCount: latencies.length,
    eventTypes: summarizeEventTypes(params.events.map((event) => event.type)),
    timestamp: new Date().toISOString(),
    latestSeq: params.latestSeq,
    averageLatencyMs: Math.round(total / latencies.length),
    maxLatencyMs: Math.max(...latencies),
  });
};

export const observeWorkbookRealtimeReceive = (params: {
  sessionId: string;
  channel: Extract<RealtimeMetricChannel, "stream" | "live" | "poll">;
  latestSeq: number;
  events: WorkbookEvent[];
}) => {
  if (!params.sessionId || params.events.length === 0) return;
  const eventTypes = summarizeEventTypes(params.events.map((event) => event.type));
  if (!shouldEmitBatch("receive", params.channel, eventTypes)) return;
  const latencySummary = summarizeCreatedAtLatency(params.events);
  emitRealtimeMetric({
    scope: "workbook",
    phase: "receive",
    channel: params.channel,
    sessionId: params.sessionId,
    eventCount: params.events.length,
    eventTypes,
    timestamp: new Date().toISOString(),
    latestSeq: params.latestSeq,
    ...(latencySummary ?? {}),
  });
};

export const observeWorkbookRealtimeApply = (params: {
  sessionId: string;
  channel: RealtimeMetricChannel;
  latestSeq: number;
  events: WorkbookEvent[];
}) => {
  if (!params.sessionId || params.events.length === 0) return;
  const eventTypes = summarizeEventTypes(params.events.map((event) => event.type));
  if (!shouldEmitBatch("apply", params.channel, eventTypes)) return;
  const latencySummary = summarizeCreatedAtLatency(params.events);
  emitRealtimeMetric({
    scope: "workbook",
    phase: "apply",
    channel: params.channel,
    sessionId: params.sessionId,
    eventCount: params.events.length,
    eventTypes,
    timestamp: new Date().toISOString(),
    latestSeq: params.latestSeq,
    ...(latencySummary ?? {}),
  });
};

export const observeWorkbookRealtimeGap = (params: {
  sessionId: string;
  channel: Extract<RealtimeMetricChannel, "stream" | "live" | "poll">;
  latestSeq: number;
  nextSeq: number;
}) => {
  if (!params.sessionId) return;
  emitRealtimeMetric({
    scope: "workbook",
    phase: "gap",
    channel: params.channel,
    sessionId: params.sessionId,
    eventCount: 0,
    eventTypes: [],
    timestamp: new Date().toISOString(),
    latestSeq: params.latestSeq,
    gapFromSeq: params.latestSeq,
    gapToSeq: params.nextSeq,
  });
};
