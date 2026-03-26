import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
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
  updateWorkbookSessionDraftPreview,
  uploadWorkbookAsset,
} from "@/features/workbook/model/api";
import type { WorkbookDraftCard, WorkbookInviteInfo } from "@/features/workbook/model/types";
import { prefetchWorkbookSessionRuntime } from "./prefetchWorkbookSessionRuntime";
import { APP_DATA_UPDATED_EVENT } from "@/shared/lib/dataUpdateBus";
import { InlineMobiusLoader } from "@/shared/ui/loading";
import { PlatformConfirmDialog } from "@/shared/ui/PlatformConfirmDialog";
import {
  consumeWorkbookHubPreviewRefreshHints,
  isWorkbookHubPreviewBridgeMessage,
  type WorkbookHubPreviewBridgePayload,
  type WorkbookHubPreviewRefreshHint,
} from "./workbookHubPreviewBridge";

type HubScope = "class" | "personal";

const toSessionPath = (sessionId: string) =>
  `/workbook/session/${encodeURIComponent(sessionId)}`;
const HUB_REFRESH_INTERVAL_MS = 5_000;
const HUB_REFRESH_THROTTLE_MS = 900;
const HUB_CARDS_PER_PAGE = 9;
const HUB_PREVIEW_REFRESH_INTERVAL_MS = 1_000;

type PreviewRefreshPendingBySessionId = Record<string, WorkbookHubPreviewRefreshHint>;

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
      current.isOwner === next.isOwner &&
      current.previewUrl === next.previewUrl &&
      current.previewAlt === next.previewAlt &&
      current.activityLabel === next.activityLabel &&
      current.activityTone === next.activityTone
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
  const location = useLocation();
  const { user, isAuthReady, openAuthModal, logout } = useAuth();
  const showStudentExitNotice = Boolean(
    (location.state as { showStudentExitNotice?: boolean } | null)?.showStudentExitNotice
  );
  const [scope, setScope] = useState<HubScope>("class");
  const [drafts, setDrafts] = useState<WorkbookDraftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingClass, setCreatingClass] = useState(false);
  const [creatingPersonal, setCreatingPersonal] = useState(false);
  const [copyingSessionId, setCopyingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageByScope, setPageByScope] = useState<Record<HubScope, number>>({
    class: 1,
    personal: 1,
  });
  const [pendingDeleteCard, setPendingDeleteCard] = useState<WorkbookDraftCard | null>(null);
  const [pendingRenameCard, setPendingRenameCard] = useState<WorkbookDraftCard | null>(null);
  const [renameTitleDraft, setRenameTitleDraft] = useState("");
  const [previewLoadErrorBySessionId, setPreviewLoadErrorBySessionId] = useState<
    Record<string, string>
  >({});
  const [previewRefreshPendingBySessionId, setPreviewRefreshPendingBySessionId] =
    useState<PreviewRefreshPendingBySessionId>({});
  const lastReloadAtRef = useRef(0);
  const loadRequestVersionRef = useRef(0);
  const hasLoadedAtLeastOnceRef = useRef(false);
  const loadingInFlightRef = useRef(false);
  const queuedReloadRef = useRef(false);
  const draftsRef = useRef<WorkbookDraftCard[]>([]);
  const previewPersistChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingPreviewPersistBySessionIdRef = useRef<Map<string, WorkbookHubPreviewBridgePayload>>(
    new Map()
  );

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    setPreviewLoadErrorBySessionId((current) => {
      const activeSessionIds = new Set(drafts.map((card) => card.sessionId));
      let changed = false;
      const nextState: Record<string, string> = {};
      Object.entries(current).forEach(([sessionId, failedUrl]) => {
        if (!activeSessionIds.has(sessionId)) {
          changed = true;
          return;
        }
        nextState[sessionId] = failedUrl;
      });
      return changed ? nextState : current;
    });
  }, [drafts]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      openAuthModal();
      return;
    }
    if (user.role !== "teacher" && !showStudentExitNotice) {
      openAuthModal();
    }
  }, [isAuthReady, openAuthModal, showStudentExitNotice, user]);

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
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("ru-RU");
  const filteredCards = useMemo(() => {
    if (normalizedSearchQuery.length === 0) return cards;
    return cards.filter((card) =>
      card.title.toLocaleLowerCase("ru-RU").includes(normalizedSearchQuery)
    );
  }, [cards, normalizedSearchQuery]);
  const requestedPage = pageByScope[scope] ?? 1;
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / HUB_CARDS_PER_PAGE));
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const pageCards = useMemo(() => {
    const offset = (currentPage - 1) * HUB_CARDS_PER_PAGE;
    return filteredCards.slice(offset, offset + HUB_CARDS_PER_PAGE);
  }, [currentPage, filteredCards]);
  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, -1, totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages];
  }, [currentPage, totalPages]);
  const hasSearchResults = normalizedSearchQuery.length > 0;
  const skeletonCount = Math.max(3, Math.min(cards.length || 0, 6));

  useEffect(() => {
    if (requestedPage === currentPage) return;
    setPageByScope((current) =>
      current[scope] === currentPage
        ? current
        : {
            ...current,
            [scope]: currentPage,
          }
    );
  }, [currentPage, requestedPage, scope]);

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

  const handleRenameCard = (card: WorkbookDraftCard) => {
    if (!card.canDelete) return;
    setPendingRenameCard(card);
    setRenameTitleDraft(card.title);
  };

  const handleConfirmRenameCard = async () => {
    const card = pendingRenameCard;
    if (!card || !card.canDelete) return;
    const nextTitle = renameTitleDraft.trim();
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
      setPendingRenameCard(null);
      triggerDraftCardsReload(true);
    } catch {
      setError("Не удалось изменить название карточки.");
    } finally {
      setRenamingSessionId(null);
    }
  };

  const markPreviewLoadFailure = useCallback((sessionId: string, previewUrl: string) => {
    setPreviewLoadErrorBySessionId((current) =>
      current[sessionId] === previewUrl
        ? current
        : {
            ...current,
            [sessionId]: previewUrl,
          }
    );
  }, []);

  const clearPreviewRefreshPending = useCallback((sessionId: string) => {
    setPreviewRefreshPendingBySessionId((current) => {
      if (!(sessionId in current)) return current;
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
  }, []);

  useEffect(() => {
    const hints = consumeWorkbookHubPreviewRefreshHints();
    if (hints.length === 0) return;
    setPreviewRefreshPendingBySessionId((current) => {
      const next = { ...current };
      hints.forEach((hint) => {
        next[hint.sessionId] = hint;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (Object.keys(previewRefreshPendingBySessionId).length === 0) return;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setPreviewRefreshPendingBySessionId((current) => {
        let changed = false;
        const next: PreviewRefreshPendingBySessionId = {};
        Object.entries(current).forEach(([sessionId, hint]) => {
          if (hint.expiresAt <= now) {
            changed = true;
            return;
          }
          next[sessionId] = hint;
        });
        return changed ? next : current;
      });
    }, HUB_PREVIEW_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [previewRefreshPendingBySessionId]);

  useEffect(() => {
    if (Object.keys(previewRefreshPendingBySessionId).length === 0) return;
    setPreviewRefreshPendingBySessionId((current) => {
      let changed = false;
      const next: PreviewRefreshPendingBySessionId = {};
      Object.entries(current).forEach(([sessionId, hint]) => {
        const card = drafts.find((item) => item.sessionId === sessionId);
        if (!card) {
          next[sessionId] = hint;
          return;
        }
        const updatedAt = Date.parse(card.updatedAt);
        if (Number.isFinite(updatedAt) && updatedAt >= hint.requestedAt) {
          changed = true;
          return;
        }
        if (hint.expiresAt <= Date.now()) {
          changed = true;
          return;
        }
        next[sessionId] = hint;
      });
      return changed ? next : current;
    });
  }, [drafts, previewRefreshPendingBySessionId]);

  const applyOptimisticPreviewToCard = useCallback((payload: WorkbookHubPreviewBridgePayload) => {
    const capturedAt =
      typeof payload.capturedAt === "string" && payload.capturedAt.trim().length > 0
        ? payload.capturedAt
        : new Date().toISOString();
    setDrafts((current) =>
      current.map((card) =>
        card.sessionId === payload.sessionId
          ? {
              ...card,
              previewUrl: payload.previewDataUrl,
              previewAlt:
                typeof payload.previewAlt === "string" && payload.previewAlt.trim().length > 0
                  ? payload.previewAlt.trim()
                  : card.previewAlt ?? "Последний вид доски",
              updatedAt: capturedAt,
            }
          : card
      )
    );
    setPreviewLoadErrorBySessionId((current) => {
      if (!(payload.sessionId in current)) return current;
      const next = { ...current };
      delete next[payload.sessionId];
      return next;
    });
    clearPreviewRefreshPending(payload.sessionId);
  }, [clearPreviewRefreshPending]);

  const persistPreviewPayloadToServer = useCallback(
    async (payload: WorkbookHubPreviewBridgePayload) => {
      try {
        const uploadedPreview = await uploadWorkbookAsset({
          sessionId: payload.sessionId,
          fileName: `session-preview-${payload.sessionId}-${Date.now()}.jpg`,
          dataUrl: payload.previewDataUrl,
          mimeType: "image/jpeg",
        });
        await updateWorkbookSessionDraftPreview({
          sessionId: payload.sessionId,
          previewUrl: uploadedPreview.url,
          previewAlt:
            typeof payload.previewAlt === "string" && payload.previewAlt.trim().length > 0
              ? payload.previewAlt.trim()
              : undefined,
          page:
            typeof payload.page === "number" && Number.isFinite(payload.page)
              ? Math.max(1, Math.trunc(payload.page))
              : undefined,
          viewport:
            payload.viewport &&
            Number.isFinite(payload.viewport.x) &&
            Number.isFinite(payload.viewport.y) &&
            Number.isFinite(payload.viewport.zoom)
              ? {
                  x: payload.viewport.x,
                  y: payload.viewport.y,
                  zoom: payload.viewport.zoom,
                }
              : undefined,
        });
        const synchronizedAt =
          typeof payload.capturedAt === "string" && payload.capturedAt.trim().length > 0
            ? payload.capturedAt
            : new Date().toISOString();
        setDrafts((current) =>
          current.map((card) =>
            card.sessionId === payload.sessionId
              ? {
                  ...card,
                  previewUrl: uploadedPreview.url,
                  previewAlt:
                    typeof payload.previewAlt === "string" && payload.previewAlt.trim().length > 0
                      ? payload.previewAlt.trim()
                      : card.previewAlt,
                  updatedAt: synchronizedAt,
                }
              : card
          )
        );
        setPreviewLoadErrorBySessionId((current) => {
          if (!(payload.sessionId in current)) return current;
          const next = { ...current };
          delete next[payload.sessionId];
          return next;
        });
        clearPreviewRefreshPending(payload.sessionId);
      } catch {
        // Preview persistence is best-effort; keep optimistic preview.
      }
    },
    [clearPreviewRefreshPending]
  );

  const flushPendingPreviewPersistQueue = useCallback(async () => {
    while (pendingPreviewPersistBySessionIdRef.current.size > 0) {
      const iterator = pendingPreviewPersistBySessionIdRef.current.entries().next();
      if (iterator.done) break;
      const [sessionId, payload] = iterator.value;
      pendingPreviewPersistBySessionIdRef.current.delete(sessionId);
      await persistPreviewPayloadToServer(payload);
    }
  }, [persistPreviewPayloadToServer]);

  const enqueuePreviewPersist = useCallback(
    (payload: WorkbookHubPreviewBridgePayload) => {
      const existing = pendingPreviewPersistBySessionIdRef.current.get(payload.sessionId);
      if (existing?.previewDataUrl === payload.previewDataUrl) return;
      pendingPreviewPersistBySessionIdRef.current.set(payload.sessionId, payload);
      previewPersistChainRef.current = previewPersistChainRef.current
        .then(() => flushPendingPreviewPersistQueue())
        .catch(() => undefined);
    },
    [flushPendingPreviewPersistQueue]
  );

  useEffect(() => {
    if (!isAuthReady || !user || user.role !== "teacher") return;
    const handlePreviewBridgeMessage = (event: MessageEvent<unknown>) => {
      if (typeof window === "undefined") return;
      if (event.origin !== window.location.origin) return;
      if (!isWorkbookHubPreviewBridgeMessage(event.data)) return;
      const payload = event.data.payload;
      applyOptimisticPreviewToCard(payload);
      enqueuePreviewPersist(payload);
    };
    window.addEventListener("message", handlePreviewBridgeMessage);
    return () => {
      window.removeEventListener("message", handlePreviewBridgeMessage);
    };
  }, [applyOptimisticPreviewToCard, enqueuePreviewPersist, isAuthReady, user]);

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
    if (!showStudentExitNotice) {
      return (
        <section className="workbook-launch workbook-entry-shell workbook-entry-shell--launch workbook-launch--auth-only">
          <AuthAmbientScene variant="launch" />
        </section>
      );
    }
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
              className="workbook-hub__start-class-btn"
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
        <div className="workbook-hub__search-strip" role="search" aria-label="Поиск карточек">
          <SearchRoundedIcon className="workbook-hub__search-icon" fontSize="small" />
          <input
            className="workbook-hub__search-input"
            type="search"
            value={searchQuery}
            placeholder="Поиск карточки по названию"
            onChange={(event) => {
              const nextQuery = event.target.value;
              setSearchQuery(nextQuery);
              setPageByScope((current) =>
                current.class === 1 && current.personal === 1
                  ? current
                  : {
                      class: 1,
                      personal: 1,
                    }
              );
            }}
          />
          {searchQuery.trim().length > 0 ? (
            <button
              type="button"
              className="workbook-hub__search-clear"
              onClick={() => {
                setSearchQuery("");
                setPageByScope((current) =>
                  current.class === 1 && current.personal === 1
                    ? current
                    : {
                        class: 1,
                        personal: 1,
                      }
                );
              }}
              aria-label="Очистить поиск"
            >
              <CloseRoundedIcon fontSize="small" />
            </button>
          ) : null}
        </div>
        <div className="workbook-hub__search-meta">
          <span>
            Найдено: {filteredCards.length}
          </span>
          {filteredCards.length > 0 ? (
            <span>
              Страница {currentPage} из {totalPages}
            </span>
          ) : null}
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
        ) : filteredCards.length === 0 ? (
          <Alert severity="info">
            {hasSearchResults
              ? "По вашему запросу карточки не найдены. Попробуйте другое название."
              : scope === "class"
                ? "Карточек индивидуальных занятий пока нет. Нажмите «Начать индивидуальное занятие»."
                : "Личных тетрадей пока нет. Нажмите «Новая личная тетрадь»."}
          </Alert>
        ) : (
          <>
            <div className="workbook-hub__list">
              {pageCards.map((card, cardIndex) => {
                const isCopying = copyingSessionId === card.sessionId;
                const isDeleting = deletingSessionId === card.sessionId;
                const isRenaming = renamingSessionId === card.sessionId;
                const rawPreviewUrl =
                  typeof card.previewUrl === "string" ? card.previewUrl.trim() : "";
                const previewUrl =
                  rawPreviewUrl.length > 0 &&
                  previewLoadErrorBySessionId[card.sessionId] !== rawPreviewUrl
                    ? rawPreviewUrl
                    : null;
                const previewAlt =
                  typeof card.previewAlt === "string" && card.previewAlt.trim().length > 0
                    ? card.previewAlt.trim()
                    : `${card.title} preview`;
                const hasActiveSession =
                  card.activityTone === "active" ||
                  (typeof card.activityLabel === "string" &&
                    card.activityLabel.trim().toLocaleLowerCase("ru-RU") === "идет сессия");
                const activityLabel = hasActiveSession ? "Идет сессия" : "Пауза";
                const activityTone = hasActiveSession ? "active" : "idle";
                const isPreviewRefreshing = Boolean(previewRefreshPendingBySessionId[card.sessionId]);
                return (
                  <article
                    className={`workbook-hub__card${previewUrl ? " workbook-hub__card--with-preview" : ""}${
                      isPreviewRefreshing ? " workbook-hub__card--preview-refreshing" : ""
                    }`}
                    key={card.sessionId}
                  >
                    {previewUrl ? (
                      <div className="workbook-hub__card-preview" aria-hidden="true">
                        <img
                          className="workbook-hub__card-preview-image"
                          src={previewUrl}
                          alt={previewAlt}
                          loading="eager"
                          decoding="async"
                          fetchPriority={cardIndex < 3 ? "high" : "auto"}
                          onError={() => markPreviewLoadFailure(card.sessionId, previewUrl)}
                        />
                        <span className="workbook-hub__card-preview-scrim" />
                      </div>
                    ) : null}
                    {isPreviewRefreshing ? (
                      <span className="workbook-hub__card-preview-refresh" aria-hidden="true" />
                    ) : null}
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

                      {activityLabel ? (
                        <div className="workbook-hub__card-activity-row">
                          <span
                            className={`workbook-hub__card-activity-badge${
                              activityTone ? ` is-${activityTone}` : ""
                            }`}
                          >
                            <span
                              className="workbook-hub__card-activity-badge-dot"
                              aria-hidden="true"
                            />
                            <span className="workbook-hub__card-activity-badge-text">
                              {activityLabel}
                            </span>
                          </span>
                        </div>
                      ) : null}

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
            {totalPages > 1 ? (
              <nav className="workbook-hub__pagination" aria-label="Пагинация карточек">
                <button
                  type="button"
                  className="workbook-hub__pagination-btn"
                  onClick={() =>
                    setPageByScope((current) => ({
                      ...current,
                      [scope]: Math.max(1, currentPage - 1),
                    }))
                  }
                  disabled={currentPage <= 1}
                >
                  Назад
                </button>
                <div className="workbook-hub__pagination-pages">
                  {paginationItems.map((pageItem, index) =>
                    pageItem === -1 ? (
                      <span key={`ellipsis-${index}`} className="workbook-hub__pagination-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={pageItem}
                        type="button"
                        className={`workbook-hub__pagination-btn workbook-hub__pagination-btn--page${
                          currentPage === pageItem ? " is-active" : ""
                        }`}
                        onClick={() =>
                          setPageByScope((current) => ({
                            ...current,
                            [scope]: pageItem,
                          }))
                        }
                        aria-current={currentPage === pageItem ? "page" : undefined}
                      >
                        {pageItem}
                      </button>
                    )
                  )}
                </div>
                <button
                  type="button"
                  className="workbook-hub__pagination-btn"
                  onClick={() =>
                    setPageByScope((current) => ({
                      ...current,
                      [scope]: Math.min(totalPages, currentPage + 1),
                    }))
                  }
                  disabled={currentPage >= totalPages}
                >
                  Вперед
                </button>
              </nav>
            ) : null}
          </>
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

      <PlatformConfirmDialog
        open={Boolean(pendingRenameCard)}
        title="Изменить название карточки"
        description="Введите новое название. Изменение сразу отобразится в карточке."
        confirmLabel="Сохранить"
        tone="neutral"
        loading={Boolean(renamingSessionId)}
        confirmDisabled={
          renameTitleDraft.trim().length < 2 ||
          renameTitleDraft.trim() === (pendingRenameCard?.title ?? "")
        }
        content={
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Название карточки"
            value={renameTitleDraft}
            onChange={(event) => setRenameTitleDraft(event.target.value)}
            disabled={Boolean(renamingSessionId)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              void handleConfirmRenameCard();
            }}
          />
        }
        onCancel={() => {
          if (renamingSessionId) return;
          setPendingRenameCard(null);
        }}
        onConfirm={() => void handleConfirmRenameCard()}
      />

    </section>
  );
}
