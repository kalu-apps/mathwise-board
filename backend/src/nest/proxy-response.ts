import { LegacyReadProxyService } from "./legacy-read-proxy.service";

export type ProxyRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  url?: string;
};

export type ProxyResponseLike = {
  status: (code: number) => ProxyResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (payload: string) => void;
};

export const forwardGetResponse = async (
  proxy: LegacyReadProxyService,
  req: ProxyRequestLike,
  res: ProxyResponseLike,
  fallbackPath: string
) => {
  const pathAndQuery = req.originalUrl ?? req.url ?? fallbackPath;
  const proxied = await proxy.forwardGet(pathAndQuery, req);
  if (proxied.contentType.toLowerCase().includes("application/json")) {
    res.status(proxied.statusCode).json(proxied.body);
    return;
  }
  res.status(proxied.statusCode);
  res.setHeader("Content-Type", proxied.contentType);
  res.send(typeof proxied.body === "string" ? proxied.body : JSON.stringify(proxied.body));
};
