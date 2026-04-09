import { generateId } from "@/shared/lib/id";
import type { WorkbookBoardObject, WorkbookEvent, WorkbookPoint } from "./types";
import type { WorkbookClientEventInput } from "./events";
import {
  isVolatileWorkbookEventType,
  isWorkbookPreviewEventType,
} from "./events";

export const compactWorkbookObjectUpdateEvents = (events: WorkbookEvent[]) => {
  if (events.length <= 1) return events;
  const compacted: WorkbookEvent[] = [];
  const pendingByTypeAndObjectId = new Map<string, WorkbookEvent>();

  const removePendingByObjectId = (objectId: string) => {
    if (!objectId || pendingByTypeAndObjectId.size === 0) return;
    const suffix = `:${objectId}`;
    Array.from(pendingByTypeAndObjectId.keys()).forEach((key) => {
      if (key.endsWith(suffix)) {
        pendingByTypeAndObjectId.delete(key);
      }
    });
  };

  const flushPending = () => {
    if (pendingByTypeAndObjectId.size === 0) return;
    pendingByTypeAndObjectId.forEach((event) => compacted.push(event));
    pendingByTypeAndObjectId.clear();
  };

  events.forEach((event) => {
    if (event.type === "board.object.update") {
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as { objectId?: unknown; patch?: unknown })
          : null;
      const objectId = payload && typeof payload.objectId === "string" ? payload.objectId : "";
      const patch =
        payload?.patch && typeof payload.patch === "object"
          ? (payload.patch as Partial<WorkbookBoardObject>)
          : null;
      if (!objectId || !patch) {
        flushPending();
        compacted.push(event);
        return;
      }
      const eventKey = `${event.type}:${objectId}`;
      const previous = pendingByTypeAndObjectId.get(eventKey);
      if (previous) {
        const previousPayload =
          previous.payload && typeof previous.payload === "object"
            ? (previous.payload as {
                objectId: string;
                patch: Partial<WorkbookBoardObject>;
              })
            : { objectId, patch: {} as Partial<WorkbookBoardObject> };
        pendingByTypeAndObjectId.set(eventKey, {
          ...event,
          payload: {
            objectId,
            patch: mergeBoardObjectPatches(previousPayload.patch, patch),
          },
        });
      } else {
        pendingByTypeAndObjectId.set(eventKey, event);
      }
      return;
    }

    if (isWorkbookPreviewEventType(event.type)) {
      flushPending();
      compacted.push(event);
      return;
    }

    const deletedObjectId =
      event.type === "board.object.delete" &&
      event.payload &&
      typeof event.payload === "object" &&
      typeof (event.payload as { objectId?: unknown }).objectId === "string"
        ? ((event.payload as { objectId: string }).objectId ?? "")
        : "";
    if (deletedObjectId) {
      removePendingByObjectId(deletedObjectId);
    }
    flushPending();
    compacted.push(event);
  });

  flushPending();
  return compacted;
};

export const mergePreviewPathPoints = (
  current: WorkbookPoint[],
  incoming: WorkbookPoint[],
  minDistance = 2.5
) => {
  if (incoming.length === 0) return current;
  const merged = current.length > 0 ? [...current] : [];
  let lastPoint = merged[merged.length - 1] ?? null;
  incoming.forEach((point) => {
    if (
      !lastPoint ||
      Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= minDistance
    ) {
      merged.push(point);
      lastPoint = point;
      return;
    }
    merged[merged.length - 1] = point;
    lastPoint = point;
  });
  return merged;
};

export const mergeBoardObjectWithPatch = (
  current: WorkbookBoardObject,
  patch: Partial<WorkbookBoardObject>
): WorkbookBoardObject => {
  const hasMetaPatch = Object.prototype.hasOwnProperty.call(patch, "meta");
  if (!hasMetaPatch) {
    return {
      ...current,
      ...patch,
    };
  }
  const patchMeta = patch.meta;
  if (!patchMeta || typeof patchMeta !== "object" || Array.isArray(patchMeta)) {
    return {
      ...current,
      ...patch,
      meta: patchMeta,
    };
  }
  const currentMeta =
    current.meta && typeof current.meta === "object" && !Array.isArray(current.meta)
      ? (current.meta as Record<string, unknown>)
      : {};
  const nextMeta = { ...currentMeta };
  Object.entries(patchMeta as Record<string, unknown>).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      delete nextMeta[key];
      return;
    }
    nextMeta[key] = value;
  });
  return {
    ...current,
    ...patch,
    meta: nextMeta,
  };
};

export const mergeBoardObjectPatches = (
  current: Partial<WorkbookBoardObject>,
  patch: Partial<WorkbookBoardObject>
): Partial<WorkbookBoardObject> => {
  const hasMetaPatch = Object.prototype.hasOwnProperty.call(patch, "meta");
  if (!hasMetaPatch) {
    return {
      ...current,
      ...patch,
    };
  }
  const patchMeta = patch.meta;
  if (!patchMeta || typeof patchMeta !== "object" || Array.isArray(patchMeta)) {
    return {
      ...current,
      ...patch,
      meta: patchMeta,
    };
  }
  const currentMeta =
    current.meta && typeof current.meta === "object" && !Array.isArray(current.meta)
      ? (current.meta as Record<string, unknown>)
      : {};
  return {
    ...current,
    ...patch,
    meta: {
      ...currentMeta,
      ...(patchMeta as Record<string, unknown>),
    },
  };
};

export const withWorkbookClientEventIds = (
  events: WorkbookClientEventInput[]
): WorkbookClientEventInput[] =>
  events.map((event) =>
    typeof event.clientEventId === "string" && event.clientEventId
      ? event
      : {
          ...event,
          clientEventId: generateId(),
        }
  );

export const resolveNextLatestSeq = (
  currentLatestSeq: number,
  responseLatestSeq: number,
  events: WorkbookEvent[]
) => {
  if (events.length === 0) {
    return Math.max(0, currentLatestSeq, responseLatestSeq);
  }
  return Math.max(0, currentLatestSeq, responseLatestSeq, ...events.map((event) => event.seq));
};

export const hasWorkbookEventGap = (
  currentLatestSeq: number,
  events: WorkbookEvent[]
) => {
  const sequenced = events
    .filter(
      (event) =>
        !isVolatileWorkbookEventType(event.type) &&
        typeof event.seq === "number" &&
        Number.isFinite(event.seq)
    )
    .map((event) => Math.trunc(event.seq))
    .sort((left, right) => left - right)
    .filter((seq, index, source) => index === 0 || source[index - 1] !== seq);

  if (sequenced.length === 0) return false;

  let expected = Math.max(0, Math.trunc(currentLatestSeq)) + 1;
  for (const seq of sequenced) {
    if (seq < expected) continue;
    if (seq > expected) return true;
    expected = seq + 1;
  }
  return false;
};
