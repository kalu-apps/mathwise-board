import { useCallback, useEffect } from "react";
import type { WorkbookLibraryState, WorkbookTimerState } from "@/features/workbook/model/types";

interface UseWorkbookLibraryAndTimerActionsParams {
  appendEventsAndApply: (
    events: Array<{ type: string; payload?: unknown }>
  ) => Promise<unknown>;
  setError: (message: string | null) => void;
  timerState: WorkbookTimerState;
  setTimerState: (
    value: WorkbookTimerState | ((current: WorkbookTimerState) => WorkbookTimerState)
  ) => void;
}

export function useWorkbookLibraryAndTimerActions({
  appendEventsAndApply,
  setError,
  timerState,
  setTimerState,
}: UseWorkbookLibraryAndTimerActionsParams) {
  const upsertLibraryItem = useCallback(
    async (item: WorkbookLibraryState["items"][number]) => {
      try {
        await appendEventsAndApply([
          {
            type: "library.item.upsert",
            payload: { item },
          },
        ]);
      } catch {
        setError("Не удалось сохранить материал в библиотеке.");
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
