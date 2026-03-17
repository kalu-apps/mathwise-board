import { Controller, Get, Req, Res } from "@nestjs/common";
import { LegacyReadProxyService } from "../legacy-read-proxy.service";
import { forwardGetResponse, type ProxyResponseLike } from "../proxy-response";

@Controller()
export class TelemetryController {
  private readonly proxy = new LegacyReadProxyService();

  @Get("/api/telemetry/runtime")
  async getRuntimeTelemetry(
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(this.proxy, req, res, "/api/telemetry/runtime");
  }

  @Get("/api/runtime/readiness")
  async getRuntimeReadiness(
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(this.proxy, req, res, "/api/runtime/readiness");
  }
}
