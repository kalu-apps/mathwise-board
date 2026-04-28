import { useCallback, useEffect, type MutableRefObject } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookPoint, WorkbookTool } from "@/features/workbook/model/types";
import type { WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

type Updater<T> = T | ((current: T) => T);

type UseWorkbookLaserHandlersParams = {
  canUseLaser: boolean;
  userId?: string;
  tool: WorkbookTool;
  pointerPoint: WorkbookPoint | null;
  appendEventsAndApply: (
    events: WorkbookClientEventInput[],
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
      historyEntry?: WorkbookHistoryEntry | null;
    }
  ) => Promise<void>;
  setError: (value: string | null) => void;
  setPointerPoint: (value: WorkbookPoint | null) => void;
  setFocusPoint: (value: WorkbookPoint | null) => void;
  setPointerPointsByUser: (
    value: Updater<Record<string, WorkbookPoint>>
  ) => void;
  setFocusPointsByUser: (
    value: Updater<Record<string, WorkbookPoint>>
  ) => void;
  focusResetTimersByUserRef: MutableRefObject<Map<string, number>>;
  laserClearInFlightRef: MutableRefObject<boolean>;
  resetToolRuntimeToSelect: () => void;
};

export const useWorkbookLaserHandlers = ({
  canUseLaser,
  userId,
  tool,
  pointerPoint,
  appendEventsAndApply,
  setError,
  setPointerPoint,
  setFocusPoint,
  setPointerPointsByUser,
  setFocusPointsByUser,
  focusResetTimersByUserRef,
  laserClearInFlightRef,
  resetToolRuntimeToSelect,
}: UseWorkbookLaserHandlersParams) => {
  const handleLaserPoint = useCallback(
    async (point: WorkbookPoint) => {
      if (!canUseLaser) return;
      const authorKey = userId ?? "unknown";
      setPointerPoint(point);
      setFocusPoint(point);
      setPointerPointsByUser((current) => ({
        ...current,
        [authorKey]: point,
      }));
      setFocusPointsByUser((current) => ({
        ...current,
        [authorKey]: point,
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
        setFocusPoint(null);
        focusResetTimersByUserRef.current.delete(authorKey);
      }, 800);
      focusResetTimersByUserRef.current.set(authorKey, nextTimer);
      try {
        await appendEventsAndApply([
          {
            type: "focus.point",
            payload: {
              target: "board",
              point,
              mode: "pin",
            },
          },
        ]);
      } catch {
        setError("Не удалось передать фокус.");
      }
    },
    [
      appendEventsAndApply,
      canUseLaser,
      focusResetTimersByUserRef,
      setError,
      setFocusPoint,
      setFocusPointsByUser,
      setPointerPoint,
      setPointerPointsByUser,
      userId,
    ]
  );

  const clearLaserPointer = useCallback(
    async (options?: { keepTool?: boolean }) => {
      if (!canUseLaser) return;
      if (laserClearInFlightRef.current) return;
      laserClearInFlightRef.current = true;
      const actorKey = userId ?? "unknown";
      setPointerPoint(null);
      setFocusPoint(null);
      setPointerPointsByUser((current) => {
        if (!(actorKey in current)) return current;
        const next = { ...current };
        delete next[actorKey];
        return next;
      });
      setFocusPointsByUser((current) => {
        if (!(actorKey in current)) return current;
        const next = { ...current };
        delete next[actorKey];
        return next;
      });
      const timerId = focusResetTimersByUserRef.current.get(actorKey);
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
        focusResetTimersByUserRef.current.delete(actorKey);
      }
      try {
        await appendEventsAndApply([
          {
            type: "focus.point",
            payload: {
              target: "board",
              mode: "clear",
            },
          },
        ]);
        if (!options?.keepTool) {
          resetToolRuntimeToSelect();
        }
      } catch {
        setError("Не удалось убрать указку.");
      } finally {
        laserClearInFlightRef.current = false;
      }
    },
    [
      appendEventsAndApply,
      canUseLaser,
      focusResetTimersByUserRef,
      laserClearInFlightRef,
      resetToolRuntimeToSelect,
      setError,
      setFocusPoint,
      setFocusPointsByUser,
      setPointerPoint,
      setPointerPointsByUser,
      userId,
    ]
  );

  useEffect(() => {
    if (tool === "laser" || !pointerPoint) return;
    void clearLaserPointer({ keepTool: true });
  }, [clearLaserPointer, pointerPoint, tool]);

  useEffect(() => {
    if (tool !== "laser" || !pointerPoint) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void clearLaserPointer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearLaserPointer, pointerPoint, tool]);

  return {
    handleLaserPoint,
    clearLaserPointer,
  };
};
