import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { formatFileSizeMb } from "@/features/workbook/model/media";

type WorkbookPdfImportPreviewModalProps = {
  open: boolean;
  file: File | null;
  fileSizeBytes?: number | null;
  maxFileBytes?: number;
  pageCount: number | null;
  container?: Element | null;
  initialRange?: {
    from: number;
    to: number;
  } | null;
  maxPagesPerImport?: number;
  blockedReason?: string | null;
  isPreparing?: boolean;
  preparingMessage?: string;
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
  fileSizeBytes,
  maxFileBytes,
  pageCount,
  container,
  initialRange,
  maxPagesPerImport = 12,
  blockedReason,
  isPreparing = false,
  preparingMessage = "Подготавливаем PDF. Определяем количество страниц…",
  onCancel,
  onConfirm,
}: WorkbookPdfImportPreviewModalProps) {
  const normalizedMaxFileBytes = useMemo(
    () =>
      typeof maxFileBytes === "number" && Number.isFinite(maxFileBytes) && maxFileBytes > 0
        ? maxFileBytes
        : null,
    [maxFileBytes]
  );
  const normalizedFileSize = useMemo(
    () =>
      typeof fileSizeBytes === "number" && Number.isFinite(fileSizeBytes) && fileSizeBytes > 0
        ? fileSizeBytes
        : file?.size ?? null,
    [file?.size, fileSizeBytes]
  );
  const maxAvailablePage = useMemo(
    () => (pageCount && Number.isFinite(pageCount) ? Math.max(1, Math.trunc(pageCount)) : null),
    [pageCount]
  );
  const initialFrom = useMemo(() => clampPageValue(initialRange?.from ?? 1), [initialRange?.from]);
  const initialTo = useMemo(() => {
    const fallbackTo = Math.max(
      1,
      Math.min(maxPagesPerImport, maxAvailablePage ?? initialFrom)
    );
    const desiredTo = clampPageValue(initialRange?.to ?? fallbackTo);
    return maxAvailablePage ? Math.min(maxAvailablePage, Math.max(initialFrom, desiredTo)) : desiredTo;
  }, [initialFrom, initialRange?.to, maxAvailablePage, maxPagesPerImport]);
  const [pageFrom, setPageFrom] = useState(() => String(initialFrom));
  const [pageTo, setPageTo] = useState(() => String(initialTo));

  useEffect(() => {
    if (!open) return;
    const nextFrom = String(initialFrom);
    const nextTo = String(initialTo);
    setPageFrom((current) => (current === nextFrom ? current : nextFrom));
    setPageTo((current) => (current === nextTo ? current : nextTo));
  }, [initialFrom, initialTo, open]);

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

  const parseSafePage = useCallback((value: string) => {
    if (typeof value !== "string") return NaN;
    const sanitized = value.replace(/[^\d]/g, "");
    if (!sanitized) return NaN;
    return Number.parseInt(sanitized, 10);
  }, []);

  const validationState = useMemo(() => {
    if (isPreparing) {
      return {
        valid: false,
        error: null as string | null,
        warning: null as string | null,
        from: null as number | null,
        to: null as number | null,
      };
    }
    if (blockedReason && blockedReason.trim().length > 0) {
      return {
        valid: false,
        error: blockedReason,
        warning: null as string | null,
        from: null as number | null,
        to: null as number | null,
      };
    }
    const rawFrom = parseSafePage(pageFrom);
    const rawTo = parseSafePage(pageTo);
    if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo)) {
      return {
        valid: false,
        error: "Укажите корректный диапазон страниц.",
        warning: null as string | null,
        from: null as number | null,
        to: null as number | null,
      };
    }
    const from = clampPageValue(rawFrom);
    const to = clampPageValue(rawTo);
    if (to < from) {
      return {
        valid: false,
        error: "Конечная страница не может быть меньше начальной.",
        warning: null as string | null,
        from,
        to,
      };
    }
    if (maxAvailablePage && from > maxAvailablePage) {
      return {
        valid: false,
        error: `В документе только ${maxAvailablePage} стр.`,
        warning: null as string | null,
        from,
        to,
      };
    }
    if (maxAvailablePage && to > maxAvailablePage) {
      return {
        valid: false,
        error: `Нельзя выбрать страницу выше ${maxAvailablePage}.`,
        warning: null as string | null,
        from,
        to,
      };
    }
    const selectedPages = to - from + 1;
    if (selectedPages > maxPagesPerImport) {
      return {
        valid: false,
        error: `За один импорт можно выбрать не более ${maxPagesPerImport} страниц.`,
        warning: null as string | null,
        from,
        to,
      };
    }
    const estimatedRangeBytes =
      normalizedFileSize !== null && normalizedMaxFileBytes !== null && maxAvailablePage
        ? Math.max(
            1,
            Math.round((normalizedFileSize * (selectedPages / maxAvailablePage)) * 1.2)
          )
        : null;
    if (
      estimatedRangeBytes !== null &&
      normalizedMaxFileBytes !== null &&
      estimatedRangeBytes > normalizedMaxFileBytes
    ) {
      return {
        valid: false,
        error: `Выбранный диапазон ориентировочно весит ${formatFileSizeMb(
          estimatedRangeBytes
        )}, это выше лимита импорта ${formatFileSizeMb(
          normalizedMaxFileBytes
        )}. Уменьшите диапазон страниц.`,
        warning: null as string | null,
        from,
        to,
      };
    }
    let warning: string | null = null;
    if (
      estimatedRangeBytes !== null &&
      normalizedMaxFileBytes !== null &&
      estimatedRangeBytes > normalizedMaxFileBytes * 0.82
    ) {
      warning =
        `Диапазон близок к лимиту: ~${formatFileSizeMb(estimatedRangeBytes)} из ${formatFileSizeMb(
          normalizedMaxFileBytes
        )}.`;
    } else if (
      normalizedFileSize !== null &&
      normalizedMaxFileBytes !== null &&
      normalizedFileSize > normalizedMaxFileBytes &&
      estimatedRangeBytes === null
    ) {
      warning =
        "Размер исходного файла большой. Если импорт не выполнится, уменьшите диапазон страниц.";
    } else if (selectedPages >= Math.max(1, maxPagesPerImport - 1)) {
      warning = `Выбран почти максимальный диапазон (${selectedPages} стр. из ${maxPagesPerImport} допустимых).`;
    }
    return {
      valid: true,
      error: null as string | null,
      warning,
      from,
      to,
    };
  }, [
    blockedReason,
    isPreparing,
    maxAvailablePage,
    maxPagesPerImport,
    normalizedFileSize,
    normalizedMaxFileBytes,
    pageFrom,
    pageTo,
    parseSafePage,
  ]);

  const handleConfirm = useCallback(() => {
    if (!validationState.valid || validationState.from === null || validationState.to === null) {
      return;
    }
    onConfirm({ from: validationState.from, to: validationState.to });
  }, [onConfirm, validationState]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      container={container}
      fullScreen
      fullWidth
      maxWidth={false}
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
        <div className="workbook-session__pdf-preview-range-row">
          <label className="workbook-session__pdf-preview-range-field">
            <span>С страницы</span>
            <input
              className="workbook-session__pdf-preview-range-input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageFrom}
              onChange={(event) => {
                const sanitized = event.target.value.replace(/[^\d]/g, "");
                setPageFrom(sanitized);
              }}
              placeholder="1"
              aria-label="Номер начальной страницы"
            />
          </label>
          <label className="workbook-session__pdf-preview-range-field">
            <span>По страницу</span>
            <input
              className="workbook-session__pdf-preview-range-input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageTo}
              onChange={(event) => {
                const sanitized = event.target.value.replace(/[^\d]/g, "");
                setPageTo(sanitized);
              }}
              placeholder="1"
              aria-label="Номер конечной страницы"
            />
          </label>
        </div>
        {validationState.warning ? (
          <Alert severity="warning" className="workbook-session__pdf-preview-modal-alert">
            {validationState.warning}
          </Alert>
        ) : null}
        {isPreparing ? (
          <Alert severity="info" className="workbook-session__pdf-preview-modal-alert">
            <span className="workbook-session__pdf-preview-preparing">
              <CircularProgress size={14} thickness={5} />
              <span>{preparingMessage}</span>
            </span>
          </Alert>
        ) : null}
        {validationState.error ? (
          <Alert severity="error" className="workbook-session__pdf-preview-modal-alert">
            {validationState.error}
          </Alert>
        ) : null}
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
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleConfirm} disabled={!validationState.valid}>
          Применить диапазон
        </Button>
      </DialogActions>
    </Dialog>
  );
}
