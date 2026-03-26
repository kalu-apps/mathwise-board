import { useEffect, useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./workbookRouteStyles";
import { useAuth } from "@/features/auth/model/AuthContext";
import { AuthAmbientScene } from "@/features/auth-ambient/ui/AuthAmbientScene";
import {
  createWorkbookSession,
  getWorkbookDrafts,
} from "@/features/workbook/model/api";
import { prefetchWorkbookSessionRuntime } from "./prefetchWorkbookSessionRuntime";
import { t } from "@/shared/i18n";
import { InlineMobiusLoader } from "@/shared/ui/loading";

const toSessionPath = (sessionId: string) =>
  `/workbook/session/${encodeURIComponent(sessionId)}`;

export default function WorkbookLaunchPage() {
  const navigate = useNavigate();
  const { user, isAuthReady, openAuthModal, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user || user.role !== "teacher") {
      openAuthModal();
      return;
    }
    void prefetchWorkbookSessionRuntime();

    let active = true;
    const routeTeacherToLesson = async () => {
      try {
        setLoading(true);
        setError(null);
        const drafts = await getWorkbookDrafts("class");
        const activeSession =
          drafts.items.find(
            (item) =>
              item.kind === "CLASS" &&
              item.isOwner &&
              item.statusForCard !== "ended"
          ) ?? null;
        const sessionId =
          activeSession?.sessionId ??
          (await createWorkbookSession({ kind: "CLASS" })).session.id;
        void prefetchWorkbookSessionRuntime();
        if (!active) return;
        if (typeof window === "undefined") {
          navigate(toSessionPath(sessionId), { replace: true });
          return;
        }
        const sessionUrl = new URL(toSessionPath(sessionId), window.location.origin).toString();
        const openedTab = window.open(sessionUrl, "_blank");
        if (!openedTab) {
          navigate(toSessionPath(sessionId), { replace: true });
          return;
        }
        openedTab.focus?.();
        navigate("/workbook", { replace: true });
      } catch {
        if (!active) return;
        setError(t("whiteboardLaunch.lessonOpenError"));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void routeTeacherToLesson();
    return () => {
      active = false;
    };
  }, [isAuthReady, navigate, openAuthModal, user]);

  if (isAuthReady && !user) {
    return (
      <section className="workbook-launch workbook-entry-shell workbook-entry-shell--launch workbook-launch--auth-only">
        <AuthAmbientScene variant="launch" />
      </section>
    );
  }

  if (isAuthReady && user?.role === "teacher" && (loading || !error)) {
    return (
      <section className="workbook-launch workbook-entry-shell workbook-entry-shell--launch">
        <AuthAmbientScene variant="launch" />
        <article className="workbook-launch__card">
          <InlineMobiusLoader
            size="hero"
            label={t("route.loadingPage")}
            centered
            stacked
          />
        </article>
      </section>
    );
  }

  return (
    <section className="workbook-launch workbook-entry-shell workbook-entry-shell--launch">
      <AuthAmbientScene variant="launch" />
      <article className="workbook-launch__card">
        <Typography variant="h4">{t("whiteboardLaunch.title")}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t("whiteboardLaunch.subtitle")}
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!isAuthReady || loading ? (
          <InlineMobiusLoader
            size="hero"
            label={t("route.loadingPage")}
            centered
            stacked
          />
        ) : null}
        {isAuthReady && user?.role === "student" ? (
          <Alert severity="warning" className="workbook-launch__student-alert">
            <div className="workbook-launch__student-alert-content">
              <span className="workbook-launch__student-alert-text">
                {t("whiteboardLaunch.waitingStudent")}
              </span>
              <Button
                variant="outlined"
                size="small"
                className="workbook-launch__student-alert-button"
                onClick={() => {
                  setError(null);
                  logout();
                }}
              >
                {t("whiteboardLaunch.loginAsTeacher")}
              </Button>
            </div>
          </Alert>
        ) : null}
      </article>
    </section>
  );
}
