import { useCallback, useEffect, useRef } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookPoint } from "@/features/workbook/model/types";

const TEACHER_CURSOR_MIN_SEND_INTERVAL_MS = 40;
const TEACHER_CURSOR_MIN_DISTANCE_PX = 2;
const TEACHER_CURSOR_HEARTBEAT_INTERVAL_MS = 900;

type UseWorkbookTeacherCursorBroadcastParams = {
  enabled: boolean;
  userId?: string;
  sendWorkbookLiveEvents: (events: WorkbookClientEventInput[]) => void;
};

export const useWorkbookTeacherCursorBroadcast = ({
  enabled,
  userId,
  sendWorkbookLiveEvents,
}: UseWorkbookTeacherCursorBroadcastParams) => {
  const lastSentAtRef = useRef(0);
  const lastSentPointRef = useRef<WorkbookPoint | null>(null);
  const hasActiveCursorRef = useRef(false);
  const heartbeatTimerRef = useRef<number | null>(null);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current === null) return;
    window.clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = null;
  }, []);

  const sendTeacherCursorMove = useCallback(
    (point: WorkbookPoint) => {
      sendWorkbookLiveEvents([
        {
          type: "teacher.cursor",
          payload: {
            target: "board",
            mode: "move",
            point: {
              x: point.x,
              y: point.y,
            },
          },
        },
      ]);
      lastSentAtRef.current = Date.now();
      lastSentPointRef.current = point;
    },
    [sendWorkbookLiveEvents]
  );

  const ensureHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) return;
    heartbeatTimerRef.current = window.setInterval(() => {
      if (!enabled || !userId || !hasActiveCursorRef.current) {
        stopHeartbeat();
        return;
      }
      const point = lastSentPointRef.current;
      if (!point) return;
      sendTeacherCursorMove(point);
    }, TEACHER_CURSOR_HEARTBEAT_INTERVAL_MS);
  }, [enabled, sendTeacherCursorMove, stopHeartbeat, userId]);

  const resetLocalState = useCallback(() => {
    stopHeartbeat();
    lastSentAtRef.current = 0;
    lastSentPointRef.current = null;
    hasActiveCursorRef.current = false;
  }, [stopHeartbeat]);

  const clearTeacherCursor = useCallback(() => {
    if (!userId || !hasActiveCursorRef.current) {
      resetLocalState();
      return;
    }
    sendWorkbookLiveEvents([
      {
        type: "teacher.cursor",
        payload: {
          target: "board",
          mode: "clear",
        },
      },
    ]);
    resetLocalState();
  }, [resetLocalState, sendWorkbookLiveEvents, userId]);

  const publishTeacherCursorPoint = useCallback(
    (point: WorkbookPoint) => {
      if (!enabled || !userId) return;
      const now = Date.now();
      const previousPoint = lastSentPointRef.current;
      const delta = previousPoint
        ? Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y)
        : Number.POSITIVE_INFINITY;
      if (
        now - lastSentAtRef.current < TEACHER_CURSOR_MIN_SEND_INTERVAL_MS &&
        delta < TEACHER_CURSOR_MIN_DISTANCE_PX
      ) {
        return;
      }
      hasActiveCursorRef.current = true;
      sendTeacherCursorMove(point);
      ensureHeartbeat();
    },
    [enabled, ensureHeartbeat, sendTeacherCursorMove, userId]
  );

  useEffect(() => {
    if (enabled && userId) return;
    clearTeacherCursor();
  }, [clearTeacherCursor, enabled, userId]);

  useEffect(
    () => () => {
      clearTeacherCursor();
    },
    [clearTeacherCursor]
  );

  return {
    publishTeacherCursorPoint,
    clearTeacherCursor,
  };
};
