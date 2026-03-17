import { All, Body, Controller, Req, Res } from "@nestjs/common";
import { LegacyReadProxyService } from "./legacy-read-proxy.service";
import { applyProxiedSetCookie, type ProxyResponseLike } from "./proxy-response";

type ProxyRequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  url?: string;
  on?: (event: string, listener: () => void) => void;
};

type ProxyResponseWithEnd = ProxyResponseLike & {
  end: (chunk?: string) => void;
};

@Controller()
export class LegacyFallbackController {
  private readonly proxy = new LegacyReadProxyService();

  @All(["/api", "/api/*path"])
  async forwardUnknownApi(
    @Body() body: unknown,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseWithEnd
  ) {
    const method = String(req.method ?? "GET").toUpperCase();
    const pathAndQuery = req.originalUrl ?? req.url ?? "/api";

    if (method === "GET" || method === "HEAD") {
      const response = await this.proxy.forwardGet(pathAndQuery, req);
      this.writeResponse(
        res,
        response.statusCode,
        response.contentType,
        response.body,
        response.setCookie,
        method === "HEAD"
      );
      return;
    }

    if (method === "POST" || method === "PUT" || method === "DELETE") {
      const response = await this.proxy.forwardJson({
        method,
        pathAndQuery,
        req,
        body,
      });
      this.writeResponse(
        res,
        response.statusCode,
        response.contentType,
        response.body,
        response.setCookie,
        false
      );
      return;
    }

    res.status(405).json({
      error: "method_not_allowed",
      method,
      path: pathAndQuery,
    });
  }

  private writeResponse(
    res: ProxyResponseWithEnd,
    statusCode: number,
    contentType: string,
    body: unknown,
    setCookie: string[],
    headOnly: boolean
  ) {
    applyProxiedSetCookie(res, { setCookie });
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
