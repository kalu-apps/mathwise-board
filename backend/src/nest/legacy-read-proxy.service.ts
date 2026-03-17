import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Readable } from "node:stream";
import { nestEnv, shadowRequestHeader } from "./nest-env";

type ProxiedPayload = {
  statusCode: number;
  contentType: string;
  body: unknown;
};

const passthroughRequestHeaders = [
  "cookie",
  "authorization",
  "accept",
  "accept-language",
  "user-agent",
  "x-request-id",
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

@Injectable()
export class LegacyReadProxyService {
  private readonly baseUrl = nestEnv.legacyBaseUrl;
  private readonly timeoutMs = nestEnv.requestTimeoutMs;

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
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
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

  async forwardGet(pathAndQuery: string, req: { headers?: Record<string, string | string[] | undefined> }) {
    const response = await this.fetchWithTimeout(pathAndQuery, req);
    const contentType = response.headers.get("content-type") ?? "application/json; charset=utf-8";
    const text = await toText(response);
    if (!isJsonContentType(contentType)) {
      return {
        statusCode: response.status,
        contentType,
        body: text,
      } satisfies ProxiedPayload;
    }
    const parsed = text.length > 0 ? safeParseJson(text) : null;
    return {
      statusCode: response.status,
      contentType,
      body: parsed,
    } satisfies ProxiedPayload;
  }

  async forwardEventStream(pathAndQuery: string, req: { headers?: Record<string, string | string[] | undefined> }, res: {
    status: (code: number) => { setHeader: (name: string, value: string) => void };
    setHeader: (name: string, value: string) => void;
    end: (chunk?: string) => void;
    on: (event: string, listener: () => void) => void;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
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
