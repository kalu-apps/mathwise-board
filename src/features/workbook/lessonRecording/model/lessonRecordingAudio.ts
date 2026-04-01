import type { LessonRecordingAudioSummary } from "./lessonRecordingTypes";

type LessonRecordingMixedAudio = {
  track: MediaStreamTrack;
  summary: LessonRecordingAudioSummary;
  cleanup: () => void;
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
}): Promise<LessonRecordingMixedAudio | null> => {
  const { displayStream, microphoneStream } = params;
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
    };
  }

  const audioContext = new AudioContextCtor();
  const destination = audioContext.createMediaStreamDestination();
  const cleanupSteps: Array<() => void> = [];

  const attachTrack = (track: MediaStreamTrack, gainValue: number) => {
    const sourceStream = new MediaStream([track.clone()]);
    const sourceNode = audioContext.createMediaStreamSource(sourceStream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = gainValue;
    sourceNode.connect(gainNode);
    gainNode.connect(destination);
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

  if (displayAudioTrack) attachTrack(displayAudioTrack, 1);
  if (micAudioTrack) attachTrack(micAudioTrack, 1);

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
