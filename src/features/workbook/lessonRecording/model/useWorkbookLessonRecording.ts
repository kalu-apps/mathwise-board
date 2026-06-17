import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getWorkbookLessonRecordingStatus,
  startWorkbookLessonRecording,
  stopWorkbookLessonRecording,
} from "@/features/workbook/model/api";
import type {
  WorkbookLessonRecordingInfo,
  WorkbookLessonRecordingStatus,
} from "@/features/workbook/model/types";
import { ApiError } from "@/shared/api/client";
import type {
  LessonRecordingNotice,
  LessonRecordingStatus,
} from "./lessonRecordingTypes";

type UseWorkbookLessonRecordingParams = {
  canAccessRecording: boolean;
  canRecord: boolean;
  sessionId: string;
  setError: (
    updater: string | null | ((current: string | null) => string | null)
  ) => void;
};

const ACTIVE_SERVER_STATUSES = new Set<WorkbookLessonRecordingStatus>([
  "starting",
  "recording",
  "stopping",
  "processing",
]);

const POLL_ACTIVE_RECORDING_MS = 2_000;
const POLL_IDLE_RECORDING_MS = 12_000;

const toClientStatus = (
  recording: WorkbookLessonRecordingInfo | null
): LessonRecordingStatus => {
  if (!recording) return "idle";
  if (recording.status === "starting") return "starting";
  if (recording.status === "recording") return "recording";
  if (recording.status === "stopping") return "stopping";
  if (recording.status === "processing") return "processing";
  return "idle";
};

const resolveElapsedMs = (recording: WorkbookLessonRecordingInfo | null) => {
  if (!recording?.startedAt) return 0;
  const startedAt = Date.parse(recording.startedAt);
  if (!Number.isFinite(startedAt)) return 0;
  const endedAt = recording.stoppedAt ? Date.parse(recording.stoppedAt) : Date.now();
  return Math.max(0, (Number.isFinite(endedAt) ? endedAt : Date.now()) - startedAt);
};

const formatServerRecordingError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 503) {
    return "Серверная запись не настроена. Проверьте LiveKit Egress и хранилище записей.";
  }
  if (error instanceof ApiError && error.status === 409) {
    return "Запись уже выполняется для этого занятия.";
  }
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return "Запуск записи доступен только преподавателю или владельцу тетради.";
  }
  return "Не удалось выполнить действие с серверной записью.";
};

export const useWorkbookLessonRecording = ({
  canAccessRecording,
  canRecord,
  sessionId,
  setError,
}: UseWorkbookLessonRecordingParams) => {
  const [status, setStatus] = useState<LessonRecordingStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [preStartDialogOpen, setPreStartDialogOpen] = useState(false);
  const [notice, setNotice] = useState<LessonRecordingNotice | null>(null);
  const [recording, setRecording] = useState<WorkbookLessonRecordingInfo | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const activeRequestRef = useRef<"start" | "stop" | null>(null);
  const statusRef = useRef<LessonRecordingStatus>("idle");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applyRecordingState = useCallback((nextRecording: WorkbookLessonRecordingInfo | null) => {
    setRecording(nextRecording);
    setStatus(toClientStatus(nextRecording));
    setElapsedMs(resolveElapsedMs(nextRecording));
  }, []);

  const refreshRecordingStatus = useCallback(async () => {
    if (!sessionId || !canAccessRecording) return;
    try {
      const response = await getWorkbookLessonRecordingStatus(sessionId);
      setIsSupported(response.available);
      applyRecordingState(response.recording);
      if (!response.available && response.unavailableReason) {
        setNotice((current) =>
          current?.tone === "error"
            ? current
            : {
                tone: "warning",
                message:
                  "Серверная запись сейчас недоступна: не настроен серверный контур записи.",
              }
        );
      }
    } catch {
      setIsSupported(false);
    }
  }, [applyRecordingState, canAccessRecording, sessionId]);

  const startRecording = useCallback(async () => {
    if (!canAccessRecording) {
      setError(
        "Запуск записи доступен преподавателю класса или владельцу личной тетради."
      );
      return;
    }
    if (!canRecord) {
      setError("Сейчас запись недоступна. Проверьте статус сессии и права.");
      return;
    }
    if (!sessionId || activeRequestRef.current) return;
    activeRequestRef.current = "start";
    setNotice(null);
    setPreStartDialogOpen(false);
    setStatus("starting");
    try {
      const response = await startWorkbookLessonRecording(sessionId);
      setIsSupported(response.available);
      applyRecordingState(response.recording);
      setNotice({
        tone: "success",
        message:
          "Серверная запись запущена. Видео собирается на сервере, вкладка преподавателя не кодирует файл.",
      });
      setError((current) => {
        if (!current) return current;
        return current.includes("запис") || current.includes("Запуск") ? null : current;
      });
    } catch (error) {
      setStatus("idle");
      setNotice({
        tone: "error",
        message: formatServerRecordingError(error),
      });
    } finally {
      activeRequestRef.current = null;
    }
  }, [applyRecordingState, canAccessRecording, canRecord, sessionId, setError]);

  const stopRecording = useCallback(async () => {
    if (!sessionId || activeRequestRef.current) return;
    const recordingId = recording?.id ?? null;
    activeRequestRef.current = "stop";
    setStatus("stopping");
    try {
      const response = await stopWorkbookLessonRecording(sessionId, recordingId);
      applyRecordingState(response.recording);
      setNotice({
        tone: "success",
        message: response.recording?.status === "ready" && response.recording.outputUrl
          ? "Запись остановлена. Файл готов к просмотру."
          : "Запись остановлена. Сервер завершает подготовку видеофайла.",
      });
    } catch (error) {
      setStatus(toClientStatus(recording));
      setNotice({
        tone: "error",
        message: formatServerRecordingError(error),
      });
    } finally {
      activeRequestRef.current = null;
    }
  }, [applyRecordingState, recording, sessionId]);

  const openPreStartDialog = useCallback(() => {
    if (!canAccessRecording) {
      setError(
        "Запуск записи доступен преподавателю класса или владельцу личной тетради."
      );
      return;
    }
    if (!canRecord) {
      setError("Сейчас запись недоступна.");
      return;
    }
    if (!isSupported) {
      setError("Серверная запись сейчас недоступна.");
      return;
    }
    if (statusRef.current !== "idle") return;
    setNotice(null);
    setPreStartDialogOpen(true);
  }, [canAccessRecording, canRecord, isSupported, setError]);

  const closePreStartDialog = useCallback(() => {
    if (statusRef.current === "starting") return;
    setPreStartDialogOpen(false);
  }, []);

  const closeNotice = useCallback(() => {
    setNotice(null);
  }, []);

  useEffect(() => {
    void refreshRecordingStatus();
  }, [refreshRecordingStatus]);

  useEffect(() => {
    if (!sessionId || !canAccessRecording) return;
    const active = recording ? ACTIVE_SERVER_STATUSES.has(recording.status) : false;
    const interval = window.setInterval(
      () => {
        void refreshRecordingStatus();
      },
      active ? POLL_ACTIVE_RECORDING_MS : POLL_IDLE_RECORDING_MS
    );
    return () => window.clearInterval(interval);
  }, [canAccessRecording, recording, refreshRecordingStatus, sessionId]);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = window.setInterval(() => {
      setElapsedMs(resolveElapsedMs(recording));
    }, 500);
    return () => window.clearInterval(timer);
  }, [recording, status]);

  useEffect(() => {
    if (!canRecord && status === "recording") {
      setNotice({
        tone: "warning",
        message:
          "Права на запись изменились. Остановите серверную запись вручную или завершите занятие.",
      });
    }
  }, [canRecord, status]);

  const canShowControls = canAccessRecording;
  const outputUrl = recording?.outputUrl ?? null;

  return useMemo(
    () => ({
      status,
      elapsedMs,
      notice,
      preStartDialogOpen,
      outputUrl,
      isSupported,
      canShowControls,
      openPreStartDialog,
      closePreStartDialog,
      startRecording,
      stopRecording,
      closeNotice,
    }),
    [
      canShowControls,
      closeNotice,
      closePreStartDialog,
      elapsedMs,
      isSupported,
      notice,
      openPreStartDialog,
      outputUrl,
      preStartDialogOpen,
      startRecording,
      status,
      stopRecording,
    ]
  );
};
