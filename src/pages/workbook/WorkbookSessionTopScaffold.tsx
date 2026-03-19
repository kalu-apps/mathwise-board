import type {
  ChangeEventHandler,
  MutableRefObject,
} from "react";
import {
  Alert,
  Button,
  Chip,
  IconButton,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import type { WorkbookSession } from "@/features/workbook/model/types";

interface WorkbookSessionTopScaffoldProps {
  boardFileInputRef: MutableRefObject<HTMLInputElement | null>;
  docsInputRef: MutableRefObject<HTMLInputElement | null>;
  onLoadBoardFile: ChangeEventHandler<HTMLInputElement>;
  onDocsUpload: ChangeEventHandler<HTMLInputElement>;
  sessionHeadRef: MutableRefObject<HTMLElement | null>;
  session: WorkbookSession;
  onBack: () => Promise<void> | void;
  canManageSession: boolean;
  copyingInviteLink: boolean;
  onCopyInviteLink: () => Promise<void> | void;
  error: string | null;
  setError: (value: string | null) => void;
  saveSyncWarning: string | null;
  setSaveSyncWarning: (value: string | null) => void;
  realtimeSyncWarning: string | null;
  setRealtimeSyncWarning: (value: string | null) => void;
  isFullscreen: boolean;
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
  sessionHeadRef,
  session,
  onBack,
  canManageSession,
  copyingInviteLink,
  onCopyInviteLink,
  error,
  setError,
  saveSyncWarning,
  setSaveSyncWarning,
  realtimeSyncWarning,
  setRealtimeSyncWarning,
  isFullscreen,
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

      <header className="workbook-session__head" ref={sessionHeadRef}>
        <div className="workbook-session__head-main">
          <IconButton
            className="workbook-session__back"
            onClick={() => void onBack()}
            aria-label="Назад"
          >
            <ArrowBackRoundedIcon />
          </IconButton>
          <div>
            <div className="workbook-session__head-meta">
              <Chip
                size="small"
                label={session.kind === "CLASS" ? "Индивидуальное занятие" : "Личная тетрадь"}
              />
              {session.status === "ended" ? (
                <Chip size="small" label="Завершено" color="default" />
              ) : null}
            </div>
          </div>
        </div>
        <div className="workbook-session__head-actions">
          {canManageSession && session.kind === "CLASS" ? (
            <Button
              variant="outlined"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => void onCopyInviteLink()}
              disabled={copyingInviteLink}
            >
              {copyingInviteLink ? "Копируем..." : "Скопировать ссылку приглашения"}
            </Button>
          ) : null}
        </div>
      </header>

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
        <Alert
          severity="warning"
          onClose={() => setSaveSyncWarning(null)}
          className={`workbook-session__alert${
            isFullscreen ? " workbook-session__alert--floating" : ""
          }`}
        >
          {saveSyncWarning}
        </Alert>
      ) : null}

      {realtimeSyncWarning ? (
        <Alert
          severity="warning"
          onClose={() => setRealtimeSyncWarning(null)}
          className={`workbook-session__alert${
            isFullscreen ? " workbook-session__alert--floating" : ""
          }`}
        >
          {realtimeSyncWarning}
        </Alert>
      ) : null}

      {pendingClearRequest &&
      pendingClearRequest.authorUserId !== currentUserId &&
      session.status !== "ended" ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void onConfirmClear()}>
              Подтвердить
            </Button>
          }
        >
          Учитель запросил очистку слоя. Подтвердите, чтобы выполнить действие.
        </Alert>
      ) : null}

      {awaitingClearRequest ? (
        <Alert severity="info">
          Ожидаем подтверждение второго участника на очистку слоя.
        </Alert>
      ) : null}
    </>
  );
}
