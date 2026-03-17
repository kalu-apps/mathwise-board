import type { NextHandleFunction } from "connect";
import type { IncomingMessage } from "node:http";
import { nestEnv, shadowRequestHeader } from "./nest-env";

const proxyHeaders = [
  "cookie",
  "authorization",
  "accept",
  "accept-language",
  "content-type",
  "user-agent",
  "x-request-id",
  "x-idempotency-key",
  "x-workbook-device-id",
  "x-workbook-device-class",
  "x-workbook-tab-id",
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
    const method = String(req.method ?? "GET").toUpperCase() as "GET" | "POST" | "PUT" | "DELETE";
    const pathname = new URL(req.url, "http://localhost").pathname;
    const shouldProxy = PROXY_ROUTES.some(
      (route) => route.method === method && route.pattern.test(pathname)
    );
    if (!shouldProxy) {
      next();
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), nestEnv.writeProxyTimeoutMs);
    try {
      const body = method === "POST" || method === "PUT" ? await readRawBody(req) : Buffer.alloc(0);
      const response = await fetch(`${nestEnv.apiBaseUrl}${req.url}`, {
        method,
        headers: createForwardHeaders(req),
        body: body.length > 0 ? body : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      res.statusCode = response.status;
      for (const [name, value] of response.headers.entries()) {
        if (name.toLowerCase() === "transfer-encoding") continue;
        res.setHeader(name, value);
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
