import { All, Controller, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { WorkbookRuntimeInfraService } from "./workbook-runtime-infra.service";

const RUNTIME_API_ROUTES = ["/api/runtime", "/api/runtime/*"];

@Controller()
export class WorkbookRuntimeInfraController {
  private readonly runtimeService: WorkbookRuntimeInfraService;

  constructor(runtimeService: WorkbookRuntimeInfraService) {
    this.runtimeService = runtimeService;
  }

  @All(RUNTIME_API_ROUTES)
  async handleRuntimeRequest(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse
  ): Promise<void> {
    const handled = await this.runtimeService.handle(req, res);
    if (handled || res.headersSent) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Not Found" }));
  }
}
