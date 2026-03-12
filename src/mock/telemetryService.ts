const TELEMETRY_BUFFER_LIMIT = 2_000;

export type RumTelemetryEventRecord = {
  type: string;
  at: string;
  route: string;
  payload: unknown;
  userId?: string | null;
  sessionId?: string | null;
  receivedAt: string;
};

const rumTelemetryBuffer: RumTelemetryEventRecord[] = [];

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
