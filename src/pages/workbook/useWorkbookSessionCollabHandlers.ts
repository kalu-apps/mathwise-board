import { useCallback, type MutableRefObject } from "react";
import { createWorkbookInvite } from "@/features/workbook/model/api";
import { upsertWorkbookChatMessage } from "@/features/workbook/model/chatMessageState";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookChatMessage,
  WorkbookSessionParticipant,
} from "@/features/workbook/model/types";
import { generateId } from "@/shared/lib/id";
import type { WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

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
  isSessionChatMaximized: boolean;
  sessionChatRef: MutableRefObject<HTMLDivElement | null>;
  sessionChatDragStateRef: MutableRefObject<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>;
  onInviteLinkCopied?: () => void;
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
      historyEntry?: WorkbookHistoryEntry | null;
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
  isSessionChatMaximized,
  sessionChatRef,
  sessionChatDragStateRef,
  onInviteLinkCopied,
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
      onInviteLinkCopied?.();
    } catch {
      setError("Не удалось скопировать ссылку приглашения.");
    } finally {
      setCopyingInviteLink(false);
    }
  }, [onInviteLinkCopied, sessionId, setCopyingInviteLink, setError]);

  const handleMenuClearBoard = useCallback(async () => {
    if (!canClear || isEnded) return;
    setMenuAnchor(null);
    try {
      await clearLayerNow("board");
      setError(null);
    } catch {
      setError("Не удалось очистить страницу.");
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

  const handleToggleParticipantMicrophone = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, {
        canUseMicrophone: enabled,
      });
    },
    [updateParticipantPermissions]
  );

  const handleToggleParticipantCamera = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, {
        canUseCamera: enabled,
      });
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
    setChatMessages((current) => upsertWorkbookChatMessage(current, message));
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

  const handleEditSessionChatMessage = useCallback(
    async (messageId: string, rawText: string) => {
      if (!sessionId || !user?.id || !canSendSessionChat) return false;
      const text = rawText.trim().slice(0, 1000);
      if (!text) return false;
      const currentMessage = chatMessages.find((item) => item.id === messageId);
      if (!currentMessage || currentMessage.authorUserId !== user.id) {
        return false;
      }
      if (currentMessage.text === text) {
        setSessionChatDraft("");
        setIsSessionChatEmojiOpen(false);
        return true;
      }
      const nextMessage: WorkbookChatMessage = {
        ...currentMessage,
        text,
      };
      setChatMessages((current) => upsertWorkbookChatMessage(current, nextMessage));
      setSessionChatDraft("");
      setIsSessionChatEmojiOpen(false);
      try {
        await appendEventsAndApply([
          {
            type: "chat.message",
            payload: { message: nextMessage },
          },
        ]);
        return true;
      } catch {
        setChatMessages((current) => upsertWorkbookChatMessage(current, currentMessage));
        setSessionChatDraft(text);
        setError("Не удалось изменить сообщение.");
        return false;
      }
    },
    [
      appendEventsAndApply,
      canSendSessionChat,
      chatMessages,
      sessionId,
      setChatMessages,
      setError,
      setIsSessionChatEmojiOpen,
      setSessionChatDraft,
      user?.id,
    ]
  );

  const handleDeleteSessionChatMessage = useCallback(
    async (messageId: string) => {
      if (!sessionId || !user?.id) return false;
      const deletedMessageIndex = chatMessages.findIndex((item) => item.id === messageId);
      const currentMessage =
        deletedMessageIndex >= 0 ? chatMessages[deletedMessageIndex] : null;
      if (!currentMessage) return false;
      if (currentMessage.authorUserId !== user.id && !canManageSession) {
        return false;
      }
      setChatMessages((current) => current.filter((item) => item.id !== messageId));
      try {
        await appendEventsAndApply([
          {
            type: "chat.message.delete",
            payload: { messageId },
          },
        ]);
        return true;
      } catch {
        setChatMessages((current) => {
          if (current.some((item) => item.id === messageId)) {
            return current;
          }
          const next = [...current];
          const safeInsertIndex = Math.min(Math.max(deletedMessageIndex, 0), next.length);
          next.splice(safeInsertIndex, 0, currentMessage);
          return next;
        });
        setError("Не удалось удалить сообщение.");
        return false;
      }
    },
    [
      appendEventsAndApply,
      canManageSession,
      chatMessages,
      sessionId,
      setChatMessages,
      setError,
      user?.id,
    ]
  );

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
      if (isCompactViewport || isSessionChatMaximized) return;
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
      sessionChatDragStateRef,
      sessionChatRef,
    ]
  );

  return {
    handleCopyInviteLink,
    handleMenuClearBoard,
    updateParticipantPermissions,
    handleToggleParticipantBoardTools,
    handleToggleParticipantMicrophone,
    handleToggleParticipantCamera,
    handleSendSessionChatMessage,
    handleEditSessionChatMessage,
    handleDeleteSessionChatMessage,
    handleClearSessionChat,
    handleSessionChatDragStart,
  };
};
