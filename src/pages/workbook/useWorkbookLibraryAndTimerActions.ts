import { useCallback, useEffect } from "react";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookLibraryState, WorkbookTimerState } from "@/features/workbook/model/types";

type StateUpdater<T> = T | ((current: T) => T);

interface UseWorkbookLibraryAndTimerActionsParams {
  appendEventsAndApply: (
    events: WorkbookClientEventInput[]
  ) => Promise<unknown>;
  setError: (message: string | null) => void;
  timerState: WorkbookTimerState | null;
  setTimerState: (value: StateUpdater<WorkbookTimerState | null>) => void;
}

type UpsertLibraryItemOptions = {
  silent?: boolean;
  onError?: (error: unknown) => void;
};

export function useWorkbookLibraryAndTimerActions({
  appendEventsAndApply,
  setError,
  timerState,
  setTimerState,
}: UseWorkbookLibraryAndTimerActionsParams) {
  const upsertLibraryItem = useCallback(
    async (
      item: WorkbookLibraryState["items"][number],
      options?: UpsertLibraryItemOptions
    ) => {
      try {
        await appendEventsAndApply([
          {
            type: "library.item.upsert",
            payload: { item },
          },
        ]);
        return true;
      } catch (error) {
        options?.onError?.(error);
        if (!options?.silent) {
          setError("Не удалось сохранить материал в библиотеке.");
        }
        return false;
      }
    },
    [appendEventsAndApply, setError]
  );

  const updateTimer = useCallback(
    async (timer: WorkbookTimerState | null) => {
      try {
        await appendEventsAndApply([
          {
            type: "timer.update",
            payload: { timer },
          },
        ]);
      } catch {
        setError("Не удалось синхронизировать таймер.");
      }
    },
    [appendEventsAndApply, setError]
  );

  useEffect(() => {
    if (!timerState || timerState.status !== "running") return;
    const intervalId = window.setInterval(() => {
      setTimerState((current) => {
        if (!current || current.status !== "running") return current;
        if (current.remainingSec <= 1) {
          const completed: WorkbookTimerState = {
            ...current,
            remainingSec: 0,
            status: "done",
            updatedAt: new Date().toISOString(),
          };
          void updateTimer(completed);
          return completed;
        }
        return {
          ...current,
          remainingSec: current.remainingSec - 1,
          updatedAt: new Date().toISOString(),
        };
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [setTimerState, timerState, updateTimer]);

  return {
    upsertLibraryItem,
  };
}
