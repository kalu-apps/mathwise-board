import { Injectable } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeWorkbookAuthApiRequest } from "../runtime-request-router";

@Injectable()
export class WorkbookRuntimeAuthService {
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const handled = await routeWorkbookAuthApiRequest(req, res);
    return handled !== false;
  }
}
