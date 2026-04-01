export type LessonRecordingStatus =
  | "idle"
  | "starting"
  | "recording"
  | "paused"
  | "stopping";

export type LessonRecordingNoticeTone = "success" | "warning" | "error" | "info";

export type LessonRecordingNotice = {
  tone: LessonRecordingNoticeTone;
  message: string;
};

export type LessonRecordingAudioSummary = {
  hasDisplayAudio: boolean;
  hasMicrophoneAudio: boolean;
};

export type LessonRecordingProfile = {
  mimeType: string;
  extension: "webm" | "mp4";
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
};
