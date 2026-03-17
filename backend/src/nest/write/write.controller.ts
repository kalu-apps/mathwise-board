import { Body, Controller, Param, Post, Put, Req, Res } from "@nestjs/common";
import { LegacyReadProxyService, type ProxiedPayload } from "../legacy-read-proxy.service";
import { nestEnv } from "../nest-env";
import { applyProxiedSetCookie, type ProxyResponseLike } from "../proxy-response";
import { workbookObjectVersionGuard, workbookWriteIdempotency } from "./write-shared";

type ProxyRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  url?: string;
};

@Controller("/api/workbook/sessions/:sessionId")
export class WorkbookWriteController {
  private readonly proxy = new LegacyReadProxyService();
  private readonly idempotency = workbookWriteIdempotency;
  private readonly objectVersionGuard = workbookObjectVersionGuard;

  @Post("/events")
  async appendEvents(
    @Param("sessionId") sessionId: string,
    @Body() body: { events?: Array<{ type?: string; payload?: unknown; clientEventId?: string }> } | null,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseLike
  ) {
    const normalizedEvents = Array.isArray(body?.events)
      ? body.events.filter((event) => event && typeof event.type === "string")
      : [];
    const idempotencyKey = this.resolveIdempotencyKey(req, "events_append", sessionId, {
      events: normalizedEvents,
    });

    const result = await this.objectVersionGuard.withSessionLock(sessionId, () =>
      this.idempotency.run(idempotencyKey, async () => {
        const events = await this.objectVersionGuard.applyOptimisticVersioning(
          sessionId,
          normalizedEvents as Array<{ type: string; payload: unknown; clientEventId?: string }>
        );
        return this.proxy.forwardJson({
          method: "POST",
          pathAndQuery: req.originalUrl ?? req.url ?? `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
          req,
          body: {
            events,
          },
        });
      })
    );
    writeProxyResult(res, result);
  }

  @Post("/events/live")
  async appendLiveEvents(
    @Param("sessionId") sessionId: string,
    @Body() body: { events?: unknown[] } | null,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseLike
  ) {
    const idempotencyKey = this.resolveIdempotencyKey(req, "events_live", sessionId, body ?? {});
    const result = await this.idempotency.run(idempotencyKey, () =>
      this.proxy.forwardJson({
        method: "POST",
        pathAndQuery:
          req.originalUrl ?? req.url ?? `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events/live`,
        req,
        body,
      })
    );
    writeProxyResult(res, result);
  }

  @Post("/events/preview")
  async appendPreviewEvent(
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, unknown> | null,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseLike
  ) {
    const idempotencyKey = this.resolveIdempotencyKey(req, "events_preview", sessionId, body ?? {});
    const result = await this.idempotency.run(idempotencyKey, () =>
      this.proxy.forwardJson({
        method: "POST",
        pathAndQuery:
          req.originalUrl ?? req.url ?? `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events/preview`,
        req,
        body,
      })
    );
    writeProxyResult(res, result);
  }

  @Put("/snapshot")
  async upsertSnapshot(
    @Param("sessionId") sessionId: string,
    @Body() body: { layer?: "board" | "annotations"; version?: number; payload?: unknown } | null,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseLike
  ) {
    const idempotencyKey = this.resolveIdempotencyKey(req, "snapshot_upsert", sessionId, body ?? {});
    const result = await this.idempotency.run(idempotencyKey, () =>
      this.proxy.forwardJson({
        method: "PUT",
        pathAndQuery: req.originalUrl ?? req.url ?? `/api/workbook/sessions/${encodeURIComponent(sessionId)}/snapshot`,
        req,
        body,
      })
    );
    writeProxyResult(res, result);
  }

  @Post("/presence")
  async heartbeatPresence(
    @Param("sessionId") sessionId: string,
    @Body() body: { state?: string; tabId?: string } | null,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseLike
  ) {
    const idempotencyKey = this.resolveIdempotencyKey(req, "presence_heartbeat", sessionId, body ?? {});
    const result = await this.idempotency.run(idempotencyKey, () =>
      this.proxy.forwardJson({
        method: "POST",
        pathAndQuery: req.originalUrl ?? req.url ?? `/api/workbook/sessions/${encodeURIComponent(sessionId)}/presence`,
        req,
        body,
      })
    );
    writeProxyResult(res, result);
  }

  @Post("/presence/leave")
  async leavePresence(
    @Param("sessionId") sessionId: string,
    @Body() body: { tabId?: string; reason?: string } | null,
    @Req() req: ProxyRequestLike,
    @Res() res: ProxyResponseLike
  ) {
    const idempotencyKey = this.resolveIdempotencyKey(req, "presence_leave", sessionId, body ?? {});
    const result = await this.idempotency.run(idempotencyKey, () =>
      this.proxy.forwardJson({
        method: "POST",
        pathAndQuery:
          req.originalUrl ?? req.url ?? `/api/workbook/sessions/${encodeURIComponent(sessionId)}/presence/leave`,
        req,
        body,
      })
    );
    writeProxyResult(res, result);
  }

  private resolveIdempotencyKey(
    req: ProxyRequestLike,
    scope: string,
    sessionId: string,
    body: unknown
  ) {
    const raw = req.headers?.["x-idempotency-key"];
    const headerValue = typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? "").trim() : "";
    if (headerValue.length > 0) {
      return `${scope}:${sessionId}:${headerValue}`;
    }
    if (!nestEnv.idempotencyBodyFallback) {
      return null;
    }
    return this.idempotency.createFallbackKey(scope, sessionId, body);
  }
}

const writeProxyResult = (
  res: ProxyResponseLike,
  proxied: ProxiedPayload
) => {
  applyProxiedSetCookie(res, proxied);
  const { statusCode, contentType, body } = proxied;
  if (contentType.toLowerCase().includes("application/json")) {
    res.status(statusCode).json(body);
    return;
  }
  res.status(statusCode);
  res.setHeader("Content-Type", contentType);
  res.send(typeof body === "string" ? body : JSON.stringify(body));
};
