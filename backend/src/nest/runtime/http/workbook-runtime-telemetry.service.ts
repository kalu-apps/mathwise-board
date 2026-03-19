import { Injectable } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookTelemetryApiRequest } from "../runtime-request-router";

@Injectable()
export class WorkbookRuntimeTelemetryService {
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const handled = await routeWorkbookTelemetryApiRequest(req, res);
    return handled !== false;
  }
}
