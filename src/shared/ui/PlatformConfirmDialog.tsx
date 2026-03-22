import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

type PlatformConfirmTone = "neutral" | "warning" | "destructive";

type PlatformConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: PlatformConfirmTone;
  loading?: boolean;
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
      </DialogContent>
      <DialogActions className="ui-confirm-dialog__actions">
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={resolveConfirmButtonColor(tone)}
          onClick={() => void onConfirm()}
          disabled={loading}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
