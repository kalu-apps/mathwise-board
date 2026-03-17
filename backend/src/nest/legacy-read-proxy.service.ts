import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Readable } from "node:stream";
import { nestEnv, shadowRequestHeader } from "./nest-env";

export type ProxiedPayload = {
  statusCode: number;
  contentType: string;
  body: unknown;
  setCookie: string[];
};

const passthroughRequestHeaders = [
  "cookie",
  "authorization",
  "accept",
  "accept-language",
  "origin",
  "referer",
  "access-control-request-method",
  "access-control-request-headers",
  "user-agent",
  "x-request-id",
  "x-idempotency-key",
  "x-workbook-device-id",
  "x-workbook-device-class",
  "x-workbook-tab-id",
  "x-workbook-session-affinity",
] as const;

const isJsonContentType = (contentType: string) =>
  contentType.toLowerCase().includes("application/json");

const toText = async (response: Response) => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const readSetCookieHeaders = (response: Response): string[] => {
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

@Injectable()
export class LegacyReadProxyService {
  private readonly baseUrl = nestEnv.legacyBaseUrl;
  private readonly readTimeoutMs = nestEnv.requestTimeoutMs;
  private readonly writeTimeoutMs = nestEnv.writeProxyTimeoutMs;

  private buildTargetUrl(pathAndQuery: string) {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
    return `${base}${pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`}`;
  }

  private createForwardHeaders(req: { headers?: Record<string, string | string[] | undefined> }) {
    const headers = new Headers();
    for (const header of passthroughRequestHeaders) {
      const raw = req.headers?.[header];
      if (typeof raw === "string" && raw.length > 0) {
        headers.set(header, raw);
        continue;
      }
      if (Array.isArray(raw) && raw.length > 0) {
        headers.set(header, raw.join("; "));
      }
    }
    headers.set(shadowRequestHeader, "1");
    return headers;
  }

  private async fetchWithTimeout(pathAndQuery: string, req: { headers?: Record<string, string | string[] | undefined> }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.readTimeoutMs);
    try {
      return await fetch(this.buildTargetUrl(pathAndQuery), {
        method: "GET",
        headers: this.createForwardHeaders(req),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "legacy_proxy_fetch_failed";
      throw new ServiceUnavailableException({
        error: "legacy_proxy_unavailable",
        message,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async forwardJson(params: {
    method: "POST" | "PUT" | "DELETE";
    pathAndQuery: string;
    req: { headers?: Record<string, string | string[] | undefined> };
    body?: unknown;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.writeTimeoutMs);
    try {
      const headers = this.createForwardHeaders(params.req);
      headers.set("content-type", "application/json; charset=utf-8");
      const response = await fetch(this.buildTargetUrl(params.pathAndQuery), {
        method: params.method,
        headers,
        body: JSON.stringify(params.body ?? null),
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "application/json; charset=utf-8";
      const text = await toText(response);
      const body = isJsonContentType(contentType) ? (text.length > 0 ? safeParseJson(text) : null) : text;
      return {
        statusCode: response.status,
        contentType,
        body,
        setCookie: readSetCookieHeaders(response),
      } satisfies ProxiedPayload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "legacy_proxy_fetch_failed";
      throw new ServiceUnavailableException({
        error: "legacy_proxy_unavailable",
        message,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async forwardGet(pathAndQuery: string, req: { headers?: Record<string, string | string[] | undefined> }) {
    const response = await this.fetchWithTimeout(pathAndQuery, req);
    const contentType = response.headers.get("content-type") ?? "application/json; charset=utf-8";
    const text = await toText(response);
    if (!isJsonContentType(contentType)) {
      return {
        statusCode: response.status,
        contentType,
        body: text,
        setCookie: readSetCookieHeaders(response),
      } satisfies ProxiedPayload;
    }
    const parsed = text.length > 0 ? safeParseJson(text) : null;
    return {
      statusCode: response.status,
      contentType,
      body: parsed,
      setCookie: readSetCookieHeaders(response),
    } satisfies ProxiedPayload;
  }

  async forwardEventStream(pathAndQuery: string, req: { headers?: Record<string, string | string[] | undefined> }, res: {
    status: (code: number) => { setHeader: (name: string, value: string) => void };
    setHeader: (name: string, value: string) => void;
    end: (chunk?: string) => void;
    on: (event: string, listener: () => void) => void;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.readTimeoutMs);
    try {
      const response = await fetch(this.buildTargetUrl(pathAndQuery), {
        method: "GET",
        headers: this.createForwardHeaders(req),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const contentType = response.headers.get("content-type") ?? "text/event-stream; charset=utf-8";
      res.status(response.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", response.headers.get("cache-control") ?? "no-cache");
      res.setHeader("Connection", "keep-alive");
      if (!response.body) {
        res.end();
        return;
      }
      const nodeStream = Readable.fromWeb(response.body as unknown as ReadableStream);
      req.on("close", () => controller.abort());
      nodeStream.on("error", () => res.end());
      nodeStream.pipe(res as unknown as NodeJS.WritableStream);
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : "legacy_stream_proxy_failed";
      throw new ServiceUnavailableException({
        error: "legacy_stream_proxy_unavailable",
        message,
      });
    }
  }
}

const safeParseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { error: "invalid_json_from_legacy", raw: value };
  }
};
