import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, TextField } from "@mui/material";
import "./workbookRouteStyles";
import { joinWorkbookInvite, resolveWorkbookInvite } from "@/features/workbook/model/api";
import { getAuthSession } from "@/features/auth/model/api";
import { useAuth } from "@/features/auth/model/AuthContext";
import { AuthAmbientScene } from "@/features/auth-ambient/ui/AuthAmbientScene";
import { ApiError } from "@/shared/api/client";
import { t } from "@/shared/i18n";
import {
  prefetchWorkbookSessionRuntime,
  prefetchWorkbookSessionRuntimeOnIdle,
} from "./prefetchWorkbookSessionRuntime";
import { InlineMobiusLoader } from "@/shared/ui/loading";

export default function WorkbookInviteJoinPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    title: string;
    hostName: string;
    sessionId: string | null;
    joined: boolean;
  }>({
    loading: true,
    error: null,
    title: "",
    hostName: "",
    sessionId: null,
    joined: false,
  });
  const [guestName, setGuestName] = useState("");
  const [guestNameError, setGuestNameError] = useState<string | null>(null);
  const shouldCollectGuestName = !user || user.role !== "teacher";
  const suggestedGuestName = useMemo(
    () =>
      !user || user.role === "teacher"
        ? ""
        : `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    [user]
  );
  const effectiveGuestName = useMemo(
    () => (guestName.trim().length > 0 ? guestName.trim() : suggestedGuestName.trim()),
    [guestName, suggestedGuestName]
  );

  const canJoin = useMemo(
    () =>
      Boolean(
        token &&
          !state.loading &&
          !state.error &&
          (!shouldCollectGuestName || effectiveGuestName.length >= 2)
      ),
    [effectiveGuestName.length, shouldCollectGuestName, state.error, state.loading, token]
  );

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      if (!token) {
        if (!active) return;
        setState((prev) => ({
            ...prev,
            loading: false,
            error: t("workbookInvite.invalidLink"),
          }));
        return;
      }
      try {
        const info = await resolveWorkbookInvite(token);
        if (!active) return;
        if (info.ended) {
          setState((prev) => ({
                ...prev,
                loading: false,
                error: t("workbookInvite.ended"),
                title: info.title,
                hostName: info.hostName,
                sessionId: info.sessionId,
          }));
          return;
        }
        if (info.expired || info.revoked) {
          setState((prev) => ({
                ...prev,
                loading: false,
                error: t("workbookInvite.inactive"),
                title: info.title,
                hostName: info.hostName,
                sessionId: info.sessionId,
          }));
          return;
        }
        prefetchWorkbookSessionRuntimeOnIdle();
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          title: info.title,
          hostName: info.hostName,
          sessionId: info.sessionId,
        }));
      } catch {
        if (!active) return;
        setState((prev) => ({
            ...prev,
            loading: false,
            error: t("workbookInvite.resolveError"),
          }));
      }
    };
    void resolve();
    return () => {
      active = false;
    };
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;
    const guestDisplayName = effectiveGuestName;
    if (shouldCollectGuestName && guestDisplayName.length < 2) {
      setGuestNameError(t("workbookInvite.guestNameRequired"));
      return;
    }
    setGuestNameError(null);
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const joined = await joinWorkbookInvite(
        token,
        shouldCollectGuestName ? guestDisplayName : undefined
      );
      const authSession = joined.user ? null : await getAuthSession();
      const resolvedUser = joined.user ?? authSession;
      if (resolvedUser) {
        updateUser(resolvedUser);
      }
      if (!resolvedUser) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: t("workbookInvite.joinError"),
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        joined: true,
        sessionId: joined.session.id,
      }));
      void prefetchWorkbookSessionRuntime();
      navigate(`/workbook/session/${encodeURIComponent(joined.session.id)}`, {
        replace: true,
      });
    } catch (error) {
      const detailsMessage =
        error instanceof ApiError &&
        typeof error.details === "object" &&
        error.details &&
        "error" in error.details &&
        typeof (error.details as { error?: unknown }).error === "string"
          ? (error.details as { error: string }).error
          : null;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: detailsMessage ?? t("workbookInvite.joinError"),
      }));
    }
  };

  return (
    <section className="workbook-invite workbook-entry-shell workbook-entry-shell--invite">
      <AuthAmbientScene variant="invite" />
      <article className="workbook-invite__card">
        <h1>{t("workbookInvite.title")}</h1>
        {state.loading ? (
          <div className="workbook-invite__loading">
            <InlineMobiusLoader
              size="hero"
              label={t("workbookInvite.checkingInvite")}
              centered
              stacked
            />
          </div>
        ) : null}
        {state.error ? <Alert severity="error">{state.error}</Alert> : null}
        {!state.loading && !state.error ? (
          <div className="workbook-invite__meta">
            {!shouldCollectGuestName ? (
              <p>
                {t("workbookInvite.sessionLabel")}: <strong>{state.title}</strong>
              </p>
            ) : null}
            <p>
              {t("workbookInvite.teacherLabel")}: <strong>{state.hostName}</strong>
            </p>
            {shouldCollectGuestName ? (
              <div className="workbook-invite__guest-field">
                <TextField
                  size="small"
                  label={t("workbookInvite.guestNameLabel")}
                  value={guestName.length > 0 ? guestName : suggestedGuestName}
                  onChange={(event) => {
                    setGuestName(event.target.value);
                    if (guestNameError) setGuestNameError(null);
                  }}
                  error={Boolean(guestNameError)}
                  helperText={guestNameError ?? t("workbookInvite.guestNameHint")}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {!state.loading ? (
          <div className="workbook-invite__actions">
            <Button
              variant="contained"
              onClick={() => void handleJoin()}
              disabled={!canJoin || state.joined}
            >
              {t("workbookInvite.join")}
            </Button>
          </div>
        ) : null}
      </article>
    </section>
  );
}
