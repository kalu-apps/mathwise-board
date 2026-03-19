import { Injectable } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookApiRequest } from "../runtime-request-router";

@Injectable()
export class WorkbookRuntimeHttpService {
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const handled = await routeWorkbookApiRequest(req, res);
    return handled !== false;
  }
}
