import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

type WorkbookPdfImportPreviewModalProps = {
  open: boolean;
  file: File | null;
  container?: Element | null;
  initialRange?: {
    from: number;
    to: number;
  } | null;
  maxPagesPerImport?: number;
  onCancel: () => void;
  onConfirm: (range: { from: number; to: number }) => void;
};

const clampPageValue = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
};

export function WorkbookPdfImportPreviewModal({
  open,
  file,
  container,
  initialRange,
  maxPagesPerImport = 12,
  onCancel,
  onConfirm,
}: WorkbookPdfImportPreviewModalProps) {
  const [pageFrom, setPageFrom] = useState("1");
  const [pageTo, setPageTo] = useState("8");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!open || !file) return null;
    return URL.createObjectURL(file);
  }, [file, open]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) {
      setRangeError(null);
      return;
    }
    const from = clampPageValue(initialRange?.from ?? 1);
    const to = Math.max(from, clampPageValue(initialRange?.to ?? Math.max(8, from)));
    setPageFrom(String(from));
    setPageTo(String(to));
    setRangeError(null);
  }, [initialRange?.from, initialRange?.to, open]);

  const handleConfirm = useCallback(() => {
    const rawFrom = Number.parseInt(pageFrom, 10);
    const rawTo = Number.parseInt(pageTo, 10);
    if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo)) {
      setRangeError("Укажите корректный диапазон страниц.");
      return;
    }
    const from = clampPageValue(rawFrom);
    const to = clampPageValue(rawTo);
    if (to < from) {
      setRangeError("Конечная страница не может быть меньше начальной.");
      return;
    }
    const selectedPages = to - from + 1;
    if (selectedPages > maxPagesPerImport) {
      setRangeError(`За один импорт можно выбрать не более ${maxPagesPerImport} страниц.`);
      return;
    }
    setRangeError(null);
    onConfirm({ from, to });
  }, [maxPagesPerImport, onConfirm, pageFrom, pageTo]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      container={container}
      fullWidth
      maxWidth="xl"
      className="workbook-session__pdf-preview-modal"
      PaperProps={{ className: "workbook-session__pdf-preview-modal-paper" }}
    >
      <DialogTitle className="workbook-session__pdf-preview-modal-title">
        <span>Предпросмотр PDF перед импортом</span>
        <IconButton
          className="workbook-session__pdf-preview-modal-close"
          onClick={onCancel}
          aria-label="Закрыть окно предпросмотра PDF"
          size="small"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="workbook-session__pdf-preview-modal-content">
        <Alert severity="info" className="workbook-session__pdf-preview-modal-alert">
          Файл пока не загружен на доску. Проверьте содержимое и укажите страницы для импорта.
        </Alert>
        <div className="workbook-session__pdf-preview-frame-shell">
          {previewUrl ? (
            <iframe
              src={`${previewUrl}#view=FitH&toolbar=1&navpanes=0`}
              title={file?.name ?? "PDF preview"}
              className="workbook-session__pdf-preview-frame"
            />
          ) : (
            <div className="workbook-session__pdf-preview-fallback">
              Предпросмотр PDF недоступен в текущем браузере.
            </div>
          )}
        </div>
        <div className="workbook-session__pdf-preview-range-row">
          <TextField
            label="С страницы"
            size="small"
            type="number"
            value={pageFrom}
            onChange={(event) => setPageFrom(event.target.value)}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="По страницу"
            size="small"
            type="number"
            value={pageTo}
            onChange={(event) => setPageTo(event.target.value)}
            inputProps={{ min: 1 }}
          />
        </div>
        <p className="workbook-session__pdf-preview-hint">
          За один импорт допускается до {maxPagesPerImport} страниц. Если документ больше,
          загрузите следующий диапазон отдельным импортом.
        </p>
        {rangeError ? (
          <Alert severity="warning" className="workbook-session__pdf-preview-modal-alert">
            {rangeError}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleConfirm}>
          Применить диапазон
        </Button>
      </DialogActions>
    </Dialog>
  );
}
