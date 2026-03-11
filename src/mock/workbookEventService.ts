import crypto from "node:crypto";
import {
  saveDb,
  type MockDb,
  type WorkbookEventRecord,
} from "./db";
import { allocateWorkbookRuntimeSequence } from "./runtimeServices";
import {
  isUrgentWorkbookLiveEventType,
  isVolatileWorkbookEventType,
  type WorkbookClientEventInput,
} from "../features/workbook/model/events";

const WORKBOOK_EVENT_LIMIT = 1_200;

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
  db.workbookEvents
    .filter((event) => event.sessionId === sessionId)
    .reduce((max, event) => Math.max(max, event.seq), 0);

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
  trimWorkbookEventsOverflow(db, payload.sessionId);
  saveDb();
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

  return {
    events: appended,
    latestSeq: isPersisted
      ? appended[appended.length - 1]?.seq ?? currentMaxSeq
      : currentMaxSeq,
    timestamp,
  };
};

export const collectUrgentWorkbookLiveEvents = (
  events: WorkbookRealtimeEnvelope["events"]
) => events.filter((event) => isUrgentWorkbookLiveEventType(event.type));
