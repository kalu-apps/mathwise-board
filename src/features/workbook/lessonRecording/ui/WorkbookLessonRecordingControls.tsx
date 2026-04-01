import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import type { LessonRecordingAudioSummary, LessonRecordingStatus } from "../model/lessonRecordingTypes";

type WorkbookLessonRecordingControlsProps = {
  status: LessonRecordingStatus;
  elapsedMs: number;
  isSupported: boolean;
  audioSummary: LessonRecordingAudioSummary;
  onRequestStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

const formatDuration = (valueMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const resolveMicrophoneTooltip = (summary: LessonRecordingAudioSummary) => {
  if (summary.hasDisplayAudio && summary.hasMicrophoneAudio) {
    return "Аудио: вкладка + микрофон";
  }
  if (summary.hasDisplayAudio) return "Аудио: только вкладка";
  if (summary.hasMicrophoneAudio) return "Аудио: только микрофон";
  return "Аудио не захватывается";
};

export function WorkbookLessonRecordingControls({
  status,
  elapsedMs,
  isSupported,
  audioSummary,
  onRequestStart,
  onPause,
  onResume,
  onStop,
}: WorkbookLessonRecordingControlsProps) {
  if (!isSupported) {
    return (
      <div className="workbook-session__recording-cluster">
        <Tooltip title="Браузер не поддерживает запись урока" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording"
              disabled
              aria-label="Запись урока недоступна в этом браузере"
            >
              <VideocamOffRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </div>
    );
  }

  if (status === "idle") {
    return (
      <div className="workbook-session__recording-cluster is-idle">
        <Tooltip title="Записать урок" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording"
              onClick={onRequestStart}
              aria-label="Начать запись урока"
            >
              <FiberManualRecordRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </div>
    );
  }

  if (status === "starting" || status === "stopping") {
    return (
      <div className={`workbook-session__recording-cluster is-${status}`}>
        <span
          className="workbook-session__recording-timer is-pending"
          aria-live="polite"
        >
          {status === "starting" ? "Подготовка..." : "Сохранение..."}
        </span>
        <span className="workbook-session__recording-spinner" aria-hidden="true">
          <CircularProgress size={16} thickness={5} />
        </span>
      </div>
    );
  }

  const isPaused = status === "paused";

  return (
    <div className={`workbook-session__recording-cluster ${isPaused ? "is-paused" : "is-recording"}`}>
      <span
        className={`workbook-session__recording-timer ${isPaused ? "is-paused" : ""}`}
        aria-live="polite"
      >
        {isPaused ? "Пауза" : "REC"} · {formatDuration(elapsedMs)}
      </span>
      <Tooltip title={resolveMicrophoneTooltip(audioSummary)} placement="bottom" arrow>
        <span>
          <IconButton
            size="small"
            className={`workbook-session__toolbar-icon workbook-session__toolbar-icon--recording-mic ${
              audioSummary.hasDisplayAudio || audioSummary.hasMicrophoneAudio
                ? "is-audio-on"
                : "is-audio-off"
            }`}
            disabled
            aria-label={resolveMicrophoneTooltip(audioSummary)}
          >
            {audioSummary.hasDisplayAudio || audioSummary.hasMicrophoneAudio ? (
              <MicRoundedIcon />
            ) : (
              <MicOffRoundedIcon />
            )}
          </IconButton>
        </span>
      </Tooltip>
      {isPaused ? (
        <Tooltip title="Продолжить запись" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording"
              onClick={onResume}
              aria-label="Продолжить запись"
            >
              <PlayArrowRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Tooltip title="Пауза записи" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording"
              onClick={onPause}
              aria-label="Поставить запись на паузу"
            >
              <PauseRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Tooltip title="Остановить запись" placement="bottom" arrow>
        <span>
          <IconButton
            size="small"
            className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording-stop"
            onClick={onStop}
            aria-label="Остановить запись и сохранить видео"
          >
            <StopRoundedIcon />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  );
}
