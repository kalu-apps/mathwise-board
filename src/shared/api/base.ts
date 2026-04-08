const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeApiRoot = (raw: string | undefined) => {
  const value = String(raw ?? "").trim();
  if (!value) return "/api";
  const normalized = trimTrailingSlash(value);
  if (normalized.endsWith("/api")) return normalized;
  return `${normalized}/api`;
};

const importMetaEnv =
  ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {}) as Record<
    string,
    unknown
  >;

const ENV_API_ROOT = normalizeApiRoot(
  typeof importMetaEnv.VITE_API_BASE_URL === "string"
    ? (importMetaEnv.VITE_API_BASE_URL as string)
    : undefined
);
const FORCE_CROSS_ORIGIN_API =
  String(importMetaEnv.VITE_FORCE_CROSS_ORIGIN_API ?? "").trim() === "1";
const IS_PROD_BUILD = importMetaEnv.PROD === true;

const resolveApiRoot = () => {
  if (!ENV_API_ROOT) return "/api";
  if (typeof window === "undefined") return ENV_API_ROOT;

  // In production prefer same-origin API to avoid CORS/realtime failures when
  // a dedicated api subdomain is temporarily misconfigured or unavailable.
  if (!IS_PROD_BUILD || FORCE_CROSS_ORIGIN_API) {
    return ENV_API_ROOT;
  }

  try {
    const resolved = new URL(ENV_API_ROOT, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return "/api";
    }
  } catch {
    return "/api";
  }

  return ENV_API_ROOT;
};

export const API_ROOT = resolveApiRoot();

const ensurePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const buildApiUrl = (path: string) => `${API_ROOT}${ensurePath(path)}`;
