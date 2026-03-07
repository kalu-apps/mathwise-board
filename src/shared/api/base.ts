const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeApiRoot = (raw: string | undefined) => {
  const value = String(raw ?? "").trim();
  if (!value) return "/api";
  const normalized = trimTrailingSlash(value);
  if (normalized.endsWith("/api")) return normalized;
  return `${normalized}/api`;
};

const ENV_API_ROOT = normalizeApiRoot(import.meta.env.VITE_API_BASE_URL);

export const API_ROOT = ENV_API_ROOT;

const ensurePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const buildApiUrl = (path: string) => `${API_ROOT}${ensurePath(path)}`;

