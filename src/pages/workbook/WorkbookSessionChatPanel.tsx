import {
  useCallback,
  useMemo,
  useState,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from "@mui/material";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import SentimentSatisfiedRoundedIcon from "@mui/icons-material/SentimentSatisfiedRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import KeyboardDoubleArrowDownRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowDownRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EmojiPicker, {
  EmojiStyle,
  SuggestionMode,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import type { WorkbookChatMessage } from "@/features/workbook/model/types";

type SessionChatPosition = {
  x: number;
  y: number;
};

type SessionChatDragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

type ChatMessageContextMenu = {
  messageId: string;
  x: number;
  y: number;
};

type WorkbookSessionChatPanelProps = {
  showCollaborationPanels: boolean;
  isSessionChatOpen: boolean;
  sessionChatRef: RefObject<HTMLDivElement | null>;
  sessionChatListRef: RefObject<HTMLDivElement | null>;
  sessionChatDragStateRef: MutableRefObject<SessionChatDragState | null>;
  isSessionChatMinimized: boolean;
  isSessionChatMaximized: boolean;
  isCompactViewport: boolean;
  sessionChatPosition: SessionChatPosition;
  chatMessages: WorkbookChatMessage[];
  firstUnreadSessionChatMessageId: string | null;
  currentUserId?: string;
  canManageSession: boolean;
  canSendSessionChat: boolean;
  sessionChatUnreadCount: number;
  isSessionChatAtBottom: boolean;
  sessionChatDraft: string;
  isSessionChatEmojiOpen: boolean;
  setIsSessionChatMinimized: (value: boolean | ((current: boolean) => boolean)) => void;
  setIsSessionChatMaximized: (value: boolean | ((current: boolean) => boolean)) => void;
  setIsSessionChatOpen: (value: boolean) => void;
  setIsSessionChatEmojiOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setSessionChatDraft: (value: string | ((current: string) => string)) => void;
  setIsClearSessionChatDialogOpen: (value: boolean) => void;
  onSessionChatDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onScrollSessionChatToLatest: (behavior?: ScrollBehavior) => void;
  onMarkSessionChatReadToLatest: () => void;
  onSendSessionChatMessage: () => Promise<void>;
  onEditSessionChatMessage: (messageId: string, text: string) => Promise<boolean>;
  onDeleteSessionChatMessage: (messageId: string) => Promise<boolean>;
};

export function WorkbookSessionChatPanel({
  showCollaborationPanels,
  isSessionChatOpen,
  sessionChatRef,
  sessionChatListRef,
  sessionChatDragStateRef,
  isSessionChatMinimized,
  isSessionChatMaximized,
  isCompactViewport,
  sessionChatPosition,
  chatMessages,
  firstUnreadSessionChatMessageId,
  currentUserId,
  canManageSession,
  canSendSessionChat,
  sessionChatUnreadCount,
  isSessionChatAtBottom,
  sessionChatDraft,
  isSessionChatEmojiOpen,
  setIsSessionChatMinimized,
  setIsSessionChatMaximized,
  setIsSessionChatOpen,
  setIsSessionChatEmojiOpen,
  setSessionChatDraft,
  setIsClearSessionChatDialogOpen,
  onSessionChatDragStart,
  onScrollSessionChatToLatest,
  onMarkSessionChatReadToLatest,
  onSendSessionChatMessage,
  onEditSessionChatMessage,
  onDeleteSessionChatMessage,
}: WorkbookSessionChatPanelProps) {
  const [messageContextMenu, setMessageContextMenu] = useState<ChatMessageContextMenu | null>(
    null
  );
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const editingMessage = useMemo(() => {
    if (!editingMessageId) return null;
    return chatMessages.find((message) => message.id === editingMessageId) ?? null;
  }, [chatMessages, editingMessageId]);

  const handleCloseMessageContextMenu = useCallback(() => {
    setMessageContextMenu(null);
  }, []);

  const handleMessageContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, message: WorkbookChatMessage) => {
      if (!currentUserId || message.authorUserId !== currentUserId) return;
      event.preventDefault();
      setMessageContextMenu({
        messageId: message.id,
        x: event.clientX + 4,
        y: event.clientY - 2,
      });
    },
    [currentUserId]
  );

  const handleCancelMessageEdit = useCallback(() => {
    setEditingMessageId(null);
    setSessionChatDraft("");
  }, [setSessionChatDraft]);

  const handleStartMessageEdit = useCallback(() => {
    if (!messageContextMenu || !currentUserId) return;
    const targetMessage = chatMessages.find((message) => message.id === messageContextMenu.messageId);
    if (!targetMessage || targetMessage.authorUserId !== currentUserId) {
      handleCloseMessageContextMenu();
      return;
    }
    setEditingMessageId(targetMessage.id);
    setSessionChatDraft(targetMessage.text);
    setIsSessionChatEmojiOpen(false);
    handleCloseMessageContextMenu();
  }, [
    chatMessages,
    currentUserId,
    handleCloseMessageContextMenu,
    messageContextMenu,
    setIsSessionChatEmojiOpen,
    setSessionChatDraft,
  ]);

  const handleDeleteMessage = useCallback(async () => {
    if (!messageContextMenu) return;
    const messageId = messageContextMenu.messageId;
    handleCloseMessageContextMenu();
    const isDeleted = await onDeleteSessionChatMessage(messageId);
    if (!isDeleted) return;
    if (editingMessageId === messageId) {
      setEditingMessageId(null);
      setSessionChatDraft("");
      setIsSessionChatEmojiOpen(false);
    }
  }, [
    editingMessageId,
    handleCloseMessageContextMenu,
    messageContextMenu,
    onDeleteSessionChatMessage,
    setIsSessionChatEmojiOpen,
    setSessionChatDraft,
  ]);

  const handleSubmitSessionChatDraft = useCallback(async () => {
    if (editingMessageId) {
      if (!editingMessage) {
        setEditingMessageId(null);
        setSessionChatDraft("");
        return;
      }
      const isUpdated = await onEditSessionChatMessage(editingMessageId, sessionChatDraft);
      if (isUpdated) {
        setEditingMessageId(null);
      }
      return;
    }
    await onSendSessionChatMessage();
  }, [
    editingMessageId,
    editingMessage,
    onEditSessionChatMessage,
    onSendSessionChatMessage,
    sessionChatDraft,
    setSessionChatDraft,
  ]);

  if (!showCollaborationPanels || !isSessionChatOpen) {
    return null;
  }
  const handleToggleMinimized = () => {
    if (isSessionChatMinimized) {
      setIsSessionChatMinimized(false);
      return;
    }
    if (isSessionChatMaximized) {
      setIsSessionChatMaximized(false);
    }
    setIsSessionChatMinimized(true);
  };

  const handleToggleMaximized = () => {
    if (isSessionChatMaximized) {
      setIsSessionChatMaximized(false);
      return;
    }
    if (isSessionChatMinimized) {
      setIsSessionChatMinimized(false);
    }
    setIsSessionChatMaximized(true);
  };

  const handleSelectEmoji = (emojiData: EmojiClickData) => {
    setSessionChatDraft((current) => `${current}${emojiData.emoji}`);
  };

  return (
    <div
      ref={sessionChatRef}
      className={`workbook-session__session-chat${
        isSessionChatMinimized ? " is-minimized" : ""
      }${isSessionChatMaximized ? " is-maximized" : ""}`}
      style={
        isSessionChatMaximized || isCompactViewport
          ? undefined
          : { left: sessionChatPosition.x, top: sessionChatPosition.y }
      }
    >
      <div className="workbook-session__session-chat-head" onPointerDown={onSessionChatDragStart}>
        <h4>
          <ForumRoundedIcon fontSize="small" />
          Чат
        </h4>
        <div className="workbook-session__session-chat-head-actions">
          {canManageSession && chatMessages.length > 0 ? (
            <Tooltip title="Очистить чат" arrow>
              <IconButton
                size="small"
                className="workbook-session__session-chat-head-icon"
                onClick={() => setIsClearSessionChatDialogOpen(true)}
                aria-label="Очистить чат"
              >
                <DeleteSweepRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          <IconButton
            size="small"
            className="workbook-session__session-chat-head-icon"
            aria-label={isSessionChatMinimized ? "Развернуть чат" : "Свернуть чат"}
            onClick={handleToggleMinimized}
          >
            {isSessionChatMinimized ? (
              <UnfoldMoreRoundedIcon fontSize="small" />
            ) : (
              <UnfoldLessRoundedIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            className="workbook-session__session-chat-head-icon"
            aria-label={
              isSessionChatMaximized ? "Обычный размер чата" : "Развернуть чат на максимум"
            }
            onClick={handleToggleMaximized}
            disabled={isSessionChatMinimized}
          >
            {isSessionChatMaximized ? (
              <FullscreenExitRoundedIcon fontSize="small" />
            ) : (
              <FullscreenRoundedIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            className="workbook-session__session-chat-head-icon"
            aria-label="Закрыть чат"
            onClick={() => {
              setIsSessionChatOpen(false);
              setIsSessionChatEmojiOpen(false);
              setEditingMessageId(null);
              sessionChatDragStateRef.current = null;
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </div>
      </div>

      {!isSessionChatMinimized ? (
        <>
          <div className="workbook-session__chat-list" ref={sessionChatListRef}>
            {chatMessages.length === 0 ? (
              <p className="workbook-session__hint">
                Сообщений пока нет. Используйте чат для быстрых текстовых подсказок.
              </p>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`workbook-session__chat-item${
                    message.authorUserId === currentUserId ? " is-own" : ""
                  }`}
                >
                  {firstUnreadSessionChatMessageId === message.id ? (
                    <div className="workbook-session__chat-unread-divider">Непрочитанные</div>
                  ) : null}
                  <article
                    data-session-chat-message-id={message.id}
                    className={`workbook-session__chat-message${
                      message.authorUserId === currentUserId ? " is-own" : ""
                    }`}
                    onContextMenu={(event) => handleMessageContextMenu(event, message)}
                  >
                    <strong>{message.authorName}</strong>
                    <p>{message.text}</p>
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </article>
                </div>
              ))
            )}
            {sessionChatUnreadCount > 0 && !isSessionChatAtBottom ? (
              <div className="workbook-session__chat-scroll-latest-wrap">
                <Tooltip title="Перемотать к последнему сообщению" arrow>
                  <IconButton
                    size="small"
                    className="workbook-session__chat-scroll-latest"
                    onClick={() => {
                      onScrollSessionChatToLatest("smooth");
                      onMarkSessionChatReadToLatest();
                    }}
                    aria-label="К последнему сообщению"
                  >
                    <KeyboardDoubleArrowDownRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            ) : null}
          </div>
          {canSendSessionChat ? (
            <div className="workbook-session__session-chat-input-wrap">
              {editingMessage ? (
                <div className="workbook-session__session-chat-editing">
                  <span>Редактирование сообщения</span>
                  <button type="button" onClick={handleCancelMessageEdit}>
                    Отменить
                  </button>
                </div>
              ) : null}
              <div className="workbook-session__session-chat-input">
                <TextField
                  size="small"
                  fullWidth
                  placeholder={
                    editingMessageId ? "Измените сообщение..." : "Введите сообщение..."
                  }
                  value={sessionChatDraft}
                  onChange={(event) => setSessionChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    void handleSubmitSessionChatDraft();
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconButton
                          size="small"
                          className="workbook-session__chat-action-icon"
                          aria-label="Эмодзи"
                          onClick={() => setIsSessionChatEmojiOpen((current) => !current)}
                        >
                          <SentimentSatisfiedRoundedIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          className="workbook-session__chat-action-icon workbook-session__chat-send-icon"
                          aria-label={editingMessageId ? "Сохранить сообщение" : "Отправить"}
                          onClick={() => void handleSubmitSessionChatDraft()}
                          disabled={!sessionChatDraft.trim()}
                        >
                          {editingMessageId ? (
                            <EditRoundedIcon fontSize="small" />
                          ) : (
                            <SendRoundedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
              {isSessionChatEmojiOpen ? (
                <div className="workbook-session__session-chat-emoji">
                  <EmojiPicker
                    width="100%"
                    height={332}
                    theme={Theme.AUTO}
                    emojiStyle={EmojiStyle.NATIVE}
                    suggestedEmojisMode={SuggestionMode.RECENT}
                    previewConfig={{ showPreview: false }}
                    lazyLoadEmojis
                    searchDisabled
                    skinTonesDisabled
                    onEmojiClick={handleSelectEmoji}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="workbook-session__hint">
              Отправка сообщений недоступна: доступ к чату отключён.
            </p>
          )}
        </>
      ) : null}
      <Menu
        open={Boolean(messageContextMenu)}
        onClose={handleCloseMessageContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          messageContextMenu
            ? { top: messageContextMenu.y, left: messageContextMenu.x }
            : undefined
        }
        classes={{ paper: "workbook-session__chat-context-menu" }}
      >
        <MenuItem onClick={handleStartMessageEdit}>
          <EditRoundedIcon fontSize="small" />
          Редактировать
        </MenuItem>
        <MenuItem onClick={() => void handleDeleteMessage()}>
          <DeleteOutlineRoundedIcon fontSize="small" />
          Удалить
        </MenuItem>
      </Menu>
    </div>
  );
}
