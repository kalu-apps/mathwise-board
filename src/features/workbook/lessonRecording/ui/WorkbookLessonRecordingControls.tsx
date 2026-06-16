import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import type { LessonRecordingStatus } from "../model/lessonRecordingTypes";

type WorkbookLessonRecordingControlsProps = {
  status: LessonRecordingStatus;
  elapsedMs: number;
  isSupported: boolean;
  outputUrl?: string | null;
  onRequestStart: () => void;
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

export function WorkbookLessonRecordingControls({
  status,
  elapsedMs,
  isSupported,
  outputUrl,
  onRequestStart,
  onStop,
}: WorkbookLessonRecordingControlsProps) {
  if (!isSupported) {
    return (
      <div className="workbook-session__recording-cluster">
        <Tooltip title="Серверная запись не настроена" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording"
              disabled
              aria-label="Серверная запись недоступна"
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
        <Tooltip title={outputUrl ? "Записать новый урок" : "Записать урок"} placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording workbook-session__toolbar-icon--recording-idle"
              onClick={onRequestStart}
              aria-label="Начать серверную запись урока"
            >
              <FiberManualRecordRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </div>
    );
  }

  if (status === "starting" || status === "stopping" || status === "processing") {
    const label =
      status === "starting"
        ? "Запуск..."
        : status === "stopping"
          ? "Остановка..."
          : "Подготовка файла...";
    return (
      <div className={`workbook-session__recording-cluster is-${status}`}>
        <span
          className="workbook-session__recording-timer is-pending"
          aria-live="polite"
        >
          {label}
        </span>
        <span className="workbook-session__recording-spinner" aria-hidden="true">
          <CircularProgress size={16} thickness={5} />
        </span>
      </div>
    );
  }

  return (
    <div className="workbook-session__recording-cluster is-recording">
      <span className="workbook-session__recording-timer" aria-live="polite">
        REC · {formatDuration(elapsedMs)}
      </span>
      <Tooltip title="Остановить запись" placement="bottom" arrow>
        <span>
          <IconButton
            size="small"
            className="workbook-session__toolbar-icon workbook-session__toolbar-icon--recording-stop"
            onClick={onStop}
            aria-label="Остановить серверную запись"
          >
            <StopRoundedIcon />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  );
}
