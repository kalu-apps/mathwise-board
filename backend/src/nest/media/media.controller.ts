import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { LegacyReadProxyService } from "../legacy-read-proxy.service";
import { forwardGetResponse, type ProxyResponseLike } from "../proxy-response";

@Controller("/api/workbook/sessions/:sessionId/media")
export class MediaController {
  private readonly proxy = new LegacyReadProxyService();

  @Get("/config")
  async getMediaConfig(
    @Param("sessionId") sessionId: string,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(
      this.proxy,
      req,
      res,
      `/api/workbook/sessions/${encodeURIComponent(sessionId)}/media/config`
    );
  }

  @Get("/livekit-token")
  async getLivekitToken(
    @Param("sessionId") sessionId: string,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(
      this.proxy,
      req,
      res,
      `/api/workbook/sessions/${encodeURIComponent(sessionId)}/media/livekit-token`
    );
  }
}
