import { Controller, Get, Param, Query, Req, Res } from "@nestjs/common";
import { LegacyReadProxyService } from "../legacy-read-proxy.service";
import { forwardGetResponse, type ProxyResponseLike } from "../proxy-response";

@Controller("/api/workbook")
export class SessionsController {
  private readonly proxy = new LegacyReadProxyService();

  @Get("/drafts")
  async getDrafts(
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(this.proxy, req, res, "/api/workbook/drafts");
  }

  @Get("/sessions/:sessionId")
  async getSessionById(
    @Param("sessionId") sessionId: string,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(
      this.proxy,
      req,
      res,
      `/api/workbook/sessions/${encodeURIComponent(sessionId)}`
    );
  }

  @Get("/sessions/:sessionId/events")
  async getSessionEvents(
    @Param("sessionId") sessionId: string,
    @Query("afterSeq") afterSeq: string | undefined,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    const normalizedAfterSeq = Number.parseInt(String(afterSeq ?? "0"), 10);
    const query = Number.isFinite(normalizedAfterSeq) ? `?afterSeq=${normalizedAfterSeq}` : "";
    await forwardGetResponse(
      this.proxy,
      req,
      res,
      `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events${query}`
    );
  }

  @Get("/sessions/:sessionId/events/stream")
  async streamSessionEvents(
    @Param("sessionId") sessionId: string,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      originalUrl?: string;
      on: (event: string, listener: () => void) => void;
    },
    @Res()
    res: {
      status: (code: number) => { setHeader: (name: string, value: string) => void };
      setHeader: (name: string, value: string) => void;
      end: (chunk?: string) => void;
    }
  ) {
    const fallbackPath = `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events/stream`;
    const pathAndQuery = req.originalUrl ?? fallbackPath;
    await this.proxy.forwardEventStream(pathAndQuery, req, res);
  }

  @Get("/sessions/:sessionId/snapshot")
  async getSessionSnapshot(
    @Param("sessionId") sessionId: string,
    @Query("layer") layer: string | undefined,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    const normalizedLayer = layer === "annotations" ? "annotations" : "board";
    await forwardGetResponse(
      this.proxy,
      req,
      res,
      `/api/workbook/sessions/${encodeURIComponent(sessionId)}/snapshot?layer=${normalizedLayer}`
    );
  }

  @Get("/invites/:inviteToken")
  async resolveInvite(
    @Param("inviteToken") inviteToken: string,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; originalUrl?: string },
    @Res() res: ProxyResponseLike
  ) {
    await forwardGetResponse(
      this.proxy,
      req,
      res,
      `/api/workbook/invites/${encodeURIComponent(inviteToken)}`
    );
  }
}
