import SyncProblemRoundedIcon from "@mui/icons-material/SyncProblemRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { useState, type SyntheticEvent } from "react";
import { Alert, Snackbar } from "@mui/material";
import { useConnectivity } from "@/app/providers/connectivityContext";
import type { ConnectivityStatus } from "@/app/providers/connectivityContext";
import { t } from "@/shared/i18n";

const CONNECTIVITY_NOTICE_AUTO_HIDE_MS = 8_000;
const OFFLINE_NOTICE_AUTO_HIDE_MS = 9_500;

export function ConnectivityBanner() {
  const { status } = useConnectivity();
  if (status === "online") return null;
  return <ConnectivityNotice key={status} status={status} />;
}

function ConnectivityNotice({
  status,
}: {
  status: Exclude<ConnectivityStatus, "online">;
}) {
  const [open, setOpen] = useState(true);
  const isOffline = status === "offline";
  const title = isOffline
    ? t("connectivity.offlineTitle")
    : t("connectivity.degradedTitle");
  const description = isOffline
    ? t("connectivity.offlineMessage")
    : t("connectivity.degradedMessage");

  const handleClose = (_event?: Event | SyntheticEvent, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={
        isOffline ? OFFLINE_NOTICE_AUTO_HIDE_MS : CONNECTIVITY_NOTICE_AUTO_HIDE_MS
      }
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <Alert
        severity={isOffline ? "error" : "warning"}
        className={`connectivity-banner connectivity-banner--${status}`}
        icon={
          isOffline ? (
            <WifiOffRoundedIcon fontSize="small" />
          ) : (
            <SyncProblemRoundedIcon fontSize="small" />
          )
        }
      >
        <div className="connectivity-banner__content">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </Alert>
    </Snackbar>
  );
}
