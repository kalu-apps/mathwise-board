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
        description="Запись будет запущена на сервере: браузер преподавателя не захватывает экран и не кодирует видеофайл."
        confirmLabel="Начать запись"
        cancelLabel="Отмена"
        tone="warning"
        content={
          <div className="workbook-session__recording-prestart">
            <p>
              Сервер откроет чистый вид доски и запишет только рабочую область занятия.
            </p>
            <ul>
              <li>Запись доступна преподавателю класса и в личной тетради владельцу.</li>
              <li>Панели инструментов, настроек, чат и служебные уведомления не попадают в видео.</li>
              <li>Нагрузка записи переносится с устройства преподавателя на серверный recorder.</li>
              <li>После остановки сервер завершит подготовку файла в хранилище записей.</li>
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
