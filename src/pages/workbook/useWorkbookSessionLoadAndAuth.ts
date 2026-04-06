import { useCallback, useEffect, useRef } from "react";
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
  const conflictResyncQueuedRef = useRef(false);
  const conflictRetryTimerRef = useRef<number | null>(null);

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

  const clearConflictRetryTimer = useCallback(() => {
    if (conflictRetryTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(conflictRetryTimerRef.current);
    conflictRetryTimerRef.current = null;
  }, []);

  const triggerQueuedConflictResync = useCallback(function runConflictResync() {
    if (!sessionId || authRequiredRef.current) return;
    if (!conflictResyncQueuedRef.current) return;
    if (sessionResyncInFlightRef.current) return;
    const now = Date.now();
    const sinceLastResyncMs = now - lastForcedResyncAtRef.current;
    if (sinceLastResyncMs < 5_000) {
      if (typeof window === "undefined" || conflictRetryTimerRef.current !== null) return;
      conflictRetryTimerRef.current = window.setTimeout(() => {
        conflictRetryTimerRef.current = null;
        runConflictResync();
      }, Math.max(250, 5_000 - sinceLastResyncMs));
      return;
    }
    clearConflictRetryTimer();
    conflictResyncQueuedRef.current = false;
    sessionResyncInFlightRef.current = true;
    lastForcedResyncAtRef.current = now;
    pauseWorkbookPersistenceForSession(sessionId);
    const conflictWarningText =
      "Обнаружен конфликт синхронизации. Повторно загружаем состояние доски.";
    setRealtimeSyncWarning((current) =>
      current === conflictWarningText ? current : conflictWarningText
    );
    void Promise.resolve(loadSession({ background: true, reason: "conflict" })).finally(() => {
      resumeWorkbookPersistenceForSession(sessionId);
      void flushWorkbookPersistenceQueue();
      sessionResyncInFlightRef.current = false;
      if (conflictResyncQueuedRef.current) {
        runConflictResync();
      }
    });
  }, [
    sessionId,
    authRequiredRef,
    clearConflictRetryTimer,
    sessionResyncInFlightRef,
    lastForcedResyncAtRef,
    setRealtimeSyncWarning,
    loadSession,
  ]);

  const handleRealtimeConflict = useCallback(() => {
    if (!sessionId || authRequiredRef.current) return;
    conflictResyncQueuedRef.current = true;
    triggerQueuedConflictResync();
  }, [authRequiredRef, sessionId, triggerQueuedConflictResync]);

  useEffect(() => {
    conflictResyncQueuedRef.current = false;
    clearConflictRetryTimer();
  }, [clearConflictRetryTimer, sessionId]);

  useEffect(
    () => () => {
      clearConflictRetryTimer();
      conflictResyncQueuedRef.current = false;
    },
    [clearConflictRetryTimer]
  );

  return {
    loadSession,
    handleRealtimeAuthRequired,
    handleRealtimeConflict,
  };
};
