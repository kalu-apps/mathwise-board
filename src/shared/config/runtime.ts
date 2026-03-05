const normalizeFlag = (value: unknown) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

export const isWhiteboardOnlyMode = normalizeFlag(
  import.meta.env.VITE_WHITEBOARD_ONLY
);

export const whiteboardOnlyRuntime = {
  enabled: isWhiteboardOnlyMode,
  teacherLogin:
    typeof import.meta.env.VITE_WHITEBOARD_TEACHER_LOGIN === "string"
      ? import.meta.env.VITE_WHITEBOARD_TEACHER_LOGIN.trim().toLowerCase()
      : "",
  studentLogin:
    typeof import.meta.env.VITE_WHITEBOARD_STUDENT_LOGIN === "string"
      ? import.meta.env.VITE_WHITEBOARD_STUDENT_LOGIN.trim().toLowerCase()
      : "",
};

