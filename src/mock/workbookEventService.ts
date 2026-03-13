import crypto from "node:crypto";
import {
  saveDb,
  type MockDb,
  type WorkbookEventRecord,
} from "./db";
import { recordWorkbookServerTrace } from "./telemetryService";
import { allocateWorkbookRuntimeSequence } from "./runtimeServices";
import {
  isUrgentWorkbookLiveEventType,
  isVolatileWorkbookEventType,
  type WorkbookClientEventInput,
} from "../features/workbook/model/events";
import {
  bumpWorkbookSessionLatestSeqCached,
  readWorkbookSessionLatestSeqCached,
} from "./workbookSeqCache";

const WORKBOOK_EVENT_LIMIT = 1_200;
const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const summarizeEventTypes = (eventTypes: string[]) =>
  Array.from(new Set(eventTypes.filter((type) => typeof type === "string" && type.length > 0))).slice(
    0,
    6
  );

const summarizeLatencyFromCreatedAt = (
  events: Array<{ createdAt?: string | null }>
): { averageLatencyMs?: number; maxLatencyMs?: number } => {
  const latencies = events.reduce<number[]>((acc, event) => {
    const createdAt = typeof event.createdAt === "string" ? Date.parse(event.createdAt) : NaN;
    if (!Number.isFinite(createdAt)) return acc;
    acc.push(Math.max(0, Date.now() - createdAt));
    return acc;
  }, []);
  if (latencies.length === 0) return {};
  const total = latencies.reduce((sum, value) => sum + value, 0);
  return {
    averageLatencyMs: Math.round(total / latencies.length),
    maxLatencyMs: Math.max(...latencies),
  };
};

export type WorkbookRealtimeEnvelope = {
  sessionId: string;
  latestSeq: number;
  events: Array<{
    id: string;
    sessionId: string;
    seq: number;
    authorUserId: string;
    type: string;
    payload: unknown;
    createdAt: string;
  }>;
  nodeId?: string;
  channel?: "stream" | "live";
};

const ensureId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2, 10)}`;

const nowIso = () => new Date().toISOString();

export const getWorkbookSessionLatestSeq = (db: MockDb, sessionId: string) =>
  readWorkbookSessionLatestSeqCached(sessionId, () =>
    db.workbookEvents
      .filter((event) => event.sessionId === sessionId)
      .reduce((max, event) => Math.max(max, event.seq), 0)
  );

export const trimWorkbookEventsOverflow = (db: MockDb, sessionId: string) => {
  const sessionEvents = db.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .sort((a, b) => a.seq - b.seq);
  if (sessionEvents.length <= WORKBOOK_EVENT_LIMIT) return;
  const overflow = sessionEvents.length - WORKBOOK_EVENT_LIMIT;
  const overflowIds = new Set(sessionEvents.slice(0, overflow).map((event) => event.id));
  db.workbookEvents = db.workbookEvents.filter((event) => !overflowIds.has(event.id));
};

export const mergeRuntimeWorkbookEventsIntoDb = (
  db: MockDb,
  payload: WorkbookRealtimeEnvelope
) => {
  const startedAt = nowMs();
  if (payload.channel === "live") return false;
  if (!Array.isArray(payload.events) || payload.events.length === 0) return false;
  const existingEventIds = new Set(
    db.workbookEvents
      .filter((event) => event.sessionId === payload.sessionId)
      .map((event) => event.id)
  );
  let inserted = false;
  for (const runtimeEvent of payload.events) {
    if (
      !runtimeEvent ||
      typeof runtimeEvent !== "object" ||
      typeof runtimeEvent.id !== "string" ||
      existingEventIds.has(runtimeEvent.id) ||
      isVolatileWorkbookEventType(runtimeEvent.type)
    ) {
      continue;
    }
    const seq = Number.isFinite(runtimeEvent.seq)
      ? Math.max(0, Math.trunc(runtimeEvent.seq))
      : 0;
    const record: WorkbookEventRecord = {
      id: runtimeEvent.id,
      sessionId: payload.sessionId,
      seq,
      authorUserId: String(runtimeEvent.authorUserId ?? "unknown"),
      type: String(runtimeEvent.type ?? ""),
      payload: JSON.stringify(runtimeEvent.payload ?? null),
      createdAt:
        typeof runtimeEvent.createdAt === "string" && runtimeEvent.createdAt.length > 0
          ? runtimeEvent.createdAt
          : nowIso(),
    };
    db.workbookEvents.push(record);
    existingEventIds.add(record.id);
    inserted = true;
  }
  if (!inserted) return false;
  bumpWorkbookSessionLatestSeqCached(payload.sessionId, payload.latestSeq);
  trimWorkbookEventsOverflow(db, payload.sessionId);
  saveDb();
  recordWorkbookServerTrace({
    scope: "workbook",
    op: "runtime_bridge",
    channel: "stream",
    sessionId: payload.sessionId,
    eventCount: payload.events.length,
    eventTypes: summarizeEventTypes(payload.events.map((event) => event.type)),
    durationMs: nowMs() - startedAt,
    latestSeq: payload.latestSeq,
    success: true,
    ...summarizeLatencyFromCreatedAt(payload.events),
  });
  return true;
};

export const appendWorkbookEvents = async (
  db: MockDb,
  params: {
    sessionId: string;
    authorUserId: string;
    events: WorkbookClientEventInput[];
    persist?: boolean;
  }
) => {
  const startedAt = nowMs();
  const timestamp = nowIso();
  const isPersisted = params.persist !== false;
  const currentMaxSeq = getWorkbookSessionLatestSeq(db, params.sessionId);
  const sequenceRange = isPersisted
    ? await allocateWorkbookRuntimeSequence({
        sessionId: params.sessionId,
        count: params.events.length,
        fallbackBaseSeq: currentMaxSeq,
      })
    : null;
  const fallbackSeqStart = currentMaxSeq + 1;

  const appended = params.events.map((event, index) => {
    const nextSeq = isPersisted
      ? sequenceRange
        ? sequenceRange.from + index
        : fallbackSeqStart + index
      : currentMaxSeq;
    const clientEventId =
      typeof event.clientEventId === "string" && event.clientEventId.trim()
        ? event.clientEventId.trim()
        : null;
    const record: WorkbookEventRecord = {
      id: clientEventId ?? ensureId(),
      sessionId: params.sessionId,
      seq: nextSeq,
      authorUserId: params.authorUserId,
      type: event.type,
      payload: JSON.stringify(event.payload ?? null),
      createdAt: timestamp,
    };
    if (isPersisted) {
      db.workbookEvents.push(record);
    }
    return {
      id: record.id,
      sessionId: record.sessionId,
      seq: record.seq,
      authorUserId: record.authorUserId,
      type: record.type,
      payload: event.payload ?? null,
      createdAt: record.createdAt,
    };
  });

  if (isPersisted) {
    trimWorkbookEventsOverflow(db, params.sessionId);
  }

  const result = {
    events: appended,
    latestSeq: isPersisted
      ? appended[appended.length - 1]?.seq ?? currentMaxSeq
      : currentMaxSeq,
    timestamp,
  };
  bumpWorkbookSessionLatestSeqCached(params.sessionId, result.latestSeq);
  recordWorkbookServerTrace({
    scope: "workbook",
    op: "append",
    channel: isPersisted ? "persist" : "live",
    sessionId: params.sessionId,
    eventCount: appended.length,
    eventTypes: summarizeEventTypes(appended.map((event) => event.type)),
    durationMs: nowMs() - startedAt,
    latestSeq: result.latestSeq,
    success: true,
  });
  return result;
};

export const collectUrgentWorkbookLiveEvents = (
  events: WorkbookRealtimeEnvelope["events"]
) => events.filter((event) => isUrgentWorkbookLiveEventType(event.type));
