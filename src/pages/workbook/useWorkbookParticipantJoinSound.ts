import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/shared/lib/localDb";
import type { WorkbookSessionParticipant } from "@/features/workbook/model/types";

const DEFAULT_ENABLED = true;
const GLOBAL_PLAY_COOLDOWN_MS = 320;
const USER_PLAY_COOLDOWN_MS = 12_000;
const BOOTSTRAP_SUPPRESS_MS = 1_600;
const RECONNECT_SUPPRESS_MS = 1_800;

type PersistedParticipantJoinSoundState = {
  enabled: boolean;
};

type UseWorkbookParticipantJoinSoundParams = {
  storageKey: string;
  participants: WorkbookSessionParticipant[] | null | undefined;
  bootstrapReady: boolean;
  effectiveActorUserId?: string;
  isSessionTabPassive?: boolean;
  isRealtimeConnected?: boolean;
};

type AudioContextCtor = typeof AudioContext;

const resolveAudioContextCtor = (): AudioContextCtor | null => {
  if (typeof window === "undefined") return null;
  const windowWithWebkit = window as Window & {
    webkitAudioContext?: AudioContextCtor;
  };
  return window.AudioContext ?? windowWithWebkit.webkitAudioContext ?? null;
};

const collectOnlineParticipantIds = (
  participants: WorkbookSessionParticipant[] | null | undefined
) => {
  const ids = new Set<string>();
  (participants ?? []).forEach((participant) => {
    if (!participant?.isOnline) return;
    const userId = String(participant.userId ?? "").trim();
    if (!userId) return;
    ids.add(userId);
  });
  return ids;
};

export function useWorkbookParticipantJoinSound({
  storageKey,
  participants,
  bootstrapReady,
  effectiveActorUserId,
  isSessionTabPassive = false,
  isRealtimeConnected = false,
}: UseWorkbookParticipantJoinSoundParams) {
  const [fallbackEnabled, setFallbackEnabled] = useState(DEFAULT_ENABLED);
  const [enabledByScope, setEnabledByScope] = useState<Record<string, boolean>>({});

  const baselineReadyRef = useRef(false);
  const knownOnlineIdsRef = useRef<Set<string>>(new Set());
  const suppressUntilRef = useRef(0);
  const previousRealtimeConnectedRef = useRef(false);
  const userCooldownMapRef = useRef<Map<string, number>>(new Map());
  const lastGlobalPlayAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const resolvedStoredEnabled = useMemo(() => {
    if (!storageKey) return fallbackEnabled;
    const stored = readStorage<Partial<PersistedParticipantJoinSoundState> | null>(storageKey, null);
    return typeof stored?.enabled === "boolean" ? stored.enabled : DEFAULT_ENABLED;
  }, [fallbackEnabled, storageKey]);

  const enabled =
    storageKey && Object.prototype.hasOwnProperty.call(enabledByScope, storageKey)
      ? Boolean(enabledByScope[storageKey])
      : resolvedStoredEnabled;

  const playJoinSound = useCallback(() => {
    const AudioContextCtor = resolveAudioContextCtor();
    if (!AudioContextCtor) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    const context = audioContextRef.current;
    if (!context) return;

    const emitTone = () => {
      try {
        const startAt = context.currentTime + 0.01;
        const notes = [
          { frequency: 740, offset: 0, duration: 0.17, peakGain: 0.06 },
          { frequency: 980, offset: 0.24, duration: 0.19, peakGain: 0.068 },
        ];

        notes.forEach((note) => {
          const noteStartAt = startAt + note.offset;
          const noteEndAt = noteStartAt + note.duration;

          const oscillator = context.createOscillator();
          const gain = context.createGain();

          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(note.frequency, noteStartAt);

          gain.gain.setValueAtTime(0.0001, noteStartAt);
          gain.gain.exponentialRampToValueAtTime(note.peakGain, noteStartAt + 0.024);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteEndAt);

          oscillator.connect(gain);
          gain.connect(context.destination);

          oscillator.start(noteStartAt);
          oscillator.stop(noteEndAt + 0.01);
        });
      } catch {
        // ignore playback failures
      }
    };

    if (context.state === "suspended") {
      void context.resume().then(emitTone).catch(() => undefined);
      return;
    }
    emitTone();
  }, []);

  useEffect(() => {
    if (!bootstrapReady) {
      baselineReadyRef.current = false;
      knownOnlineIdsRef.current = new Set();
      suppressUntilRef.current = 0;
      return;
    }
    if (baselineReadyRef.current) return;
    knownOnlineIdsRef.current = collectOnlineParticipantIds(participants);
    baselineReadyRef.current = true;
    suppressUntilRef.current = Date.now() + BOOTSTRAP_SUPPRESS_MS;
  }, [bootstrapReady, participants]);

  useEffect(() => {
    if (!bootstrapReady) {
      previousRealtimeConnectedRef.current = isRealtimeConnected;
      return;
    }
    const wasConnected = previousRealtimeConnectedRef.current;
    if (!wasConnected && isRealtimeConnected) {
      suppressUntilRef.current = Math.max(
        suppressUntilRef.current,
        Date.now() + RECONNECT_SUPPRESS_MS
      );
    }
    previousRealtimeConnectedRef.current = isRealtimeConnected;
  }, [bootstrapReady, isRealtimeConnected]);

  useEffect(() => {
    if (!bootstrapReady || !baselineReadyRef.current) return;
    const nextOnlineIds = collectOnlineParticipantIds(participants);
    const previousOnlineIds = knownOnlineIdsRef.current;
    const joinedIds: string[] = [];

    nextOnlineIds.forEach((participantId) => {
      if (!previousOnlineIds.has(participantId)) {
        joinedIds.push(participantId);
      }
    });

    knownOnlineIdsRef.current = nextOnlineIds;
    if (joinedIds.length === 0) return;
    if (!enabled) return;
    if (isSessionTabPassive) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const now = Date.now();
    if (now < suppressUntilRef.current) return;

    const selfUserId = String(effectiveActorUserId ?? "").trim();
    const shouldPlayForIds = joinedIds.filter((participantId) => {
      if (!participantId || participantId === selfUserId) return false;
      const lastPlayedAt = userCooldownMapRef.current.get(participantId) ?? 0;
      if (now - lastPlayedAt < USER_PLAY_COOLDOWN_MS) return false;
      return true;
    });

    if (shouldPlayForIds.length === 0) return;
    shouldPlayForIds.forEach((participantId) => {
      userCooldownMapRef.current.set(participantId, now);
    });
    if (now - lastGlobalPlayAtRef.current < GLOBAL_PLAY_COOLDOWN_MS) return;

    lastGlobalPlayAtRef.current = now;
    playJoinSound();
  }, [
    bootstrapReady,
    effectiveActorUserId,
    enabled,
    isSessionTabPassive,
    participants,
    playJoinSound,
  ]);

  useEffect(() => {
    return () => {
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (!context) return;
      void context.close().catch(() => undefined);
    };
  }, []);

  const toggleEnabled = useCallback(() => {
    if (!storageKey) {
      setFallbackEnabled((current) => !current);
      return;
    }
    const nextEnabled = !enabled;
    setEnabledByScope((current) => {
      if (current[storageKey] === nextEnabled) return current;
      return {
        ...current,
        [storageKey]: nextEnabled,
      };
    });
    writeStorage<PersistedParticipantJoinSoundState>(storageKey, {
      enabled: nextEnabled,
    });
  }, [enabled, storageKey]);

  return {
    participantJoinSoundEnabled: enabled,
    toggleParticipantJoinSound: toggleEnabled,
  };
}
