import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { useAuth } from "@/features/auth/model/AuthContext";
import { useThemeMode } from "@/app/theme/themeModeContext";
import { t } from "@/shared/i18n";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
};

export function AuthModal({ open, onClose, initialEmail = "" }: AuthModalProps) {
  const { loginWithPassword } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = () => {
    setEmail(initialEmail);
    setPassword("");
    setError(null);
    setLoading(false);
    setShowPassword(false);
  };

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.trim().length > 0 && !loading,
    [email, loading, password]
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(t("auth.passwordRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    const result = await loginWithPassword(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? t("auth.passwordLoginFailed"));
      return;
    }
    onClose();
  };

  const handleDialogClose = (_event: object, reason: "backdropClick" | "escapeKeyDown") => {
    if (reason === "backdropClick" || reason === "escapeKeyDown") return;
    onClose();
  };

  return (
    <Dialog
      className="auth-modal"
      open={open}
      onClose={handleDialogClose}
      disableEscapeKeyDown
      maxWidth={false}
      PaperProps={{
        sx: {
          width: "min(92vw, 260px)",
        },
      }}
      TransitionProps={{ onEnter: resetForm }}
    >
      <DialogTitle className="auth-modal__title">
        <span>{t("auth.emailLoginTitle")}</span>
        <Tooltip
          title={
            mode === "dark"
              ? t("header.switchLightTheme")
              : t("header.switchDarkTheme")
          }
        >
          <IconButton
            onClick={toggleMode}
            size="small"
            className="auth-modal__theme-toggle"
            aria-label={
              mode === "dark"
                ? t("header.switchLightTheme")
                : t("header.switchDarkTheme")
            }
          >
            {mode === "dark" ? (
              <LightModeRoundedIcon fontSize="small" />
            ) : (
              <DarkModeRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <DialogContent className="auth-modal__content">
        <Stack spacing={1.25} sx={{ pt: 1 }}>
          <TextField
            label={t("auth.emailLabel")}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            fullWidth
            size="small"
          />
          <TextField
            label={t("auth.passwordLabel")}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            fullWidth
            size="small"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            InputProps={{
              endAdornment: (
                <IconButton
                  size="small"
                  edge="end"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showPassword ? (
                    <VisibilityOffRoundedIcon fontSize="small" />
                  ) : (
                    <VisibilityRoundedIcon fontSize="small" />
                  )}
                </IconButton>
              ),
            }}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? t("common.loading") : t("auth.loginButton")}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
