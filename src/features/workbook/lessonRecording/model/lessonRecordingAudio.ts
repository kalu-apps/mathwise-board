import type { LessonRecordingAudioSummary } from "./lessonRecordingTypes";

type LessonRecordingMixedAudio = {
  track: MediaStreamTrack;
  summary: LessonRecordingAudioSummary;
  cleanup: () => void;
  setMicrophoneEnabled?: (enabled: boolean) => void;
};

const resolveAudioContextCtor = () => {
  if (typeof window === "undefined") return null;
  const WindowWithWebkitAudioContext = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext ?? WindowWithWebkitAudioContext.webkitAudioContext ?? null;
};

export const mixLessonRecordingAudio = async (params: {
  displayStream: MediaStream;
  microphoneStream: MediaStream | null;
  microphoneEnabled?: boolean;
}): Promise<LessonRecordingMixedAudio | null> => {
  const { displayStream, microphoneStream, microphoneEnabled = true } = params;
  const displayAudioTrack = displayStream.getAudioTracks()[0] ?? null;
  const micAudioTrack = microphoneStream?.getAudioTracks()[0] ?? null;
  const summary: LessonRecordingAudioSummary = {
    hasDisplayAudio: Boolean(displayAudioTrack),
    hasMicrophoneAudio: Boolean(micAudioTrack),
  };

  if (!displayAudioTrack && !micAudioTrack) {
    return null;
  }

  const AudioContextCtor = resolveAudioContextCtor();
  if (!AudioContextCtor) {
    const fallbackTrack = (displayAudioTrack ?? micAudioTrack)?.clone() ?? null;
    if (!fallbackTrack) return null;
    fallbackTrack.enabled = displayAudioTrack ? true : microphoneEnabled;
    return {
      track: fallbackTrack,
      summary,
      cleanup: () => {
        try {
          fallbackTrack.stop();
        } catch {
          // ignore cleanup failures
        }
      },
      setMicrophoneEnabled: displayAudioTrack
        ? undefined
        : (enabled: boolean) => {
            fallbackTrack.enabled = enabled;
          },
    };
  }

  const audioContext = new AudioContextCtor();
  const destination = audioContext.createMediaStreamDestination();
  const cleanupSteps: Array<() => void> = [];

  let micGainNode: GainNode | null = null;

  const attachTrack = (track: MediaStreamTrack, options?: { isMicrophone?: boolean }) => {
    const { isMicrophone = false } = options ?? {};
    const sourceStream = new MediaStream([track.clone()]);
    const sourceNode = audioContext.createMediaStreamSource(sourceStream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = isMicrophone ? (microphoneEnabled ? 1 : 0) : 1;
    sourceNode.connect(gainNode);
    gainNode.connect(destination);
    if (isMicrophone) {
      micGainNode = gainNode;
    }
    cleanupSteps.push(() => {
      try {
        sourceNode.disconnect();
      } catch {
        // ignore cleanup failures
      }
      try {
        gainNode.disconnect();
      } catch {
        // ignore cleanup failures
      }
      sourceStream.getTracks().forEach((sourceTrack) => {
        try {
          sourceTrack.stop();
        } catch {
          // ignore cleanup failures
        }
      });
    });
  };

  if (displayAudioTrack) attachTrack(displayAudioTrack);
  if (micAudioTrack) attachTrack(micAudioTrack, { isMicrophone: true });

  try {
    await audioContext.resume();
  } catch {
    // resume can fail in strict autoplay policies; recording still may proceed.
  }

  const mixedTrack = destination.stream.getAudioTracks()[0] ?? null;
  if (!mixedTrack) {
    cleanupSteps.forEach((step) => step());
    void audioContext.close().catch(() => undefined);
    return null;
  }

  return {
    track: mixedTrack,
    summary,
    setMicrophoneEnabled: micGainNode
      ? (enabled: boolean) => {
          if (!micGainNode) return;
          micGainNode.gain.value = enabled ? 1 : 0;
        }
      : undefined,
    cleanup: () => {
      try {
        mixedTrack.stop();
      } catch {
        // ignore cleanup failures
      }
      cleanupSteps.forEach((step) => step());
      void audioContext.close().catch(() => undefined);
    },
  };
};
