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

const parseCsv = (value: string | undefined) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const nodeEnv = String(process.env.NODE_ENV ?? "development")
  .trim()
  .toLowerCase();
const isProduction = nodeEnv === "production";

export const nestEnv = {
  nodeEnv,
  isProduction,
  host:
    String(process.env.NEST_HOST ?? process.env.HOST ?? "0.0.0.0").trim() ||
    "0.0.0.0",
  port: readPositiveInt(process.env.NEST_PORT ?? process.env.PORT, 4173, 65_535),
  bodyLimitMb: readPositiveInt(process.env.NEST_BODY_LIMIT_MB, 48, 128),
  corsAllowedOrigins: parseCsv(process.env.CORS_ALLOWED_ORIGINS),
  objectVersionStrict: readBool(process.env.NEST_OBJECT_VERSION_STRICT, false),
  idempotencyTtlMs: readPositiveInt(process.env.NEST_IDEMPOTENCY_TTL_MS, 300_000, 86_400_000),
  idempotencyMaxRecords: readPositiveInt(process.env.NEST_IDEMPOTENCY_MAX_RECORDS, 20_000, 200_000),
  idempotencyBodyFallback: readBool(process.env.NEST_IDEMPOTENCY_BODY_FALLBACK, true),
  idempotencySampleRate: readFloat(process.env.NEST_IDEMPOTENCY_SAMPLE_RATE, 1, 0.01, 1),
};
