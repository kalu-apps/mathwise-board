import { Injectable } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookRuntimeApiRequest } from "../runtime-request-router";

@Injectable()
export class WorkbookRuntimeInfraService {
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const handled = await routeWorkbookRuntimeApiRequest(req, res);
    return handled !== false;
  }
}
