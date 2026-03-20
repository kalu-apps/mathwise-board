export const AUTH_STORAGE_KEY = "math-tutor-auth";
export const AUTH_GUEST_SESSION_KEY = "math-tutor-auth:guest-session";
export const AUTH_STORAGE_TTL_MS = 12 * 60 * 60 * 1000;
export const AUTH_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const AUTH_IDLE_ACTIVITY_KEY = "math-tutor-auth:last-activity";
export const AUTH_IDLE_ACTIVITY_THROTTLE_MS = 15 * 1000;
export const AUTH_LOGOUT_BROADCAST_CHANNEL = "math-tutor-auth:channel";
export const AUTH_LOGOUT_SIGNAL_STORAGE_KEY = "math-tutor-auth:logout-signal";
export const AUTH_LOGOUT_SIGNAL_TTL_MS = 60 * 1000;

export const TEACHER_CANONICAL_EMAIL = "teacher@axiom.demo";

export const TEACHER_EMAILS = [
  TEACHER_CANONICAL_EMAIL,
];

export const TEACHER_LOGIN_HINT_EMAIL =
  import.meta.env.VITE_WHITEBOARD_TEACHER_EMAIL_HINT?.trim().toLowerCase() || "";
