import { Controller, Get, Req, Res } from "@nestjs/common";
import { LegacyReadProxyService } from "../legacy-read-proxy.service";
import { forwardGetResponse, type ProxyResponseLike } from "../proxy-response";

@Controller("/api/auth")
export class AuthController {
  private readonly proxy = new LegacyReadProxyService();

  @Get("/session")
  async getSession(
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(this.proxy, req, res, "/api/auth/session");
  }

  @Get("/password/status")
  async getPasswordStatus(
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(this.proxy, req, res, "/api/auth/password/status");
  }
}
