import { All, Controller, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookAuthApiRequest } from "../runtime-request-router";

const AUTH_API_ROUTES = ["/api/auth", "/api/auth/*path"];

@Controller()
export class WorkbookRuntimeAuthController {
  @All(AUTH_API_ROUTES)
  async handleAuthRequest(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse
  ): Promise<void> {
    const handled = await routeWorkbookAuthApiRequest(req, res);
    if (handled || res.headersSent) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Not Found" }));
  }
}
