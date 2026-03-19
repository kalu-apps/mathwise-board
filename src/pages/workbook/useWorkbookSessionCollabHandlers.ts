import { useCallback, type MutableRefObject } from "react";
import { createWorkbookInvite } from "@/features/workbook/model/api";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookChatMessage,
  WorkbookSessionParticipant,
} from "@/features/workbook/model/types";
import { generateId } from "@/shared/lib/id";

type Updater<T> = T | ((current: T) => T);

type UserIdentity = {
  id?: string;
  firstName?: string;
  lastName?: string;
};

type UseWorkbookSessionCollabHandlersParams = {
  sessionId: string;
  user?: UserIdentity;
  actorDisplayName?: string;
  canClear: boolean;
  isEnded: boolean;
  canManageSession: boolean;
  canSendSessionChat: boolean;
  sessionChatDraft: string;
  chatMessages: WorkbookChatMessage[];
  isCompactViewport: boolean;
  isSessionChatMinimized: boolean;
  isSessionChatMaximized: boolean;
  sessionChatRef: MutableRefObject<HTMLDivElement | null>;
  sessionChatDragStateRef: MutableRefObject<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>;
  setCopyingInviteLink: (value: boolean) => void;
  setError: (value: string | null) => void;
  setMenuAnchor: (value: HTMLElement | null) => void;
  setChatMessages: (value: Updater<WorkbookChatMessage[]>) => void;
  setSessionChatDraft: (value: string) => void;
  setIsSessionChatEmojiOpen: (value: boolean) => void;
  setIsSessionChatAtBottom: (value: boolean) => void;
  scrollSessionChatToLatest: (behavior?: ScrollBehavior) => void;
  markSessionChatReadToLatest: () => void;
  clearLayerNow: (layer: "board" | "annotations") => Promise<void>;
  appendEventsAndApply: (
    events: WorkbookClientEventInput[],
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
      historyEntry?: unknown;
    }
  ) => Promise<void>;
};

export const useWorkbookSessionCollabHandlers = ({
  sessionId,
  user,
  actorDisplayName,
  canClear,
  isEnded,
  canManageSession,
  canSendSessionChat,
  sessionChatDraft,
  chatMessages,
  isCompactViewport,
  isSessionChatMinimized,
  isSessionChatMaximized,
  sessionChatRef,
  sessionChatDragStateRef,
  setCopyingInviteLink,
  setError,
  setMenuAnchor,
  setChatMessages,
  setSessionChatDraft,
  setIsSessionChatEmojiOpen,
  setIsSessionChatAtBottom,
  scrollSessionChatToLatest,
  markSessionChatReadToLatest,
  clearLayerNow,
  appendEventsAndApply,
}: UseWorkbookSessionCollabHandlersParams) => {
  const handleCopyInviteLink = useCallback(async () => {
    if (!sessionId) return;
    try {
      setCopyingInviteLink(true);
      const invite = await createWorkbookInvite(sessionId);
      const rawInviteUrl =
        typeof invite.inviteUrl === "string" ? invite.inviteUrl.trim() : "";
      const invitePath =
        rawInviteUrl.startsWith("http://") || rawInviteUrl.startsWith("https://")
          ? rawInviteUrl
          : rawInviteUrl.length > 0
            ? rawInviteUrl.startsWith("/")
              ? rawInviteUrl
              : `/${rawInviteUrl}`
            : `/workbook/invite/${encodeURIComponent(invite.token)}`;
      const absoluteInviteUrl =
        invitePath.startsWith("http://") || invitePath.startsWith("https://")
          ? invitePath
          : new URL(invitePath, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteInviteUrl);
      setError(null);
    } catch {
      setError("Не удалось скопировать ссылку приглашения.");
    } finally {
      setCopyingInviteLink(false);
    }
  }, [sessionId, setCopyingInviteLink, setError]);

  const handleMenuClearBoard = useCallback(async () => {
    if (!canClear || isEnded) return;
    setMenuAnchor(null);
    const confirmed = window.confirm("Очистить доску целиком?");
    if (!confirmed) return;
    try {
      await clearLayerNow("board");
      setError(null);
    } catch {
      setError("Не удалось очистить доску.");
    }
  }, [canClear, clearLayerNow, isEnded, setError, setMenuAnchor]);

  const updateParticipantPermissions = useCallback(
    async (
      targetUserId: string,
      patch: Partial<WorkbookSessionParticipant["permissions"]>
    ) => {
      if (!canManageSession) return;
      try {
        await appendEventsAndApply([
          {
            type: "permissions.update",
            payload: {
              userId: targetUserId,
              permissions: patch,
            },
          },
        ]);
      } catch {
        setError("Не удалось обновить права участника.");
      }
    },
    [appendEventsAndApply, canManageSession, setError]
  );

  const handleToggleParticipantBoardTools = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, {
        canDraw: enabled,
        canAnnotate: enabled,
        canSelect: enabled,
        canDelete: enabled,
        canInsertImage: enabled,
        canClear: enabled,
        canUseLaser: enabled,
      });
    },
    [updateParticipantPermissions]
  );

  const handleToggleParticipantChat = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, { canUseChat: enabled });
    },
    [updateParticipantPermissions]
  );

  const handleToggleParticipantMic = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, { canUseMedia: enabled });
    },
    [updateParticipantPermissions]
  );

  const handleSendSessionChatMessage = useCallback(async () => {
    if (!sessionId || !user?.id || !canSendSessionChat) return;
    const text = sessionChatDraft.trim();
    if (!text) return;
    const authorName =
      actorDisplayName ||
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      "Участник";
    const message: WorkbookChatMessage = {
      id: generateId(),
      authorUserId: user.id,
      authorName,
      text: text.slice(0, 1000),
      createdAt: new Date().toISOString(),
    };
    setChatMessages((current) =>
      current.some((item) => item.id === message.id) ? current : [...current, message]
    );
    setSessionChatDraft("");
    setIsSessionChatEmojiOpen(false);
    setIsSessionChatAtBottom(true);
    scrollSessionChatToLatest("smooth");
    markSessionChatReadToLatest();
    try {
      await appendEventsAndApply([
        {
          type: "chat.message",
          payload: { message },
        },
      ]);
    } catch {
      setChatMessages((current) => current.filter((item) => item.id !== message.id));
      setSessionChatDraft(text);
      setError("Не удалось отправить сообщение в чат.");
    }
  }, [
    actorDisplayName,
    appendEventsAndApply,
    canSendSessionChat,
    markSessionChatReadToLatest,
    scrollSessionChatToLatest,
    sessionChatDraft,
    sessionId,
    setChatMessages,
    setError,
    setIsSessionChatAtBottom,
    setIsSessionChatEmojiOpen,
    setSessionChatDraft,
    user?.firstName,
    user?.id,
    user?.lastName,
  ]);

  const handleClearSessionChat = useCallback(async () => {
    if (!canManageSession || chatMessages.length === 0) return;
    const previous = chatMessages;
    setChatMessages([]);
    try {
      await appendEventsAndApply([
        {
          type: "chat.clear",
          payload: {},
        },
      ]);
    } catch {
      setChatMessages(previous);
      setError("Не удалось очистить чат.");
    }
  }, [appendEventsAndApply, canManageSession, chatMessages, setChatMessages, setError]);

  const handleSessionChatDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isCompactViewport || isSessionChatMinimized || isSessionChatMaximized) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button")) return;
      const panel = sessionChatRef.current;
      if (!panel) return;
      const offsetX = event.clientX - panel.getBoundingClientRect().left;
      const offsetY = event.clientY - panel.getBoundingClientRect().top;
      sessionChatDragStateRef.current = {
        pointerId: event.pointerId,
        offsetX,
        offsetY,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [
      isCompactViewport,
      isSessionChatMaximized,
      isSessionChatMinimized,
      sessionChatDragStateRef,
      sessionChatRef,
    ]
  );

  return {
    handleCopyInviteLink,
    handleMenuClearBoard,
    updateParticipantPermissions,
    handleToggleParticipantBoardTools,
    handleToggleParticipantChat,
    handleToggleParticipantMic,
    handleSendSessionChatMessage,
    handleClearSessionChat,
    handleSessionChatDragStart,
  };
};
