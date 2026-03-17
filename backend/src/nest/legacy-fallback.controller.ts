import { All, Body, Controller, Req, Res } from "@nestjs/common";
import { LegacyReadProxyService } from "./legacy-read-proxy.service";

type ProxyRequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  url?: string;
  on?: (event: string, listener: () => void) => void;
};

type ProxyResponseLike = {
  status: (code: number) => ProxyResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (payload: string) => void;
  end: (chunk?: string) => void;
};

@Controller()
export class LegacyFallbackController {
  private readonly proxy = new LegacyReadProxyService();

  @All(["/api", "/api/*path"])
  async forwardUnknownApi(
    @Body() body: unknown,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseLike
  ) {
    const method = String(req.method ?? "GET").toUpperCase();
    const pathAndQuery = req.originalUrl ?? req.url ?? "/api";

    if (method === "GET" || method === "HEAD") {
      const response = await this.proxy.forwardGet(pathAndQuery, req);
      this.writeResponse(res, response.statusCode, response.contentType, response.body, method === "HEAD");
      return;
    }

    if (method === "POST" || method === "PUT" || method === "DELETE") {
      const response = await this.proxy.forwardJson({
        method,
        pathAndQuery,
        req,
        body,
      });
      this.writeResponse(res, response.statusCode, response.contentType, response.body, false);
      return;
    }

    res.status(405).json({
      error: "method_not_allowed",
      method,
      path: pathAndQuery,
    });
  }

  private writeResponse(
    res: ProxyResponseLike,
    statusCode: number,
    contentType: string,
    body: unknown,
    headOnly: boolean
  ) {
    if (headOnly) {
      res.status(statusCode);
      res.end();
      return;
    }
    if (contentType.toLowerCase().includes("application/json")) {
      res.status(statusCode).json(body);
      return;
    }
    res.status(statusCode);
    res.setHeader("Content-Type", contentType);
    res.send(typeof body === "string" ? body : JSON.stringify(body));
  }
}
