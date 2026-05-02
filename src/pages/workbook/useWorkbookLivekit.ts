import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getWorkbookLivekitToken, getWorkbookMediaConfig } from "@/features/workbook/model/api";
import type { WorkbookSessionKind } from "@/features/workbook/model/types";
import { ApiError } from "@/shared/api/client";
import { emitMediaMetric } from "@/shared/lib/mediaMonitoring";
import type {
  Room as LivekitRoom,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  RemoteVideoTrack,
} from "livekit-client";
import {
  buildCameraCaptureOptions,
  buildCameraPublishOptions,
  buildLivekitConnectOptions,
  emitLivekitConnectionQualityMetric,
  emitLivekitMediaDevicesErrorMetric,
  hasRelayIceServer,
  isLikelyMobileOrTabletDevice,
  isLocalSecureContext,
  normalizeLivekitIceServers,
  resolveLivekitVideoProfile,
  summarizeLivekitConnectFailure,
  type CameraFacingMode,
  type LivekitModule,
} from "./workbookLivekitRuntime";

type UseWorkbookLivekitParams = {
  sessionId: string;
  sessionKind?: WorkbookSessionKind;
  canUseMicrophone: boolean;
  canUseCamera: boolean;
  isEnded: boolean;
  userId?: string;
  setError: Dispatch<SetStateAction<string | null>>;
};

type RemoteAudioBinding = {
  track: RemoteAudioTrack;
  element: HTMLAudioElement;
};

export type WorkbookRemoteVideoTrack = {
  participantIdentity: string;
  participantName: string;
  trackSid: string;
  track: RemoteVideoTrack;
};

const LIVEKIT_CONNECT_RETRY_DELAYS_MS = [800, 2_000] as const;

export const useWorkbookLivekit = ({
  sessionId,
  sessionKind,
  canUseMicrophone,
  canUseCamera,
  isEnded,
  userId,
  setError,
}: UseWorkbookLivekitParams) => {
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [canSwitchCameraFacing, setCanSwitchCameraFacing] = useState(false);
  const [isRearCameraActive, setIsRearCameraActive] = useState(false);
  const [isSwitchingCameraFacing, setIsSwitchingCameraFacing] = useState(false);
  const [isLivekitConnected, setIsLivekitConnected] = useState(false);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState<WorkbookRemoteVideoTrack[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);

  const livekitRuntimeRef = useRef<LivekitModule | null>(null);
  const livekitRoomRef = useRef<LivekitRoom | null>(null);
  const livekitRoomSessionIdRef = useRef<string | null>(null);
  const livekitConnectInFlightRef = useRef<Promise<void> | null>(null);
  const livekitRetryTimeoutRef = useRef<number | null>(null);
  const livekitConnectAttemptRef = useRef(0);
  const livekitDisconnectAttemptRef = useRef(0);
  const livekitShouldBeConnectedRef = useRef(false);
  const preferredCameraFacingRef = useRef<CameraFacingMode>("user");
  const isLikelyMobileOrTabletRef = useRef(isLikelyMobileOrTabletDevice());
  const micDefaultSessionKeyRef = useRef<string | null>(null);
  const cameraDefaultSessionKeyRef = useRef<string | null>(null);
  const remoteAudioGestureUnlockedRef = useRef(false);
  const remoteAudioBindingsRef = useRef<Map<string, RemoteAudioBinding>>(new Map());
  const remoteVideoTracksRef = useRef<Map<string, WorkbookRemoteVideoTrack>>(new Map());

  const clearLivekitRetryTimeout = useCallback(() => {
    if (typeof window === "undefined") return;
    if (livekitRetryTimeoutRef.current === null) return;
    window.clearTimeout(livekitRetryTimeoutRef.current);
    livekitRetryTimeoutRef.current = null;
  }, []);

  const ensureLivekitRuntime = useCallback(async () => {
    if (livekitRuntimeRef.current) return livekitRuntimeRef.current;
    const runtime = await import("livekit-client");
    livekitRuntimeRef.current = runtime;
    return runtime;
  }, []);

  const refreshCameraFacingCapability = useCallback(async () => {
    if (!isLikelyMobileOrTabletRef.current) {
      setCanSwitchCameraFacing(false);
      return;
    }
    try {
      const runtime = await ensureLivekitRuntime();
      const devices = await runtime.Room.getLocalDevices("videoinput");
      setCanSwitchCameraFacing(devices.length > 1);
    } catch {
      setCanSwitchCameraFacing(false);
    }
  }, [ensureLivekitRuntime]);

  const syncRemoteVideoTracksState = useCallback(() => {
    const snapshot = Array.from(remoteVideoTracksRef.current.values()).sort((left, right) => {
      const leftKey = `${left.participantName}:${left.participantIdentity}`;
      const rightKey = `${right.participantName}:${right.participantIdentity}`;
      return leftKey.localeCompare(rightKey, "ru");
    });
    setRemoteVideoTracks(snapshot);
  }, []);

  const detachRemoteVideo = useCallback(
    (participantIdentity?: string) => {
      if (!participantIdentity) {
        if (remoteVideoTracksRef.current.size === 0) return;
        remoteVideoTracksRef.current.clear();
        syncRemoteVideoTracksState();
        return;
      }
      let changed = false;
      Array.from(remoteVideoTracksRef.current.keys()).forEach((key) => {
        if (!key.startsWith(`${participantIdentity}:`)) return;
        changed = remoteVideoTracksRef.current.delete(key) || changed;
      });
      if (!changed) return;
      syncRemoteVideoTracksState();
    },
    [syncRemoteVideoTracksState]
  );

  const detachRemoteAudio = useCallback((participantIdentity?: string) => {
    Array.from(remoteAudioBindingsRef.current.entries()).forEach(([key, binding]) => {
      if (participantIdentity && !key.startsWith(`${participantIdentity}:`)) return;
      try {
        binding.track.detach(binding.element);
      } catch {
        // ignore detach errors
      }
      try {
        binding.element.pause();
      } catch {
        // ignore pause errors
      }
      binding.element.srcObject = null;
      binding.element.remove();
      remoteAudioBindingsRef.current.delete(key);
    });
  }, []);

  const detachAllRemoteAudio = useCallback(() => {
    detachRemoteAudio();
  }, [detachRemoteAudio]);
  const detachAllRemoteVideo = useCallback(() => {
    detachRemoteVideo();
  }, [detachRemoteVideo]);

  const enableRemoteVideoPublication = useCallback((publicationLike: unknown) => {
    const runtime = livekitRuntimeRef.current;
    if (!runtime) return;
    if (!publicationLike || typeof publicationLike !== "object") return;
    const publication = publicationLike as RemoteTrackPublication & {
      kind?: unknown;
      setEnabled?: (enabled: boolean) => void;
    };
    if (publication.kind !== runtime.Track.Kind.Video) return;
    try {
      publication.setEnabled?.(true);
    } catch {
      // Ignore publication state race during reconnect.
    }
  }, []);

  const enableRemoteVideoForParticipant = useCallback(
    (participantLike: unknown) => {
      if (!participantLike || typeof participantLike !== "object") return;
      const participant = participantLike as RemoteParticipant & {
        trackPublications?: Map<string, RemoteTrackPublication>;
      };
      participant.trackPublications?.forEach((publication) => {
        enableRemoteVideoPublication(publication);
      });
    },
    [enableRemoteVideoPublication]
  );

  const handleTrackSubscribed = useCallback(
    (track: unknown, publicationLike: unknown, participantLike: unknown) => {
      const runtime = livekitRuntimeRef.current;
      if (!runtime) return;
      if (!track || typeof track !== "object") return;
      const trackKind = (track as { kind?: unknown }).kind;
      const participant = participantLike as RemoteParticipant;
      const participantIdentity = participant.identity || participant.sid || "unknown";
      if (trackKind === runtime.Track.Kind.Audio) {
        const audioTrack = track as RemoteAudioTrack;
        const trackSid = audioTrack.sid || `${participantIdentity}-audio`;
        const bindingKey = `${participantIdentity}:${trackSid}`;
        if (remoteAudioBindingsRef.current.has(bindingKey)) return;
        const element = audioTrack.attach() as HTMLAudioElement;
        element.autoplay = false;
        element.setAttribute("playsinline", "true");
        element.muted = false;
        element.volume = 1;
        element.style.display = "none";
        document.body.appendChild(element);
        remoteAudioBindingsRef.current.set(bindingKey, {
          track: audioTrack,
          element,
        });
        const canResumeImmediately = (() => {
          if (remoteAudioGestureUnlockedRef.current) return true;
          if (typeof document === "undefined") return false;
          const activation = (
            document as Document & {
              userActivation?: { hasBeenActive?: boolean; isActive?: boolean };
            }
          ).userActivation;
          return Boolean(activation?.hasBeenActive || activation?.isActive);
        })();
        if (canResumeImmediately) {
          void element.play().catch(() => undefined);
        }
        return;
      }
      if (trackKind !== runtime.Track.Kind.Video) {
        return;
      }
      enableRemoteVideoPublication(publicationLike);
      const remoteVideoTrack = track as RemoteVideoTrack;
      const trackSid = remoteVideoTrack.sid || `${participantIdentity}-video`;
      const bindingKey = `${participantIdentity}:${trackSid}`;
      if (remoteVideoTracksRef.current.has(bindingKey)) return;
      remoteVideoTracksRef.current.set(bindingKey, {
        participantIdentity,
        participantName: participant.name || participant.identity || "Участник",
        trackSid,
        track: remoteVideoTrack,
      });
      syncRemoteVideoTracksState();
    },
    [enableRemoteVideoPublication, syncRemoteVideoTracksState]
  );

  const handleTrackUnsubscribed = useCallback(
    (track: unknown, _publication: unknown, participantLike: unknown) => {
      const runtime = livekitRuntimeRef.current;
      if (!runtime) return;
      if (!track || typeof track !== "object") return;
      const trackKind = (track as { kind?: unknown }).kind;
      const participant = participantLike as RemoteParticipant;
      const participantIdentity = participant.identity || participant.sid || "unknown";
      if (trackKind === runtime.Track.Kind.Audio) {
        const trackSid = (track as { sid?: string }).sid || "";
        if (!trackSid) {
          detachRemoteAudio(participantIdentity);
          return;
        }
        const bindingKey = `${participantIdentity}:${trackSid}`;
        const binding = remoteAudioBindingsRef.current.get(bindingKey);
        if (!binding) return;
        try {
          binding.track.detach(binding.element);
        } catch {
          // ignore detach errors
        }
        try {
          binding.element.pause();
        } catch {
          // ignore pause errors
        }
        binding.element.srcObject = null;
        binding.element.remove();
        remoteAudioBindingsRef.current.delete(bindingKey);
        return;
      }
      if (trackKind !== runtime.Track.Kind.Video) return;
      const trackSid = (track as { sid?: string }).sid || "";
      if (!trackSid) {
        detachRemoteVideo(participantIdentity);
        return;
      }
      const bindingKey = `${participantIdentity}:${trackSid}`;
      if (!remoteVideoTracksRef.current.delete(bindingKey)) return;
      syncRemoteVideoTracksState();
    },
    [detachRemoteAudio, detachRemoteVideo, syncRemoteVideoTracksState]
  );

  const handleMicrophoneError = useCallback(
    (reason: unknown) => {
      if (reason instanceof DOMException) {
        if (reason.name === "NotAllowedError") {
          setError("Доступ к микрофону запрещён. Разрешите его в настройках браузера.");
          return;
        }
        if (reason.name === "NotFoundError") {
          setError("Не найдено доступное устройство микрофона.");
          return;
        }
        if (reason.name === "NotReadableError") {
          setError("Микрофон занят другим приложением. Освободите устройство и повторите.");
          return;
        }
        if (reason.name === "SecurityError") {
          setError("Браузер заблокировал микрофон: откройте страницу по HTTPS.");
          return;
        }
      }
      setError("Не удалось подключить микрофон.");
    },
    [setError]
  );

  const handleCameraError = useCallback(
    (reason: unknown) => {
      if (reason instanceof DOMException) {
        if (reason.name === "NotAllowedError") {
          setError("Доступ к камере запрещён. Разрешите его в настройках браузера.");
          return;
        }
        if (reason.name === "NotFoundError") {
          setError("Не найдено доступное устройство камеры.");
          return;
        }
        if (reason.name === "NotReadableError") {
          setError("Камера занята другим приложением. Освободите устройство и повторите.");
          return;
        }
        if (reason.name === "SecurityError") {
          setError("Браузер заблокировал камеру: откройте страницу по HTTPS.");
          return;
        }
      }
      setError("Не удалось подключить камеру.");
    },
    [setError]
  );

  const syncLocalVideoTrackFromRoom = useCallback(() => {
    const runtime = livekitRuntimeRef.current;
    const room = livekitRoomRef.current;
    if (!runtime || !room || room.state !== runtime.ConnectionState.Connected) {
      setLocalVideoTrack(null);
      return;
    }
    const publication = room.localParticipant.getTrackPublication(runtime.Track.Source.Camera);
    const candidateTrack = publication?.track;
    if (
      candidateTrack &&
      typeof candidateTrack === "object" &&
      (candidateTrack as { kind?: unknown }).kind === runtime.Track.Kind.Video
    ) {
      setLocalVideoTrack(candidateTrack as LocalVideoTrack);
      return;
    }
    setLocalVideoTrack(null);
  }, []);

  const disconnectLivekitRoom = useCallback(
    async (options?: { forceStopTracks?: boolean; resetRetryState?: boolean }) => {
      livekitConnectInFlightRef.current = null;
      clearLivekitRetryTimeout();
      if (options?.resetRetryState !== false) {
        livekitConnectAttemptRef.current = 0;
        livekitDisconnectAttemptRef.current = 0;
      }
      const room = livekitRoomRef.current;
      if (!room) {
        setIsLivekitConnected(false);
        setLocalVideoTrack(null);
        detachAllRemoteVideo();
        if (options?.forceStopTracks) {
          setMicEnabled(false);
          setCameraEnabled(false);
        }
        return;
      }
      room.removeAllListeners();
      detachAllRemoteAudio();
      detachAllRemoteVideo();
      await room.disconnect(options?.forceStopTracks ?? true).catch(() => undefined);
      livekitRoomRef.current = null;
      livekitRoomSessionIdRef.current = null;
      setIsLivekitConnected(false);
      setLocalVideoTrack(null);
      if (options?.forceStopTracks) {
        setMicEnabled(false);
        setCameraEnabled(false);
      }
    },
    [clearLivekitRetryTimeout, detachAllRemoteAudio, detachAllRemoteVideo]
  );

  const connectLivekitRoom = useCallback(async () => {
    if (!sessionId || sessionKind !== "CLASS" || !userId) return;
    if (livekitConnectInFlightRef.current) {
      await livekitConnectInFlightRef.current;
      return;
    }
    const task = (async () => {
      const runtime = await ensureLivekitRuntime();
      clearLivekitRetryTimeout();
      const connectAttempt = livekitConnectAttemptRef.current + 1;
      livekitConnectAttemptRef.current = connectAttempt;
      emitMediaMetric({
        scope: "workbook",
        subsystem: "livekit",
        phase: "token_request",
        sessionId,
        sessionKind: sessionKind ?? null,
        timestamp: new Date().toISOString(),
        attempt: connectAttempt,
      });
      const mediaConfigPromise = getWorkbookMediaConfig(sessionId).catch((reason) => {
        emitMediaMetric({
          scope: "workbook",
          subsystem: "livekit",
          phase: "ice_config_failure",
          sessionId,
          sessionKind: sessionKind ?? null,
          timestamp: new Date().toISOString(),
          attempt: connectAttempt,
          errorName: reason instanceof Error ? reason.name : null,
          errorMessage: reason instanceof Error ? reason.message : null,
          errorStatus: reason instanceof ApiError ? reason.status : null,
        });
        return null;
      });
      const tokenConfig = await getWorkbookLivekitToken(sessionId);
      const mediaConfig = await mediaConfigPromise;
      const rtcIceServers = normalizeLivekitIceServers(mediaConfig?.iceServers);
      const hasRelayIce = hasRelayIceServer(rtcIceServers);
      const rtcIceServersForConnect = hasRelayIce ? rtcIceServers : undefined;
      emitMediaMetric({
        scope: "workbook",
        subsystem: "livekit",
        phase: "token_success",
        sessionId,
        sessionKind: sessionKind ?? null,
        timestamp: new Date().toISOString(),
        attempt: connectAttempt,
        wsUrl: tokenConfig.wsUrl,
        roomName: tokenConfig.roomName,
        iceServerCount: rtcIceServers?.length ?? 0,
        hasRelayIceServer: hasRelayIce,
      });
      if (!tokenConfig.wsUrl || !tokenConfig.token) {
        throw new Error("livekit_token_invalid");
      }
      if (!isLocalSecureContext()) {
        throw new Error("media_secure_context_required");
      }

      const currentRoom = livekitRoomRef.current;
      if (
        currentRoom &&
        livekitRoomSessionIdRef.current === sessionId &&
        currentRoom.state === runtime.ConnectionState.Connected
      ) {
        return;
      }
      if (currentRoom) {
        await disconnectLivekitRoom({ forceStopTracks: false, resetRetryState: false });
      }

      const videoProfile = resolveLivekitVideoProfile(
        runtime,
        isLikelyMobileOrTabletRef.current
      );

      const room = new runtime.Room({
        adaptiveStream: {
          pixelDensity: videoProfile.pixelDensity,
          pauseVideoInBackground: true,
        },
        dynacast: true,
        videoCaptureDefaults: videoProfile.capturePreset
          ? {
              resolution: videoProfile.capturePreset.resolution,
            }
          : undefined,
        publishDefaults: {
          videoEncoding: videoProfile.capturePreset?.encoding,
          videoSimulcastLayers:
            videoProfile.simulcastLayers.length > 0 ? videoProfile.simulcastLayers : undefined,
        },
      });
      livekitRoomRef.current = room;
      livekitRoomSessionIdRef.current = sessionId;
      const isCurrentRoom = () => livekitRoomRef.current === room;
      const onTrackSubscribed = (
        track: unknown,
        publication: unknown,
        participant: unknown
      ) => {
        if (!isCurrentRoom()) return;
        handleTrackSubscribed(track, publication, participant);
      };
      const onTrackUnsubscribed = (
        track: unknown,
        publication: unknown,
        participant: unknown
      ) => {
        if (!isCurrentRoom()) return;
        handleTrackUnsubscribed(track, publication, participant);
      };
      room.on(runtime.RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(runtime.RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.on(runtime.RoomEvent.TrackPublished, (publication: RemoteTrackPublication) => {
        if (!isCurrentRoom()) return;
        enableRemoteVideoPublication(publication);
      });
      room.on(runtime.RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        if (!isCurrentRoom()) return;
        enableRemoteVideoForParticipant(participant);
      });
      room.on(runtime.RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        if (!isCurrentRoom()) return;
        detachRemoteAudio(participant.identity || participant.sid || "");
        detachRemoteVideo(participant.identity || participant.sid || "");
      });
      room.on(runtime.RoomEvent.Disconnected, () => {
        if (!isCurrentRoom()) return;
        detachAllRemoteAudio();
        detachAllRemoteVideo();
        livekitRoomRef.current = null;
        livekitRoomSessionIdRef.current = null;
        setIsLivekitConnected(false);
        setLocalVideoTrack(null);
        emitMediaMetric({
          scope: "workbook",
          subsystem: "livekit",
          phase: "disconnect",
          sessionId,
          sessionKind: sessionKind ?? null,
          timestamp: new Date().toISOString(),
        });
        if (
          typeof window === "undefined" ||
          !livekitShouldBeConnectedRef.current ||
          livekitConnectInFlightRef.current
        ) {
          livekitDisconnectAttemptRef.current = 0;
          return;
        }
        if (livekitRetryTimeoutRef.current !== null) return;
        livekitDisconnectAttemptRef.current += 1;
        const reconnectAttempt = livekitDisconnectAttemptRef.current;
        const reconnectBaseDelayMs = Math.min(
          20_000,
          1_000 * 2 ** Math.max(0, reconnectAttempt - 1)
        );
        const reconnectDelayMs = reconnectBaseDelayMs + Math.floor(Math.random() * 500);
        emitMediaMetric({
          scope: "workbook",
          subsystem: "livekit",
          phase: "retry_scheduled",
          sessionId,
          sessionKind: sessionKind ?? null,
          timestamp: new Date().toISOString(),
          attempt: reconnectAttempt,
          retryInMs: reconnectDelayMs,
          errorReason: "room_disconnected",
        });
        livekitRetryTimeoutRef.current = window.setTimeout(() => {
          livekitRetryTimeoutRef.current = null;
          if (!livekitShouldBeConnectedRef.current) return;
          void connectLivekitRoom();
        }, reconnectDelayMs);
      });
      room.on(runtime.RoomEvent.ConnectionStateChanged, (state: unknown) => {
        if (!isCurrentRoom()) return;
        setIsLivekitConnected(state === runtime.ConnectionState.Connected);
        if (state === runtime.ConnectionState.Connected) {
          syncLocalVideoTrackFromRoom();
        } else if (state === runtime.ConnectionState.Disconnected) {
          setLocalVideoTrack(null);
        }
        emitMediaMetric({
          scope: "workbook",
          subsystem: "livekit",
          phase: "connection_state",
          sessionId,
          sessionKind: sessionKind ?? null,
          timestamp: new Date().toISOString(),
          connectionState: typeof state === "string" ? state : String(state ?? ""),
        });
      });
      room.on(runtime.RoomEvent.ConnectionQualityChanged, (quality: unknown, participant: unknown) => {
        if (!isCurrentRoom()) return;
        emitLivekitConnectionQualityMetric({
          sessionId,
          sessionKind,
          quality,
          participant,
        });
      });
      room.on(runtime.RoomEvent.MediaDevicesError, (error: unknown, kind: unknown) => {
        if (!isCurrentRoom()) return;
        emitLivekitMediaDevicesErrorMetric({
          sessionId,
          sessionKind,
          error,
          kind,
        });
      });
      emitMediaMetric({
        scope: "workbook",
        subsystem: "livekit",
        phase: "connect_start",
        sessionId,
        sessionKind: sessionKind ?? null,
        timestamp: new Date().toISOString(),
        attempt: connectAttempt,
        wsUrl: tokenConfig.wsUrl,
        roomName: tokenConfig.roomName,
        captureProfile: videoProfile.captureProfile,
        simulcastLayerCount: videoProfile.simulcastLayers.length,
        constrainedNetwork: videoProfile.constrainedNetwork,
        mobileOrTablet: videoProfile.mobileOrTablet,
      });
      await room.connect(tokenConfig.wsUrl, tokenConfig.token, buildLivekitConnectOptions(rtcIceServersForConnect));
      if (!isCurrentRoom()) return;
      room.remoteParticipants.forEach((participant) => {
        enableRemoteVideoForParticipant(participant);
      });
      setIsLivekitConnected(true);
      syncLocalVideoTrackFromRoom();
      livekitConnectAttemptRef.current = 0;
      livekitDisconnectAttemptRef.current = 0;
      emitMediaMetric({
        scope: "workbook",
        subsystem: "livekit",
        phase: "connect_success",
        sessionId,
        sessionKind: sessionKind ?? null,
        timestamp: new Date().toISOString(),
        attempt: connectAttempt,
        wsUrl: tokenConfig.wsUrl,
        roomName: tokenConfig.roomName,
        iceServerCount: rtcIceServers?.length ?? 0,
        hasRelayIceServer: hasRelayIce,
        captureProfile: videoProfile.captureProfile,
        simulcastLayerCount: videoProfile.simulcastLayers.length,
        constrainedNetwork: videoProfile.constrainedNetwork,
        mobileOrTablet: videoProfile.mobileOrTablet,
      });
    })();
    livekitConnectInFlightRef.current = task;
    try {
      await task;
      setError((current) => {
        if (!current) return current;
        if (
          current.includes("микрофон") ||
          current.includes("Микрофон") ||
          current.includes("камер") ||
          current.includes("Камер") ||
          current.includes("LiveKit")
        ) {
          return null;
        }
        return current;
      });
    } catch (reason) {
      const failure = summarizeLivekitConnectFailure(reason);
      const connectAttempt = livekitConnectAttemptRef.current;
      const retryDelay =
        failure.retryable && connectAttempt <= LIVEKIT_CONNECT_RETRY_DELAYS_MS.length
          ? LIVEKIT_CONNECT_RETRY_DELAYS_MS[connectAttempt - 1]
          : null;
      emitMediaMetric({
        scope: "workbook",
        subsystem: "livekit",
        phase: "connect_failure",
        sessionId,
        sessionKind: sessionKind ?? null,
        timestamp: new Date().toISOString(),
        attempt: connectAttempt,
        errorName: failure.errorName,
        errorMessage: failure.errorMessage,
        errorReason: failure.errorReason,
        errorStatus: failure.errorStatus,
      });
      await disconnectLivekitRoom({ forceStopTracks: false, resetRetryState: retryDelay === null });
      if (retryDelay !== null && typeof window !== "undefined") {
        emitMediaMetric({
          scope: "workbook",
          subsystem: "livekit",
          phase: "retry_scheduled",
          sessionId,
          sessionKind: sessionKind ?? null,
          timestamp: new Date().toISOString(),
          attempt: connectAttempt,
          retryInMs: retryDelay,
          errorName: failure.errorName,
          errorReason: failure.errorReason,
          errorStatus: failure.errorStatus,
        });
        livekitRetryTimeoutRef.current = window.setTimeout(() => {
          livekitRetryTimeoutRef.current = null;
          void connectLivekitRoom();
        }, retryDelay);
      } else {
        livekitConnectAttemptRef.current = 0;
        setError(failure.userMessage);
      }
    } finally {
      livekitConnectInFlightRef.current = null;
    }
  }, [
    clearLivekitRetryTimeout,
    detachAllRemoteAudio,
    detachAllRemoteVideo,
    detachRemoteAudio,
    detachRemoteVideo,
    disconnectLivekitRoom,
    ensureLivekitRuntime,
    handleTrackSubscribed,
    handleTrackUnsubscribed,
    enableRemoteVideoForParticipant,
    enableRemoteVideoPublication,
    sessionId,
    sessionKind,
    setError,
    syncLocalVideoTrackFromRoom,
    userId,
  ]);

  const syncLivekitMicState = useCallback(async () => {
    const runtime = livekitRuntimeRef.current;
    const room = livekitRoomRef.current;
    if (!runtime || !room || room.state !== runtime.ConnectionState.Connected) return;
    const shouldPublishMicrophone = Boolean(canUseMicrophone && micEnabled);
    try {
      await room.localParticipant.setMicrophoneEnabled(shouldPublishMicrophone);
      if (shouldPublishMicrophone) {
        setError((current) => {
          if (!current) return current;
          return current.includes("микрофон") || current.includes("Микрофон")
            ? null
            : current;
        });
      }
    } catch (reason) {
      handleMicrophoneError(reason);
    }
  }, [canUseMicrophone, handleMicrophoneError, micEnabled, setError]);

  const syncLivekitCameraState = useCallback(async () => {
    const runtime = livekitRuntimeRef.current;
    const room = livekitRoomRef.current;
    if (!runtime || !room || room.state !== runtime.ConnectionState.Connected) {
      setLocalVideoTrack(null);
      return;
    }
    const shouldPublishCamera = Boolean(canUseCamera && cameraEnabled);
    try {
      const videoProfile = resolveLivekitVideoProfile(
        runtime,
        isLikelyMobileOrTabletRef.current
      );
      const cameraOptions = shouldPublishCamera
        ? buildCameraCaptureOptions(
            videoProfile,
            isLikelyMobileOrTabletRef.current ? preferredCameraFacingRef.current : null
          )
        : undefined;
      const publishOptions = shouldPublishCamera
        ? buildCameraPublishOptions(videoProfile)
        : undefined;
      await room.localParticipant.setCameraEnabled(
        shouldPublishCamera,
        cameraOptions,
        publishOptions
      );
      syncLocalVideoTrackFromRoom();
      if (shouldPublishCamera) {
        await refreshCameraFacingCapability();
      }
      if (shouldPublishCamera) {
        setError((current) => {
          if (!current) return current;
          return current.includes("камер") || current.includes("Камер") ? null : current;
        });
      }
    } catch (reason) {
      handleCameraError(reason);
    }
  }, [
    cameraEnabled,
    canUseCamera,
    handleCameraError,
    refreshCameraFacingCapability,
    setError,
    syncLocalVideoTrackFromRoom,
  ]);

  const switchCameraFacing = useCallback(async () => {
    if (!isLikelyMobileOrTabletRef.current) return;
    if (!canUseCamera || !cameraEnabled) return;
    if (isSwitchingCameraFacing) return;
    const runtime = livekitRuntimeRef.current;
    const room = livekitRoomRef.current;
    if (!runtime || !room || room.state !== runtime.ConnectionState.Connected) return;

    const previousFacing = preferredCameraFacingRef.current;
    const nextFacing: CameraFacingMode = previousFacing === "user" ? "environment" : "user";
    preferredCameraFacingRef.current = nextFacing;
    setIsRearCameraActive(nextFacing === "environment");
    setIsSwitchingCameraFacing(true);

    try {
      const publication = room.localParticipant.getTrackPublication(runtime.Track.Source.Camera);
      const localCameraTrack = publication?.videoTrack ?? null;
      const videoProfile = resolveLivekitVideoProfile(runtime, true);
      const cameraOptions = buildCameraCaptureOptions(videoProfile, nextFacing);
      if (localCameraTrack) {
        await localCameraTrack.restartTrack(cameraOptions);
      } else {
        await room.localParticipant.setCameraEnabled(
          true,
          cameraOptions,
          buildCameraPublishOptions(videoProfile)
        );
      }
      syncLocalVideoTrackFromRoom();
      await refreshCameraFacingCapability();
      setError((current) => {
        if (!current) return current;
        return current.includes("камер") || current.includes("Камер") ? null : current;
      });
    } catch (reason) {
      preferredCameraFacingRef.current = previousFacing;
      setIsRearCameraActive(previousFacing === "environment");
      handleCameraError(reason);
    } finally {
      setIsSwitchingCameraFacing(false);
    }
  }, [
    cameraEnabled,
    canUseCamera,
    handleCameraError,
    isSwitchingCameraFacing,
    refreshCameraFacingCapability,
    setError,
    syncLocalVideoTrackFromRoom,
  ]);

  const shouldKeepLivekitConnected = Boolean(
    sessionId && sessionKind === "CLASS" && !isEnded && userId
  );

  useEffect(() => {
    livekitShouldBeConnectedRef.current = shouldKeepLivekitConnected;
    if (!shouldKeepLivekitConnected) {
      livekitDisconnectAttemptRef.current = 0;
    }
  }, [shouldKeepLivekitConnected]);

  useEffect(() => {
    if (!sessionId || sessionKind !== "CLASS" || isEnded || !userId) {
      void disconnectLivekitRoom({
        forceStopTracks: isEnded || sessionKind !== "CLASS",
      });
      return;
    }
    void connectLivekitRoom();
  }, [
    connectLivekitRoom,
    disconnectLivekitRoom,
    isEnded,
    sessionId,
    sessionKind,
    userId,
  ]);

  useEffect(() => {
    if (sessionKind !== "CLASS" || isEnded || !isLivekitConnected) {
      return;
    }
    void syncLivekitMicState();
  }, [isEnded, isLivekitConnected, sessionKind, syncLivekitMicState]);

  useEffect(() => {
    if (sessionKind !== "CLASS" || isEnded || !isLivekitConnected) {
      return;
    }
    void syncLivekitCameraState();
  }, [isEnded, isLivekitConnected, sessionKind, syncLivekitCameraState]);

  useEffect(() => {
    if (sessionKind !== "CLASS" || isEnded || !isLivekitConnected || !cameraEnabled) {
      setCanSwitchCameraFacing(false);
      return;
    }
    void refreshCameraFacingCapability();
  }, [
    cameraEnabled,
    isEnded,
    isLivekitConnected,
    refreshCameraFacingCapability,
    sessionKind,
  ]);

  useEffect(() => {
    const sessionKey =
      sessionId && sessionKind === "CLASS" && !isEnded && userId ? `${sessionId}:${userId}` : null;
    if (!sessionKey) {
      micDefaultSessionKeyRef.current = null;
      cameraDefaultSessionKeyRef.current = null;
      preferredCameraFacingRef.current = "user";
      setIsRearCameraActive(false);
      setIsSwitchingCameraFacing(false);
      setCanSwitchCameraFacing(false);
      return;
    }
    if (micDefaultSessionKeyRef.current === sessionKey) return;
    micDefaultSessionKeyRef.current = sessionKey;
    cameraDefaultSessionKeyRef.current = sessionKey;
    preferredCameraFacingRef.current = "user";
    setIsRearCameraActive(false);
    setIsSwitchingCameraFacing(false);
    setCanSwitchCameraFacing(false);
    setMicEnabled(Boolean(canUseMicrophone));
    setCameraEnabled(false);
  }, [canUseMicrophone, isEnded, sessionId, sessionKind, userId]);

  useEffect(() => {
    if (canUseMicrophone || !micEnabled) return;
    setMicEnabled(false);
  }, [canUseMicrophone, micEnabled]);

  useEffect(() => {
    if (canUseCamera || !cameraEnabled) return;
    setCameraEnabled(false);
  }, [cameraEnabled, canUseCamera]);

  useEffect(
    () => () => {
      void disconnectLivekitRoom({ forceStopTracks: true });
    },
    [disconnectLivekitRoom]
  );

  useEffect(() => {
    if (!sessionId || sessionKind !== "CLASS" || isEnded || !userId) {
      return;
    }
    const handleOnline = () => {
      if (livekitRoomRef.current || livekitConnectInFlightRef.current) return;
      void connectLivekitRoom();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [connectLivekitRoom, isEnded, sessionId, sessionKind, userId]);

  useEffect(() => {
    if (sessionKind !== "CLASS" || isEnded) return;
    const resumeRemoteAudio = () => {
      remoteAudioGestureUnlockedRef.current = true;
      Array.from(remoteAudioBindingsRef.current.values()).forEach((binding) => {
        void binding.element.play().catch(() => undefined);
      });
    };
    window.addEventListener("pointerdown", resumeRemoteAudio, { passive: true });
    window.addEventListener("keydown", resumeRemoteAudio);
    return () => {
      window.removeEventListener("pointerdown", resumeRemoteAudio);
      window.removeEventListener("keydown", resumeRemoteAudio);
    };
  }, [isEnded, sessionKind]);

  return {
    isLivekitConnected,
    micEnabled,
    setMicEnabled,
    cameraEnabled,
    setCameraEnabled,
    canSwitchCameraFacing,
    isRearCameraActive,
    isSwitchingCameraFacing,
    switchCameraFacing,
    localVideoTrack,
    remoteVideoTracks,
  };
};
