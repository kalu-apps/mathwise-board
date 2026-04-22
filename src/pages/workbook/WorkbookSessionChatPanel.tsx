import type { MutableRefObject, PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  IconButton,
  InputAdornment,
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
}: WorkbookSessionChatPanelProps) {
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
              <div className="workbook-session__session-chat-input">
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Введите сообщение..."
                  value={sessionChatDraft}
                  onChange={(event) => setSessionChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    void onSendSessionChatMessage();
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
                          aria-label="Отправить"
                          onClick={() => void onSendSessionChatMessage()}
                          disabled={!sessionChatDraft.trim()}
                        >
                          <SendRoundedIcon fontSize="small" />
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
    </div>
  );
}
