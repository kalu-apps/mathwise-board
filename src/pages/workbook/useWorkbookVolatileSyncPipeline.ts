import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { observeWorkbookRealtimeVolatileDrop } from "@/features/workbook/model/realtimeObservability";
import { mergePreviewPathPoints } from "@/features/workbook/model/runtime";
import type {
  WorkbookClientEventInput,
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

type QueuedStrokePreviewEntry = {
  stroke: WorkbookStroke;
  previewVersion: number;
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
  realtimeBackpressureV2Enabled: boolean;
  volatilePreviewMaxPerFlush: number;
  volatilePreviewQueueMax: number;
  sendWorkbookLiveEvents: (events: WorkbookClientEventInput[]) => void;
  setCanvasViewport: (offset: WorkbookPoint) => void;
  volatileSyncTimerRef: MutableRefObject<number | null>;
  viewportSyncLastSentAtRef: MutableRefObject<number>;
  viewportSyncQueuedOffsetRef: MutableRefObject<WorkbookPoint | null>;
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
  realtimeBackpressureV2Enabled,
  volatilePreviewMaxPerFlush,
  volatilePreviewQueueMax,
  sendWorkbookLiveEvents,
  setCanvasViewport,
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
      eraserPreviewQueuedByGestureRef.current.clear();
      eraserPreviewQueuedAtRef.current.clear();
      return;
    }

    const events: WorkbookClientEventInput[] = [];
    const queuedOffset = viewportSyncQueuedOffsetRef.current;
    if (queuedOffset && session.kind === "CLASS") {
      const now = Date.now();
      const elapsed = now - viewportSyncLastSentAtRef.current;
      if (elapsed >= VIEWPORT_SYNC_MIN_INTERVAL_MS) {
        viewportSyncQueuedOffsetRef.current = null;
        viewportSyncLastSentAtRef.current = now;
        events.push({
          type: "board.viewport.sync",
          payload: { offset: queuedOffset },
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
      eraserPreviewQueuedByGestureRef.current.clear();
      eraserPreviewQueuedAtRef.current.clear();
    }

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

  const handleCanvasViewportOffsetChange = useCallback(
    (offset: WorkbookPoint) => {
      setCanvasViewport(offset);
    },
    [setCanvasViewport]
  );

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

  return {
    scheduleVolatileSyncFlush,
    handleCanvasViewportOffsetChange,
    queueStrokePreview,
    queueEraserPreview,
  };
};
