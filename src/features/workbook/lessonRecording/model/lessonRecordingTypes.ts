export type LessonRecordingStatus =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "processing";

export type LessonRecordingNoticeTone = "success" | "warning" | "error" | "info";

export type LessonRecordingNotice = {
  tone: LessonRecordingNoticeTone;
  message: string;
};
