import { Alert, Snackbar } from "@mui/material";
import { PlatformConfirmDialog } from "@/shared/ui/PlatformConfirmDialog";
import type { LessonRecordingNotice } from "../model/lessonRecordingTypes";

type WorkbookLessonRecordingDialogsProps = {
  overlayContainer?: Element | null;
  isCompactDialogViewport: boolean;
  preStartDialogOpen: boolean;
  isStarting: boolean;
  onClosePreStartDialog: () => void;
  onConfirmPreStartDialog: () => void;
  notice: LessonRecordingNotice | null;
  onCloseNotice: () => void;
};

export function WorkbookLessonRecordingDialogs({
  overlayContainer,
  isCompactDialogViewport,
  preStartDialogOpen,
  isStarting,
  onClosePreStartDialog,
  onConfirmPreStartDialog,
  notice,
  onCloseNotice,
}: WorkbookLessonRecordingDialogsProps) {
  return (
    <>
      <PlatformConfirmDialog
        open={preStartDialogOpen}
        container={overlayContainer}
        fullScreen={isCompactDialogViewport}
        loading={isStarting}
        title="Запись урока"
        description="После старта браузер попросит выбрать вкладку/окно для захвата."
        confirmLabel="Начать запись"
        cancelLabel="Отмена"
        tone="warning"
        content={
          <div className="workbook-session__recording-prestart">
            <p>
              Будет записано видео урока в высоком качестве. После остановки файл
              автоматически сохранится на устройство.
            </p>
            <ul>
              <li>Запись доступна только преподавателю.</li>
              <li>Записывается происходящее на доске и доступный аудиоконтур.</li>
              <li>В сохраненное видео добавляется подпись: «Автор: Калугина Анна Викторовна».</li>
            </ul>
          </div>
        }
        onCancel={onClosePreStartDialog}
        onConfirm={onConfirmPreStartDialog}
      />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={notice?.tone === "error" ? 7_000 : 4_500}
        onClose={onCloseNotice}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={notice?.tone === "warning" ? "warning" : notice?.tone === "error" ? "error" : notice?.tone === "info" ? "info" : "success"}
          onClose={onCloseNotice}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notice?.message ?? ""}
        </Alert>
      </Snackbar>
    </>
  );
}
