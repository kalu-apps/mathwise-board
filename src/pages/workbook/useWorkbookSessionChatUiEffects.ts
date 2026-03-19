import { useEffect, type MutableRefObject, type RefObject } from "react";

interface SessionChatPosition {
  x: number;
  y: number;
}

interface SessionChatDragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

interface UseWorkbookSessionChatUiEffectsParams {
  sessionChatReadStorageKey: string;
  setSessionChatReadAt: (value: string | null) => void;
  canUseSessionChat: boolean;
  isSessionChatOpen: boolean;
  setIsSessionChatOpen: (value: boolean) => void;
  setIsSessionChatEmojiOpen: (value: boolean) => void;
  setSessionChatDraft: (value: string) => void;
  isSessionChatMinimized: boolean;
  isSessionChatMaximized: boolean;
  isSessionChatAtBottom: boolean;
  firstUnreadSessionChatMessageId: string | null;
  sessionChatUnreadCount: number;
  chatMessages: Array<{ id: string }>;
  sessionChatShouldScrollToUnreadRef: MutableRefObject<boolean>;
  sessionChatListRef: RefObject<HTMLDivElement | null>;
  sessionChatRef: RefObject<HTMLDivElement | null>;
  sessionChatDragStateRef: MutableRefObject<SessionChatDragState | null>;
  isCompactViewport: boolean;
  setIsSessionChatAtBottom: (value: boolean) => void;
  markSessionChatReadToLatest: () => void;
  scrollSessionChatToLatest: (behavior?: ScrollBehavior) => void;
  scrollSessionChatToMessage: (messageId: string, behavior?: ScrollBehavior) => boolean;
  setSessionChatPosition: (
    value: SessionChatPosition | ((current: SessionChatPosition) => SessionChatPosition)
  ) => void;
  sessionChatScrollBottomThresholdPx: number;
}

export function useWorkbookSessionChatUiEffects({
  sessionChatReadStorageKey,
  setSessionChatReadAt,
  canUseSessionChat,
  isSessionChatOpen,
  setIsSessionChatOpen,
  setIsSessionChatEmojiOpen,
  setSessionChatDraft,
  isSessionChatMinimized,
  isSessionChatMaximized,
  isSessionChatAtBottom,
  firstUnreadSessionChatMessageId,
  sessionChatUnreadCount,
  chatMessages,
  sessionChatShouldScrollToUnreadRef,
  sessionChatListRef,
  sessionChatRef,
  sessionChatDragStateRef,
  isCompactViewport,
  setIsSessionChatAtBottom,
  markSessionChatReadToLatest,
  scrollSessionChatToLatest,
  scrollSessionChatToMessage,
  setSessionChatPosition,
  sessionChatScrollBottomThresholdPx,
}: UseWorkbookSessionChatUiEffectsParams) {
  useEffect(() => {
    if (!sessionChatReadStorageKey) {
      setSessionChatReadAt(null);
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(sessionChatReadStorageKey);
    setSessionChatReadAt(stored && stored.trim().length > 0 ? stored : null);
  }, [sessionChatReadStorageKey, setSessionChatReadAt]);

  useEffect(() => {
    if (!canUseSessionChat && isSessionChatOpen) {
      setIsSessionChatOpen(false);
      setIsSessionChatEmojiOpen(false);
      setSessionChatDraft("");
    }
  }, [
    canUseSessionChat,
    isSessionChatOpen,
    setIsSessionChatEmojiOpen,
    setIsSessionChatOpen,
    setSessionChatDraft,
  ]);

  useEffect(() => {
    if (!isSessionChatOpen || isSessionChatMinimized) return;
    const hasUnread = Boolean(firstUnreadSessionChatMessageId);
    if (sessionChatShouldScrollToUnreadRef.current) {
      sessionChatShouldScrollToUnreadRef.current = false;
      if (hasUnread && firstUnreadSessionChatMessageId) {
        const scrolled = scrollSessionChatToMessage(firstUnreadSessionChatMessageId);
        if (!scrolled) {
          window.requestAnimationFrame(() => {
            void scrollSessionChatToMessage(firstUnreadSessionChatMessageId);
          });
        }
        return;
      }
      scrollSessionChatToLatest();
      return;
    }
    if (isSessionChatAtBottom) {
      scrollSessionChatToLatest();
      if (sessionChatUnreadCount > 0) {
        markSessionChatReadToLatest();
      }
    }
  }, [
    chatMessages,
    firstUnreadSessionChatMessageId,
    isSessionChatAtBottom,
    isSessionChatMinimized,
    isSessionChatOpen,
    markSessionChatReadToLatest,
    scrollSessionChatToLatest,
    scrollSessionChatToMessage,
    sessionChatShouldScrollToUnreadRef,
    sessionChatUnreadCount,
  ]);

  useEffect(() => {
    if (!isSessionChatOpen || isSessionChatMinimized) return;
    const container = sessionChatListRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const nextAtBottom = distanceToBottom <= sessionChatScrollBottomThresholdPx;
      setIsSessionChatAtBottom(nextAtBottom);
      if (nextAtBottom && sessionChatUnreadCount > 0) {
        markSessionChatReadToLatest();
      }
    };
    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [
    isSessionChatMinimized,
    isSessionChatOpen,
    markSessionChatReadToLatest,
    sessionChatListRef,
    sessionChatScrollBottomThresholdPx,
    sessionChatUnreadCount,
    setIsSessionChatAtBottom,
  ]);

  useEffect(() => {
    if (
      isCompactViewport ||
      !isSessionChatOpen ||
      isSessionChatMinimized ||
      isSessionChatMaximized
    ) {
      return;
    }
    const panel = sessionChatRef.current;
    if (!panel || typeof window === "undefined") return;
    const panelWidth = panel.offsetWidth || 420;
    const panelHeight = panel.offsetHeight || 420;
    const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panelHeight - 8);
    setSessionChatPosition((current) => ({
      x: Math.min(maxX, Math.max(8, current.x)),
      y: Math.min(maxY, Math.max(8, current.y)),
    }));
  }, [
    isCompactViewport,
    isSessionChatMaximized,
    isSessionChatMinimized,
    isSessionChatOpen,
    sessionChatRef,
    setSessionChatPosition,
  ]);

  useEffect(() => {
    if (
      isCompactViewport ||
      !isSessionChatOpen ||
      isSessionChatMaximized ||
      isSessionChatMinimized
    ) {
      return;
    }
    const onPointerMove = (event: PointerEvent) => {
      const dragState = sessionChatDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const panel = sessionChatRef.current;
      if (!panel) return;
      const panelWidth = panel.offsetWidth || 420;
      const panelHeight = panel.offsetHeight || 420;
      const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
      const maxY = Math.max(8, window.innerHeight - panelHeight - 8);
      setSessionChatPosition({
        x: Math.min(maxX, Math.max(8, event.clientX - dragState.offsetX)),
        y: Math.min(maxY, Math.max(8, event.clientY - dragState.offsetY)),
      });
    };
    const onPointerUp = (event: PointerEvent) => {
      const dragState = sessionChatDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      sessionChatDragStateRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      sessionChatDragStateRef.current = null;
    };
  }, [
    isCompactViewport,
    isSessionChatMaximized,
    isSessionChatMinimized,
    isSessionChatOpen,
    sessionChatDragStateRef,
    sessionChatRef,
    setSessionChatPosition,
  ]);

  useEffect(() => {
    if (!isCompactViewport) return;
    sessionChatDragStateRef.current = null;
    setSessionChatPosition({ x: 8, y: 56 });
  }, [isCompactViewport, sessionChatDragStateRef, setSessionChatPosition]);
}
