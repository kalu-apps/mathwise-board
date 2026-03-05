import { useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/model/AuthContext";
import {
  createWorkbookSession,
  getWorkbookDrafts,
} from "@/features/workbook/model/api";
import { t } from "@/shared/i18n";

const toSessionPath = (sessionId: string) =>
  `/workbook/session/${encodeURIComponent(sessionId)}`;

export default function WorkbookLaunchPage() {
  const navigate = useNavigate();
  const { user, isAuthReady, openAuthModal, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      openAuthModal();
      return;
    }
    if (user.role !== "teacher") return;

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
        if (!active) return;
        navigate(toSessionPath(sessionId), { replace: true });
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

  return (
    <section className="workbook-launch">
      <article className="workbook-launch__card">
        <Typography variant="h4">{t("whiteboardLaunch.title")}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t("whiteboardLaunch.subtitle")}
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!isAuthReady || loading ? (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2">{t("route.loadingPage")}</Typography>
          </Stack>
        ) : null}
        {isAuthReady && user?.role === "student" ? (
          <Alert severity="warning">
            {t("whiteboardLaunch.waitingStudent")}
          </Alert>
        ) : null}
        <Stack direction="row" spacing={1} className="workbook-launch__actions">
          {!user ? (
            <Button variant="contained" onClick={openAuthModal}>
              {t("header.login")}
            </Button>
          ) : (
            <Button variant="outlined" onClick={logout}>
              {t("header.logout")}
            </Button>
          )}
        </Stack>
      </article>
    </section>
  );
}
