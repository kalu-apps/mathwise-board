import crypto from "node:crypto";
import os from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";

const readBool = (value: string | undefined, fallback: boolean) => {
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

const normalizeSameSite = (value: string | undefined): "Lax" | "Strict" | "None" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";
  return "Lax";
};

const parseCookieValue = (req: IncomingMessage, cookieName: string) => {
  const raw = req.headers.cookie;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const pairs = raw.split(";");
  for (const pair of pairs) {
    const [nameRaw, ...valueRaw] = pair.trim().split("=");
    if (nameRaw !== cookieName) continue;
    try {
      return decodeURIComponent(valueRaw.join("=") ?? "");
    } catch {
      return valueRaw.join("=") ?? null;
    }
  }
  return null;
};

const appendSetCookieDirective = (res: ServerResponse, cookie: string) => {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookie]);
    return;
  }
  res.setHeader("Set-Cookie", [String(existing), cookie]);
};

const SESSION_AFFINITY_BUCKETS = readPositiveInt(
  process.env.WORKBOOK_SESSION_AFFINITY_BUCKETS,
  128,
  8_192
);
const SESSION_AFFINITY_SALT = String(
  process.env.WORKBOOK_SESSION_AFFINITY_SALT ?? process.env.WORKBOOK_ACCESS_LOG_HASH_SALT ?? "mathwise"
).trim();
const SESSION_AFFINITY_COOKIE_ENABLED = readBool(
  process.env.WORKBOOK_SESSION_AFFINITY_COOKIE_ENABLED,
  true
);
const SESSION_AFFINITY_COOKIE_NAME =
  String(process.env.WORKBOOK_SESSION_AFFINITY_COOKIE_NAME ?? "mw_session_affinity").trim() ||
  "mw_session_affinity";
const SESSION_AFFINITY_COOKIE_TTL_SECONDS = readPositiveInt(
  process.env.WORKBOOK_SESSION_AFFINITY_COOKIE_TTL_SECONDS,
  8 * 60 * 60,
  30 * 24 * 60 * 60
);
const SESSION_AFFINITY_COOKIE_SAME_SITE = normalizeSameSite(
  process.env.WORKBOOK_SESSION_AFFINITY_COOKIE_SAME_SITE
);
const SESSION_AFFINITY_COOKIE_SECURE =
  SESSION_AFFINITY_COOKIE_SAME_SITE === "None"
    ? true
    : readBool(process.env.WORKBOOK_SESSION_AFFINITY_COOKIE_SECURE, true);
const SESSION_AFFINITY_COOKIE_HTTP_ONLY = readBool(
  process.env.WORKBOOK_SESSION_AFFINITY_COOKIE_HTTP_ONLY,
  false
);
const SESSION_AFFINITY_COOKIE_DOMAIN = String(process.env.WORKBOOK_SESSION_AFFINITY_COOKIE_DOMAIN ?? "")
  .trim();
const SESSION_AFFINITY_NODE_ID =
  String(process.env.WORKBOOK_SESSION_AFFINITY_NODE_ID ?? "").trim() ||
  `${os.hostname()}-${process.pid}`;

const SESSION_AFFINITY_HEADER = "x-workbook-session-affinity";
const SESSION_AFFINITY_BUCKET_HEADER = "x-workbook-session-affinity-bucket";
const SESSION_AFFINITY_NODE_HEADER = "x-workbook-runtime-node";

type SessionAffinityStats = {
  taggedResponses: number;
  cookieWrites: number;
  cookieNoop: number;
  lastSessionId: string | null;
  lastBucket: number | null;
  lastAppliedAt: string | null;
};

const stats: SessionAffinityStats = {
  taggedResponses: 0,
  cookieWrites: 0,
  cookieNoop: 0,
  lastSessionId: null,
  lastBucket: null,
  lastAppliedAt: null,
};

const readIncomingAffinityHeader = (req: IncomingMessage) => {
  const raw = req.headers[SESSION_AFFINITY_HEADER];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
  return "";
};

const hashSessionAffinity = (sessionId: string) =>
  crypto
    .createHash("sha1")
    .update(`${SESSION_AFFINITY_SALT}:${sessionId}`)
    .digest("hex");

const toBucket = (digestHex: string) => {
  const normalized = digestHex.slice(0, 8);
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed % SESSION_AFFINITY_BUCKETS);
};

const toHeaderValue = (bucket: number) => `b${bucket}`;

export type WorkbookSessionAffinity = {
  sessionId: string;
  bucket: number;
  key: string;
  headerValue: string;
  nodeId: string;
};

export const resolveWorkbookSessionAffinity = (sessionId: string): WorkbookSessionAffinity => {
  const normalizedSessionId = sessionId.trim();
  const digest = hashSessionAffinity(normalizedSessionId);
  const bucket = toBucket(digest);
  return {
    sessionId: normalizedSessionId,
    bucket,
    key: digest.slice(0, 16),
    headerValue: toHeaderValue(bucket),
    nodeId: SESSION_AFFINITY_NODE_ID,
  };
};

const buildAffinityCookie = (value: string) =>
  [
    `${SESSION_AFFINITY_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${SESSION_AFFINITY_COOKIE_TTL_SECONDS}`,
    `SameSite=${SESSION_AFFINITY_COOKIE_SAME_SITE}`,
    ...(SESSION_AFFINITY_COOKIE_SECURE ? ["Secure"] : []),
    ...(SESSION_AFFINITY_COOKIE_HTTP_ONLY ? ["HttpOnly"] : []),
    ...(SESSION_AFFINITY_COOKIE_DOMAIN ? [`Domain=${SESSION_AFFINITY_COOKIE_DOMAIN}`] : []),
  ].join("; ");

export const applyWorkbookSessionAffinityHeaders = (params: {
  req: IncomingMessage;
  res: ServerResponse;
  sessionId: string;
}) => {
  const affinity = resolveWorkbookSessionAffinity(params.sessionId);
  params.res.setHeader(SESSION_AFFINITY_HEADER, affinity.headerValue);
  params.res.setHeader(SESSION_AFFINITY_BUCKET_HEADER, String(affinity.bucket));
  params.res.setHeader(SESSION_AFFINITY_NODE_HEADER, affinity.nodeId);

  stats.taggedResponses += 1;
  stats.lastSessionId = affinity.sessionId;
  stats.lastBucket = affinity.bucket;
  stats.lastAppliedAt = new Date().toISOString();

  if (!SESSION_AFFINITY_COOKIE_ENABLED) return;
  const incomingCookieValue = parseCookieValue(params.req, SESSION_AFFINITY_COOKIE_NAME);
  const incomingHeaderValue = readIncomingAffinityHeader(params.req);
  if (incomingCookieValue === affinity.headerValue && incomingHeaderValue === affinity.headerValue) {
    stats.cookieNoop += 1;
    return;
  }
  appendSetCookieDirective(params.res, buildAffinityCookie(affinity.headerValue));
  stats.cookieWrites += 1;
};

export const appendSetCookieHeader = (res: ServerResponse, cookie: string) => {
  appendSetCookieDirective(res, cookie);
};

export const extractWorkbookSessionIdFromPath = (pathname: string): string | null => {
  const directMatch = pathname.match(/^\/api\/workbook\/sessions\/([^/]+)/);
  if (!directMatch) return null;
  try {
    const decoded = decodeURIComponent(directMatch[1]);
    const normalized = decoded.trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    const normalized = directMatch[1].trim();
    return normalized.length > 0 ? normalized : null;
  }
};

export const getWorkbookSessionAffinityDiagnostics = () => ({
  enabled: true,
  headers: {
    affinity: SESSION_AFFINITY_HEADER,
    bucket: SESSION_AFFINITY_BUCKET_HEADER,
    node: SESSION_AFFINITY_NODE_HEADER,
  },
  buckets: SESSION_AFFINITY_BUCKETS,
  saltConfigured: SESSION_AFFINITY_SALT.length > 0,
  nodeId: SESSION_AFFINITY_NODE_ID,
  cookie: {
    enabled: SESSION_AFFINITY_COOKIE_ENABLED,
    name: SESSION_AFFINITY_COOKIE_NAME,
    ttlSeconds: SESSION_AFFINITY_COOKIE_TTL_SECONDS,
    sameSite: SESSION_AFFINITY_COOKIE_SAME_SITE,
    secure: SESSION_AFFINITY_COOKIE_SECURE,
    httpOnly: SESSION_AFFINITY_COOKIE_HTTP_ONLY,
    domainConfigured: SESSION_AFFINITY_COOKIE_DOMAIN.length > 0,
  },
  stats: {
    ...stats,
  },
});

export const getWorkbookSessionAffinityHeaderName = () => SESSION_AFFINITY_HEADER;
export const getWorkbookSessionAffinityBucketHeaderName = () => SESSION_AFFINITY_BUCKET_HEADER;
export const getWorkbookSessionAffinityNodeHeaderName = () => SESSION_AFFINITY_NODE_HEADER;
