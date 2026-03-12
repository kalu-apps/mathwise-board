const TELEMETRY_BUFFER_LIMIT = 2_000;
const SERVER_TRACE_SLOW_THRESHOLD_MS = 250;

export type RumTelemetryEventRecord = {
  type: string;
  at: string;
  route: string;
  payload: unknown;
  userId?: string | null;
  sessionId?: string | null;
  receivedAt: string;
};

export type WorkbookServerTraceRecord = {
  scope: "workbook";
  op: "append" | "publish_runtime" | "deliver_local" | "runtime_bridge";
  channel: "persist" | "live" | "stream";
  sessionId: string;
  eventCount: number;
  eventTypes: string[];
  durationMs: number;
  latestSeq?: number;
  clientCount?: number;
  averageLatencyMs?: number;
  maxLatencyMs?: number;
  success: boolean;
  timestamp: string;
  error?: string | null;
};

const rumTelemetryBuffer: RumTelemetryEventRecord[] = [];
const workbookServerTraceBuffer: WorkbookServerTraceRecord[] = [];

const safeIso = (value: unknown) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return new Date().toISOString();
  }
  return value;
};

const sanitizeString = (value: unknown, fallback = "") => {
  if (typeof value !== "string") return fallback;
  return value.trim();
};

const sanitizeRoute = (value: unknown) => {
  const normalized = sanitizeString(value, "/");
  if (!normalized) return "/";
  return normalized.slice(0, 512);
};

const sanitizeTelemetryEvent = (
  value: unknown,
  context?: { userId?: string | null; sessionId?: string | null }
): RumTelemetryEventRecord | null => {
  if (!value || typeof value !== "object") return null;
  const source = value as {
    type?: unknown;
    at?: unknown;
    route?: unknown;
    payload?: unknown;
  };
  const type = sanitizeString(source.type);
  if (!type) return null;
  return {
    type: type.slice(0, 64),
    at: safeIso(source.at),
    route: sanitizeRoute(source.route),
    payload: source.payload ?? null,
    userId: context?.userId ?? null,
    sessionId: context?.sessionId ?? null,
    receivedAt: new Date().toISOString(),
  };
};

export const ingestRumTelemetryEvents = (
  rawEvents: unknown[],
  context?: { userId?: string | null; sessionId?: string | null }
) => {
  const accepted = rawEvents.reduce<RumTelemetryEventRecord[]>((acc, rawEvent) => {
    const record = sanitizeTelemetryEvent(rawEvent, context);
    if (record) acc.push(record);
    return acc;
  }, []);
  if (accepted.length === 0) {
    return { accepted: 0 };
  }
  rumTelemetryBuffer.push(...accepted);
  if (rumTelemetryBuffer.length > TELEMETRY_BUFFER_LIMIT) {
    rumTelemetryBuffer.splice(0, rumTelemetryBuffer.length - TELEMETRY_BUFFER_LIMIT);
  }
  return { accepted: accepted.length };
};

export const readRecentRumTelemetryEvents = (limit = 100) =>
  rumTelemetryBuffer.slice(-Math.max(1, Math.min(limit, TELEMETRY_BUFFER_LIMIT)));

export const recordWorkbookServerTrace = (trace: Omit<WorkbookServerTraceRecord, "timestamp">) => {
  const record: WorkbookServerTraceRecord = {
    ...trace,
    durationMs: Math.max(0, Math.round(trace.durationMs)),
    timestamp: new Date().toISOString(),
  };
  workbookServerTraceBuffer.push(record);
  if (workbookServerTraceBuffer.length > TELEMETRY_BUFFER_LIMIT) {
    workbookServerTraceBuffer.splice(
      0,
      workbookServerTraceBuffer.length - TELEMETRY_BUFFER_LIMIT
    );
  }
  if (!record.success || record.durationMs >= SERVER_TRACE_SLOW_THRESHOLD_MS) {
    console.warn("[workbook-trace]", record);
  }
};

export const readRecentWorkbookServerTraces = (limit = 100) =>
  workbookServerTraceBuffer.slice(-Math.max(1, Math.min(limit, TELEMETRY_BUFFER_LIMIT)));

export const getTelemetryDiagnostics = () => {
  const recentTraces = readRecentWorkbookServerTraces(200);
  const slowTraceCount = recentTraces.filter(
    (trace) => !trace.success || trace.durationMs >= SERVER_TRACE_SLOW_THRESHOLD_MS
  ).length;
  return {
    rumBuffered: rumTelemetryBuffer.length,
    workbookServerTracesBuffered: workbookServerTraceBuffer.length,
    recentSlowWorkbookTraceCount: slowTraceCount,
    lastWorkbookTraceAt: recentTraces[recentTraces.length - 1]?.timestamp ?? null,
  };
};
