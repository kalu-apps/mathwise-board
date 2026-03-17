import type { IncomingMessage, ServerResponse } from "node:http";

type ShadowParityEntry = {
  at: string;
  method: string;
  path: string;
  legacyStatus: number;
  nestStatus: number | null;
  success: boolean;
  durationMs: number;
  mismatchReason: string | null;
};

type ShadowParityStats = {
  enabled: boolean;
  nestBaseUrl: string;
  timeoutMs: number;
  sampleRate: number;
  totalCompared: number;
  matched: number;
  mismatched: number;
  errors: number;
  recent: ShadowParityEntry[];
};

const READ_PATH_SKIP_PATTERNS = [
  /^\/api\/workbook\/sessions\/[^/]+\/events\/stream$/,
  /^\/api\/nest\/shadow\/parity$/,
];
const BUFFER_LIMIT = 200;

const readBool = (value: string | undefined) => {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const readPositiveInt = (value: string | undefined, fallback: number, cap: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(cap, parsed);
};

const readSampleRate = (value: string | undefined) => {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(1, Math.max(0.01, parsed));
};

const config = {
  enabled: readBool(process.env.FF_NEST_API_SHADOW),
  nestBaseUrl: String(process.env.NEST_API_BASE_URL ?? "http://127.0.0.1:4180")
    .trim()
    .replace(/\/+$/, ""),
  timeoutMs: readPositiveInt(process.env.NEST_SHADOW_TIMEOUT_MS, 1_500, 10_000),
  sampleRate: readSampleRate(process.env.NEST_SHADOW_SAMPLE_RATE),
};

const state: ShadowParityStats = {
  enabled: config.enabled,
  nestBaseUrl: config.nestBaseUrl,
  timeoutMs: config.timeoutMs,
  sampleRate: config.sampleRate,
  totalCompared: 0,
  matched: 0,
  mismatched: 0,
  errors: 0,
  recent: [],
};

const pushEntry = (entry: ShadowParityEntry) => {
  state.recent.push(entry);
  if (state.recent.length > BUFFER_LIMIT) {
    state.recent.splice(0, state.recent.length - BUFFER_LIMIT);
  }
};

const normalizeJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = normalizeJson(record[key]);
    return acc;
  }, {});
};

const normalizePayload = (payload: string, contentType: string) => {
  if (!contentType.toLowerCase().includes("application/json")) {
    return payload;
  }
  if (!payload) return null;
  try {
    return normalizeJson(JSON.parse(payload));
  } catch {
    return payload;
  }
};

const toBuffer = (chunk: unknown, encoding?: BufferEncoding) => {
  if (chunk == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === "string") return Buffer.from(chunk, encoding ?? "utf8");
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(String(chunk));
};

const shouldCompare = (req: IncomingMessage) => {
  if (!config.enabled) return false;
  if (Math.random() > config.sampleRate) return false;
  const method = String(req.method ?? "").toUpperCase();
  if (method !== "GET") return false;
  const requestUrl = req.url ?? "";
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  if (!pathname.startsWith("/api/")) return false;
  if (READ_PATH_SKIP_PATTERNS.some((pattern) => pattern.test(pathname))) return false;
  if (req.headers["x-shadow-probe"] === "1") return false;
  return true;
};

const buildTargetUrl = (requestUrl: string) =>
  `${config.nestBaseUrl}${requestUrl.startsWith("/") ? requestUrl : `/${requestUrl}`}`;

const runShadowCompare = async (params: {
  req: IncomingMessage;
  legacyStatus: number;
  legacyBody: string;
  legacyContentType: string;
  startedAt: number;
}) => {
  const { req, legacyStatus, legacyBody, legacyContentType, startedAt } = params;
  const requestUrl = req.url ?? "/";
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  const headers = new Headers();
  const cookie = req.headers.cookie;
  if (typeof cookie === "string" && cookie.length > 0) {
    headers.set("cookie", cookie);
  }
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.length > 0) {
    headers.set("authorization", auth);
  }
  headers.set("x-shadow-probe", "1");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(buildTargetUrl(requestUrl), {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const nestStatus = response.status;
    const nestContentType = response.headers.get("content-type") ?? "application/json; charset=utf-8";
    const nestBody = await response.text();
    const legacyNormalized = normalizePayload(legacyBody, legacyContentType);
    const nestNormalized = normalizePayload(nestBody, nestContentType);
    const matched =
      legacyStatus === nestStatus &&
      JSON.stringify(legacyNormalized) === JSON.stringify(nestNormalized);

    state.totalCompared += 1;
    if (matched) {
      state.matched += 1;
    } else {
      state.mismatched += 1;
    }
    const mismatchReason =
      legacyStatus !== nestStatus
        ? "status_mismatch"
        : matched
          ? null
          : "payload_mismatch";
    pushEntry({
      at: new Date().toISOString(),
      method: "GET",
      path: pathname,
      legacyStatus,
      nestStatus,
      success: matched,
      durationMs: Math.max(0, Date.now() - startedAt),
      mismatchReason,
    });
    if (!matched) {
      console.warn("[nest-shadow-parity:mismatch]", {
        path: pathname,
        legacyStatus,
        nestStatus,
        mismatchReason,
      });
    }
  } catch (error) {
    state.totalCompared += 1;
    state.errors += 1;
    pushEntry({
      at: new Date().toISOString(),
      method: "GET",
      path: pathname,
      legacyStatus,
      nestStatus: null,
      success: false,
      durationMs: Math.max(0, Date.now() - startedAt),
      mismatchReason: error instanceof Error ? error.message : "shadow_compare_failed",
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const createNestShadowParityMiddleware = () => {
  if (!config.enabled) {
    return (_req: IncomingMessage, _res: ServerResponse, next: () => void) => next();
  }
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!shouldCompare(req)) {
      next();
      return;
    }
    const startedAt = Date.now();
    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = ((chunk: unknown, encoding?: BufferEncoding, cb?: () => void) => {
      chunks.push(toBuffer(chunk, encoding));
      return originalWrite(chunk as never, encoding as never, cb as never);
    }) as ServerResponse["write"];

    res.end = ((chunk?: unknown, encoding?: BufferEncoding, cb?: () => void) => {
      if (chunk != null) {
        chunks.push(toBuffer(chunk, encoding));
      }
      return originalEnd(chunk as never, encoding as never, cb as never);
    }) as ServerResponse["end"];

    res.once("finish", () => {
      const legacyBody = Buffer.concat(chunks).toString("utf8");
      const legacyContentType = String(res.getHeader("content-type") ?? "application/json; charset=utf-8");
      void runShadowCompare({
        req,
        legacyStatus: res.statusCode,
        legacyBody,
        legacyContentType,
        startedAt,
      });
    });

    next();
  };
};

export const getNestShadowParityDiagnostics = () => ({
  ...state,
  mismatchRate: state.totalCompared > 0 ? Number((state.mismatched / state.totalCompared).toFixed(4)) : 0,
  errorRate: state.totalCompared > 0 ? Number((state.errors / state.totalCompared).toFixed(4)) : 0,
});
