const sanitizeForFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const buildLessonRecordingFileName = (params: {
  sessionTitle?: string | null;
  extension: "webm" | "mp4";
}) => {
  const { sessionTitle, extension } = params;
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const safeSessionTitle = sanitizeForFileName(String(sessionTitle ?? ""));
  const titlePart = safeSessionTitle.length > 0 ? safeSessionTitle : "lesson";
  return `mathwise-${titlePart}-${year}-${month}-${day}-${hours}${minutes}.${extension}`;
};

export const triggerLessonRecordingDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
};
