import { useCallback, useDeferredValue, useMemo, type MutableRefObject, type RefObject } from "react";
import {
  isLiveReplayableWorkbookEventType,
  isVolatileWorkbookEventType,
} from "@/features/workbook/model/events";
import { normalizeChatMessagePayload } from "@/features/workbook/model/scene";
import type { WorkbookChatMessage, WorkbookEvent } from "@/features/workbook/model/types";
import { parseChatTimestamp } from "./WorkbookSessionPage.core";

type SetStringState = (value: string | null | ((current: string | null) => string | null)) => void;
type SetBooleanState = (value: boolean | ((current: boolean) => boolean)) => void;

interface UseWorkbookSessionChatEventHandlersParams {
  sessionId: string;
  userId?: string;
  actorUserId?: string;
  chatMessages: WorkbookChatMessage[];
  sessionChatReadAt: string | null;
  setSessionChatReadAt: SetStringState;
  setIsSessionChatAtBottom: SetBooleanState;
  sessionChatListRef: RefObject<HTMLDivElement | null>;
  latestSeqRef: MutableRefObject<number>;
  lastAppliedSeqRef: MutableRefObject<number>;
  processedEventIdsRef: MutableRefObject<Set<string>>;
}

interface FilterUnseenWorkbookEventsOptions {
  allowLiveReplay?: boolean;
  ignoreSeqGuard?: boolean;
}

export function useWorkbookSessionChatEventHandlers({
  sessionId,
  userId,
  actorUserId,
  chatMessages,
  sessionChatReadAt,
  setSessionChatReadAt,
  setIsSessionChatAtBottom,
  sessionChatListRef,
  latestSeqRef,
  lastAppliedSeqRef,
  processedEventIdsRef,
}: UseWorkbookSessionChatEventHandlersParams) {
  const sessionChatReadStorageKey = useMemo(
    () => (sessionId && userId ? `workbook:chat-read:${sessionId}:${userId}` : ""),
    [sessionId, userId]
  );
  const contextbarStorageKey = useMemo(
    () => (sessionId && userId ? `workbook:contextbar:${sessionId}:${userId}` : ""),
    [sessionId, userId]
  );
  const sessionTabLockStorageKey = useMemo(
    () => (sessionId && userId ? `workbook:tab-lock:${sessionId}:${userId}` : ""),
    [sessionId, userId]
  );
  const sessionTabLockChannelName = useMemo(
    () => (sessionId && userId ? `workbook-tab-lock:${sessionId}:${userId}` : ""),
    [sessionId, userId]
  );
  const personalBoardSettingsStorageKey = useMemo(() => {
    const effectiveActorUserId = actorUserId ?? userId ?? "";
    return sessionId && effectiveActorUserId
      ? `workbook:personal-board-settings:${sessionId}:${effectiveActorUserId}`
      : "";
  }, [actorUserId, sessionId, userId]);

  const deferredChatMessages = useDeferredValue(chatMessages);
  const unreadSessionChatMessages = useMemo(() => {
    if (!userId) return [];
    let readIndex = sessionChatReadAt
      ? deferredChatMessages.findIndex((message) => message.id === sessionChatReadAt)
      : -1;
    if (readIndex < 0 && sessionChatReadAt) {
      const readTimestamp = parseChatTimestamp(sessionChatReadAt);
      if (readTimestamp > 0) {
        deferredChatMessages.forEach((message, index) => {
          if (parseChatTimestamp(message.createdAt) <= readTimestamp) {
            readIndex = index;
          }
        });
      }
    }
    return deferredChatMessages
      .slice(readIndex + 1)
      .filter((message) => message.authorUserId !== userId);
  }, [deferredChatMessages, sessionChatReadAt, userId]);
  const sessionChatUnreadCount = unreadSessionChatMessages.length;
  const firstUnreadSessionChatMessageId = unreadSessionChatMessages[0]?.id ?? null;

  const persistSessionChatReadAt = useCallback(
    (value: string | null) => {
      if (!sessionChatReadStorageKey || typeof window === "undefined") return;
      if (!value) {
        window.localStorage.removeItem(sessionChatReadStorageKey);
        return;
      }
      window.localStorage.setItem(sessionChatReadStorageKey, value);
    },
    [sessionChatReadStorageKey]
  );

  const markSessionChatReadToLatest = useCallback(() => {
    const latestMessage = chatMessages[chatMessages.length - 1];
    if (!latestMessage) return;
    const latestMessageId = latestMessage.id;
    setSessionChatReadAt((current) => {
      if (current === latestMessageId) {
        return current;
      }
      persistSessionChatReadAt(latestMessageId);
      return latestMessageId;
    });
  }, [chatMessages, persistSessionChatReadAt, setSessionChatReadAt]);

  const scrollSessionChatToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = sessionChatListRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    setIsSessionChatAtBottom(true);
  }, [sessionChatListRef, setIsSessionChatAtBottom]);

  const scrollSessionChatToMessage = useCallback(
    (messageId: string, behavior: ScrollBehavior = "auto") => {
      const container = sessionChatListRef.current;
      if (!container) return false;
      const target = container.querySelector<HTMLElement>(
        `[data-session-chat-message-id="${messageId}"]`
      );
      if (!target) return false;
      target.scrollIntoView({
        block: "start",
        behavior,
      });
      return true;
    },
    [sessionChatListRef]
  );

  const filterUnseenWorkbookEvents = useCallback(
    (events: WorkbookEvent[], options?: FilterUnseenWorkbookEventsOptions) => {
      const unseen: WorkbookEvent[] = [];
      events.forEach((event) => {
        const allowReplay = Boolean(
          options?.allowLiveReplay && isLiveReplayableWorkbookEventType(event.type)
        );
        if (
          !options?.ignoreSeqGuard &&
          !allowReplay &&
          !isVolatileWorkbookEventType(event.type) &&
          typeof event?.seq === "number" &&
          Number.isFinite(event.seq) &&
          event.seq <= lastAppliedSeqRef.current
        ) {
          return;
        }
        if (!event?.id || processedEventIdsRef.current.has(event.id)) return;
        processedEventIdsRef.current.add(event.id);
        unseen.push(event);
      });
      if (processedEventIdsRef.current.size > 50_000) {
        processedEventIdsRef.current.clear();
        unseen.slice(-2_000).forEach((event) => {
          if (event?.id) {
            processedEventIdsRef.current.add(event.id);
          }
        });
      }
      return unseen;
    },
    [lastAppliedSeqRef, processedEventIdsRef]
  );

  const recoverChatMessagesFromEvents = useCallback((events: WorkbookEvent[]) => {
    if (events.length === 0) return [] as WorkbookChatMessage[];
    const sorted = [...events].sort((left, right) => left.seq - right.seq);
    let restored: WorkbookChatMessage[] = [];
    sorted.forEach((event) => {
      if (event.type === "chat.clear") {
        restored = [];
        return;
      }
      if (event.type === "chat.message.delete") {
        const messageId = (event.payload as { messageId?: unknown })?.messageId;
        if (typeof messageId === "string" && messageId) {
          restored = restored.filter((message) => message.id !== messageId);
        }
        return;
      }
      if (event.type !== "chat.message") return;
      const message = normalizeChatMessagePayload(
        (event.payload as { message?: unknown })?.message
      );
      if (!message) return;
      if (restored.some((item) => item.id === message.id)) return;
      restored = [...restored, message];
    });
    return restored;
  }, []);

  return {
    sessionChatReadStorageKey,
    contextbarStorageKey,
    sessionTabLockStorageKey,
    sessionTabLockChannelName,
    personalBoardSettingsStorageKey,
    sessionChatUnreadCount,
    firstUnreadSessionChatMessageId,
    markSessionChatReadToLatest,
    scrollSessionChatToLatest,
    scrollSessionChatToMessage,
    filterUnseenWorkbookEvents,
    recoverChatMessagesFromEvents,
  };
}
