import type { LessonRecordingProfile } from "./lessonRecordingTypes";

const PROFILE_CANDIDATES: LessonRecordingProfile[] = [
  {
    mimeType: "video/mp4;codecs=avc1.640028,mp4a.40.2",
    extension: "mp4",
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 128_000,
  },
  {
    mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    extension: "mp4",
    videoBitsPerSecond: 4_500_000,
    audioBitsPerSecond: 128_000,
  },
  {
    mimeType: "video/mp4",
    extension: "mp4",
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 112_000,
  },
  {
    mimeType: "video/webm;codecs=vp9,opus",
    extension: "webm",
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 128_000,
  },
  {
    mimeType: "video/webm;codecs=vp8,opus",
    extension: "webm",
    videoBitsPerSecond: 4_500_000,
    audioBitsPerSecond: 128_000,
  },
  {
    mimeType: "video/webm",
    extension: "webm",
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 112_000,
  },
];

const inferResolutionTier = (track: MediaStreamTrack | null): "ultra" | "high" | "mid" | "base" => {
  if (!track) return "base";
  const settings =
    typeof track.getSettings === "function"
      ? track.getSettings()
      : ({} as MediaTrackSettings);
  const width = Number(settings.width ?? 0);
  const height = Number(settings.height ?? 0);
  const pixels = width * height;
  if (pixels >= 3840 * 2160) return "ultra";
  if (pixels >= 2560 * 1440) return "high";
  if (pixels >= 1920 * 1080) return "mid";
  return "base";
};

const resolveTierMultiplier = (tier: "ultra" | "high" | "mid" | "base") => {
  if (tier === "ultra") return 1;
  if (tier === "high") return 1;
  if (tier === "mid") return 1;
  return 0.82;
};

export const resolveLessonRecordingProfile = (
  videoTrack: MediaStreamTrack | null
): LessonRecordingProfile => {
  const mediaRecorderSupported =
    typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function";
  const baseProfile =
    PROFILE_CANDIDATES.find((candidate) =>
      mediaRecorderSupported ? MediaRecorder.isTypeSupported(candidate.mimeType) : false
    ) ?? PROFILE_CANDIDATES[PROFILE_CANDIDATES.length - 1];
  const tier = inferResolutionTier(videoTrack);
  const multiplier = resolveTierMultiplier(tier);
  return {
    ...baseProfile,
    videoBitsPerSecond: Math.round(baseProfile.videoBitsPerSecond * multiplier),
  };
};
