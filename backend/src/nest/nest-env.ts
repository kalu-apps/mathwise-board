const readBool = (value: string | undefined, fallback = false) => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const readPositiveInt = (value: string | undefined, fallback: number, cap: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(cap, parsed);
};

export const nestEnv = {
  host: String(process.env.NEST_HOST ?? "0.0.0.0").trim() || "0.0.0.0",
  port: readPositiveInt(process.env.NEST_PORT, 4180, 65_535),
  featureEnabled: readBool(process.env.FF_NEST_API, false),
  legacyBaseUrl: String(process.env.NEST_LEGACY_BASE_URL ?? "http://127.0.0.1:4173")
    .trim()
    .replace(/\/+$/, ""),
  requestTimeoutMs: readPositiveInt(process.env.NEST_PROXY_TIMEOUT_MS, 3_000, 30_000),
};

export const shadowRequestHeader = "x-shadow-probe";
