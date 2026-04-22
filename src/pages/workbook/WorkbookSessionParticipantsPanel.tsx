import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Avatar, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import ViewSidebarRoundedIcon from "@mui/icons-material/ViewSidebarRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import type { WorkbookSessionParticipant } from "@/features/workbook/model/types";
import type { WorkbookRemoteVideoTrack } from "./useWorkbookLivekit";

export type WorkbookParticipantsPanelMode = "sidebar" | "expanded" | "video_only";
type ParticipantsViewMode = "teacher" | "duo" | "all";

type WorkbookSessionParticipantsPanelProps = {
  participantCards: WorkbookSessionParticipant[];
  currentUserId?: string;
  currentUserRole?: string;
  canUseSessionChat: boolean;
  canManageSession: boolean;
  isSessionChatOpen: boolean;
  sessionChatUnreadCount: number;
  onToggleSessionChat: () => void;
  participantJoinSoundEnabled?: boolean;
  onToggleParticipantJoinSound?: () => void;
  onCollapseParticipants: () => void;
  micEnabled: boolean;
  onToggleMic: () => void;
  cameraEnabled: boolean;
  onToggleCamera: () => void;
  canUseMedia: boolean;
  isEnded: boolean;
  participantsPanelMode: WorkbookParticipantsPanelMode;
  onParticipantsPanelModeChange: (mode: WorkbookParticipantsPanelMode) => void;
  localVideoTrack: LocalVideoTrack | null;
  remoteVideoTracks: WorkbookRemoteVideoTrack[];
  isParticipantBoardToolsEnabled: (participant: WorkbookSessionParticipant) => boolean;
  onToggleParticipantBoardTools: (
    participant: WorkbookSessionParticipant,
    enabled: boolean
  ) => void;
  onToggleParticipantChat: (participant: WorkbookSessionParticipant, enabled: boolean) => void;
  onToggleParticipantMic: (participant: WorkbookSessionParticipant, enabled: boolean) => void;
  onSetStudentsMediaEnabled: (enabled: boolean) => void;
  onSetStudentsChatEnabled: (enabled: boolean) => void;
  isCompactViewport?: boolean;
};

export { type WorkbookSessionParticipantsPanelProps };

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

type ParticipantVideoSurfaceProps = {
  track: LocalVideoTrack | RemoteVideoTrack | null;
  muted?: boolean;
  mirrored?: boolean;
  label: string;
};

const ParticipantVideoSurface = memo(function ParticipantVideoSurface({
  track,
  muted = false,
  mirrored = false,
  label,
}: ParticipantVideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !track) return;
    element.autoplay = true;
    element.playsInline = true;
    element.muted = muted;
    element.defaultMuted = muted;
    try {
      track.attach(element);
      void element.play().catch(() => undefined);
    } catch {
      // Ignore short-lived attach failures during renegotiation.
    }
    return () => {
      try {
        track.detach(element);
      } catch {
        // Ignore detach failures on teardown.
      }
      try {
        element.pause();
      } catch {
        // Ignore pause failures.
      }
      element.srcObject = null;
    };
  }, [muted, track]);

  if (!track) {
    return (
      <div className="workbook-session__participant-video-placeholder" aria-label={label}>
        <VideocamOffRoundedIcon fontSize="small" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className={`workbook-session__participant-video${mirrored ? " is-mirrored" : ""}`}
      autoPlay
      playsInline
      muted={muted}
    />
  );
});

export const WorkbookSessionParticipantsPanel = memo(function WorkbookSessionParticipantsPanel({
  participantCards,
  currentUserId,
  currentUserRole,
  canUseSessionChat,
  canManageSession,
  isSessionChatOpen,
  sessionChatUnreadCount,
  onToggleSessionChat,
  participantJoinSoundEnabled = true,
  onToggleParticipantJoinSound,
  onCollapseParticipants,
  micEnabled,
  onToggleMic,
  cameraEnabled,
  onToggleCamera,
  canUseMedia,
  isEnded,
  participantsPanelMode,
  onParticipantsPanelModeChange,
  localVideoTrack,
  remoteVideoTracks,
  isParticipantBoardToolsEnabled,
  onToggleParticipantBoardTools,
  onToggleParticipantChat,
  onToggleParticipantMic,
  onSetStudentsMediaEnabled,
  onSetStudentsChatEnabled,
  isCompactViewport = false,
}: WorkbookSessionParticipantsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<ParticipantsDragState | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<ParticipantsFloatingPosition | null>(
    null
  );
  const [viewMode, setViewMode] = useState<ParticipantsViewMode>("all");
  const [duoStudentIndex, setDuoStudentIndex] = useState(0);
  const [hostMenuAnchor, setHostMenuAnchor] = useState<HTMLElement | null>(null);

  const isVideoOnlyMode = participantsPanelMode === "video_only";

  const clearDrag = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  useEffect(() => {
    if (isCompactViewport || isVideoOnlyMode || !floatingPosition) return;
    const syncPositionToViewport = () => {
      const panel = panelRef.current;
      const panelHeight = Math.max(
        220,
        Math.round(panel?.getBoundingClientRect().height ?? 320)
      );
      const margin = 12;
      const maxX = Math.max(margin, window.innerWidth - floatingPosition.width - margin);
      const maxY = Math.max(margin, window.innerHeight - panelHeight - margin);
      const nextX = Math.min(maxX, Math.max(margin, floatingPosition.x));
      const nextY = Math.min(maxY, Math.max(margin, floatingPosition.y));
      if (nextX === floatingPosition.x && nextY === floatingPosition.y) return;
      setFloatingPosition((current) =>
        current
          ? {
              ...current,
              x: nextX,
              y: nextY,
            }
          : current
      );
    };

    window.addEventListener("resize", syncPositionToViewport);
    return () => {
      window.removeEventListener("resize", syncPositionToViewport);
    };
  }, [floatingPosition, isCompactViewport, isVideoOnlyMode]);

  const handleHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isCompactViewport || isVideoOnlyMode || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "button, [role='button'], .MuiButtonBase-root, .workbook-session__participants-head-actions"
        )
      ) {
        return;
      }
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
    [isCompactViewport, isVideoOnlyMode]
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

  const sortedParticipantCards = useMemo(
    () =>
      [...participantCards].sort((left, right) => {
        if (left.roleInSession !== right.roleInSession) {
          return left.roleInSession === "teacher" ? -1 : 1;
        }
        if (left.isOnline !== right.isOnline) {
          return left.isOnline ? -1 : 1;
        }
        return left.displayName.localeCompare(right.displayName, "ru");
      }),
    [participantCards]
  );

  const baseVisibleParticipantCards = useMemo(
    () =>
      sortedParticipantCards.filter(
        (participant) => participant.roleInSession === "teacher" || participant.isOnline
      ),
    [sortedParticipantCards]
  );

  const teacherParticipants = useMemo(
    () => baseVisibleParticipantCards.filter((participant) => participant.roleInSession === "teacher"),
    [baseVisibleParticipantCards]
  );

  const studentParticipants = useMemo(
    () => baseVisibleParticipantCards.filter((participant) => participant.roleInSession === "student"),
    [baseVisibleParticipantCards]
  );
  const safeDuoStudentIndex =
    studentParticipants.length === 0
      ? 0
      : Math.min(duoStudentIndex, studentParticipants.length - 1);

  const visibleParticipantCards = useMemo(() => {
    if (viewMode === "teacher") {
      return teacherParticipants.slice(0, 1);
    }
    if (viewMode === "duo") {
      const cards: WorkbookSessionParticipant[] = [];
      if (teacherParticipants[0]) {
        cards.push(teacherParticipants[0]);
      }
      if (studentParticipants[safeDuoStudentIndex]) {
        cards.push(studentParticipants[safeDuoStudentIndex]);
      }
      return cards;
    }
    return baseVisibleParticipantCards;
  }, [
    baseVisibleParticipantCards,
    safeDuoStudentIndex,
    studentParticipants,
    teacherParticipants,
    viewMode,
  ]);

  const remoteTrackByIdentity = useMemo(() => {
    const map = new Map<string, RemoteVideoTrack>();
    remoteVideoTracks.forEach((item) => {
      if (!item.participantIdentity || map.has(item.participantIdentity)) return;
      map.set(item.participantIdentity, item.track);
    });
    return map;
  }, [remoteVideoTracks]);

  const resolveParticipantTrack = useCallback(
    (participant: WorkbookSessionParticipant) => {
      if (participant.userId === currentUserId) {
        return localVideoTrack;
      }
      return remoteTrackByIdentity.get(participant.userId) ?? null;
    },
    [currentUserId, localVideoTrack, remoteTrackByIdentity]
  );

  const isFloating = !isCompactViewport && !isVideoOnlyMode && Boolean(floatingPosition);

  return (
    <div
      ref={panelRef}
      className={`workbook-session__card workbook-session__participants-card${
        isFloating ? " is-floating" : ""
      } ${isVideoOnlyMode ? "is-video-only" : ""}`}
      style={
        isFloating && floatingPosition
          ? {
              position: "fixed",
              left: floatingPosition.x,
              top: floatingPosition.y,
              width: floatingPosition.width,
              zIndex: 96,
              maxHeight: `calc(100vh - ${Math.max(12, floatingPosition.y + 12)}px)`,
            }
          : undefined
      }
    >
      <div
        className={`workbook-session__participants-head${
          isCompactViewport || isVideoOnlyMode
            ? ""
            : " workbook-session__participants-head--draggable"
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
          {onToggleParticipantJoinSound ? (
            <Tooltip
              title={
                participantJoinSoundEnabled
                  ? "Отключить сигнал входа участников"
                  : "Включить сигнал входа участников"
              }
              placement="left"
              arrow
            >
              <span>
                <IconButton size="small" onClick={onToggleParticipantJoinSound}>
                  {participantJoinSoundEnabled ? (
                    <VolumeUpRoundedIcon fontSize="small" />
                  ) : (
                    <VolumeOffRoundedIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
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
          {canManageSession ? (
            <Tooltip title="Панель управления участниками" placement="left" arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={(event) => setHostMenuAnchor(event.currentTarget)}
                >
                  <MoreVertRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          <Tooltip title="Свернуть блок участников" placement="left" arrow>
            <span>
              <IconButton size="small" onClick={onCollapseParticipants}>
                <UnfoldLessRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="workbook-session__participants-layout-strip">
        <div className="workbook-session__participants-view-switch">
          <button
            type="button"
            className={viewMode === "teacher" ? "is-active" : ""}
            onClick={() => setViewMode("teacher")}
          >
            Учитель
          </button>
          <button
            type="button"
            className={viewMode === "duo" ? "is-active" : ""}
            onClick={() => setViewMode("duo")}
          >
            2 окна
          </button>
          <button
            type="button"
            className={viewMode === "all" ? "is-active" : ""}
            onClick={() => setViewMode("all")}
          >
            Все
          </button>
        </div>
        <div className="workbook-session__participants-mode-switch">
          <Tooltip title="Обычный вид" arrow>
            <span>
              <IconButton
                size="small"
                className={participantsPanelMode === "sidebar" ? "is-active" : ""}
                onClick={() => onParticipantsPanelModeChange("sidebar")}
              >
                <ViewSidebarRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Расширить панель" arrow>
            <span>
              <IconButton
                size="small"
                className={participantsPanelMode === "expanded" ? "is-active" : ""}
                onClick={() => onParticipantsPanelModeChange("expanded")}
              >
                <UnfoldMoreRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Только видео" arrow>
            <span>
              <IconButton
                size="small"
                className={participantsPanelMode === "video_only" ? "is-active" : ""}
                onClick={() =>
                  onParticipantsPanelModeChange(
                    participantsPanelMode === "video_only" ? "sidebar" : "video_only"
                  )
                }
              >
                {participantsPanelMode === "video_only" ? (
                  <FullscreenExitRoundedIcon fontSize="small" />
                ) : (
                  <FullscreenRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </div>

      {viewMode === "duo" && studentParticipants.length > 1 ? (
        <div className="workbook-session__participants-duo-nav">
          <button
            type="button"
            onClick={() =>
              setDuoStudentIndex((current) =>
                studentParticipants.length === 0
                  ? 0
                  : (current - 1 + studentParticipants.length) % studentParticipants.length
              )
            }
            aria-label="Предыдущий участник"
          >
            <ChevronLeftRoundedIcon fontSize="small" />
          </button>
          <span>
            Участник {safeDuoStudentIndex + 1} из {studentParticipants.length}
          </span>
          <button
            type="button"
            onClick={() =>
              setDuoStudentIndex((current) =>
                studentParticipants.length === 0 ? 0 : (current + 1) % studentParticipants.length
              )
            }
            aria-label="Следующий участник"
          >
            <ChevronRightRoundedIcon fontSize="small" />
          </button>
        </div>
      ) : null}

      <div className="workbook-session__participants-scroll workbook-session__participants-scroll--video-grid">
        {visibleParticipantCards.map((participant) => {
          const isSelfParticipant = participant.userId === currentUserId;
          const boardToolsEnabled = isParticipantBoardToolsEnabled(participant);
          const participantRoleLabel =
            participant.roleInSession === "teacher" ? "Преподаватель" : "Студент";
          const participantRoleWithSelf =
            isSelfParticipant && currentUserRole !== "teacher"
              ? `${participantRoleLabel} • Вы`
              : participantRoleLabel;
          const participantTrack = resolveParticipantTrack(participant);
          const canControlStudent = canManageSession && participant.roleInSession === "student";
          return (
            <article key={participant.userId} className="workbook-session__participant-card is-video-card">
              <div className="workbook-session__participant-video-wrap">
                <ParticipantVideoSurface
                  track={participantTrack}
                  muted={isSelfParticipant}
                  mirrored={isSelfParticipant}
                  label={participant.permissions.canUseMedia ? "Камера выключена" : "Медиа отключено"}
                />
                <div className="workbook-session__participant-overlay-controls">
                  {isSelfParticipant ? (
                    <>
                      <Tooltip title={micEnabled ? "Выключить микрофон" : "Включить микрофон"} arrow>
                        <span>
                          <IconButton
                            size="small"
                            className={`workbook-session__participant-overlay-control ${
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
                      <Tooltip title={cameraEnabled ? "Выключить камеру" : "Включить камеру"} arrow>
                        <span>
                          <IconButton
                            size="small"
                            className={`workbook-session__participant-overlay-control ${
                              cameraEnabled ? "is-enabled" : "is-disabled"
                            }`}
                            onClick={onToggleCamera}
                            disabled={!canUseMedia || isEnded}
                          >
                            {cameraEnabled ? (
                              <VideocamRoundedIcon fontSize="small" />
                            ) : (
                              <VideocamOffRoundedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  ) : null}
                  {canControlStudent ? (
                    <>
                      <Tooltip
                        title={
                          participant.permissions.canUseMedia
                            ? "Ограничить микрофон"
                            : "Разрешить микрофон"
                        }
                        arrow
                      >
                        <span>
                          <IconButton
                            size="small"
                            className={`workbook-session__participant-overlay-control ${
                              participant.permissions.canUseMedia ? "is-enabled" : "is-disabled"
                            }`}
                            onClick={() =>
                              onToggleParticipantMic(participant, !participant.permissions.canUseMedia)
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
                      <Tooltip
                        title={
                          participant.permissions.canUseMedia
                            ? "Ограничить камеру"
                            : "Разрешить камеру"
                        }
                        arrow
                      >
                        <span>
                          <IconButton
                            size="small"
                            className={`workbook-session__participant-overlay-control ${
                              participant.permissions.canUseMedia ? "is-enabled" : "is-disabled"
                            }`}
                            onClick={() =>
                              onToggleParticipantMic(participant, !participant.permissions.canUseMedia)
                            }
                            disabled={isEnded}
                          >
                            {participant.permissions.canUseMedia ? (
                              <VideocamRoundedIcon fontSize="small" />
                            ) : (
                              <VideocamOffRoundedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          participant.permissions.canUseChat ? "Ограничить чат" : "Разрешить чат"
                        }
                        arrow
                      >
                        <span>
                          <IconButton
                            size="small"
                            className={`workbook-session__participant-overlay-control ${
                              participant.permissions.canUseChat ? "is-enabled" : "is-disabled"
                            }`}
                            onClick={() =>
                              onToggleParticipantChat(participant, !participant.permissions.canUseChat)
                            }
                            disabled={isEnded}
                          >
                            <ForumRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  ) : null}
                </div>
                <div className="workbook-session__participant-video-nameplate">
                  <Avatar
                    src={participant.photo}
                    alt={participant.displayName}
                    className={`workbook-session__participant-avatar ${
                      participant.isOnline ? "is-online" : "is-offline"
                    }`}
                  >
                    {participant.displayName.slice(0, 1)}
                  </Avatar>
                  <div className="workbook-session__participant-video-nameplate-meta">
                    <strong>{participant.displayName}</strong>
                    <span>{participantRoleWithSelf}</span>
                  </div>
                </div>
              </div>
              {canControlStudent ? (
                <div className="workbook-session__participant-card-footer">
                  <button
                    type="button"
                    className={`workbook-session__participant-footer-toggle ${
                      boardToolsEnabled ? "is-enabled" : "is-disabled"
                    }`}
                    onClick={() => onToggleParticipantBoardTools(participant, !boardToolsEnabled)}
                    disabled={isEnded}
                  >
                    {boardToolsEnabled ? <LockOpenRoundedIcon fontSize="small" /> : <LockRoundedIcon fontSize="small" />}
                    Инструменты
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <Menu
        anchorEl={hostMenuAnchor}
        open={Boolean(hostMenuAnchor)}
        onClose={() => setHostMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            onSetStudentsMediaEnabled(false);
            setHostMenuAnchor(null);
          }}
          disabled={!canManageSession || isEnded}
        >
          Отключить медиа всем
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSetStudentsMediaEnabled(true);
            setHostMenuAnchor(null);
          }}
          disabled={!canManageSession || isEnded}
        >
          Включить медиа всем
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSetStudentsChatEnabled(false);
            setHostMenuAnchor(null);
          }}
          disabled={!canManageSession || isEnded}
        >
          Отключить чат всем
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSetStudentsChatEnabled(true);
            setHostMenuAnchor(null);
          }}
          disabled={!canManageSession || isEnded}
        >
          Включить чат всем
        </MenuItem>
      </Menu>
    </div>
  );
});
