import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getWorkbookLivekitToken } from "@/features/workbook/model/api";
import type { WorkbookSessionKind } from "@/features/workbook/model/types";
import { ApiError } from "@/shared/api/client";
import type {
  Room as LivekitRoom,
  RemoteAudioTrack,
  RemoteParticipant,
} from "livekit-client";

type LivekitModule = typeof import("livekit-client");

type UseWorkbookLivekitParams = {
  sessionId: string;
  sessionKind?: WorkbookSessionKind;
  canUseMedia: boolean;
  isEnded: boolean;
  userId?: string;
  setError: Dispatch<SetStateAction<string | null>>;
};

type RemoteAudioBinding = {
  track: RemoteAudioTrack;
  element: HTMLAudioElement;
};

const isLocalSecureContext = () => {
  if (typeof window === "undefined") return true;
  if (window.isSecureContext) return true;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1"
  );
};

export const useWorkbookLivekit = ({
  sessionId,
  sessionKind,
  canUseMedia,
  isEnded,
  userId,
  setError,
}: UseWorkbookLivekitParams) => {
  const [micEnabled, setMicEnabled] = useState(false);
  const [isLivekitConnected, setIsLivekitConnected] = useState(false);

  const livekitRuntimeRef = useRef<LivekitModule | null>(null);
  const livekitRoomRef = useRef<LivekitRoom | null>(null);
  const livekitRoomSessionIdRef = useRef<string | null>(null);
  const livekitConnectInFlightRef = useRef<Promise<void> | null>(null);
  const remoteAudioBindingsRef = useRef<Map<string, RemoteAudioBinding>>(new Map());

  const ensureLivekitRuntime = useCallback(async () => {
    if (livekitRuntimeRef.current) return livekitRuntimeRef.current;
    const runtime = await import("livekit-client");
    livekitRuntimeRef.current = runtime;
    return runtime;
  }, []);

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

  const handleTrackSubscribed = useCallback(
    (track: unknown, _publication: unknown, participantLike: unknown) => {
      const runtime = livekitRuntimeRef.current;
      if (!runtime) return;
      if (
        !track ||
        typeof track !== "object" ||
        (track as { kind?: unknown }).kind !== runtime.Track.Kind.Audio
      ) {
        return;
      }
      const audioTrack = track as RemoteAudioTrack;
      const participant = participantLike as RemoteParticipant;
      const participantIdentity = participant.identity || participant.sid || "unknown";
      const trackSid = audioTrack.sid || `${participantIdentity}-audio`;
      const bindingKey = `${participantIdentity}:${trackSid}`;
      if (remoteAudioBindingsRef.current.has(bindingKey)) return;
      const element = audioTrack.attach() as HTMLAudioElement;
      element.autoplay = true;
      element.setAttribute("playsinline", "true");
      element.muted = false;
      element.volume = 1;
      element.style.display = "none";
      document.body.appendChild(element);
      remoteAudioBindingsRef.current.set(bindingKey, {
        track: audioTrack,
        element,
      });
      void element.play().catch(() => undefined);
    },
    []
  );

  const handleTrackUnsubscribed = useCallback(
    (track: unknown, _publication: unknown, participantLike: unknown) => {
      const runtime = livekitRuntimeRef.current;
      if (!runtime) return;
      if (
        !track ||
        typeof track !== "object" ||
        (track as { kind?: unknown }).kind !== runtime.Track.Kind.Audio
      ) {
        return;
      }
      const participant = participantLike as RemoteParticipant;
      const participantIdentity = participant.identity || participant.sid || "unknown";
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
    },
    [detachRemoteAudio]
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

  const disconnectLivekitRoom = useCallback(
    async (options?: { forceStopTracks?: boolean }) => {
      livekitConnectInFlightRef.current = null;
      const room = livekitRoomRef.current;
      if (!room) {
        setIsLivekitConnected(false);
        if (options?.forceStopTracks) {
          setMicEnabled(false);
        }
        return;
      }
      room.removeAllListeners();
      detachAllRemoteAudio();
      await room.disconnect(options?.forceStopTracks ?? true).catch(() => undefined);
      livekitRoomRef.current = null;
      livekitRoomSessionIdRef.current = null;
      setIsLivekitConnected(false);
      if (options?.forceStopTracks) {
        setMicEnabled(false);
      }
    },
    [detachAllRemoteAudio]
  );

  const connectLivekitRoom = useCallback(async () => {
    if (!sessionId || sessionKind !== "CLASS" || !userId) return;
    if (livekitConnectInFlightRef.current) {
      await livekitConnectInFlightRef.current;
      return;
    }
    const task = (async () => {
      const runtime = await ensureLivekitRuntime();
      const tokenConfig = await getWorkbookLivekitToken(sessionId);
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
        await disconnectLivekitRoom({ forceStopTracks: false });
      }

      const room = new runtime.Room({
        adaptiveStream: true,
        dynacast: true,
      });
      room.on(runtime.RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(runtime.RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.on(runtime.RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        detachRemoteAudio(participant.identity || participant.sid || "");
      });
      room.on(runtime.RoomEvent.Disconnected, () => {
        detachAllRemoteAudio();
      });
      room.on(runtime.RoomEvent.ConnectionStateChanged, (state: unknown) => {
        setIsLivekitConnected(state === runtime.ConnectionState.Connected);
      });
      await room.connect(tokenConfig.wsUrl, tokenConfig.token, {
        autoSubscribe: true,
      });
      livekitRoomRef.current = room;
      livekitRoomSessionIdRef.current = sessionId;
      setIsLivekitConnected(true);
    })();
    livekitConnectInFlightRef.current = task;
    try {
      await task;
      setError((current) => {
        if (!current) return current;
        if (
          current.includes("микрофон") ||
          current.includes("Микрофон") ||
          current.includes("LiveKit")
        ) {
          return null;
        }
        return current;
      });
    } catch (reason) {
      if (reason instanceof Error && reason.message === "media_secure_context_required") {
        setError(
          "Микрофон доступен только в защищённом режиме: откройте сайт по HTTPS (или localhost)."
        );
      } else if (reason instanceof ApiError && reason.status === 503) {
        setError("LiveKit не настроен на сервере. Проверьте MEDIA_LIVEKIT_* переменные.");
      } else {
        setError("Не удалось подключить аудио-комнату LiveKit.");
      }
      await disconnectLivekitRoom({ forceStopTracks: false });
    } finally {
      livekitConnectInFlightRef.current = null;
    }
  }, [
    detachAllRemoteAudio,
    detachRemoteAudio,
    disconnectLivekitRoom,
    ensureLivekitRuntime,
    handleTrackSubscribed,
    handleTrackUnsubscribed,
    sessionId,
    sessionKind,
    setError,
    userId,
  ]);

  const syncLivekitMicState = useCallback(async () => {
    const runtime = livekitRuntimeRef.current;
    const room = livekitRoomRef.current;
    if (!runtime || !room || room.state !== runtime.ConnectionState.Connected) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(micEnabled);
      if (micEnabled) {
        setError((current) => {
          if (!current) return current;
          return current.includes("микрофон") || current.includes("Микрофон")
            ? null
            : current;
        });
      }
    } catch (reason) {
      handleMicrophoneError(reason);
      setMicEnabled(false);
    }
  }, [handleMicrophoneError, micEnabled, setError]);

  useEffect(() => {
    if (!sessionId || sessionKind !== "CLASS" || !canUseMedia || isEnded || !userId) {
      void disconnectLivekitRoom({
        forceStopTracks: isEnded || sessionKind !== "CLASS" || !canUseMedia,
      });
      return;
    }
    void connectLivekitRoom();
  }, [
    canUseMedia,
    connectLivekitRoom,
    disconnectLivekitRoom,
    isEnded,
    sessionId,
    sessionKind,
    userId,
  ]);

  useEffect(() => {
    if (sessionKind !== "CLASS" || !canUseMedia || isEnded || !isLivekitConnected) {
      return;
    }
    void syncLivekitMicState();
  }, [canUseMedia, isEnded, isLivekitConnected, micEnabled, sessionKind, syncLivekitMicState]);

  useEffect(() => {
    if (canUseMedia || !micEnabled) return;
    setMicEnabled(false);
  }, [canUseMedia, micEnabled]);

  useEffect(
    () => () => {
      void disconnectLivekitRoom({ forceStopTracks: true });
    },
    [disconnectLivekitRoom]
  );

  useEffect(() => {
    if (sessionKind !== "CLASS" || !canUseMedia || isEnded) return;
    const resumeRemoteAudio = () => {
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
  }, [canUseMedia, isEnded, sessionKind]);

  return {
    isLivekitConnected,
    micEnabled,
    setMicEnabled,
  };
};
