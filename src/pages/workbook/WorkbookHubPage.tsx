import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
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
  renameWorkbookSession,
} from "@/features/workbook/model/api";
import type { WorkbookDraftCard, WorkbookInviteInfo } from "@/features/workbook/model/types";
import { prefetchWorkbookSessionRuntime } from "./prefetchWorkbookSessionRuntime";
import { APP_DATA_UPDATED_EVENT } from "@/shared/lib/dataUpdateBus";
import { InlineMobiusLoader } from "@/shared/ui/loading";

type HubScope = "class" | "personal";

const toSessionPath = (sessionId: string) =>
  `/workbook/session/${encodeURIComponent(sessionId)}`;
const HUB_REFRESH_INTERVAL_MS = 30_000;
const HUB_REFRESH_THROTTLE_MS = 900;

const toSortTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const dedupeDraftCards = (items: WorkbookDraftCard[]) => {
  const uniqueCards = new Map<string, WorkbookDraftCard>();
  items.forEach((item) => {
    const key = `${item.kind}:${item.sessionId}`;
    const previous = uniqueCards.get(key);
    if (!previous || toSortTimestamp(item.updatedAt) >= toSortTimestamp(previous.updatedAt)) {
      uniqueCards.set(key, item);
    }
  });
  return Array.from(uniqueCards.values());
};

const areDraftCardsEqual = (left: WorkbookDraftCard[], right: WorkbookDraftCard[]) => {
  if (left.length !== right.length) return false;
  return left.every((current, index) => {
    const next = right[index];
    return (
      next &&
      current.sessionId === next.sessionId &&
      current.kind === next.kind &&
      current.title === next.title &&
      current.updatedAt === next.updatedAt &&
      current.durationMinutes === next.durationMinutes &&
      current.participantsCount === next.participantsCount &&
      current.statusForCard === next.statusForCard &&
      current.canDelete === next.canDelete &&
      current.isOwner === next.isOwner
    );
  });
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingClass, setCreatingClass] = useState(false);
  const [creatingPersonal, setCreatingPersonal] = useState(false);
  const [copyingSessionId, setCopyingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<WorkbookDraftCard | null>(null);
  const lastReloadAtRef = useRef(0);
  const loadRequestVersionRef = useRef(0);
  const hasLoadedAtLeastOnceRef = useRef(false);
  const loadingInFlightRef = useRef(false);
  const queuedReloadRef = useRef(false);
  const draftsRef = useRef<WorkbookDraftCard[]>([]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (!isAuthReady || user) return;
    openAuthModal();
  }, [isAuthReady, openAuthModal, user]);

  const loadDraftCards = useCallback(async () => {
    if (!isAuthReady || !user || user.role !== "teacher") {
      setLoading(false);
      loadingInFlightRef.current = false;
      queuedReloadRef.current = false;
      hasLoadedAtLeastOnceRef.current = false;
      return;
    }
    if (loadingInFlightRef.current) {
      queuedReloadRef.current = true;
      return;
    }
    loadingInFlightRef.current = true;
    const requestVersion = loadRequestVersionRef.current + 1;
    loadRequestVersionRef.current = requestVersion;
    const showSkeleton = !hasLoadedAtLeastOnceRef.current && draftsRef.current.length === 0;
    try {
      if (showSkeleton) {
        setLoading(true);
      }
      const response = await getWorkbookDrafts("all");
      if (loadRequestVersionRef.current !== requestVersion) return;
      const sorted = dedupeDraftCards(response.items).sort(
        (left, right) => toSortTimestamp(right.updatedAt) - toSortTimestamp(left.updatedAt)
      );
      hasLoadedAtLeastOnceRef.current = true;
      setError(null);
      setDrafts((current) => (areDraftCardsEqual(current, sorted) ? current : sorted));
    } catch {
      if (loadRequestVersionRef.current !== requestVersion) return;
      hasLoadedAtLeastOnceRef.current = true;
      setError(
        draftsRef.current.length > 0
          ? "Не удалось синхронизировать карточки. Показываем последние сохраненные данные."
          : "Не удалось загрузить карточки. Повторим синхронизацию автоматически."
      );
    } finally {
      loadingInFlightRef.current = false;
      if (loadRequestVersionRef.current === requestVersion) {
        setLoading(false);
      }
      if (queuedReloadRef.current) {
        queuedReloadRef.current = false;
        void loadDraftCards();
      }
    }
  }, [isAuthReady, user]);

  const triggerDraftCardsReload = useCallback(
    (force = false) => {
      const now = Date.now();
      if (!force && now - lastReloadAtRef.current < HUB_REFRESH_THROTTLE_MS) return;
      lastReloadAtRef.current = now;
      void loadDraftCards();
    },
    [loadDraftCards]
  );

  useEffect(() => {
    if (!isAuthReady || !user || user.role !== "teacher") {
      setLoading(false);
      return;
    }
    triggerDraftCardsReload(true);
  }, [isAuthReady, triggerDraftCardsReload, user]);

  useEffect(() => {
    if (!isAuthReady || !user || user.role !== "teacher") return;
    const handleFocus = () => {
      triggerDraftCardsReload();
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      triggerDraftCardsReload();
    };
    const handlePageShow = () => {
      triggerDraftCardsReload(true);
    };
    const handleOnline = () => {
      triggerDraftCardsReload(true);
    };
    const handleDataUpdated = () => {
      triggerDraftCardsReload(true);
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);
    window.addEventListener(APP_DATA_UPDATED_EVENT, handleDataUpdated);
    document.addEventListener("visibilitychange", handleVisibility);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      triggerDraftCardsReload();
    }, HUB_REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(APP_DATA_UPDATED_EVENT, handleDataUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [isAuthReady, triggerDraftCardsReload, user]);

  const openSessionInNewTab = useCallback(
    (sessionId: string) => {
      void prefetchWorkbookSessionRuntime();
      if (typeof window === "undefined") {
        navigate(toSessionPath(sessionId));
        return;
      }
      const fromPath = `${window.location.pathname}${window.location.search}` || "/workbook";
      const sessionPath = `${toSessionPath(sessionId)}?${new URLSearchParams({ from: fromPath })}`;
      const targetUrl = new URL(sessionPath, window.location.origin).toString();
      const openedTab = window.open(targetUrl, "_blank");
      if (openedTab) {
        openedTab.focus?.();
        return;
      }
      setError("Браузер заблокировал новую вкладку. Разрешите всплывающие окна и повторите.");
    },
    [navigate]
  );

  const handleOpenCard = useCallback(
    (sessionId: string) => {
      setError(null);
      openSessionInNewTab(sessionId);
      triggerDraftCardsReload();
    },
    [openSessionInNewTab, triggerDraftCardsReload]
  );

  const [classCards, personalCards] = useMemo(() => {
    const classDrafts = drafts.filter((item) => item.kind === "CLASS");
    const personalDrafts = drafts.filter((item) => item.kind === "PERSONAL");
    return [classDrafts, personalDrafts];
  }, [drafts]);
  const cards = scope === "class" ? classCards : personalCards;
  const skeletonCount = Math.max(3, Math.min(cards.length || 0, 6));

  const handleCreateClassSession = async () => {
    try {
      setCreatingClass(true);
      setError(null);
      const created = await createWorkbookSession({
        kind: "CLASS",
        title: "Индивидуальное занятие",
      });
      openSessionInNewTab(created.session.id);
      triggerDraftCardsReload(true);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        openAuthModal();
        return;
      }
      if (reason instanceof ApiError && reason.status === 503) {
        setError("Сервис временно недоступен. Попробуйте снова через несколько секунд.");
        return;
      }
      if (reason instanceof ApiError && reason.status === 403) {
        setError("Недостаточно прав для создания индивидуального занятия.");
        return;
      }
      setError(
        reason instanceof ApiError && reason.message
          ? `Не удалось создать индивидуальное занятие: ${reason.message}`
          : "Не удалось создать индивидуальное занятие."
      );
    } finally {
      setCreatingClass(false);
    }
  };

  const handleCreatePersonalDraft = async () => {
    try {
      setCreatingPersonal(true);
      setError(null);
      const created = await createWorkbookSession({
        kind: "PERSONAL",
      });
      openSessionInNewTab(created.session.id);
      triggerDraftCardsReload(true);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        openAuthModal();
        return;
      }
      if (reason instanceof ApiError && reason.status === 503) {
        setError("Сервис временно недоступен. Попробуйте снова через несколько секунд.");
        return;
      }
      if (reason instanceof ApiError && reason.status === 403) {
        setError("Недостаточно прав для создания личной тетради.");
        return;
      }
      setError(
        reason instanceof ApiError && reason.message
          ? `Не удалось создать личную тетрадь: ${reason.message}`
          : "Не удалось создать личную тетрадь."
      );
    } finally {
      setCreatingPersonal(false);
    }
  };

  const handleDeleteCard = (card: WorkbookDraftCard) => {
    if (!card.canDelete) return;
    setPendingDeleteCard(card);
  };

  const handleConfirmDeleteCard = async () => {
    const card = pendingDeleteCard;
    if (!card || !card.canDelete) return;
    try {
      setDeletingSessionId(card.sessionId);
      setError(null);
      await deleteWorkbookSession(card.sessionId);
      setDrafts((current) => current.filter((item) => item.sessionId !== card.sessionId));
      setPendingDeleteCard(null);
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
      const invite = await createWorkbookInvite(card.sessionId);
      const inviteUrl = resolveInviteUrl(invite);
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      setError("Не удалось скопировать ссылку приглашения.");
    } finally {
      setCopyingSessionId(null);
    }
  };

  const handleRenameCard = async (card: WorkbookDraftCard) => {
    if (!card.canDelete) return;
    const nextTitleRaw = window.prompt("Введите новое название карточки:", card.title);
    if (nextTitleRaw === null) return;
    const nextTitle = nextTitleRaw.trim();
    if (nextTitle.length < 2) {
      setError("Название должно содержать минимум 2 символа.");
      return;
    }
    if (nextTitle === card.title) return;
    try {
      setRenamingSessionId(card.sessionId);
      setError(null);
      const result = await renameWorkbookSession(card.sessionId, nextTitle);
      const updatedAt = result.session.lastActivityAt;
      const updatedTitle = result.session.title;
      setDrafts((current) =>
        current.map((item) =>
          item.sessionId === card.sessionId
            ? {
                ...item,
                title: updatedTitle,
                updatedAt,
              }
            : item
        )
      );
      triggerDraftCardsReload(true);
    } catch {
      setError("Не удалось изменить название карточки.");
    } finally {
      setRenamingSessionId(null);
    }
  };

  if (!isAuthReady) {
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
          <Alert severity="warning" className="workbook-launch__student-alert">
            <div className="workbook-launch__student-alert-content">
              <span className="workbook-launch__student-alert-text">
                {t("whiteboardLaunch.waitingStudent")}
              </span>
              <Button
                color="inherit"
                size="small"
                onClick={logout}
                className="workbook-launch__student-alert-button"
              >
                {t("whiteboardLaunch.loginAsTeacher")}
              </Button>
            </div>
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

        {loading && drafts.length === 0 ? (
          <div className="workbook-hub__list" aria-busy="true" aria-live="polite">
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <article className="workbook-hub__card workbook-hub__card--skeleton" key={index}>
                <div className="workbook-hub__card-main">
                  <div className="workbook-hub__card-title-row">
                    <Skeleton variant="circular" width={26} height={26} />
                    <Skeleton variant="text" width="72%" height={30} />
                  </div>
                  <div className="workbook-hub__card-meta">
                    <Skeleton variant="rounded" width={148} height={18} />
                    <Skeleton variant="rounded" width={120} height={18} />
                  </div>
                  <div className="workbook-hub__card-timeline">
                    <Skeleton variant="rounded" height={24} />
                    <Skeleton variant="rounded" height={24} />
                  </div>
                  <div className="workbook-hub__card-timeline-row">
                    <span />
                    <div className="workbook-hub__card-actions">
                      <Skeleton variant="rounded" width={118} height={30} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
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
              const isRenaming = renamingSessionId === card.sessionId;
              return (
                <article className="workbook-hub__card" key={card.sessionId}>
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
                        <span className="workbook-hub__card-timeline-label">Последний вход</span>
                        <span className="workbook-hub__card-timeline-value">
                          {formatDateTime(card.updatedAt)}
                        </span>
                      </div>
                      <div className="workbook-hub__card-timeline-row">
                        <span className="workbook-hub__card-timeline-label">
                          Длительность присутствия
                        </span>
                        <span className="workbook-hub__card-timeline-value">
                          {formatDuration(card.durationMinutes)}
                        </span>
                      </div>
                    </div>

                    <div className="workbook-hub__card-actions-row">
                      <Button
                        className="workbook-hub__card-action-btn workbook-hub__card-action-btn--open"
                        size="small"
                        variant="text"
                        startIcon={<OpenInNewRoundedIcon />}
                        onClick={() => handleOpenCard(card.sessionId)}
                        onMouseEnter={() => {
                          void prefetchWorkbookSessionRuntime();
                        }}
                        onFocus={() => {
                          void prefetchWorkbookSessionRuntime();
                        }}
                        onPointerDown={() => {
                          void prefetchWorkbookSessionRuntime();
                        }}
                      >
                        Открыть
                      </Button>
                      <div className="workbook-hub__card-actions">
                        {card.kind === "CLASS" ? (
                          <Button
                            className="workbook-hub__card-action-btn"
                            size="small"
                            variant="text"
                            startIcon={
                              isCopying ? (
                                <InlineMobiusLoader size="tiny" decorative />
                              ) : (
                                <ContentCopyRoundedIcon fontSize="small" />
                              )
                            }
                            onClick={() => void handleCopyInvite(card)}
                            disabled={isCopying}
                          >
                            Ссылка
                          </Button>
                        ) : null}
                        {card.canDelete ? (
                          <Button
                            className="workbook-hub__card-action-btn"
                            size="small"
                            variant="text"
                            startIcon={
                              isRenaming ? (
                                <InlineMobiusLoader size="tiny" decorative />
                              ) : (
                                <EditRoundedIcon fontSize="small" />
                              )
                            }
                            onClick={() => void handleRenameCard(card)}
                            disabled={isRenaming}
                          >
                            Редактировать
                          </Button>
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

      <Dialog
        open={Boolean(pendingDeleteCard)}
        onClose={() => {
          if (deletingSessionId) return;
          setPendingDeleteCard(null);
        }}
        className="workbook-hub__confirm-dialog"
      >
        <DialogTitle>Удалить карточку?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {pendingDeleteCard
              ? `Карточка «${pendingDeleteCard.title}» будет удалена, а ссылка доступа деактивирована.`
              : "Карточка будет удалена, а ссылка доступа деактивирована."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPendingDeleteCard(null)}
            disabled={Boolean(deletingSessionId)}
          >
            Отмена
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleConfirmDeleteCard()}
            disabled={Boolean(deletingSessionId)}
          >
            {deletingSessionId ? "Удаляем..." : "Удалить"}
          </Button>
        </DialogActions>
      </Dialog>

    </section>
  );
}
