import type { NextHandleFunction } from "connect";
import type { IncomingMessage } from "node:http";
import {
  extractWorkbookSessionIdFromPath,
  getWorkbookSessionAffinityBucketHeaderName,
  getWorkbookSessionAffinityHeaderName,
  getWorkbookSessionAffinityNodeHeaderName,
  resolveWorkbookSessionAffinity,
} from "../../../src/mock/sessionAffinity";
import { nestEnv, shadowRequestHeader } from "./nest-env";

const proxyHeaders = [
  "cookie",
  "authorization",
  "accept",
  "accept-language",
  "origin",
  "referer",
  "content-type",
  "user-agent",
  "access-control-request-method",
  "access-control-request-headers",
  "x-request-id",
  "x-idempotency-key",
  "x-workbook-device-id",
  "x-workbook-device-class",
  "x-workbook-tab-id",
  "x-workbook-session-affinity",
] as const;

const PROXY_ROUTES: Array<{ method: "GET" | "POST" | "PUT"; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/api\/workbook\/sessions\/[^/]+\/events$/ },
  { method: "POST", pattern: /^\/api\/workbook\/sessions\/[^/]+\/events\/live$/ },
  { method: "POST", pattern: /^\/api\/workbook\/sessions\/[^/]+\/events\/preview$/ },
  { method: "PUT", pattern: /^\/api\/workbook\/sessions\/[^/]+\/snapshot$/ },
  { method: "POST", pattern: /^\/api\/workbook\/sessions\/[^/]+\/presence$/ },
  { method: "POST", pattern: /^\/api\/workbook\/sessions\/[^/]+\/presence\/leave$/ },
  { method: "GET", pattern: /^\/api\/nest\/write\/diagnostics$/ },
];
const ALL_PROXY_SKIP_PATTERNS = [/^\/api\/nest\/shadow\/parity$/, /^\/api\/nest\/proxy\/diagnostics$/];

const readRawBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return Buffer.concat(chunks);
};

const readRequestHeader = (
  req: IncomingMessage,
  name: string
): string | null => {
  const raw = req.headers[name];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0] ?? null;
  return null;
};

const applyCorsHeadersFromRequest = (req: IncomingMessage, res: {
  setHeader: (name: string, value: string) => void;
}) => {
  const origin = readRequestHeader(req, "origin");
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  const requestedHeaders = readRequestHeader(req, "access-control-request-headers");
  if (requestedHeaders) {
    res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
  }
  const requestedMethod = readRequestHeader(req, "access-control-request-method");
  if (requestedMethod) {
    res.setHeader("Access-Control-Allow-Methods", requestedMethod);
  }
};

const getResponseSetCookies = (response: Response): string[] => {
  const typedHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof typedHeaders.getSetCookie === "function") {
    const cookies = typedHeaders.getSetCookie().filter((value) => value.length > 0);
    if (cookies.length > 0) {
      return cookies;
    }
  }
  const single = response.headers.get("set-cookie");
  return typeof single === "string" && single.length > 0 ? [single] : [];
};

const createForwardHeaders = (req: IncomingMessage) => {
  const headers = new Headers();
  for (const headerName of proxyHeaders) {
    const raw = req.headers[headerName];
    if (typeof raw === "string" && raw.length > 0) {
      headers.set(headerName, raw);
      continue;
    }
    if (Array.isArray(raw) && raw.length > 0) {
      headers.set(headerName, raw.join("; "));
    }
  }
  return headers;
};

const shouldProxyRoute = (
  method: "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "HEAD",
  pathname: string
) => {
  if (nestEnv.proxyMode === "all") {
    if (!pathname.startsWith("/api/")) return false;
    if (ALL_PROXY_SKIP_PATTERNS.some((pattern) => pattern.test(pathname))) return false;
    return true;
  }
  return PROXY_ROUTES.some(
    (route) => route.method === method && route.pattern.test(pathname)
  );
};

export const createNestApiProxyMiddleware = (): NextHandleFunction => {
  if (!nestEnv.featureEnabled) {
    return (_req, _res, next) => next();
  }

  return async (req, res, next) => {
    if (!req.url) {
      next();
      return;
    }
    if (req.headers[shadowRequestHeader] === "1") {
      next();
      return;
    }
    const method = String(req.method ?? "GET").toUpperCase() as
      | "GET"
      | "POST"
      | "PUT"
      | "DELETE"
      | "OPTIONS"
      | "HEAD";
    const pathname = new URL(req.url, "http://localhost").pathname;
    const shouldProxy = shouldProxyRoute(method, pathname);
    if (!shouldProxy) {
      next();
      return;
    }
    const sessionId = extractWorkbookSessionIdFromPath(pathname);
    const affinityHeaderName = getWorkbookSessionAffinityHeaderName();
    const affinityBucketHeaderName = getWorkbookSessionAffinityBucketHeaderName();
    const affinityNodeHeaderName = getWorkbookSessionAffinityNodeHeaderName();

    const controller = new AbortController();
    const timeoutBudgetMs = method === "GET" ? nestEnv.requestTimeoutMs : nestEnv.writeProxyTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutBudgetMs);
    try {
      const body = method === "POST" || method === "PUT" ? await readRawBody(req) : Buffer.alloc(0);
      const forwardHeaders = createForwardHeaders(req);
      if (sessionId && !forwardHeaders.has(affinityHeaderName)) {
        const affinity = resolveWorkbookSessionAffinity(sessionId);
        forwardHeaders.set(affinityHeaderName, affinity.headerValue);
      }
      const response = await fetch(`${nestEnv.apiBaseUrl}${req.url}`, {
        method,
        headers: forwardHeaders,
        body: body.length > 0 ? body : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      res.statusCode = response.status;
      for (const [name, value] of response.headers.entries()) {
        const lower = name.toLowerCase();
        if (lower === "transfer-encoding" || lower === "set-cookie") continue;
        res.setHeader(name, value);
      }
      const setCookies = getResponseSetCookies(response);
      if (setCookies.length > 0) {
        res.setHeader("Set-Cookie", setCookies);
      }
      if (sessionId) {
        const affinity = resolveWorkbookSessionAffinity(sessionId);
        res.setHeader(affinityHeaderName, affinity.headerValue);
        res.setHeader(affinityBucketHeaderName, String(affinity.bucket));
        res.setHeader(affinityNodeHeaderName, affinity.nodeId);
      }
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const responseBody = Buffer.from(await response.arrayBuffer());
      res.end(responseBody);
    } catch (error) {
      clearTimeout(timeoutId);
      res.statusCode = 503;
      applyCorsHeadersFromRequest(req, res);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: "nest_api_proxy_unavailable",
          message: error instanceof Error ? error.message : "proxy_failed",
        })
      );
    }
  };
};
