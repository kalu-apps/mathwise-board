import { memo, useEffect, useMemo, useRef } from "react";
import NoPhotographyRoundedIcon from "@mui/icons-material/NoPhotographyRounded";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import type { WorkbookRemoteVideoTrack } from "./useWorkbookLivekit";

type WorkbookSessionVideoDockProps = {
  cameraEnabled: boolean;
  localVideoTrack: LocalVideoTrack | null;
  remoteVideoTracks: WorkbookRemoteVideoTrack[];
  isCompactViewport?: boolean;
};

type WorkbookSessionVideoTileProps = {
  label: string;
  track: LocalVideoTrack | RemoteVideoTrack | null;
  muted?: boolean;
  mirrored?: boolean;
  placeholderLabel: string;
  testId: string;
};

const WorkbookSessionVideoTile = memo(function WorkbookSessionVideoTile({
  label,
  track,
  muted = false,
  mirrored = false,
  placeholderLabel,
  testId,
}: WorkbookSessionVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !track) return;
    element.autoplay = true;
    element.playsInline = true;
    element.muted = muted;
    if (muted) {
      element.defaultMuted = true;
    }
    try {
      track.attach(element);
      void element.play().catch(() => undefined);
    } catch {
      // Track attach can fail briefly during renegotiation.
    }
    return () => {
      try {
        track.detach(element);
      } catch {
        // Ignore detach errors on unmount/reconnect.
      }
      try {
        element.pause();
      } catch {
        // Ignore pause errors.
      }
      element.srcObject = null;
    };
  }, [muted, track]);

  return (
    <article
      className={`workbook-session__video-tile${mirrored ? " is-mirrored" : ""}`}
      data-testid={testId}
    >
      {track ? (
        <video
          ref={videoRef}
          className="workbook-session__video-tile-media"
          autoPlay
          playsInline
          muted={muted}
        />
      ) : (
        <div className="workbook-session__video-tile-placeholder" aria-label={placeholderLabel}>
          <NoPhotographyRoundedIcon fontSize="small" />
          <span>{placeholderLabel}</span>
        </div>
      )}
      <div className="workbook-session__video-tile-label">{label}</div>
    </article>
  );
});

export const WorkbookSessionVideoDock = memo(function WorkbookSessionVideoDock({
  cameraEnabled,
  localVideoTrack,
  remoteVideoTracks,
  isCompactViewport = false,
}: WorkbookSessionVideoDockProps) {
  const remoteTiles = useMemo(() => {
    const uniqueTracks = new Map<string, WorkbookRemoteVideoTrack>();
    remoteVideoTracks.forEach((item) => {
      if (!item.participantIdentity) return;
      uniqueTracks.set(item.participantIdentity, item);
    });
    return Array.from(uniqueTracks.values());
  }, [remoteVideoTracks]);

  const hasAnyVideoTiles = Boolean(cameraEnabled || localVideoTrack || remoteTiles.length > 0);
  if (!hasAnyVideoTiles) return null;

  return (
    <section
      className={`workbook-session__video-dock${isCompactViewport ? " is-compact" : ""}`}
      aria-label="Видео участников"
    >
      <div className="workbook-session__video-dock-header">
        <strong>Видео</strong>
        <span>
          Участников с камерой:{" "}
          {remoteTiles.length + (cameraEnabled || localVideoTrack ? 1 : 0)}
        </span>
      </div>
      <div className="workbook-session__video-dock-grid">
        <WorkbookSessionVideoTile
          label="Вы"
          track={localVideoTrack}
          muted
          mirrored
          placeholderLabel={cameraEnabled ? "Подключаем камеру..." : "Камера выключена"}
          testId="workbook-video-local"
        />
        {remoteTiles.map((item) => (
          <WorkbookSessionVideoTile
            key={`${item.participantIdentity}:${item.trackSid}`}
            label={item.participantName || "Участник"}
            track={item.track}
            placeholderLabel="Камера недоступна"
            testId={`workbook-video-remote-${item.participantIdentity}`}
          />
        ))}
      </div>
    </section>
  );
});
