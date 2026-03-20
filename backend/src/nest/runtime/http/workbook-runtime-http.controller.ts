import { All, Controller, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookApiRequest } from "../runtime-request-router";

const WORKBOOK_API_ROUTES = [
  "/api/workbook",
  "/api/workbook/*path",
];

@Controller()
export class WorkbookRuntimeHttpController {
  @All(WORKBOOK_API_ROUTES)
  async handleRuntimeApiRequest(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse
  ): Promise<void> {
    const handled = await routeWorkbookApiRequest(req, res);
    if (handled || res.headersSent) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Not Found" }));
  }
}
