import type { WorkbookClientEventInput } from "./events";

type WorkbookEventsPostSource = "direct" | "queue";

type WorkbookEventsPostAttemptParams = {
  sessionId: string;
  source: WorkbookEventsPostSource;
  idempotencyKey: string;
  events: WorkbookClientEventInput[];
};

type WorkbookEventsPostConflictParams = {
  sessionId: string;
  source: WorkbookEventsPostSource;
  idempotencyKey: string;
  events: WorkbookClientEventInput[];
  attempts?: number;
};

const TRACE_EVENT = "workbook-events-post-trace";
const LOCAL_TRACE_KEY = "mw_workbook_events_trace";
const MAX_EVENT_TYPES = 8;
const MAX_STACK_LINES = 6;

const firstAttemptBySession = new Set<string>();
const conflictTraceKeys = new Set<string>();

const getWindow = () => (typeof window === "undefined" ? null : window);

const resolveTraceEnabled = () => {
  const view = getWindow();
  if (!view) return false;
  const host = view.location.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("stage.")
  ) {
    return true;
  }
  try {
    return view.localStorage.getItem(LOCAL_TRACE_KEY) === "1";
  } catch {
    return false;
  }
};

const summarizeEventTypes = (events: WorkbookClientEventInput[]) =>
  Array.from(
    new Set(
      events
        .map((event) => (typeof event.type === "string" ? event.type.trim() : ""))
        .filter((type) => type.length > 0)
    )
  ).slice(0, MAX_EVENT_TYPES);

const getCallsiteStack = () => {
  try {
    const stack = new Error().stack;
    if (!stack) return [];
    return stack
      .split("\n")
      .slice(2, 2 + MAX_STACK_LINES)
      .map((line) => line.trim());
  } catch {
    return [];
  }
};

const emitTrace = (detail: Record<string, unknown>) => {
  const view = getWindow();
  if (!view) return;
  try {
    view.dispatchEvent(
      new CustomEvent<Record<string, unknown>>(TRACE_EVENT, {
        detail,
      })
    );
  } catch {
    // no-op
  }
};

export const observeWorkbookEventsPostAttempt = (
  params: WorkbookEventsPostAttemptParams
) => {
  if (!resolveTraceEnabled()) return;
  const normalizedSessionId = params.sessionId.trim();
  if (!normalizedSessionId || firstAttemptBySession.has(normalizedSessionId)) return;
  firstAttemptBySession.add(normalizedSessionId);
  const detail = {
    stage: "first_attempt",
    sessionId: normalizedSessionId,
    source: params.source,
    idempotencyKey: params.idempotencyKey,
    eventCount: params.events.length,
    eventTypes: summarizeEventTypes(params.events),
    timestamp: new Date().toISOString(),
    stack: getCallsiteStack(),
  };
  console.info("[workbook-events]", detail);
  emitTrace(detail);
};

export const observeWorkbookEventsPostConflict = (
  params: WorkbookEventsPostConflictParams
) => {
  if (!resolveTraceEnabled()) return;
  const normalizedSessionId = params.sessionId.trim();
  if (!normalizedSessionId) return;
  const traceKey = `${normalizedSessionId}:${params.idempotencyKey}:${params.source}`;
  if (conflictTraceKeys.has(traceKey)) return;
  conflictTraceKeys.add(traceKey);
  const detail = {
    stage: "conflict_409",
    sessionId: normalizedSessionId,
    source: params.source,
    idempotencyKey: params.idempotencyKey,
    attempts: typeof params.attempts === "number" ? params.attempts : undefined,
    eventCount: params.events.length,
    eventTypes: summarizeEventTypes(params.events),
    timestamp: new Date().toISOString(),
  };
  console.warn("[workbook-events]", detail);
  emitTrace(detail);
};

