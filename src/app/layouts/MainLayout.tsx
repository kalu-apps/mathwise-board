import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/widgets/header/ui/Header";
import { AuthModal } from "@/features/auth/ui/AuthModal";
import { useAuth } from "@/features/auth/model/AuthContext";
import { ConnectivityBanner } from "@/shared/ui/ConnectivityBanner";
import { PerformanceModeBanner } from "@/shared/ui/PerformanceModeBanner";

export function MainLayout() {
  const { user, isAuthReady, isAuthModalOpen, closeAuthModal, authModalEmail } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isWorkbookSessionRoute = location.pathname.startsWith("/workbook/session/");
  const isWorkbookRecordingRoute = location.pathname.startsWith("/workbook/recording/");
  const isWorkbookFullScreenRoute = isWorkbookSessionRoute || isWorkbookRecordingRoute;
  const hideAuthModalForWorkbook =
    location.pathname.startsWith("/workbook/invite/") ||
    isWorkbookFullScreenRoute;
  const workbookInviteTokenFromRouteState =
    location.state &&
    typeof location.state === "object" &&
    "inviteToken" in location.state &&
    typeof (location.state as { inviteToken?: unknown }).inviteToken === "string"
      ? (location.state as { inviteToken: string }).inviteToken.trim()
      : "";

  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (location.pathname !== "/") return;
    const state = location.state as { from?: string; authRequired?: boolean } | null;
    const from = typeof state?.from === "string" ? state.from.trim() : "";
    if (!from || !from.startsWith("/") || from.startsWith("//") || from === "/") return;
    navigate(from, { replace: true, state: null });
  }, [isAuthReady, location.pathname, location.state, navigate, user]);

  useEffect(() => {
    if (!hideAuthModalForWorkbook || !isAuthModalOpen) return;
    closeAuthModal();
  }, [closeAuthModal, hideAuthModalForWorkbook, isAuthModalOpen]);

  useEffect(() => {
    if (!isAuthReady || user) return;
    if (!location.pathname.startsWith("/workbook")) return;
    if (location.pathname.startsWith("/workbook/invite/")) return;
    if (isWorkbookRecordingRoute) return;
    if (isWorkbookSessionRoute && workbookInviteTokenFromRouteState) {
      navigate(`/workbook/invite/${encodeURIComponent(workbookInviteTokenFromRouteState)}`, {
        replace: true,
        state: null,
      });
      return;
    }
    navigate("/", { replace: true, state: null });
  }, [
    isAuthReady,
    isWorkbookRecordingRoute,
    isWorkbookSessionRoute,
    location.pathname,
    navigate,
    user,
    workbookInviteTokenFromRouteState,
  ]);

  return (
    <>
      {!isWorkbookFullScreenRoute ? <Header /> : null}
      <ConnectivityBanner />
      <PerformanceModeBanner />
      <main className={`app-main${isWorkbookFullScreenRoute ? " app-main--workbook-session" : ""}`}>
        <Outlet />
      </main>
      {!hideAuthModalForWorkbook ? (
        <AuthModal
          open={isAuthModalOpen}
          onClose={closeAuthModal}
          initialEmail={authModalEmail}
        />
      ) : null}
    </>
  );
}
