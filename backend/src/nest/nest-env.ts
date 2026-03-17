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

const readFloat = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const readProxyMode = (value: string | undefined): "write" | "all" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "all") return "all";
  return "write";
};

export const nestEnv = {
  host: String(process.env.NEST_HOST ?? "0.0.0.0").trim() || "0.0.0.0",
  port: readPositiveInt(process.env.NEST_PORT, 4180, 65_535),
  featureEnabled: readBool(process.env.FF_NEST_API, false),
  featureShadowEnabled: readBool(process.env.FF_NEST_API_SHADOW, false),
  proxyMode: readProxyMode(process.env.NEST_PROXY_MODE),
  legacyBaseUrl: String(process.env.NEST_LEGACY_BASE_URL ?? "http://127.0.0.1:4173")
    .trim()
    .replace(/\/+$/, ""),
  apiBaseUrl: String(process.env.NEST_API_BASE_URL ?? "http://127.0.0.1:4180")
    .trim()
    .replace(/\/+$/, ""),
  requestTimeoutMs: readPositiveInt(process.env.NEST_PROXY_TIMEOUT_MS, 3_000, 30_000),
  writeProxyTimeoutMs: readPositiveInt(process.env.NEST_WRITE_PROXY_TIMEOUT_MS, 8_000, 60_000),
  objectVersionStrict: readBool(process.env.NEST_OBJECT_VERSION_STRICT, false),
  idempotencyTtlMs: readPositiveInt(process.env.NEST_IDEMPOTENCY_TTL_MS, 300_000, 86_400_000),
  idempotencyMaxRecords: readPositiveInt(process.env.NEST_IDEMPOTENCY_MAX_RECORDS, 20_000, 200_000),
  idempotencyBodyFallback: readBool(process.env.NEST_IDEMPOTENCY_BODY_FALLBACK, true),
  idempotencySampleRate: readFloat(process.env.NEST_IDEMPOTENCY_SAMPLE_RATE, 1, 0.01, 1),
};

export const shadowRequestHeader = "x-shadow-probe";
