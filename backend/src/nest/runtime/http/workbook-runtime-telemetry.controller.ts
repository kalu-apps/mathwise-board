import { All, Controller, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { WorkbookRuntimeTelemetryService } from "./workbook-runtime-telemetry.service";

const TELEMETRY_API_ROUTES = ["/api/telemetry", "/api/telemetry/*path"];

@Controller()
export class WorkbookRuntimeTelemetryController {
  private readonly telemetryService: WorkbookRuntimeTelemetryService;

  constructor(telemetryService: WorkbookRuntimeTelemetryService) {
    this.telemetryService = telemetryService;
  }

  @All(TELEMETRY_API_ROUTES)
  async handleTelemetryRequest(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse
  ): Promise<void> {
    const handled = await this.telemetryService.handle(req, res);
    if (handled || res.headersSent) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Not Found" }));
  }
}
