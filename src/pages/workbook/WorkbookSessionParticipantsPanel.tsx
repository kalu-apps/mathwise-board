import { memo, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Avatar, IconButton, Tooltip } from "@mui/material";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
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
  isCompactViewport?: boolean;
};

type ParticipantsFloatingPosition = {
  x: number;
  y: number;
  width: number;
};

type ParticipantsDragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
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
  isCompactViewport = false,
}: WorkbookSessionParticipantsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<ParticipantsDragState | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<ParticipantsFloatingPosition | null>(
    null
  );

  const clearDrag = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const handleHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isCompactViewport || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest(".workbook-session__participants-head-actions")) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const width = Math.max(220, Math.round(rect.width));
      setFloatingPosition((current) =>
        current ?? {
          x: rect.left,
          y: rect.top,
          width,
        }
      );
      dragStateRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [isCompactViewport]
  );

  const handleHeaderPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const panel = panelRef.current;
    if (!panel) return;
    const panelHeight = Math.max(220, Math.round(panel.getBoundingClientRect().height));
    const margin = 12;
    const minX = margin;
    const minY = margin;
    const maxX = Math.max(minX, window.innerWidth - dragState.width - margin);
    const maxY = Math.max(minY, window.innerHeight - panelHeight - margin);
    const nextX = Math.min(maxX, Math.max(minX, event.clientX - dragState.offsetX));
    const nextY = Math.min(maxY, Math.max(minY, event.clientY - dragState.offsetY));
    setFloatingPosition({
      x: nextX,
      y: nextY,
      width: dragState.width,
    });
    event.preventDefault();
  }, []);

  const handleHeaderPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      clearDrag();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [clearDrag]
  );

  const isFloating = !isCompactViewport && Boolean(floatingPosition);

  return (
    <div
      ref={panelRef}
      className={`workbook-session__card workbook-session__participants-card${
        isFloating ? " is-floating" : ""
      }`}
      style={
        isFloating && floatingPosition
          ? {
              position: "fixed",
              left: floatingPosition.x,
              top: floatingPosition.y,
              width: floatingPosition.width,
              zIndex: 90,
              maxHeight: `calc(100vh - ${Math.max(12, floatingPosition.y + 12)}px)`,
            }
          : undefined
      }
    >
      <div
        className={`workbook-session__participants-head${
          isCompactViewport ? "" : " workbook-session__participants-head--draggable"
        }`}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerEnd}
        onPointerCancel={handleHeaderPointerEnd}
      >
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
          const participantRoleLabel =
            participant.roleInSession === "teacher" ? "Преподаватель" : "Студент";
          const participantRoleWithSelf =
            isSelfParticipant && currentUserRole !== "teacher"
              ? `${participantRoleLabel} • Вы`
              : participantRoleLabel;
          return (
            <article key={participant.userId} className="workbook-session__participant-card">
              <div className="workbook-session__participant-card-top">
                <div className="workbook-session__participant-main">
                  <Avatar
                    src={participant.photo}
                    alt={participant.displayName}
                    className={`workbook-session__participant-avatar ${
                      participant.isOnline ? "is-online" : "is-offline"
                    }`}
                  >
                    {participant.displayName.slice(0, 1)}
                  </Avatar>
                  <div className="workbook-session__participant-main-meta">
                    <strong>{participant.displayName}</strong>
                    <div className="workbook-session__participant-meta-row">
                      <span className="workbook-session__participant-role">
                        {participantRoleWithSelf}
                      </span>
                      <div className="workbook-session__participant-controls">
                        {isSelfParticipant ? (
                          <Tooltip
                            title={micEnabled ? "Выключить микрофон" : "Включить микрофон"}
                            arrow
                          >
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
                              title={
                                participant.permissions.canUseChat
                                  ? "Отключить чат"
                                  : "Включить чат"
                              }
                              arrow
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  className={`workbook-session__participant-control ${
                                    participant.permissions.canUseChat
                                      ? "is-enabled"
                                      : "is-disabled"
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
                                    participant.permissions.canUseMedia
                                      ? "is-enabled"
                                      : "is-disabled"
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
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
});
