import type { MutableRefObject } from "react";
import { dropWorkbookPersistenceTasksForSession } from "@/features/workbook/model/persistenceQueue";
import { reportWorkbookLoadStageMetric } from "@/features/workbook/model/workbookPerformance";
import { getNowMs } from "./WorkbookSessionPage.core";
import type { SetState } from "./useWorkbookSessionLoadAuthTypes";

export const applyWorkbookSessionAccessError = ({
  status,
  backgroundMode,
  sessionId,
  authRequiredRef,
  setSaveState,
  setError,
  setSaveSyncWarning,
}: {
  status: 401 | 403 | 404;
  backgroundMode: boolean;
  sessionId: string;
  authRequiredRef: MutableRefObject<boolean>;
  setSaveState: SetState<"saved" | "unsaved" | "saving" | "error">;
  setError: SetState<string | null>;
  setSaveSyncWarning: SetState<string | null>;
}) => {
  dropWorkbookPersistenceTasksForSession(sessionId);
  authRequiredRef.current = true;
  setSaveState("error");
  if (status === 401) {
    setError("Сессия недоступна: требуется повторная авторизация.");
    if (backgroundMode) {
      setSaveSyncWarning(
        "Сессия авторизации истекла. Войдите снова и не закрывайте вкладку до восстановления синхронизации."
      );
    }
    return;
  }
  if (status === 403) {
    setError("Нет доступа к этой сессии. Запросите новую ссылку у преподавателя.");
    if (backgroundMode) {
      setSaveSyncWarning(
        "Нет доступа к этой сессии. Запросите новую ссылку и дождитесь восстановления синхронизации."
      );
    }
    return;
  }
  setError("Сессия не найдена. Возможно, урок завершен или ссылка устарела.");
  if (backgroundMode) {
    setSaveSyncWarning(
      "Сессия не найдена. Откройте актуальную ссылку и не закрывайте вкладку до восстановления синхронизации."
    );
  }
};

export const reportWorkbookFirstInteractiveMetric = ({
  sessionId,
  isBackground,
  firstInteractiveMetricReportedRef,
  loadStartedAtMs,
  isStaleLoadRequest,
}: {
  sessionId: string;
  isBackground: boolean;
  firstInteractiveMetricReportedRef: MutableRefObject<boolean>;
  loadStartedAtMs: number;
  isStaleLoadRequest: () => boolean;
}) => {
  if (isBackground || firstInteractiveMetricReportedRef.current || !sessionId.trim()) return;
  firstInteractiveMetricReportedRef.current = true;
  const emitMetric = () => {
    if (isStaleLoadRequest()) return;
    reportWorkbookLoadStageMetric({
      sessionId,
      name: "first_interactive_ms",
      durationMs: getNowMs() - loadStartedAtMs,
      startedAtMs: loadStartedAtMs,
    });
  };
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      emitMetric();
    });
    return;
  }
  emitMetric();
};
