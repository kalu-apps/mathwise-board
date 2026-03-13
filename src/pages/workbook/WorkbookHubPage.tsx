import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import "./workbookRouteStyles";
import { ApiError } from "@/shared/api/client";
import { t } from "@/shared/i18n";
import { useAuth } from "@/features/auth/model/AuthContext";
import { AuthAmbientScene } from "@/features/auth-ambient/ui/AuthAmbientScene";
import {
  createWorkbookInvite,
  createWorkbookSession,
  deleteWorkbookSession,
  getWorkbookDrafts,
} from "@/features/workbook/model/api";
import type { WorkbookDraftCard, WorkbookInviteInfo } from "@/features/workbook/model/types";

type HubScope = "class" | "personal";

const toSessionPath = (sessionId: string) =>
  `/workbook/session/${encodeURIComponent(sessionId)}`;

const toSortTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatDateTime = (value: string) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Нет данных";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
};

const formatDuration = (minutes?: number | null) => {
  if (!minutes || minutes <= 0) return "Без данных";
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours <= 0) return `${restMinutes} мин`;
  if (restMinutes <= 0) return `${hours} ч`;
  return `${hours} ч ${restMinutes} мин`;
};

const resolveInviteUrl = (invite: WorkbookInviteInfo) => {
  const rawInviteUrl = typeof invite.inviteUrl === "string" ? invite.inviteUrl.trim() : "";
  const invitePath = rawInviteUrl.startsWith("http://") || rawInviteUrl.startsWith("https://")
    ? rawInviteUrl
    : rawInviteUrl.length > 0
      ? rawInviteUrl.startsWith("/")
        ? rawInviteUrl
        : `/${rawInviteUrl}`
      : `/workbook/invite/${encodeURIComponent(invite.token)}`;
  if (invitePath.startsWith("http://") || invitePath.startsWith("https://")) {
    return invitePath;
  }
  return new URL(invitePath, window.location.origin).toString();
};

export default function WorkbookHubPage() {
  const navigate = useNavigate();
  const { user, isAuthReady, openAuthModal, logout } = useAuth();
  const [scope, setScope] = useState<HubScope>("class");
  const [drafts, setDrafts] = useState<WorkbookDraftCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [creatingClass, setCreatingClass] = useState(false);
  const [creatingPersonal, setCreatingPersonal] = useState(false);
  const [copyingSessionId, setCopyingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || user) return;
    openAuthModal();
  }, [isAuthReady, openAuthModal, user]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user || user.role !== "teacher") {
      setLoading(false);
      return;
    }
    let active = true;
    const loadDraftCards = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getWorkbookDrafts("all");
        if (!active) return;
        const sorted = response.items
          .slice()
          .sort((left, right) => toSortTimestamp(right.updatedAt) - toSortTimestamp(left.updatedAt));
        setDrafts(sorted);
      } catch {
        if (!active) return;
        setError("Не удалось загрузить карточки. Обновите страницу и повторите.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDraftCards();
    return () => {
      active = false;
    };
  }, [isAuthReady, reloadVersion, user]);

  const classCards = drafts.filter((item) => item.kind === "CLASS");
  const personalCards = drafts.filter((item) => item.kind === "PERSONAL");
  const cards = scope === "class" ? classCards : personalCards;

  const handleRefresh = () => {
    setReloadVersion((current) => current + 1);
  };

  const handleCreateClassSession = async () => {
    try {
      setCreatingClass(true);
      setError(null);
      setSuccess(null);
      const created = await createWorkbookSession({
        kind: "CLASS",
        title: "Индивидуальное занятие",
      });
      navigate(toSessionPath(created.session.id));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        openAuthModal();
        return;
      }
      setError("Не удалось создать индивидуальное занятие.");
    } finally {
      setCreatingClass(false);
    }
  };

  const handleCreatePersonalDraft = async () => {
    try {
      setCreatingPersonal(true);
      setError(null);
      setSuccess(null);
      const created = await createWorkbookSession({
        kind: "PERSONAL",
      });
      navigate(toSessionPath(created.session.id));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        openAuthModal();
        return;
      }
      setError("Не удалось создать личную тетрадь.");
    } finally {
      setCreatingPersonal(false);
    }
  };

  const handleDeleteCard = async (card: WorkbookDraftCard) => {
    if (!card.canDelete) return;
    const confirmed = window.confirm(
      `Удалить карточку «${card.title}»?\nСсылка доступа к этой доске будет деактивирована.`
    );
    if (!confirmed) return;
    try {
      setDeletingSessionId(card.sessionId);
      setError(null);
      setSuccess(null);
      await deleteWorkbookSession(card.sessionId);
      setDrafts((current) => current.filter((item) => item.sessionId !== card.sessionId));
      setSuccess("Карточка удалена. Ссылка доступа отключена.");
    } catch {
      setError("Не удалось удалить карточку.");
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleCopyInvite = async (card: WorkbookDraftCard) => {
    if (card.kind !== "CLASS") return;
    try {
      setCopyingSessionId(card.sessionId);
      setError(null);
      setSuccess(null);
      const invite = await createWorkbookInvite(card.sessionId);
      const inviteUrl = resolveInviteUrl(invite);
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(inviteUrl);
      setSuccess("Бессрочная ссылка приглашения скопирована.");
    } catch {
      setError("Не удалось скопировать ссылку приглашения.");
    } finally {
      setCopyingSessionId(null);
    }
  };

  if (!isAuthReady) {
    return (
      <section className="workbook-launch workbook-entry-shell workbook-entry-shell--launch">
        <AuthAmbientScene variant="launch" />
        <article className="workbook-launch__card">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={22} />
            <Typography variant="body2">{t("route.loadingPage")}</Typography>
          </Stack>
        </article>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="workbook-launch workbook-entry-shell workbook-entry-shell--launch workbook-launch--auth-only">
        <AuthAmbientScene variant="launch" />
      </section>
    );
  }

  if (user.role !== "teacher") {
    return (
      <section className="workbook-launch workbook-entry-shell workbook-entry-shell--launch">
        <AuthAmbientScene variant="launch" />
        <article className="workbook-launch__card">
          <Typography variant="h4">Рабочие тетради</Typography>
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={logout}>
                {t("whiteboardLaunch.loginAsTeacher")}
              </Button>
            }
          >
            {t("whiteboardLaunch.waitingStudent")}
          </Alert>
        </article>
      </section>
    );
  }

  return (
    <section className="workbook-hub">
      <article className="workbook-hub__panel">
        <div className="workbook-hub__hero">
          <Avatar sx={{ bgcolor: "primary.main", width: 42, height: 42 }}>
            <AutoStoriesRoundedIcon />
          </Avatar>
          <div className="workbook-hub__hero-main">
            <h1>Рабочие тетради</h1>
            <p>
              Управляйте карточками индивидуальных занятий и личных тетрадей. Все действия на
              досках сохраняются автоматически.
            </p>
          </div>
          <div className="workbook-hub__hero-actions">
            <Button
              variant="contained"
              startIcon={<SchoolRoundedIcon />}
              onClick={() => void handleCreateClassSession()}
              disabled={creatingClass}
            >
              {creatingClass ? "Создаем..." : "Начать индивидуальное занятие"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<MenuBookRoundedIcon />}
              onClick={() => void handleCreatePersonalDraft()}
              disabled={creatingPersonal}
            >
              {creatingPersonal ? "Создаем..." : "Новая личная тетрадь"}
            </Button>
            <Button
              variant="text"
              startIcon={<RefreshRoundedIcon />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Обновить
            </Button>
          </div>
        </div>
      </article>

      <article className="workbook-hub__panel workbook-hub__panel--search">
        <div className="workbook-hub__filters">
          <button
            type="button"
            className={scope === "class" ? "is-active" : ""}
            onClick={() => setScope("class")}
          >
            Индивидуальные занятия ({classCards.length})
          </button>
          <button
            type="button"
            className={scope === "personal" ? "is-active" : ""}
            onClick={() => setScope("personal")}
          >
            Личные тетради ({personalCards.length})
          </button>
        </div>

        {error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        ) : null}

        {loading ? (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={22} />
            <Typography variant="body2">{t("route.loadingPage")}</Typography>
          </Stack>
        ) : cards.length === 0 ? (
          <Alert severity="info">
            {scope === "class"
              ? "Карточек индивидуальных занятий пока нет. Нажмите «Начать индивидуальное занятие»."
              : "Личных тетрадей пока нет. Нажмите «Новая личная тетрадь»."}
          </Alert>
        ) : (
          <div className="workbook-hub__list">
            {cards.map((card) => {
              const isCopying = copyingSessionId === card.sessionId;
              const isDeleting = deletingSessionId === card.sessionId;
              return (
                <article className="workbook-hub__card" key={card.draftId}>
                  {card.canDelete ? (
                    <Tooltip title="Удалить карточку">
                      <span>
                        <IconButton
                          size="small"
                          className="workbook-hub__card-remove"
                          onClick={() => void handleDeleteCard(card)}
                          disabled={isDeleting}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                  <div className="workbook-hub__card-main">
                    <div className="workbook-hub__card-title-row">
                      <Avatar sx={{ width: 26, height: 26 }}>
                        {card.kind === "CLASS" ? (
                          <SchoolRoundedIcon fontSize="small" />
                        ) : (
                          <MenuBookRoundedIcon fontSize="small" />
                        )}
                      </Avatar>
                      <h3 title={card.title}>{card.title}</h3>
                    </div>

                    <div className="workbook-hub__card-meta">
                      <span>
                        {card.kind === "CLASS" ? "Индивидуальное занятие" : "Личная тетрадь"}
                      </span>
                      <span>•</span>
                      <span>
                        {card.kind === "CLASS"
                          ? `Участников: ${card.participantsCount}`
                          : "Персональная база знаний"}
                      </span>
                    </div>

                    <div className="workbook-hub__card-timeline">
                      <div className="workbook-hub__card-timeline-row">
                        <span>Последний вход</span>
                        <span>{formatDateTime(card.updatedAt)}</span>
                      </div>
                      <div className="workbook-hub__card-timeline-row">
                        <span>Длительность присутствия</span>
                        <span>{formatDuration(card.durationMinutes)}</span>
                      </div>
                    </div>

                    <div className="workbook-hub__card-timeline-row">
                      <span />
                      <div className="workbook-hub__card-actions">
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<OpenInNewRoundedIcon />}
                          onClick={() => navigate(toSessionPath(card.sessionId))}
                        >
                          Открыть
                        </Button>
                        {card.kind === "CLASS" ? (
                          <Tooltip title="Скопировать ссылку ученику">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => void handleCopyInvite(card)}
                                disabled={isCopying}
                              >
                                {isCopying ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <ContentCopyRoundedIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </article>

      <article className="workbook-hub__panel">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AddRoundedIcon color="action" />
          <Typography variant="body2" color="text.secondary">
            В индивидуальных занятиях ссылка постоянная до удаления карточки преподавателем. После
            удаления доступ по ссылке закрывается.
          </Typography>
        </Stack>
      </article>
    </section>
  );
}
