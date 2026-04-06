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
  const hideAuthModalForWorkbook =
    location.pathname.startsWith("/workbook/invite/") ||
    isWorkbookSessionRoute;

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
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [isAuthReady, location.pathname, user]);

  return (
    <>
      {!isWorkbookSessionRoute ? <Header /> : null}
      <ConnectivityBanner />
      <PerformanceModeBanner />
      <main className={`app-main${isWorkbookSessionRoute ? " app-main--workbook-session" : ""}`}>
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
