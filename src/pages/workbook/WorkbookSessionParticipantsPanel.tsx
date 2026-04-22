import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Avatar, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
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
  canUseMicrophone: boolean;
  canUseCamera: boolean;
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
  onToggleParticipantMicrophone: (
    participant: WorkbookSessionParticipant,
    enabled: boolean
  ) => void;
  onToggleParticipantCamera: (
    participant: WorkbookSessionParticipant,
    enabled: boolean
  ) => void;
  onSetStudentsMicrophoneEnabled: (enabled: boolean) => void;
  onSetStudentsCameraEnabled: (enabled: boolean) => void;
  onSetStudentsBoardToolsEnabled: (enabled: boolean) => void;
  isCompactViewport?: boolean;
};

export { type WorkbookSessionParticipantsPanelProps };

const PARTICIPANTS_VIEW_MODE_ORDER: ParticipantsViewMode[] = ["teacher", "duo", "all"];

const PARTICIPANTS_VIEW_MODE_LABEL: Record<ParticipantsViewMode, string> = {
  teacher: "Учитель",
  duo: "2 окна",
  all: "Все",
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
  canUseMicrophone,
  canUseCamera,
  isEnded,
  participantsPanelMode,
  onParticipantsPanelModeChange,
  localVideoTrack,
  remoteVideoTracks,
  isParticipantBoardToolsEnabled,
  onToggleParticipantBoardTools,
  onToggleParticipantMicrophone,
  onToggleParticipantCamera,
  onSetStudentsMicrophoneEnabled,
  onSetStudentsCameraEnabled,
  onSetStudentsBoardToolsEnabled,
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
  const [primaryVideoParticipantId, setPrimaryVideoParticipantId] = useState<string | null>(
    null
  );

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
  const allStudentParticipants = useMemo(
    () => sortedParticipantCards.filter((participant) => participant.roleInSession === "student"),
    [sortedParticipantCards]
  );
  const hasStudentParticipants = allStudentParticipants.length > 0;
  const areAllStudentsMicrophonesDisabled =
    hasStudentParticipants &&
    allStudentParticipants.every((participant) => !participant.permissions.canUseMicrophone);
  const areAllStudentsCamerasDisabled =
    hasStudentParticipants &&
    allStudentParticipants.every((participant) => !participant.permissions.canUseCamera);
  const areAllStudentsBoardToolsDisabled =
    hasStudentParticipants &&
    allStudentParticipants.every(
      (participant) => !isParticipantBoardToolsEnabled(participant)
    );
  const safeDuoStudentIndex =
    studentParticipants.length === 0
      ? 0
      : Math.min(duoStudentIndex, studentParticipants.length - 1);
  const currentViewModeLabel = PARTICIPANTS_VIEW_MODE_LABEL[viewMode];
  const nextViewMode = useMemo(() => {
    const currentIndex = PARTICIPANTS_VIEW_MODE_ORDER.indexOf(viewMode);
    return PARTICIPANTS_VIEW_MODE_ORDER[
      (currentIndex + 1) % PARTICIPANTS_VIEW_MODE_ORDER.length
    ];
  }, [viewMode]);
  const nextViewModeLabel = PARTICIPANTS_VIEW_MODE_LABEL[nextViewMode];

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

  const renderParticipantCards = useMemo(
    () => (isVideoOnlyMode ? baseVisibleParticipantCards : visibleParticipantCards),
    [baseVisibleParticipantCards, isVideoOnlyMode, visibleParticipantCards]
  );

  const resolvedPrimaryVideoParticipantId = useMemo(() => {
    if (!isVideoOnlyMode) return null;
    if (
      primaryVideoParticipantId &&
      renderParticipantCards.some((participant) => participant.userId === primaryVideoParticipantId)
    ) {
      return primaryVideoParticipantId;
    }
    if (
      currentUserId &&
      renderParticipantCards.some((participant) => participant.userId === currentUserId)
    ) {
      return currentUserId;
    }
    return renderParticipantCards[0]?.userId ?? null;
  }, [currentUserId, isVideoOnlyMode, primaryVideoParticipantId, renderParticipantCards]);

  const orderedParticipantCards = useMemo(() => {
    if (!isVideoOnlyMode || !resolvedPrimaryVideoParticipantId) {
      return renderParticipantCards;
    }
    const primaryParticipant = renderParticipantCards.find(
      (participant) => participant.userId === resolvedPrimaryVideoParticipantId
    );
    if (!primaryParticipant) return renderParticipantCards;
    return [
      primaryParticipant,
      ...renderParticipantCards.filter(
        (participant) => participant.userId !== resolvedPrimaryVideoParticipantId
      ),
    ];
  }, [isVideoOnlyMode, renderParticipantCards, resolvedPrimaryVideoParticipantId]);

  const videoOnlyCountClass =
    isVideoOnlyMode && orderedParticipantCards.length > 0
      ? ` is-video-only-count-${Math.min(6, orderedParticipantCards.length)}`
      : "";

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
  const handleCycleViewMode = useCallback(() => {
    setViewMode((current) => {
      const currentIndex = PARTICIPANTS_VIEW_MODE_ORDER.indexOf(current);
      return PARTICIPANTS_VIEW_MODE_ORDER[
        (currentIndex + 1) % PARTICIPANTS_VIEW_MODE_ORDER.length
      ];
    });
  }, []);

  const handleParticipantCardClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>, participantId: string) => {
      if (!isVideoOnlyMode) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "button, [role='button'], .MuiButtonBase-root, a, input, textarea, select, label"
        )
      ) {
        return;
      }
      setPrimaryVideoParticipantId(participantId);
    },
    [isVideoOnlyMode]
  );

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
        <div className="workbook-session__participants-head-actions">
          <Tooltip
            title={`Режим: ${currentViewModeLabel}. Следующий: ${nextViewModeLabel}`}
            arrow
          >
            <span>
              <IconButton
                size="small"
                className="workbook-session__participants-view-cycle"
                onClick={handleCycleViewMode}
              >
                <AutorenewRoundedIcon fontSize="small" />
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

      {!isVideoOnlyMode && viewMode === "duo" && studentParticipants.length > 1 ? (
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

      <div
        className={`workbook-session__participants-scroll workbook-session__participants-scroll--video-grid${
          isVideoOnlyMode ? " is-video-only-layout" : ""
        }${videoOnlyCountClass}`}
      >
        {orderedParticipantCards.map((participant) => {
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
          const isVideoPrimary =
            isVideoOnlyMode && participant.userId === resolvedPrimaryVideoParticipantId;
          return (
            <article
              key={participant.userId}
              className={`workbook-session__participant-card is-video-card${
                isVideoOnlyMode ? " is-video-selectable" : ""
              }${isVideoPrimary ? " is-video-primary" : ""}`}
              onClick={(event) => handleParticipantCardClick(event, participant.userId)}
            >
              <div className="workbook-session__participant-video-wrap">
                <ParticipantVideoSurface
                  track={participantTrack}
                  muted={isSelfParticipant}
                  mirrored={isSelfParticipant}
                  label={
                    participant.permissions.canUseCamera
                      ? "Камера выключена"
                      : "Камера отключена преподавателем"
                  }
                />
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
                  <div className="workbook-session__participant-video-nameplate-controls">
                    {isSelfParticipant ? (
                      <>
                        <Tooltip
                          title={micEnabled ? "Выключить микрофон" : "Включить микрофон"}
                          arrow
                        >
                          <span>
                            <IconButton
                              size="small"
                              className={`workbook-session__participant-overlay-control workbook-session__participant-nameplate-control ${
                                micEnabled ? "is-enabled" : "is-disabled"
                              }`}
                              onClick={onToggleMic}
                              disabled={!canUseMicrophone || isEnded}
                            >
                              {micEnabled ? (
                                <MicRoundedIcon fontSize="small" />
                              ) : (
                                <MicOffRoundedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={cameraEnabled ? "Выключить камеру" : "Включить камеру"}
                          arrow
                        >
                          <span>
                            <IconButton
                              size="small"
                              className={`workbook-session__participant-overlay-control workbook-session__participant-nameplate-control ${
                                cameraEnabled ? "is-enabled" : "is-disabled"
                              }`}
                              onClick={onToggleCamera}
                              disabled={!canUseCamera || isEnded}
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
                            participant.permissions.canUseMicrophone
                              ? "Ограничить микрофон"
                              : "Разрешить микрофон"
                          }
                          arrow
                        >
                          <span>
                            <IconButton
                              size="small"
                              className={`workbook-session__participant-overlay-control workbook-session__participant-nameplate-control ${
                                participant.permissions.canUseMicrophone
                                  ? "is-enabled"
                                  : "is-disabled"
                              }`}
                              onClick={() =>
                                onToggleParticipantMicrophone(
                                  participant,
                                  !participant.permissions.canUseMicrophone
                                )
                              }
                              disabled={isEnded}
                            >
                              {participant.permissions.canUseMicrophone ? (
                                <MicRoundedIcon fontSize="small" />
                              ) : (
                                <MicOffRoundedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            participant.permissions.canUseCamera
                              ? "Ограничить камеру"
                              : "Разрешить камеру"
                          }
                          arrow
                        >
                          <span>
                            <IconButton
                              size="small"
                              className={`workbook-session__participant-overlay-control workbook-session__participant-nameplate-control ${
                                participant.permissions.canUseCamera
                                  ? "is-enabled"
                                  : "is-disabled"
                              }`}
                              onClick={() =>
                                onToggleParticipantCamera(
                                  participant,
                                  !participant.permissions.canUseCamera
                                )
                              }
                              disabled={isEnded}
                            >
                              {participant.permissions.canUseCamera ? (
                                <VideocamRoundedIcon fontSize="small" />
                              ) : (
                                <VideocamOffRoundedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            boardToolsEnabled
                              ? "Ограничить инструменты на доске"
                              : "Разрешить инструменты на доске"
                          }
                          arrow
                        >
                          <span>
                            <IconButton
                              size="small"
                              className={`workbook-session__participant-overlay-control workbook-session__participant-nameplate-control ${
                                boardToolsEnabled ? "is-enabled" : "is-disabled"
                              }`}
                              onClick={() =>
                                onToggleParticipantBoardTools(
                                  participant,
                                  !boardToolsEnabled
                                )
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
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
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
            onSetStudentsMicrophoneEnabled(areAllStudentsMicrophonesDisabled);
            setHostMenuAnchor(null);
          }}
          disabled={!canManageSession || isEnded || !hasStudentParticipants}
        >
          {areAllStudentsMicrophonesDisabled
            ? "Включить микрофоны всем"
            : "Отключить микрофоны всем"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSetStudentsCameraEnabled(areAllStudentsCamerasDisabled);
            setHostMenuAnchor(null);
          }}
          disabled={!canManageSession || isEnded || !hasStudentParticipants}
        >
          {areAllStudentsCamerasDisabled
            ? "Включить камеры всем"
            : "Отключить камеры всем"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSetStudentsBoardToolsEnabled(areAllStudentsBoardToolsDisabled);
            setHostMenuAnchor(null);
          }}
          disabled={!canManageSession || isEnded || !hasStudentParticipants}
        >
          {areAllStudentsBoardToolsDisabled
            ? "Включить инструменты всем"
            : "Отключить инструменты всем"}
        </MenuItem>
      </Menu>
    </div>
  );
});
