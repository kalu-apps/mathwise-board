import { useLocation, useNavigate } from "react-router-dom";
import { Button, IconButton, Tooltip } from "@mui/material";
import CalculateIcon from "@mui/icons-material/Calculate";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import type { MouseEvent } from "react";
import { useAuth } from "@/features/auth/model/AuthContext";
import { useThemeMode } from "@/app/theme/themeModeContext";
import { t } from "@/shared/i18n";

export function Header() {
  const { user, isGuestSession, logout, openAuthModal } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const isWorkbookSessionRoute = location.pathname.startsWith("/workbook/session/");

  const handleLogoClick = () => {
    navigate("/workbook");
  };

  const handleLogout = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    logout();
    navigate("/", { replace: true });
  };

  const handleSessionBack = () => {
    if (typeof window !== "undefined") {
      const backEvent = new CustomEvent("workbook:session-back-request", {
        cancelable: true,
      });
      const shouldContinueDefaultNavigation = window.dispatchEvent(backEvent);
      if (!shouldContinueDefaultNavigation) {
        return;
      }
    }
    navigate("/workbook", { replace: true });
  };

  return (
    <header className="header">
      <div className="header__container">
        <div className="header__left">
          <IconButton
            className="header__logo"
            onClick={handleLogoClick}
            size="large"
            aria-label={t("header.openNavigation")}
          >
            <CalculateIcon className="header__logo-icon" />
          </IconButton>
          {isWorkbookSessionRoute ? (
            <Tooltip title="Вернуться к тетрадям">
              <IconButton
                className="header__session-back"
                onClick={handleSessionBack}
                size="small"
                aria-label="Вернуться к тетрадям"
              >
                <ArrowBackRoundedIcon />
              </IconButton>
            </Tooltip>
          ) : null}
        </div>

        <div className="header__right">
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
              aria-label={
                mode === "dark"
                  ? t("header.switchLightTheme")
                  : t("header.switchDarkTheme")
              }
              className="header__theme-toggle"
            >
              {mode === "dark" ? (
                <LightModeRoundedIcon fontSize="small" />
              ) : (
                <DarkModeRoundedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          {user && !isGuestSession ? (
            <>
              <Tooltip title={t("header.profile")}>
                <Button
                  onClick={() => navigate("/workbook")}
                  className="header__profile-btn"
                  color="inherit"
                >
                  <div className="header__avatar">{(user.firstName || user.email)[0]}</div>
                  <span className="header__profile-name">{user.firstName || user.email}</span>
                </Button>
              </Tooltip>

              {user.role === "teacher" ? (
                <Tooltip title={t("header.logout")}>
                  <IconButton onClick={handleLogout} size="small">
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </>
          ) : !isGuestSession ? (
            <Tooltip title={t("header.login")}>
              <IconButton onClick={() => openAuthModal()}>
                <LoginIcon />
              </IconButton>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </header>
  );
}
