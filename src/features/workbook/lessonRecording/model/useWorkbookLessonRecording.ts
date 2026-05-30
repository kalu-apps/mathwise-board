import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { mixLessonRecordingAudio } from "./lessonRecordingAudio";
import {
  createLessonRecordingChunkStore,
  type LessonRecordingChunkStore,
} from "./lessonRecordingChunkStore";
import { buildLessonRecordingFileName, triggerLessonRecordingDownload } from "./lessonRecordingFile";
import { resolveLessonRecordingProfile } from "./lessonRecordingQuality";
import type {
  LessonRecordingAudioSummary,
  LessonRecordingNotice,
  LessonRecordingStatus,
} from "./lessonRecordingTypes";

type DisplayMediaWithHints = MediaStreamConstraints & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
};

type UseWorkbookLessonRecordingParams = {
  canAccessRecording: boolean;
  canRecord: boolean;
  canUseMedia: boolean;
  micEnabled: boolean;
  setMicEnabled: (next: SetStateAction<boolean>) => void;
  sessionTitle?: string | null;
  setError: (
    updater: string | null | ((current: string | null) => string | null)
  ) => void;
};

type LessonRecordingRuntime = {
  displayStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  recorderStream: MediaStream | null;
  mixedAudioCleanup: (() => void) | null;
  setMixedMicrophoneEnabled: ((enabled: boolean) => void) | null;
  videoWatermarkCleanup: (() => void) | null;
  displayVideoTrack: MediaStreamTrack | null;
  displayEndedHandler: (() => void) | null;
  extension: "webm" | "mp4";
  mimeType: string;
  audioSummary: LessonRecordingAudioSummary;
};

const INITIAL_AUDIO_SUMMARY: LessonRecordingAudioSummary = {
  hasDisplayAudio: false,
  hasMicrophoneAudio: false,
};

const LESSON_RECORDING_MAX_WIDTH = 1920;
const LESSON_RECORDING_MAX_HEIGHT = 1080;
const LESSON_RECORDING_MAX_FRAME_RATE = 30;

const isLessonRecordingSupported = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getDisplayMedia) &&
  typeof MediaRecorder !== "undefined";

const constrainLessonRecordingVideoTrack = async (track: MediaStreamTrack) => {
  if (typeof track.applyConstraints !== "function") return;
  try {
    await track.applyConstraints({
      width: { max: LESSON_RECORDING_MAX_WIDTH },
      height: { max: LESSON_RECORDING_MAX_HEIGHT },
      frameRate: { max: LESSON_RECORDING_MAX_FRAME_RATE },
    });
  } catch {
    // Capture constraints are browser- and source-dependent; recording can proceed safely.
  }
};

const resolveNowElapsedMs = (params: {
  status: LessonRecordingStatus;
  elapsedBeforePauseMs: number;
  startedAtMs: number | null;
}) => {
  const { status, elapsedBeforePauseMs, startedAtMs } = params;
  if (status !== "recording") return elapsedBeforePauseMs;
  if (!startedAtMs) return elapsedBeforePauseMs;
  return elapsedBeforePauseMs + Math.max(0, Date.now() - startedAtMs);
};

export const useWorkbookLessonRecording = ({
  canAccessRecording,
  canRecord,
  canUseMedia,
  micEnabled,
  setMicEnabled,
  sessionTitle,
  setError,
}: UseWorkbookLessonRecordingParams) => {
  const [status, setStatus] = useState<LessonRecordingStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [preStartDialogOpen, setPreStartDialogOpen] = useState(false);
  const [notice, setNotice] = useState<LessonRecordingNotice | null>(null);
  const [audioSummary, setAudioSummary] = useState<LessonRecordingAudioSummary>(
    INITIAL_AUDIO_SUMMARY
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkStoreRef = useRef<LessonRecordingChunkStore | null>(null);
  const chunkWritePromisesRef = useRef<Set<Promise<void>>>(new Set());
  const runtimeRef = useRef<LessonRecordingRuntime>({
    displayStream: null,
    microphoneStream: null,
    recorderStream: null,
    mixedAudioCleanup: null,
    setMixedMicrophoneEnabled: null,
    videoWatermarkCleanup: null,
    displayVideoTrack: null,
    displayEndedHandler: null,
    extension: "webm",
    mimeType: "video/webm",
    audioSummary: INITIAL_AUDIO_SUMMARY,
  });
  const startedAtMsRef = useRef<number | null>(null);
  const elapsedBeforePauseMsRef = useRef(0);
  const statusRef = useRef<LessonRecordingStatus>("idle");
  const isFinalizingRef = useRef(false);
  const stopReasonRef = useRef<"stopped" | "interrupted" | "error">("stopped");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const cleanupRuntimeResources = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.displayVideoTrack && runtime.displayEndedHandler) {
      runtime.displayVideoTrack.removeEventListener("ended", runtime.displayEndedHandler);
    }
    if (runtime.mixedAudioCleanup) {
      runtime.mixedAudioCleanup();
    }
    if (runtime.videoWatermarkCleanup) {
      runtime.videoWatermarkCleanup();
    }

    const trackSet = new Set<MediaStreamTrack>();
    [runtime.displayStream, runtime.microphoneStream, runtime.recorderStream].forEach((stream) => {
      stream?.getTracks().forEach((track) => trackSet.add(track));
    });
    trackSet.forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore cleanup failures
      }
    });

    runtimeRef.current = {
      displayStream: null,
      microphoneStream: null,
      recorderStream: null,
      mixedAudioCleanup: null,
      setMixedMicrophoneEnabled: null,
      videoWatermarkCleanup: null,
      displayVideoTrack: null,
      displayEndedHandler: null,
      extension: "webm",
      mimeType: "video/webm",
      audioSummary: INITIAL_AUDIO_SUMMARY,
    };
  }, []);

  const waitForPendingChunkWrites = useCallback(async () => {
    const pendingWrites = Array.from(chunkWritePromisesRef.current);
    if (pendingWrites.length === 0) return;
    await Promise.allSettled(pendingWrites);
  }, []);

  const finalizeRecording = useCallback(
    async (options?: { reason?: "stopped" | "interrupted" | "error"; errorMessage?: string }) => {
      if (isFinalizingRef.current) return;
      isFinalizingRef.current = true;
      const chunkStore = chunkStoreRef.current;
      try {
        await waitForPendingChunkWrites();
        const runtime = runtimeRef.current;
        const blobType = runtime.mimeType || "video/webm";
        const blob = chunkStore ? await chunkStore.buildBlob(blobType) : null;

        if (blob && blob.size > 0) {
          const fileName = buildLessonRecordingFileName({
            sessionTitle,
            extension: runtime.extension,
          });
          triggerLessonRecordingDownload(blob, fileName);
          if (options?.reason === "interrupted") {
            setNotice({
              tone: "warning",
              message:
                "Запись была прервана, но частичный файл сохранен на устройство.",
            });
          } else if (options?.reason === "error") {
            setNotice({
              tone: "warning",
              message:
                "Запись завершилась с ошибкой, но файл был сохранен на устройство.",
            });
          } else {
            setNotice({
              tone: "success",
              message: `Запись сохранена: ${fileName}`,
            });
          }
        } else if (options?.reason !== "stopped") {
          setNotice({
            tone: "error",
            message: options?.errorMessage || "Не удалось сохранить видеофайл записи.",
          });
        } else {
          setNotice({
            tone: "error",
            message:
              "Запись остановлена, но файл не был сформирован. Повторите попытку.",
          });
        }
      } catch {
        setNotice({
          tone: "error",
          message: "Не удалось завершить запись и сохранить файл.",
        });
      } finally {
        chunkWritePromisesRef.current.clear();
        await chunkStore?.clear().catch(() => undefined);
        chunkStoreRef.current = null;
        recorderRef.current = null;
        cleanupRuntimeResources();
        elapsedBeforePauseMsRef.current = 0;
        startedAtMsRef.current = null;
        setElapsedMs(0);
        setStatus("idle");
        setAudioSummary(INITIAL_AUDIO_SUMMARY);
        isFinalizingRef.current = false;
      }
    },
    [cleanupRuntimeResources, sessionTitle, waitForPendingChunkWrites]
  );

  const stopRecording = useCallback(
    (reason: "stopped" | "interrupted" | "error" = "stopped", errorMessage?: string) => {
      stopReasonRef.current = reason;
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        void finalizeRecording({ reason, errorMessage });
        return;
      }
      setStatus("stopping");
      try {
        recorder.stop();
      } catch {
        void finalizeRecording({
          reason: "error",
          errorMessage: "Не удалось корректно остановить запись.",
        });
      }
    },
    [finalizeRecording]
  );

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
    if (!isLessonRecordingSupported()) {
      setError("Ваш браузер не поддерживает запись урока в этом режиме.");
      return;
    }
    if (statusRef.current !== "idle") return;
    setNotice(null);
    setStatus("starting");
    setPreStartDialogOpen(false);

    const displayOptions: DisplayMediaWithHints = {
      video: {
        frameRate: {
          ideal: LESSON_RECORDING_MAX_FRAME_RATE,
          max: LESSON_RECORDING_MAX_FRAME_RATE,
        },
        width: {
          ideal: LESSON_RECORDING_MAX_WIDTH,
          max: LESSON_RECORDING_MAX_WIDTH,
        },
        height: {
          ideal: LESSON_RECORDING_MAX_HEIGHT,
          max: LESSON_RECORDING_MAX_HEIGHT,
        },
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      systemAudio: "include",
      monitorTypeSurfaces: "include",
    };

    let displayStream: MediaStream | null = null;
    let microphoneStream: MediaStream | null = null;
    let mixedAudioCleanup: (() => void) | null = null;
    let setMixedMicrophoneEnabled: ((enabled: boolean) => void) | null = null;
    let videoWatermarkCleanup: (() => void) | null = null;

    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia(
        displayOptions as MediaStreamConstraints
      );
    } catch (reason) {
      setStatus("idle");
      if (
        reason instanceof DOMException &&
        (reason.name === "NotAllowedError" || reason.name === "AbortError")
      ) {
        setNotice({
          tone: "info",
          message: "Запись отменена: источник захвата не был выбран.",
        });
        return;
      }
      setError("Не удалось запустить захват экрана/вкладки для записи.");
      return;
    }

    const displayVideoTrack = displayStream.getVideoTracks()[0] ?? null;
    if (!displayVideoTrack) {
      displayStream.getTracks().forEach((track) => track.stop());
      setStatus("idle");
      setError("Не удалось получить видеопоток для записи урока.");
      return;
    }
    await constrainLessonRecordingVideoTrack(displayVideoTrack);

    if (canUseMedia) {
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch {
        setNotice({
          tone: "warning",
          message:
            "Микрофон недоступен для записи. Будет использовано только доступное аудио вкладки.",
        });
      }
    }

    const recorderStream = new MediaStream();
    const recorderVideoTrack = displayVideoTrack.clone();
    videoWatermarkCleanup = () => {
      try {
        recorderVideoTrack.stop();
      } catch {
        // ignore cleanup failures
      }
    };
    recorderStream.addTrack(recorderVideoTrack);

    const hasMicrophoneTrack = Boolean(microphoneStream?.getAudioTracks()[0]);
    const shouldEnableMicrophone = hasMicrophoneTrack;
    if (hasMicrophoneTrack) {
      microphoneStream?.getAudioTracks().forEach((track) => {
        track.enabled = shouldEnableMicrophone;
      });
      if (!micEnabled) {
        setMicEnabled(true);
      }
    }

    let resolvedAudioSummary = INITIAL_AUDIO_SUMMARY;
    try {
      const mixedAudio = await mixLessonRecordingAudio({
        displayStream,
        microphoneStream,
        microphoneEnabled: shouldEnableMicrophone,
      });
      if (mixedAudio?.track) {
        recorderStream.addTrack(mixedAudio.track);
        mixedAudioCleanup = mixedAudio.cleanup;
        setMixedMicrophoneEnabled = mixedAudio.setMicrophoneEnabled ?? null;
        resolvedAudioSummary = mixedAudio.summary;
      }
    } catch {
      setNotice({
        tone: "warning",
        message:
          "Не удалось смешать аудио-источники. Видео будет сохранено без общего микса.",
      });
    }

    const profile = resolveLessonRecordingProfile(displayVideoTrack);
    const options: MediaRecorderOptions = {
      mimeType: profile.mimeType,
      videoBitsPerSecond: profile.videoBitsPerSecond,
      audioBitsPerSecond: profile.audioBitsPerSecond,
    };

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(recorderStream, options);
    } catch {
      cleanupRuntimeResources();
      displayStream.getTracks().forEach((track) => track.stop());
      microphoneStream?.getTracks().forEach((track) => track.stop());
      recorderStream.getTracks().forEach((track) => track.stop());
      setStatus("idle");
      setError("Браузер не смог создать recorder для выбранного источника.");
      return;
    }

    const chunkStore = await createLessonRecordingChunkStore();
    chunkStoreRef.current = chunkStore;
    chunkWritePromisesRef.current.clear();
    recorder.ondataavailable = (event) => {
      if (!(event.data instanceof Blob) || event.data.size <= 0) return;
      const writePromise = chunkStore.append(event.data);
      chunkWritePromisesRef.current.add(writePromise);
      void writePromise.finally(() => {
        chunkWritePromisesRef.current.delete(writePromise);
      });
    };
    recorder.onerror = () => {
      stopRecording("error", "Запись прервана из-за ошибки браузера.");
    };
    recorder.onstop = () => {
      const reason =
        statusRef.current === "stopping"
          ? stopReasonRef.current
          : "interrupted";
      void finalizeRecording({ reason });
    };

    const onDisplayEnded = () => {
      setNotice({
        tone: "warning",
        message:
          "Захват источника завершен. Запись остановлена и будет сохранена.",
      });
      stopRecording("interrupted");
    };
    displayVideoTrack.addEventListener("ended", onDisplayEnded);

    runtimeRef.current = {
      displayStream,
      microphoneStream,
      recorderStream,
      mixedAudioCleanup,
      setMixedMicrophoneEnabled,
      videoWatermarkCleanup,
      displayVideoTrack,
      displayEndedHandler: onDisplayEnded,
      extension: profile.extension,
      mimeType: profile.mimeType,
      audioSummary: resolvedAudioSummary,
    };

    setAudioSummary(resolvedAudioSummary);
    if (!resolvedAudioSummary.hasDisplayAudio && !resolvedAudioSummary.hasMicrophoneAudio) {
      setNotice({
        tone: "warning",
        message:
          "Запись начата без аудио. Проверьте, что для вкладки включен захват звука и доступ к микрофону.",
      });
    } else if (!resolvedAudioSummary.hasDisplayAudio) {
      setNotice({
        tone: "warning",
        message:
          "Для записи голосов всех участников выбирайте вкладку с опцией «Поделиться аудио».",
      });
    }
    try {
      recorder.start(1_000);
    } catch {
      void chunkStore.clear().catch(() => undefined);
      chunkStoreRef.current = null;
      chunkWritePromisesRef.current.clear();
      cleanupRuntimeResources();
      setStatus("idle");
      setError("Не удалось начать запись.");
      return;
    }

    recorderRef.current = recorder;
    elapsedBeforePauseMsRef.current = 0;
    startedAtMsRef.current = Date.now();
    setElapsedMs(0);
    setStatus("recording");
    setError((current) => {
      if (!current) return current;
      if (current.includes("Запуск записи") || current.includes("запись")) return null;
      return current;
    });
  }, [
    canAccessRecording,
    canRecord,
    canUseMedia,
    cleanupRuntimeResources,
    finalizeRecording,
    micEnabled,
    setError,
    setMicEnabled,
    stopRecording,
  ]);

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
    if (!isLessonRecordingSupported()) {
      setError("Ваш браузер не поддерживает запись урока в этом режиме.");
      return;
    }
    if (statusRef.current !== "idle") return;
    setNotice(null);
    setPreStartDialogOpen(true);
  }, [canAccessRecording, canRecord, setError]);

  const closePreStartDialog = useCallback(() => {
    if (statusRef.current === "starting") return;
    setPreStartDialogOpen(false);
  }, []);

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    const resolvedElapsed = resolveNowElapsedMs({
      status: "recording",
      elapsedBeforePauseMs: elapsedBeforePauseMsRef.current,
      startedAtMs: startedAtMsRef.current,
    });
    elapsedBeforePauseMsRef.current = resolvedElapsed;
    startedAtMsRef.current = null;
    setElapsedMs(resolvedElapsed);
    try {
      recorder.pause();
      setStatus("paused");
    } catch {
      setError("Не удалось поставить запись на паузу.");
    }
  }, [setError]);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    startedAtMsRef.current = Date.now();
    try {
      recorder.resume();
      setStatus("recording");
    } catch {
      setError("Не удалось возобновить запись.");
    }
  }, [setError]);

  const closeNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (!canUseMedia) {
      setError("Микрофон недоступен для текущего участника.");
      return;
    }
    setMicEnabled((current) => !current);
  }, [canUseMedia, setError, setMicEnabled]);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = window.setInterval(() => {
      const nextElapsed = resolveNowElapsedMs({
        status,
        elapsedBeforePauseMs: elapsedBeforePauseMsRef.current,
        startedAtMs: startedAtMsRef.current,
      });
      setElapsedMs(nextElapsed);
    }, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!canRecord && (status === "recording" || status === "paused")) {
      setNotice({
        tone: "warning",
        message:
          "Запись остановлена: текущий пользователь больше не может продолжать запись.",
      });
      stopRecording("interrupted");
    }
  }, [canRecord, status, stopRecording]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    runtime.microphoneStream?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
    runtime.setMixedMicrophoneEnabled?.(micEnabled);
  }, [micEnabled]);

  useEffect(() => {
    const isRecordingActive = status === "recording" || status === "paused" || status === "stopping";
    if (!isRecordingActive) return;
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, [status]);

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore cleanup failures
        }
      }
      cleanupRuntimeResources();
    },
    [cleanupRuntimeResources]
  );

  const isSupported = isLessonRecordingSupported();
  const canShowControls = canAccessRecording;
  const isRecordingActive = status === "recording" || status === "paused";
  const canToggleMicrophone = isRecordingActive && canUseMedia && audioSummary.hasMicrophoneAudio;

  return useMemo(
    () => ({
      status,
      elapsedMs,
      notice,
      preStartDialogOpen,
      audioSummary,
      isSupported,
      canShowControls,
      micEnabled,
      canToggleMicrophone,
      openPreStartDialog,
      closePreStartDialog,
      startRecording,
      pauseRecording,
      resumeRecording,
      toggleMicrophone,
      stopRecording,
      closeNotice,
    }),
    [
      audioSummary,
      canToggleMicrophone,
      canShowControls,
      closeNotice,
      closePreStartDialog,
      elapsedMs,
      isSupported,
      micEnabled,
      notice,
      openPreStartDialog,
      pauseRecording,
      preStartDialogOpen,
      resumeRecording,
      startRecording,
      status,
      toggleMicrophone,
      stopRecording,
    ]
  );
};
