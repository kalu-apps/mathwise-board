import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { observeWorkbookRealtimeVolatileDrop } from "@/features/workbook/model/realtimeObservability";
import { mergePreviewPathPoints } from "@/features/workbook/model/runtime";
import {
  buildWorkbookStrokeTranslatePreviewEventType,
  WORKBOOK_MAX_STROKE_TRANSLATE_PREVIEW_IDS,
} from "@/features/workbook/model/strokeTranslateEvents";
import type {
  WorkbookClientEventInput,
  WorkbookViewportSyncPayload,
} from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookSession,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import {
  ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX,
  VIEWPORT_SYNC_MIN_INTERVAL_MS,
  VOLATILE_SYNC_FLUSH_INTERVAL_MS,
} from "./WorkbookSessionPage.core";

const VIEWPORT_SYNC_HEARTBEAT_MS = 1_000;

type QueuedStrokePreviewEntry = {
  stroke: WorkbookStroke;
  previewVersion: number;
};

type QueuedStrokeTranslatePreviewEntry = {
  layer: WorkbookLayer;
  page: number;
  strokeIds: string[];
  dx: number;
  dy: number;
  previewVersion: number;
  queuedAt: number;
};

type QueuedEraserPreviewEntry = {
  gestureId: string;
  layer: WorkbookLayer;
  page: number;
  radius: number;
  points: WorkbookPoint[];
  ended?: boolean;
};

type UseWorkbookVolatileSyncPipelineParams = {
  sessionId: string;
  session: WorkbookSession | null;
  isEnded: boolean;
  canDraw: boolean;
  canSelect: boolean;
  canBroadcastViewportSync: boolean;
  realtimeBackpressureV2Enabled: boolean;
  volatilePreviewMaxPerFlush: number;
  volatilePreviewQueueMax: number;
  sendWorkbookLiveEvents: (events: WorkbookClientEventInput[]) => void;
  currentBoardPage: number;
  canvasViewport: WorkbookPoint;
  viewportZoom: number;
  setCanvasViewport: (offset: WorkbookPoint) => void;
  setViewportZoom: (zoom: number) => void;
  volatileSyncTimerRef: MutableRefObject<number | null>;
  viewportSyncLastSentAtRef: MutableRefObject<number>;
  viewportSyncQueuedOffsetRef: MutableRefObject<WorkbookViewportSyncPayload | null>;
  objectPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectPreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
  objectPreviewVersionRef: MutableRefObject<Map<string, number>>;
  strokePreviewQueuedByIdRef: MutableRefObject<Map<string, QueuedStrokePreviewEntry>>;
  strokePreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
  eraserPreviewQueuedByGestureRef: MutableRefObject<Map<string, QueuedEraserPreviewEntry>>;
  eraserPreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
};

export const useWorkbookVolatileSyncPipeline = ({
  sessionId,
  session,
  isEnded,
  canDraw,
  canSelect,
  canBroadcastViewportSync,
  realtimeBackpressureV2Enabled,
  volatilePreviewMaxPerFlush,
  volatilePreviewQueueMax,
  sendWorkbookLiveEvents,
  currentBoardPage,
  canvasViewport,
  viewportZoom,
  setCanvasViewport,
  setViewportZoom,
  volatileSyncTimerRef,
  viewportSyncLastSentAtRef,
  viewportSyncQueuedOffsetRef,
  objectPreviewQueuedPatchRef,
  objectPreviewQueuedAtRef,
  objectPreviewVersionRef,
  strokePreviewQueuedByIdRef,
  strokePreviewQueuedAtRef,
  eraserPreviewQueuedByGestureRef,
  eraserPreviewQueuedAtRef,
}: UseWorkbookVolatileSyncPipelineParams) => {
  const flushQueuedVolatileSyncRef = useRef<() => void>(() => {});
  const strokePreviewVersionByIdRef = useRef<Map<string, number>>(new Map());
  const strokeTranslatePreviewQueuedByKeyRef = useRef<
    Map<string, QueuedStrokeTranslatePreviewEntry>
  >(new Map());
  const strokeTranslatePreviewVersionRef = useRef(0);

  const flushQueuedVolatileSync = useCallback(() => {
    const droppedEventTypes = new Set<string>();
    let droppedCount = 0;
    if (!sessionId || !session || isEnded) {
      viewportSyncQueuedOffsetRef.current = null;
      objectPreviewQueuedPatchRef.current.clear();
      objectPreviewQueuedAtRef.current.clear();
      strokePreviewQueuedByIdRef.current.clear();
      strokePreviewQueuedAtRef.current.clear();
      strokePreviewVersionByIdRef.current.clear();
      strokeTranslatePreviewQueuedByKeyRef.current.clear();
      eraserPreviewQueuedByGestureRef.current.clear();
      eraserPreviewQueuedAtRef.current.clear();
      return;
    }

    const events: WorkbookClientEventInput[] = [];
    const queuedViewport = viewportSyncQueuedOffsetRef.current;
    if (queuedViewport && !canBroadcastViewportSync) {
      viewportSyncQueuedOffsetRef.current = null;
    }
    if (queuedViewport && canBroadcastViewportSync) {
      const now = Date.now();
      const elapsed = now - viewportSyncLastSentAtRef.current;
      if (elapsed >= VIEWPORT_SYNC_MIN_INTERVAL_MS) {
        viewportSyncQueuedOffsetRef.current = null;
        viewportSyncLastSentAtRef.current = now;
        events.push({
          type: "board.viewport.sync",
          payload: queuedViewport,
        });
      } else if (volatileSyncTimerRef.current === null) {
        volatileSyncTimerRef.current = window.setTimeout(() => {
          volatileSyncTimerRef.current = null;
          flushQueuedVolatileSyncRef.current();
        }, VIEWPORT_SYNC_MIN_INTERVAL_MS - elapsed);
      }
    }

    if (canSelect) {
      const queuedObjectPreviews = Array.from(objectPreviewQueuedPatchRef.current.entries())
        .map(([objectId, patch]) => ({
          objectId,
          patch,
          queuedAt: objectPreviewQueuedAtRef.current.get(objectId) ?? 0,
        }));
      objectPreviewQueuedPatchRef.current.clear();
      objectPreviewQueuedAtRef.current.clear();
      if (queuedObjectPreviews.length > volatilePreviewMaxPerFlush) {
        const orderedByRecency = queuedObjectPreviews
          .slice()
          .sort((left, right) => right.queuedAt - left.queuedAt);
        const keep = orderedByRecency.slice(0, volatilePreviewMaxPerFlush);
        const overflow = orderedByRecency.length - keep.length;
        if (overflow > 0) {
          droppedCount += overflow;
          droppedEventTypes.add("board.object.preview");
        }
        queuedObjectPreviews.length = 0;
        queuedObjectPreviews.push(...keep);
      }
      queuedObjectPreviews
        .sort((left, right) => left.queuedAt - right.queuedAt)
        .forEach(({ objectId, patch }) => {
          const nextPreviewVersion = (objectPreviewVersionRef.current.get(objectId) ?? 0) + 1;
          objectPreviewVersionRef.current.set(objectId, nextPreviewVersion);
          events.push({
            type: "board.object.preview",
            payload: {
              objectId,
              patch,
              previewVersion: nextPreviewVersion,
            },
          });
        });
    } else {
      objectPreviewQueuedPatchRef.current.clear();
      objectPreviewQueuedAtRef.current.clear();
    }

    if (canDraw) {
      const queuedStrokePreviews = Array.from(strokePreviewQueuedByIdRef.current.entries())
        .map(([strokeId, entry]) => ({
          strokeId,
          entry,
          queuedAt: strokePreviewQueuedAtRef.current.get(strokeId) ?? 0,
        }));
      strokePreviewQueuedByIdRef.current.clear();
      strokePreviewQueuedAtRef.current.clear();
      if (queuedStrokePreviews.length > volatilePreviewMaxPerFlush) {
        const orderedByRecency = queuedStrokePreviews
          .slice()
          .sort((left, right) => right.queuedAt - left.queuedAt);
        const keep = orderedByRecency.slice(0, volatilePreviewMaxPerFlush);
        const overflow = orderedByRecency.length - keep.length;
        if (overflow > 0) {
          droppedCount += overflow;
          droppedEventTypes.add("board.stroke.preview");
          droppedEventTypes.add("annotations.stroke.preview");
        }
        queuedStrokePreviews.length = 0;
        queuedStrokePreviews.push(...keep);
      }
      queuedStrokePreviews
        .sort((left, right) => left.queuedAt - right.queuedAt)
        .forEach(({ entry }) => {
          events.push({
            type:
              entry.stroke.layer === "annotations"
                ? ("annotations.stroke.preview" as const)
                : ("board.stroke.preview" as const),
            payload: {
              stroke: entry.stroke,
              previewVersion: entry.previewVersion,
            },
          });
        });
      const queuedEraserPreviews = Array.from(eraserPreviewQueuedByGestureRef.current.entries())
        .map(([gestureId, entry]) => ({
          gestureId,
          entry,
          queuedAt: eraserPreviewQueuedAtRef.current.get(gestureId) ?? 0,
        }));
      eraserPreviewQueuedByGestureRef.current.clear();
      eraserPreviewQueuedAtRef.current.clear();
      if (queuedEraserPreviews.length > volatilePreviewMaxPerFlush) {
        const orderedByRecency = queuedEraserPreviews
          .slice()
          .sort((left, right) => right.queuedAt - left.queuedAt);
        const keep = orderedByRecency.slice(0, volatilePreviewMaxPerFlush);
        const overflow = orderedByRecency.length - keep.length;
        if (overflow > 0) {
          droppedCount += overflow;
          droppedEventTypes.add("board.eraser.preview");
        }
        queuedEraserPreviews.length = 0;
        queuedEraserPreviews.push(...keep);
      }
      queuedEraserPreviews
        .sort((left, right) => left.queuedAt - right.queuedAt)
        .forEach(({ entry }) => {
          events.push({
            type: "board.eraser.preview",
            payload: {
              gestureId: entry.gestureId,
              layer: entry.layer,
              page: entry.page,
              radius: entry.radius,
              points: entry.points,
              ...(entry.ended ? { ended: true } : {}),
            },
          });
        });
    } else {
      strokePreviewQueuedByIdRef.current.clear();
      strokePreviewQueuedAtRef.current.clear();
      strokePreviewVersionByIdRef.current.clear();
      strokeTranslatePreviewQueuedByKeyRef.current.clear();
      eraserPreviewQueuedByGestureRef.current.clear();
      eraserPreviewQueuedAtRef.current.clear();
    }

    const queuedStrokeTranslatePreviews = Array.from(
      strokeTranslatePreviewQueuedByKeyRef.current.values()
    );
    strokeTranslatePreviewQueuedByKeyRef.current.clear();
    queuedStrokeTranslatePreviews
      .sort((left, right) => left.queuedAt - right.queuedAt)
      .forEach((entry) => {
        events.push({
          type: buildWorkbookStrokeTranslatePreviewEventType(entry.layer),
          payload: {
            strokeIds: entry.strokeIds,
            dx: entry.dx,
            dy: entry.dy,
            page: entry.page,
            previewVersion: entry.previewVersion,
          },
        });
      });

    if (events.length > 0) {
      sendWorkbookLiveEvents(events);
    }
    if (realtimeBackpressureV2Enabled && droppedCount > 0) {
      observeWorkbookRealtimeVolatileDrop({
        sessionId,
        channel: "live",
        droppedCount,
        reason: "backpressure_trim",
        eventTypes: Array.from(droppedEventTypes),
      });
    }
  }, [
    canDraw,
    canBroadcastViewportSync,
    canSelect,
    isEnded,
    realtimeBackpressureV2Enabled,
    sendWorkbookLiveEvents,
    session,
    sessionId,
    volatilePreviewMaxPerFlush,
    viewportSyncLastSentAtRef,
    viewportSyncQueuedOffsetRef,
    volatileSyncTimerRef,
    objectPreviewQueuedAtRef,
    objectPreviewQueuedPatchRef,
    objectPreviewVersionRef,
    strokePreviewQueuedAtRef,
    strokePreviewQueuedByIdRef,
    eraserPreviewQueuedAtRef,
    eraserPreviewQueuedByGestureRef,
  ]);

  useEffect(() => {
    flushQueuedVolatileSyncRef.current = flushQueuedVolatileSync;
  }, [flushQueuedVolatileSync]);

  const scheduleVolatileSyncFlush = useCallback(
    (delay = VOLATILE_SYNC_FLUSH_INTERVAL_MS) => {
      if (volatileSyncTimerRef.current !== null) return;
      volatileSyncTimerRef.current = window.setTimeout(() => {
        volatileSyncTimerRef.current = null;
        flushQueuedVolatileSync();
      }, Math.max(0, delay));
    },
    [flushQueuedVolatileSync, volatileSyncTimerRef]
  );

  const queueViewportSyncSnapshot = useCallback(
    (next: WorkbookViewportSyncPayload, delay = VOLATILE_SYNC_FLUSH_INTERVAL_MS) => {
      if (!canBroadcastViewportSync || !session || isEnded) {
        return;
      }
      viewportSyncQueuedOffsetRef.current = next;
      scheduleVolatileSyncFlush(delay);
    },
    [
      canBroadcastViewportSync,
      isEnded,
      scheduleVolatileSyncFlush,
      session,
      viewportSyncQueuedOffsetRef,
    ]
  );

  const handleCanvasViewportOffsetChange = useCallback(
    (offset: WorkbookPoint) => {
      setCanvasViewport(offset);
      queueViewportSyncSnapshot({
        offset,
        page: Math.max(1, Math.round(currentBoardPage || 1)),
        zoom: viewportZoom,
      });
    },
    [currentBoardPage, queueViewportSyncSnapshot, setCanvasViewport, viewportZoom]
  );

  const handleCanvasViewportZoomChange = useCallback(
    (zoom: number) => {
      setViewportZoom(zoom);
      queueViewportSyncSnapshot({
        offset: canvasViewport,
        page: Math.max(1, Math.round(currentBoardPage || 1)),
        zoom,
      });
    },
    [canvasViewport, currentBoardPage, queueViewportSyncSnapshot, setViewportZoom]
  );

  useEffect(() => {
    if (!canBroadcastViewportSync || !session || isEnded) {
      return;
    }
    const syncCurrentViewport = () => {
      queueViewportSyncSnapshot({
        offset: canvasViewport,
        page: Math.max(1, Math.round(currentBoardPage || 1)),
        zoom: viewportZoom,
      });
    };
    syncCurrentViewport();
    const timerId = window.setInterval(syncCurrentViewport, VIEWPORT_SYNC_HEARTBEAT_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [
    canBroadcastViewportSync,
    canvasViewport,
    currentBoardPage,
    isEnded,
    queueViewportSyncSnapshot,
    session,
    viewportZoom,
  ]);

  const queueStrokePreview = useCallback(
    (payload: { stroke: WorkbookStroke; previewVersion: number; flush?: "immediate" }) => {
      const strokeId = payload.stroke.id;
      if (!strokeId) return;
      const incomingVersion =
        typeof payload.previewVersion === "number" && Number.isFinite(payload.previewVersion)
          ? Math.max(1, Math.trunc(payload.previewVersion))
          : 1;
      const previousVersion = strokePreviewVersionByIdRef.current.get(strokeId) ?? 0;
      const nextVersion = Math.max(incomingVersion, previousVersion + 1);
      strokePreviewVersionByIdRef.current.set(strokeId, nextVersion);
      const now = Date.now();
      strokePreviewQueuedByIdRef.current.set(strokeId, {
        stroke: payload.stroke,
        previewVersion: nextVersion,
      });
      strokePreviewQueuedAtRef.current.set(strokeId, now);
      if (strokePreviewQueuedByIdRef.current.size > volatilePreviewQueueMax) {
        const overflow = strokePreviewQueuedByIdRef.current.size - volatilePreviewQueueMax;
        const ordered = Array.from(strokePreviewQueuedAtRef.current.entries())
          .sort((left, right) => left[1] - right[1])
          .slice(0, overflow);
        if (overflow > 0 && sessionId && realtimeBackpressureV2Enabled) {
          observeWorkbookRealtimeVolatileDrop({
            sessionId,
            channel: "live",
            droppedCount: overflow,
            reason: "stroke_preview_queue_trim",
            eventTypes: ["board.stroke.preview", "annotations.stroke.preview"],
          });
        }
        ordered.forEach(([expiredStrokeId]) => {
          strokePreviewQueuedAtRef.current.delete(expiredStrokeId);
          strokePreviewQueuedByIdRef.current.delete(expiredStrokeId);
        });
      }
      if (payload.flush === "immediate") {
        if (volatileSyncTimerRef.current !== null) {
          window.clearTimeout(volatileSyncTimerRef.current);
          volatileSyncTimerRef.current = null;
        }
        flushQueuedVolatileSync();
        return;
      }
      scheduleVolatileSyncFlush();
    },
    [
      flushQueuedVolatileSync,
      strokePreviewQueuedByIdRef,
      strokePreviewQueuedAtRef,
      strokePreviewVersionByIdRef,
      volatilePreviewQueueMax,
      volatileSyncTimerRef,
      sessionId,
      realtimeBackpressureV2Enabled,
      scheduleVolatileSyncFlush,
    ]
  );

  const queueEraserPreview = useCallback(
    (payload: {
      gestureId: string;
      layer: WorkbookLayer;
      page: number;
      radius: number;
      points: WorkbookPoint[];
      ended?: boolean;
    }) => {
      if (!payload.gestureId) return;
      const now = Date.now();
      const current = eraserPreviewQueuedByGestureRef.current.get(payload.gestureId);
      const mergedPoints = mergePreviewPathPoints(
        current?.points ?? [],
        payload.points,
        ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX
      );
      eraserPreviewQueuedByGestureRef.current.set(payload.gestureId, {
        gestureId: payload.gestureId,
        layer: payload.layer,
        page: payload.page,
        radius: payload.radius,
        points: mergedPoints,
        ended: Boolean(current?.ended || payload.ended),
      });
      eraserPreviewQueuedAtRef.current.set(payload.gestureId, now);
      if (eraserPreviewQueuedByGestureRef.current.size > volatilePreviewQueueMax) {
        const overflow = eraserPreviewQueuedByGestureRef.current.size - volatilePreviewQueueMax;
        const ordered = Array.from(eraserPreviewQueuedAtRef.current.entries())
          .sort((left, right) => left[1] - right[1])
          .slice(0, overflow);
        if (overflow > 0 && sessionId && realtimeBackpressureV2Enabled) {
          observeWorkbookRealtimeVolatileDrop({
            sessionId,
            channel: "live",
            droppedCount: overflow,
            reason: "eraser_preview_queue_trim",
            eventTypes: ["board.eraser.preview"],
          });
        }
        ordered.forEach(([expiredGestureId]) => {
          eraserPreviewQueuedAtRef.current.delete(expiredGestureId);
          eraserPreviewQueuedByGestureRef.current.delete(expiredGestureId);
        });
      }
      scheduleVolatileSyncFlush(payload.ended ? 0 : undefined);
    },
    [
      eraserPreviewQueuedByGestureRef,
      eraserPreviewQueuedAtRef,
      volatilePreviewQueueMax,
      sessionId,
      realtimeBackpressureV2Enabled,
      scheduleVolatileSyncFlush,
    ]
  );

  const queueStrokeTranslatePreview = useCallback(
    (payload: {
      layer: WorkbookLayer;
      page?: number;
      strokeIds: string[];
      dx: number;
      dy: number;
    }) => {
      if (!canDraw || !sessionId || !session || isEnded) return;
      const strokeIds = Array.from(
        new Set(
          payload.strokeIds
            .map((strokeId) => strokeId.trim())
            .filter((strokeId) => strokeId.length > 0)
        )
      );
      if (strokeIds.length === 0) return;
      if (strokeIds.length > WORKBOOK_MAX_STROKE_TRANSLATE_PREVIEW_IDS) return;
      if (!Number.isFinite(payload.dx) || !Number.isFinite(payload.dy)) return;
      if (Math.abs(payload.dx) <= 0.5 && Math.abs(payload.dy) <= 0.5) return;
      const layer = payload.layer === "annotations" ? "annotations" : "board";
      const page =
        typeof payload.page === "number" && Number.isFinite(payload.page)
          ? Math.max(1, Math.trunc(payload.page))
          : 1;
      const previewVersion = Math.max(Date.now(), strokeTranslatePreviewVersionRef.current + 1);
      strokeTranslatePreviewVersionRef.current = previewVersion;
      strokeTranslatePreviewQueuedByKeyRef.current.set(`${layer}:${page}`, {
        layer,
        page,
        strokeIds,
        dx: payload.dx,
        dy: payload.dy,
        previewVersion,
        queuedAt: Date.now(),
      });
      scheduleVolatileSyncFlush();
    },
    [canDraw, isEnded, scheduleVolatileSyncFlush, session, sessionId]
  );

  return {
    scheduleVolatileSyncFlush,
    handleCanvasViewportOffsetChange,
    handleCanvasViewportZoomChange,
    queueStrokePreview,
    queueStrokeTranslatePreview,
    queueEraserPreview,
  };
};
