import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  normalizeObjectPayload,
  normalizeScenePayload,
  normalizeStrokePayload,
} from "./scene";
import { mergeBoardObjectWithPatch, mergePreviewPathPoints } from "./runtime";
import type {
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookEvent,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookSession,
  WorkbookSessionParticipant,
  WorkbookStroke,
} from "./types";

type ClearRequest = {
  requestId: string;
  targetLayer: WorkbookLayer;
  authorUserId: string;
};

type IncomingEraserPreviewEntry = {
  id: string;
  authorUserId: string;
  gestureId: string;
  layer: WorkbookLayer;
  page: number;
  radius: number;
  points: WorkbookPoint[];
  updatedAt: number;
};

type RestoreSceneSnapshotPayload = {
  boardStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  annotationStrokes: WorkbookStroke[];
  chatMessages: unknown[];
  comments: unknown[];
  timerState: unknown;
  boardSettings: unknown;
  libraryState: unknown;
  documentState: unknown;
};

type StrokePreviewPayload = {
  stroke: WorkbookStroke;
  previewVersion: number;
  updatedAt: number;
};

type ApplyWorkbookIncomingRealtimeEventParams = {
  event: WorkbookEvent;
  eventTimestamp: number;
  userId?: string;
  selectedObjectId: string | null;
  selectedTextDraftDirty: boolean;
  selectedTextDraftObjectId: string | null;
  awaitingClearRequest: ClearRequest | null;
  areParticipantsEqual: (
    current: WorkbookSessionParticipant[],
    next: WorkbookSessionParticipant[]
  ) => boolean;
  applyHistoryOperations: (operations: unknown[]) => void;
  restoreSceneSnapshot: (payload: RestoreSceneSnapshotPayload) => void;
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: (options?: { clearFinalized?: boolean }) => void;
  clearIncomingEraserPreviewRuntime: () => void;
  scheduleIncomingEraserPreviewExpiry: (previewId: string, delayMs: number) => void;
  queueIncomingStrokePreview: (payload: StrokePreviewPayload, strokeId: string) => void;
  finalizeStrokePreview: (strokeId: string) => void;
  queueIncomingPreviewPatch: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>
  ) => void;
  applyLocalBoardObjects: (
    updater: (current: WorkbookBoardObject[]) => WorkbookBoardObject[]
  ) => void;
  setSession: Dispatch<SetStateAction<WorkbookSession | null>>;
  setCanvasViewport: Dispatch<SetStateAction<WorkbookPoint>>;
  setIncomingEraserPreviews: Dispatch<
    SetStateAction<Record<string, IncomingEraserPreviewEntry>>
  >;
  setBoardStrokes: Dispatch<SetStateAction<WorkbookStroke[]>>;
  setAnnotationStrokes: Dispatch<SetStateAction<WorkbookStroke[]>>;
  setConstraints: Dispatch<SetStateAction<WorkbookConstraint[]>>;
  setSelectedObjectId: Dispatch<SetStateAction<string | null>>;
  setSelectedConstraintId: Dispatch<SetStateAction<string | null>>;
  setPendingClearRequest: Dispatch<SetStateAction<ClearRequest | null>>;
  setAwaitingClearRequest: Dispatch<SetStateAction<ClearRequest | null>>;
  setConfirmedClearRequest: Dispatch<SetStateAction<ClearRequest | null>>;
  setFocusPoint: Dispatch<SetStateAction<WorkbookPoint | null>>;
  setPointerPoint: Dispatch<SetStateAction<WorkbookPoint | null>>;
  setFocusPointsByUser: Dispatch<SetStateAction<Record<string, WorkbookPoint>>>;
  setPointerPointsByUser: Dispatch<SetStateAction<Record<string, WorkbookPoint>>>;
  viewportLastReceivedAtRef: MutableRefObject<number>;
  finalizedStrokePreviewIdsRef: MutableRefObject<Set<string>>;
  incomingStrokePreviewVersionRef: MutableRefObject<Map<string, number>>;
  objectLastCommittedEventAtRef: MutableRefObject<Map<string, number>>;
  incomingPreviewQueuedPatchRef: MutableRefObject<
    Map<string, Partial<WorkbookBoardObject>[]>
  >;
  incomingPreviewVersionByAuthorObjectRef: MutableRefObject<Map<string, number>>;
  objectUpdateQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectUpdateDispatchOptionsRef: MutableRefObject<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >;
  objectUpdateHistoryBeforeRef: MutableRefObject<Map<string, WorkbookBoardObject>>;
  objectPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectUpdateInFlightRef: MutableRefObject<Set<string>>;
  objectPreviewVersionRef: MutableRefObject<Map<string, number>>;
  objectUpdateTimersRef: MutableRefObject<Map<string, number>>;
  focusResetTimersByUserRef: MutableRefObject<Map<string, number>>;
  generateId: () => string;
  eraserPreviewPointMergeMinDistancePx: number;
  eraserPreviewExpiryMs: number;
  eraserPreviewEndExpiryMs: number;
  viewportSyncEpsilon: number;
};

export const applyWorkbookIncomingRealtimeEvent = (
  params: ApplyWorkbookIncomingRealtimeEventParams
) => {
  const {
    event,
    eventTimestamp,
    userId,
    selectedObjectId,
    selectedTextDraftDirty,
    selectedTextDraftObjectId,
    awaitingClearRequest,
    areParticipantsEqual,
    applyHistoryOperations,
    restoreSceneSnapshot,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    clearIncomingEraserPreviewRuntime,
    scheduleIncomingEraserPreviewExpiry,
    queueIncomingStrokePreview,
    finalizeStrokePreview,
    queueIncomingPreviewPatch,
  applyLocalBoardObjects,
  setSession,
  setCanvasViewport,
    setIncomingEraserPreviews,
    setBoardStrokes,
    setAnnotationStrokes,
    setConstraints,
    setSelectedObjectId,
    setSelectedConstraintId,
    setPendingClearRequest,
    setAwaitingClearRequest,
    setConfirmedClearRequest,
    setFocusPoint,
    setPointerPoint,
    setFocusPointsByUser,
    setPointerPointsByUser,
    viewportLastReceivedAtRef,
    finalizedStrokePreviewIdsRef,
    incomingStrokePreviewVersionRef,
    objectLastCommittedEventAtRef,
    incomingPreviewQueuedPatchRef,
    incomingPreviewVersionByAuthorObjectRef,
    objectUpdateQueuedPatchRef,
    objectUpdateDispatchOptionsRef,
    objectUpdateHistoryBeforeRef,
    objectPreviewQueuedPatchRef,
    objectUpdateInFlightRef,
    objectPreviewVersionRef,
    objectUpdateTimersRef,
    focusResetTimersByUserRef,
    generateId,
    eraserPreviewPointMergeMinDistancePx,
    eraserPreviewExpiryMs,
    eraserPreviewEndExpiryMs,
    viewportSyncEpsilon,
  } = params;

  if (event.type === "presence.sync") {
    const payload = event.payload as { participants?: unknown };
    if (!Array.isArray(payload.participants)) return true;
    const participants = payload.participants as WorkbookSessionParticipant[];
    setSession((current) =>
      current
        ? areParticipantsEqual(current.participants, participants)
          ? current
          : {
              ...current,
              participants,
            }
        : current
    );
    return true;
  }

  if (event.type === "board.viewport.sync") {
    if (event.authorUserId === userId) return true;
    const payload = event.payload as { offset?: unknown };
    const rawOffset =
      payload.offset && typeof payload.offset === "object"
        ? (payload.offset as Partial<WorkbookPoint>)
        : null;
    if (
      !rawOffset ||
      typeof rawOffset.x !== "number" ||
      !Number.isFinite(rawOffset.x) ||
      typeof rawOffset.y !== "number" ||
      !Number.isFinite(rawOffset.y)
    ) {
      return true;
    }
    const offset: WorkbookPoint = { x: rawOffset.x, y: rawOffset.y };
    viewportLastReceivedAtRef.current = Date.now();
    setCanvasViewport((current) => {
      if (
        Math.abs(current.x - offset.x) <= viewportSyncEpsilon &&
        Math.abs(current.y - offset.y) <= viewportSyncEpsilon
      ) {
        return current;
      }
      return { x: offset.x, y: offset.y };
    });
    return true;
  }

  if (event.type === "board.undo" || event.type === "board.redo") {
    const payload = event.payload as { scene?: unknown; operations?: unknown };
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    if (Array.isArray(payload.operations)) {
      applyHistoryOperations(payload.operations);
      return true;
    }
    if (!payload.scene || typeof payload.scene !== "object") return true;
    const normalized = normalizeScenePayload(payload.scene);
    restoreSceneSnapshot({
      boardStrokes: normalized.strokes.filter((stroke) => stroke.layer === "board"),
      boardObjects: normalized.objects,
      constraints: normalized.constraints,
      annotationStrokes: normalized.strokes.filter((stroke) => stroke.layer === "annotations"),
      chatMessages: normalized.chat,
      comments: normalized.comments,
      timerState: normalized.timer,
      boardSettings: normalized.boardSettings,
      libraryState: normalized.library,
      documentState: normalized.document,
    });
    return true;
  }

  if (event.type === "board.eraser.preview") {
    if (event.authorUserId === userId) return true;
    const payload = event.payload as {
      gestureId?: unknown;
      layer?: unknown;
      page?: unknown;
      radius?: unknown;
      points?: unknown;
      ended?: unknown;
    };
    const gestureId = typeof payload.gestureId === "string" ? payload.gestureId.trim() : "";
    if (!gestureId) return true;
    const points = Array.isArray(payload.points)
      ? payload.points.reduce<WorkbookPoint[]>((acc, point) => {
          if (!point || typeof point !== "object") return acc;
          const x = (point as { x?: unknown }).x;
          const y = (point as { y?: unknown }).y;
          if (
            typeof x !== "number" ||
            !Number.isFinite(x) ||
            typeof y !== "number" ||
            !Number.isFinite(y)
          ) {
            return acc;
          }
          acc.push({ x, y });
          return acc;
        }, [])
      : [];
    const previewId = `${event.authorUserId}:${gestureId}`;
    const ended = Boolean(payload.ended);
    setIncomingEraserPreviews((current) => {
      const existing = current[previewId];
      const nextPoints = mergePreviewPathPoints(
        existing?.points ?? [],
        points,
        eraserPreviewPointMergeMinDistancePx
      );
      if (!existing && nextPoints.length === 0 && ended) {
        return current;
      }
      return {
        ...current,
        [previewId]: {
          id: previewId,
          authorUserId: event.authorUserId,
          gestureId,
          layer: payload.layer === "annotations" ? "annotations" : "board",
          page:
            typeof payload.page === "number" && Number.isFinite(payload.page)
              ? Math.max(1, Math.trunc(payload.page))
              : existing?.page ?? 1,
          radius:
            typeof payload.radius === "number" && Number.isFinite(payload.radius)
              ? Math.max(4, Math.min(160, payload.radius))
              : existing?.radius ?? 14,
          points: nextPoints,
          updatedAt: eventTimestamp,
        },
      };
    });
    scheduleIncomingEraserPreviewExpiry(
      previewId,
      ended ? eraserPreviewEndExpiryMs : eraserPreviewExpiryMs
    );
    return true;
  }

  if (event.type === "board.stroke.preview" || event.type === "annotations.stroke.preview") {
    if (event.authorUserId === userId) return true;
    const payload = event.payload as { stroke?: unknown; previewVersion?: unknown };
    const stroke = normalizeStrokePayload(payload.stroke);
    if (!stroke) return true;
    if (finalizedStrokePreviewIdsRef.current.has(stroke.id)) return true;
    const previewVersion =
      typeof payload.previewVersion === "number" && Number.isFinite(payload.previewVersion)
        ? Math.max(1, Math.trunc(payload.previewVersion))
        : 0;
    const appliedVersion = incomingStrokePreviewVersionRef.current.get(stroke.id) ?? 0;
    if (previewVersion > 0 && previewVersion <= appliedVersion) return true;
    if (previewVersion > 0) {
      incomingStrokePreviewVersionRef.current.set(stroke.id, previewVersion);
    }
    queueIncomingStrokePreview(
      {
        stroke,
        previewVersion,
        updatedAt: Date.now(),
      },
      stroke.id
    );
    return true;
  }

  if (event.type === "board.stroke") {
    const stroke = normalizeStrokePayload((event.payload as { stroke?: unknown })?.stroke);
    if (!stroke || stroke.layer !== "board") return true;
    finalizeStrokePreview(stroke.id);
    setBoardStrokes((current) =>
      current.some((item) => item.id === stroke.id) ? current : [...current, stroke]
    );
    return true;
  }

  if (event.type === "board.stroke.delete") {
    const strokeId = (event.payload as { strokeId?: unknown })?.strokeId;
    if (typeof strokeId !== "string") return true;
    finalizeStrokePreview(strokeId);
    setBoardStrokes((current) => current.filter((item) => item.id !== strokeId));
    return true;
  }

  if (event.type === "annotations.stroke") {
    const stroke = normalizeStrokePayload((event.payload as { stroke?: unknown })?.stroke);
    if (!stroke || stroke.layer !== "annotations") return true;
    finalizeStrokePreview(stroke.id);
    setAnnotationStrokes((current) =>
      current.some((item) => item.id === stroke.id) ? current : [...current, stroke]
    );
    return true;
  }

  if (event.type === "annotations.stroke.delete") {
    const strokeId = (event.payload as { strokeId?: unknown })?.strokeId;
    if (typeof strokeId !== "string") return true;
    finalizeStrokePreview(strokeId);
    setAnnotationStrokes((current) => current.filter((item) => item.id !== strokeId));
    return true;
  }

  if (event.type === "board.object.create") {
    const object = normalizeObjectPayload((event.payload as { object?: unknown })?.object);
    if (!object) return true;
    objectLastCommittedEventAtRef.current.set(object.id, eventTimestamp);
    applyLocalBoardObjects((current) =>
      current.some((item) => item.id === object.id) ? current : [...current, object]
    );
    return true;
  }

  if (event.type === "board.object.update") {
    const payload = event.payload as { objectId?: unknown; patch?: unknown };
    const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
    const patch =
      payload.patch && typeof payload.patch === "object"
        ? (payload.patch as Partial<WorkbookBoardObject>)
        : null;
    if (!objectId || !patch) return true;
    objectLastCommittedEventAtRef.current.set(objectId, eventTimestamp);
    const shouldKeepLocalTextDraft =
      selectedTextDraftDirty &&
      selectedTextDraftObjectId === objectId &&
      event.authorUserId === userId &&
      typeof patch.text === "string";
    let safePatch = patch;
    if (shouldKeepLocalTextDraft) {
      safePatch = { ...patch };
      delete safePatch.text;
      if (Object.keys(safePatch).length === 0) return true;
    }
    incomingPreviewQueuedPatchRef.current.delete(objectId);
    applyLocalBoardObjects((current) => {
      let found = false;
      const next = current.map((item) => {
        if (item.id !== objectId) return item;
        found = true;
        return mergeBoardObjectWithPatch(item, safePatch);
      });
      return found ? next : current;
    });
    return true;
  }

  if (event.type === "board.object.preview") {
    if (event.authorUserId === userId) return true;
    const payload = event.payload as {
      objectId?: unknown;
      patch?: unknown;
      previewVersion?: unknown;
    };
    const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
    const patch =
      payload.patch && typeof payload.patch === "object"
        ? (payload.patch as Partial<WorkbookBoardObject>)
        : null;
    if (!objectId || !patch) return true;
    const committedAt = objectLastCommittedEventAtRef.current.get(objectId) ?? 0;
    if (committedAt > 0 && eventTimestamp <= committedAt) return true;
    const previewVersion =
      typeof payload.previewVersion === "number" && Number.isFinite(payload.previewVersion)
        ? Math.max(1, Math.trunc(payload.previewVersion))
        : null;
    if (previewVersion !== null) {
      const versionKey = `${event.authorUserId ?? "unknown"}:${objectId}`;
      const appliedVersion =
        incomingPreviewVersionByAuthorObjectRef.current.get(versionKey) ?? 0;
      if (previewVersion <= appliedVersion) return true;
      incomingPreviewVersionByAuthorObjectRef.current.set(versionKey, previewVersion);
    }
    queueIncomingPreviewPatch(objectId, patch);
    return true;
  }

  if (event.type === "board.object.delete") {
    const objectId = (event.payload as { objectId?: unknown })?.objectId;
    if (typeof objectId !== "string") return true;
    objectLastCommittedEventAtRef.current.set(objectId, eventTimestamp);
    objectUpdateQueuedPatchRef.current.delete(objectId);
    objectUpdateDispatchOptionsRef.current.delete(objectId);
    objectUpdateHistoryBeforeRef.current.delete(objectId);
    objectPreviewQueuedPatchRef.current.delete(objectId);
    objectUpdateInFlightRef.current.delete(objectId);
    objectPreviewVersionRef.current.delete(objectId);
    incomingPreviewQueuedPatchRef.current.delete(objectId);
    Array.from(incomingPreviewVersionByAuthorObjectRef.current.keys()).forEach((key) => {
      if (key.endsWith(`:${objectId}`)) {
        incomingPreviewVersionByAuthorObjectRef.current.delete(key);
      }
    });
    const pendingUpdateTimer = objectUpdateTimersRef.current.get(objectId);
    if (pendingUpdateTimer !== undefined) {
      window.clearTimeout(pendingUpdateTimer);
      objectUpdateTimersRef.current.delete(objectId);
    }
    applyLocalBoardObjects((current) => current.filter((item) => item.id !== objectId));
    setConstraints((current) =>
      current.filter(
        (constraint) =>
          constraint.sourceObjectId !== objectId &&
          constraint.targetObjectId !== objectId
      )
    );
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null);
    }
    return true;
  }

  if (event.type === "board.object.pin") {
    const payload = event.payload as { objectId?: unknown; pinned?: unknown };
    const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
    if (!objectId) return true;
    applyLocalBoardObjects((current) =>
      current.map((item) =>
        item.id === objectId ? { ...item, pinned: Boolean(payload.pinned) } : item
      )
    );
    return true;
  }

  if (event.type === "board.clear") {
    setBoardStrokes([]);
    applyLocalBoardObjects(() => []);
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    setFocusPoint(null);
    setPointerPoint(null);
    setFocusPointsByUser({});
    setPointerPointsByUser({});
    focusResetTimersByUserRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    focusResetTimersByUserRef.current.clear();
    setConstraints([]);
    setSelectedObjectId(null);
    setSelectedConstraintId(null);
    setPendingClearRequest(null);
    setAwaitingClearRequest(null);
    return true;
  }

  if (event.type === "annotations.clear") {
    clearStrokePreviewRuntime({ clearFinalized: false });
    clearIncomingEraserPreviewRuntime();
    setAnnotationStrokes([]);
    return true;
  }

  if (event.type === "board.clear.request") {
    const payload = event.payload as { requestId?: unknown; targetLayer?: unknown };
    const requestId = typeof payload.requestId === "string" ? payload.requestId : generateId();
    const targetLayer = payload.targetLayer === "annotations" ? "annotations" : "board";
    const request: ClearRequest = {
      requestId,
      targetLayer,
      authorUserId: event.authorUserId,
    };
    setPendingClearRequest(request);
    if (event.authorUserId === userId) {
      setAwaitingClearRequest(request);
    }
    return true;
  }

  if (event.type === "board.clear.confirm") {
    const requestId = (event.payload as { requestId?: unknown })?.requestId;
    if (typeof requestId !== "string") return true;
    if (awaitingClearRequest && awaitingClearRequest.requestId === requestId) {
      setConfirmedClearRequest(awaitingClearRequest);
    }
    setPendingClearRequest((current) => {
      if (!current || current.requestId !== requestId) return current;
      return null;
    });
    setAwaitingClearRequest((current) => {
      if (!current || current.requestId !== requestId) return current;
      return null;
    });
    return true;
  }

  if (event.type === "focus.point") {
    const payload = event.payload as { target?: unknown; point?: unknown; mode?: unknown };
    if (payload.target !== "board") return true;
    const mode =
      payload.mode === "pin" || payload.mode === "move" || payload.mode === "clear"
        ? payload.mode
        : "flash";
    const authorKey = event.authorUserId || "unknown";
    if (mode === "clear") {
      if (event.authorUserId === userId) {
        setPointerPoint(null);
        setFocusPoint(null);
      }
      setPointerPointsByUser((current) => {
        if (!(authorKey in current)) return current;
        const next = { ...current };
        delete next[authorKey];
        return next;
      });
      setFocusPointsByUser((current) => {
        if (!(authorKey in current)) return current;
        const next = { ...current };
        delete next[authorKey];
        return next;
      });
      const existingTimer = focusResetTimersByUserRef.current.get(authorKey);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        focusResetTimersByUserRef.current.delete(authorKey);
      }
      return true;
    }
    const point = payload.point as Partial<WorkbookPoint> | undefined;
    if (!point || typeof point.x !== "number" || typeof point.y !== "number") return true;
    const pointX = point.x;
    const pointY = point.y;
    if (mode === "pin" || mode === "move") {
      if (event.authorUserId === userId) {
        setPointerPoint({ x: pointX, y: pointY });
      }
      setPointerPointsByUser((current) => ({
        ...current,
        [authorKey]: { x: pointX, y: pointY },
      }));
    }
    if (event.authorUserId === userId) {
      setFocusPoint({ x: pointX, y: pointY });
    }
    setFocusPointsByUser((current) => ({
      ...current,
      [authorKey]: { x: pointX, y: pointY },
    }));
    const previousTimer = focusResetTimersByUserRef.current.get(authorKey);
    if (previousTimer !== undefined) {
      window.clearTimeout(previousTimer);
    }
    const nextTimer = window.setTimeout(() => {
      setFocusPointsByUser((current) => {
        if (!(authorKey in current)) return current;
        const next = { ...current };
        delete next[authorKey];
        return next;
      });
      if (event.authorUserId === userId) {
        setFocusPoint(null);
      }
      focusResetTimersByUserRef.current.delete(authorKey);
    }, 800);
    focusResetTimersByUserRef.current.set(authorKey, nextTimer);
    return true;
  }

  return false;
};
