import { memo } from "react";
import { Avatar, IconButton, Tooltip } from "@mui/material";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import type { WorkbookSessionParticipant } from "@/features/workbook/model/types";

export type WorkbookSessionParticipantsPanelProps = {
  participantCards: WorkbookSessionParticipant[];
  currentUserId?: string;
  currentUserRole?: string;
  canUseSessionChat: boolean;
  canManageSession: boolean;
  isSessionChatOpen: boolean;
  sessionChatUnreadCount: number;
  onToggleSessionChat: () => void;
  onCollapseParticipants: () => void;
  micEnabled: boolean;
  onToggleMic: () => void;
  canUseMedia: boolean;
  isEnded: boolean;
  isParticipantBoardToolsEnabled: (participant: WorkbookSessionParticipant) => boolean;
  onToggleParticipantBoardTools: (
    participant: WorkbookSessionParticipant,
    enabled: boolean
  ) => void;
  onToggleParticipantChat: (participant: WorkbookSessionParticipant, enabled: boolean) => void;
  onToggleParticipantMic: (participant: WorkbookSessionParticipant, enabled: boolean) => void;
};

export const WorkbookSessionParticipantsPanel = memo(function WorkbookSessionParticipantsPanel({
  participantCards,
  currentUserId,
  currentUserRole,
  canUseSessionChat,
  canManageSession,
  isSessionChatOpen,
  sessionChatUnreadCount,
  onToggleSessionChat,
  onCollapseParticipants,
  micEnabled,
  onToggleMic,
  canUseMedia,
  isEnded,
  isParticipantBoardToolsEnabled,
  onToggleParticipantBoardTools,
  onToggleParticipantChat,
  onToggleParticipantMic,
}: WorkbookSessionParticipantsPanelProps) {
  return (
    <div className="workbook-session__card">
      <div className="workbook-session__participants-head">
        <h3>
          <GroupRoundedIcon fontSize="small" />
          Участники
        </h3>
        <div className="workbook-session__participants-head-actions">
          <Tooltip title="Открыть чат сессии" placement="left" arrow>
            <span className="workbook-session__participants-chat-button">
              <IconButton
                size="small"
                className={isSessionChatOpen ? "is-active" : ""}
                disabled={!canUseSessionChat && !canManageSession}
                onClick={onToggleSessionChat}
              >
                <ForumRoundedIcon fontSize="small" />
              </IconButton>
              {sessionChatUnreadCount > 0 && !isSessionChatOpen ? (
                <span
                  className="workbook-session__participants-chat-unread"
                  aria-label={`Непрочитанных сообщений: ${sessionChatUnreadCount}`}
                >
                  {sessionChatUnreadCount > 9 ? "9+" : sessionChatUnreadCount}
                </span>
              ) : null}
            </span>
          </Tooltip>
          <Tooltip title="Свернуть блок участников" placement="left" arrow>
            <span>
              <IconButton size="small" onClick={onCollapseParticipants}>
                <UnfoldLessRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </div>
      <div className="workbook-session__participants-scroll">
        {participantCards.map((participant) => {
          const isSelfParticipant = participant.userId === currentUserId;
          const boardToolsEnabled = isParticipantBoardToolsEnabled(participant);
          return (
            <article key={participant.userId} className="workbook-session__participant-card">
              <div className="workbook-session__participant-card-top">
                <div className="workbook-session__participant-main">
                  <Avatar src={participant.photo} alt={participant.displayName}>
                    {participant.displayName.slice(0, 1)}
                  </Avatar>
                  <div className="workbook-session__participant-main-meta">
                    <strong>{participant.displayName}</strong>
                    <span>
                      {participant.roleInSession === "teacher" ? "Преподаватель" : "Студент"}
                      {isSelfParticipant && currentUserRole !== "teacher" ? " • Вы" : ""}
                    </span>
                  </div>
                </div>
                <Tooltip
                  title={participant.isOnline ? "Онлайн" : "Офлайн"}
                  placement="top"
                  arrow
                >
                  <span
                    className={`workbook-session__presence-dot ${
                      participant.isOnline ? "is-online" : "is-offline"
                    }`}
                    aria-label={participant.isOnline ? "Онлайн" : "Офлайн"}
                  >
                    <FiberManualRecordRoundedIcon fontSize="inherit" />
                  </span>
                </Tooltip>
              </div>

              <div className="workbook-session__participant-controls">
                {isSelfParticipant ? (
                  <Tooltip title={micEnabled ? "Выключить микрофон" : "Включить микрофон"} arrow>
                    <span>
                      <IconButton
                        size="small"
                        className={`workbook-session__participant-control ${
                          micEnabled ? "is-enabled" : "is-disabled"
                        }`}
                        onClick={onToggleMic}
                        disabled={!canUseMedia || isEnded}
                      >
                        {micEnabled ? (
                          <MicRoundedIcon fontSize="small" />
                        ) : (
                          <MicOffRoundedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}

                {canManageSession && participant.roleInSession === "student" ? (
                  <>
                    <Tooltip
                      title={
                        boardToolsEnabled
                          ? "Отключить инструменты и личные настройки доски"
                          : "Включить инструменты и личные настройки доски"
                      }
                      arrow
                    >
                      <span>
                        <IconButton
                          size="small"
                          className={`workbook-session__participant-control ${
                            boardToolsEnabled ? "is-enabled" : "is-disabled"
                          }`}
                          onClick={() =>
                            onToggleParticipantBoardTools(participant, !boardToolsEnabled)
                          }
                          disabled={isEnded}
                        >
                          {boardToolsEnabled ? (
                            <LockOpenRoundedIcon fontSize="small" />
                          ) : (
                            <LockRoundedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={participant.permissions.canUseChat ? "Отключить чат" : "Включить чат"}
                      arrow
                    >
                      <span>
                        <IconButton
                          size="small"
                          className={`workbook-session__participant-control ${
                            participant.permissions.canUseChat ? "is-enabled" : "is-disabled"
                          }`}
                          onClick={() =>
                            onToggleParticipantChat(
                              participant,
                              !participant.permissions.canUseChat
                            )
                          }
                          disabled={isEnded}
                        >
                          <ForumRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        participant.permissions.canUseMedia
                          ? "Отключить микрофон"
                          : "Включить микрофон"
                      }
                      arrow
                    >
                      <span>
                        <IconButton
                          size="small"
                          className={`workbook-session__participant-control ${
                            participant.permissions.canUseMedia ? "is-enabled" : "is-disabled"
                          }`}
                          onClick={() =>
                            onToggleParticipantMic(
                              participant,
                              !participant.permissions.canUseMedia
                            )
                          }
                          disabled={isEnded}
                        >
                          {participant.permissions.canUseMedia ? (
                            <MicRoundedIcon fontSize="small" />
                          ) : (
                            <MicOffRoundedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
});
