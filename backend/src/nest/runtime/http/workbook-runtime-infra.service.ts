import { Injectable } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookRuntimeApiRequest } from "../runtime-request-router";

@Injectable()
export class WorkbookRuntimeInfraService {
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    try {
      const handled = await routeWorkbookRuntimeApiRequest(req, res);
      return handled !== false;
    } catch (error) {
      console.error("[workbook-runtime] runtime_route_unhandled_error", {
        method: req.method,
        url: req.url,
        message: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "internal_runtime_error" }));
      }
      return true;
    }
  }
}
