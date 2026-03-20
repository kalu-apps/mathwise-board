import { All, Controller, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookRuntimeApiRequest } from "../runtime-request-router";

const RUNTIME_API_ROUTES = ["/api/runtime", "/api/runtime/*path"];

@Controller()
export class WorkbookRuntimeInfraController {
  @All(RUNTIME_API_ROUTES)
  async handleRuntimeRequest(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse
  ): Promise<void> {
    const handled = await routeWorkbookRuntimeApiRequest(req, res);
    if (handled || res.headersSent) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Not Found" }));
  }
}
