import { useCallback } from "react";
import {
  dropWorkbookPersistenceTasksForSession,
  flushWorkbookPersistenceQueue,
  pauseWorkbookPersistenceForSession,
  resumeWorkbookPersistenceForSession,
} from "@/features/workbook/model/persistenceQueue";
import type { WorkbookSessionLoadAndAuthParams } from "./useWorkbookSessionLoadAuthTypes";
import { useWorkbookSessionLoadSession } from "./useWorkbookSessionLoadSession";

export const useWorkbookSessionLoadAndAuth = ({
  sessionId,
  setSaveState,
  setSaveSyncWarning,
  setError,
  setRealtimeSyncWarning,
  authRequiredRef,
  sessionResyncInFlightRef,
  lastForcedResyncAtRef,
  clearIncomingRealtimeApplyQueue,
  ...loadSessionParams
}: WorkbookSessionLoadAndAuthParams) => {
  const loadSession = useWorkbookSessionLoadSession({
    sessionId,
    setSaveState,
    setSaveSyncWarning,
    setError,
    authRequiredRef,
    clearIncomingRealtimeApplyQueue,
    ...loadSessionParams,
  });

  const handleRealtimeAuthRequired = useCallback(
    (status: 401 | 403 | 404 = 401) => {
      if (authRequiredRef.current) return;
      authRequiredRef.current = true;
      if (sessionId) {
        dropWorkbookPersistenceTasksForSession(sessionId);
      }
      setSaveState("error");
      if (status === 401) {
        setSaveSyncWarning(
          "Сессия авторизации истекла. Войдите снова и не закрывайте вкладку до восстановления синхронизации."
        );
        setError("Сессия недоступна: требуется повторная авторизация.");
        return;
      }
      if (status === 403) {
        setSaveSyncWarning(
          "Нет доступа к этой сессии. Запросите новую ссылку и дождитесь восстановления синхронизации."
        );
        setError("Нет доступа к этой сессии. Запросите новую ссылку у преподавателя.");
        return;
      }
      setSaveSyncWarning(
        "Сессия не найдена. Откройте актуальную ссылку и не закрывайте вкладку до восстановления синхронизации."
      );
      setError("Сессия не найдена. Возможно, урок завершен или ссылка устарела.");
    },
    [authRequiredRef, sessionId, setError, setSaveState, setSaveSyncWarning]
  );

  const handleRealtimeConflict = useCallback(() => {
    if (!sessionId || authRequiredRef.current) return;
    if (sessionResyncInFlightRef.current) return;
    const now = Date.now();
    if (now - lastForcedResyncAtRef.current < 5_000) return;
    sessionResyncInFlightRef.current = true;
    lastForcedResyncAtRef.current = now;
    pauseWorkbookPersistenceForSession(sessionId);
    setRealtimeSyncWarning(
      "Обнаружен конфликт синхронизации. Повторно загружаем состояние доски."
    );
    void Promise.resolve(loadSession({ background: true })).finally(() => {
      resumeWorkbookPersistenceForSession(sessionId);
      void flushWorkbookPersistenceQueue();
      sessionResyncInFlightRef.current = false;
    });
  }, [
    sessionId,
    authRequiredRef,
    sessionResyncInFlightRef,
    lastForcedResyncAtRef,
    setRealtimeSyncWarning,
    loadSession,
  ]);

  return {
    loadSession,
    handleRealtimeAuthRequired,
    handleRealtimeConflict,
  };
};
