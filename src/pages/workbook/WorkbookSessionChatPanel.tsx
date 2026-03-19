import type { MutableRefObject, PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  Avatar,
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

type ParticipantCard = {
  userId: string;
  displayName: string;
  photo: string;
  isOnline: boolean;
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
  participantCards: ParticipantCard[];
  chatMessages: WorkbookChatMessage[];
  firstUnreadSessionChatMessageId: string | null;
  currentUserId?: string;
  canManageSession: boolean;
  canSendSessionChat: boolean;
  sessionChatUnreadCount: number;
  isSessionChatAtBottom: boolean;
  sessionChatDraft: string;
  isSessionChatEmojiOpen: boolean;
  chatEmojis: string[];
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
  participantCards,
  chatMessages,
  firstUnreadSessionChatMessageId,
  currentUserId,
  canManageSession,
  canSendSessionChat,
  sessionChatUnreadCount,
  isSessionChatAtBottom,
  sessionChatDraft,
  isSessionChatEmojiOpen,
  chatEmojis,
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
          Чат сессии
        </h4>
        <div className="workbook-session__session-chat-head-actions">
          <IconButton
            size="small"
            aria-label={isSessionChatMinimized ? "Развернуть чат" : "Свернуть чат"}
            onClick={() => setIsSessionChatMinimized((current) => !current)}
          >
            {isSessionChatMinimized ? (
              <UnfoldMoreRoundedIcon fontSize="small" />
            ) : (
              <UnfoldLessRoundedIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            aria-label={
              isSessionChatMaximized ? "Обычный размер чата" : "Развернуть чат на максимум"
            }
            onClick={() => setIsSessionChatMaximized((current) => !current)}
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
          <div className="workbook-session__session-chat-meta">
            <div className="workbook-session__session-chat-avatars">
              {participantCards.slice(0, 10).map((participant) => (
                <Tooltip
                  key={`chat-avatar-${participant.userId}`}
                  title={participant.displayName}
                  arrow
                >
                  <Avatar
                    src={participant.photo}
                    alt={participant.displayName}
                    className={`workbook-session__session-chat-avatar ${
                      participant.isOnline ? "is-online" : "is-offline"
                    }`}
                  >
                    {participant.displayName.slice(0, 1)}
                  </Avatar>
                </Tooltip>
              ))}
            </div>
            <div className="workbook-session__session-chat-meta-right">
              {canManageSession && chatMessages.length > 0 ? (
                <Tooltip title="Очистить чат" arrow>
                  <IconButton
                    size="small"
                    className="workbook-session__chat-action-icon"
                    onClick={() => setIsClearSessionChatDialogOpen(true)}
                    aria-label="Очистить чат"
                  >
                    <DeleteSweepRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
              {sessionChatUnreadCount > 0 || !isSessionChatAtBottom ? (
                <Tooltip title="Перемотать к последнему сообщению" arrow>
                  <IconButton
                    size="small"
                    onClick={() => {
                      onScrollSessionChatToLatest("smooth");
                      onMarkSessionChatReadToLatest();
                    }}
                    aria-label="К последнему сообщению"
                  >
                    <KeyboardDoubleArrowDownRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </div>
          </div>
          <div className="workbook-session__chat-list" ref={sessionChatListRef}>
            {chatMessages.length === 0 ? (
              <p className="workbook-session__hint">
                Сообщений пока нет. Используйте чат для быстрых текстовых подсказок.
              </p>
            ) : (
              chatMessages.map((message) => (
                <div key={message.id}>
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
                  {chatEmojis.map((emoji) => (
                    <button
                      key={`session-chat-emoji-${emoji}`}
                      type="button"
                      onClick={() => setSessionChatDraft((current) => `${current}${emoji}`)}
                    >
                      {emoji}
                    </button>
                  ))}
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
