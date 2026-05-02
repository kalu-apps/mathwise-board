import type {
  ChangeEventHandler,
  MutableRefObject,
  SyntheticEvent,
} from "react";
import {
  useEffect,
  useState,
} from "react";
import {
  Alert,
  Button,
  Fade,
  Snackbar,
} from "@mui/material";

const REALTIME_WARNING_SHOW_DELAY_MS = 1_500;
const SYNC_NOTICE_AUTO_HIDE_MS = 8_500;

interface WorkbookSessionTopScaffoldProps {
  boardFileInputRef: MutableRefObject<HTMLInputElement | null>;
  docsInputRef: MutableRefObject<HTMLInputElement | null>;
  onLoadBoardFile: ChangeEventHandler<HTMLInputElement>;
  onDocsUpload: ChangeEventHandler<HTMLInputElement>;
  error: string | null;
  setError: (value: string | null) => void;
  saveSyncWarning: string | null;
  setSaveSyncWarning: (value: string | null) => void;
  realtimeSyncWarning: string | null;
  setRealtimeSyncWarning: (value: string | null) => void;
  isFullscreen: boolean;
  isEnded: boolean;
  pendingClearRequest: {
    authorUserId: string;
  } | null;
  currentUserId?: string;
  onConfirmClear: () => Promise<void> | void;
  awaitingClearRequest: boolean;
}

export function WorkbookSessionTopScaffold({
  boardFileInputRef,
  docsInputRef,
  onLoadBoardFile,
  onDocsUpload,
  error,
  setError,
  saveSyncWarning,
  setSaveSyncWarning,
  realtimeSyncWarning,
  setRealtimeSyncWarning,
  isFullscreen,
  isEnded,
  pendingClearRequest,
  currentUserId,
  onConfirmClear,
  awaitingClearRequest,
}: WorkbookSessionTopScaffoldProps) {
  return (
    <>
      <input
        ref={boardFileInputRef}
        type="file"
        accept=".json,.mwb"
        className="workbook-session__file-input"
        onChange={onLoadBoardFile}
      />
      <input
        ref={docsInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="workbook-session__file-input"
        onChange={onDocsUpload}
      />

      {error ? (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          className={`workbook-session__alert${
            isFullscreen ? " workbook-session__alert--floating" : ""
          }`}
        >
          {error}
        </Alert>
      ) : null}

      {saveSyncWarning ? (
        <WorkbookSyncNoticeSnackbar
          key={`save-${saveSyncWarning}`}
          message={saveSyncWarning}
          onClose={() => setSaveSyncWarning(null)}
        />
      ) : realtimeSyncWarning ? (
        <WorkbookSyncNoticeSnackbar
          key={`realtime-${realtimeSyncWarning}`}
          message={realtimeSyncWarning}
          showDelayMs={REALTIME_WARNING_SHOW_DELAY_MS}
          onClose={() => setRealtimeSyncWarning(null)}
        />
      ) : null}

      {pendingClearRequest &&
      pendingClearRequest.authorUserId !== currentUserId &&
      !isEnded ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void onConfirmClear()}>
              Подтвердить
            </Button>
          }
        >
          Учитель запросил очистку страницы. Подтвердите, чтобы выполнить действие.
        </Alert>
      ) : null}

      {awaitingClearRequest ? (
        <Alert severity="info">
          Ожидаем подтверждение второго участника на очистку страницы.
        </Alert>
      ) : null}
    </>
  );
}

function WorkbookSyncNoticeSnackbar({
  message,
  showDelayMs = 0,
  onClose,
}: {
  message: string;
  showDelayMs?: number;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(showDelayMs <= 0);

  useEffect(() => {
    if (showDelayMs <= 0) return undefined;
    const timerId = window.setTimeout(() => {
      setOpen(true);
    }, showDelayMs);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [showDelayMs]);

  const handleClose = (_event?: Event | SyntheticEvent, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
    onClose();
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={SYNC_NOTICE_AUTO_HIDE_MS}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      TransitionComponent={Fade}
    >
      <Alert
        severity="warning"
        className="workbook-session__alert workbook-session__alert--toast"
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
