import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type { ReactNode } from "react";

type PlatformConfirmTone = "neutral" | "warning" | "destructive";

type PlatformConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: PlatformConfirmTone;
  loading?: boolean;
  confirmDisabled?: boolean;
  content?: ReactNode;
  container?: Element | null;
  fullScreen?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

const resolveConfirmButtonColor = (tone: PlatformConfirmTone) => {
  if (tone === "destructive") return "error";
  if (tone === "warning") return "warning";
  return "primary";
};

export function PlatformConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Отмена",
  tone = "neutral",
  loading = false,
  confirmDisabled = false,
  content,
  container,
  fullScreen = false,
  onCancel,
  onConfirm,
}: PlatformConfirmDialogProps) {
  return (
    <Dialog
      container={container}
      open={open}
      onClose={loading ? undefined : onCancel}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen}
      className="ui-confirm-dialog"
    >
      <DialogTitle className="ui-confirm-dialog__title">{title}</DialogTitle>
      <DialogContent className="ui-confirm-dialog__content">
        <p>{description}</p>
        {content ? <div className="ui-confirm-dialog__slot">{content}</div> : null}
      </DialogContent>
      <DialogActions className="ui-confirm-dialog__actions">
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={resolveConfirmButtonColor(tone)}
          onClick={() => void onConfirm()}
          disabled={loading || confirmDisabled}
        >
          {loading ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
