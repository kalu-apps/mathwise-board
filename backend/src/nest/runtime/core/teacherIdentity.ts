export const TEACHER_USER_ID = "teacher-axiom";
export const TEACHER_CANONICAL_EMAIL = "teacher@axiom.demo";

const normalizeTeacherEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const WHITEBOARD_TEACHER_EMAIL = (() => {
  const fromEnv = normalizeTeacherEmail(process.env.WHITEBOARD_TEACHER_EMAIL);
  return fromEnv.length > 0 ? fromEnv : TEACHER_CANONICAL_EMAIL;
})();

export const WHITEBOARD_TEACHER_EMAIL_ALIASES = new Set<string>([
  TEACHER_CANONICAL_EMAIL,
  WHITEBOARD_TEACHER_EMAIL,
]);

export const isTeacherEmail = (value: unknown) =>
  WHITEBOARD_TEACHER_EMAIL_ALIASES.has(normalizeTeacherEmail(value));
