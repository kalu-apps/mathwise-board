import { All, Controller, Req, Res } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { WorkbookRuntimeAuthService } from "./workbook-runtime-auth.service";

const AUTH_API_ROUTES = ["/api/auth", "/api/auth/*path"];

@Controller()
export class WorkbookRuntimeAuthController {
  private readonly authService: WorkbookRuntimeAuthService;

  constructor(authService: WorkbookRuntimeAuthService) {
    this.authService = authService;
  }

  @All(AUTH_API_ROUTES)
  async handleAuthRequest(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse
  ): Promise<void> {
    const handled = await this.authService.handle(req, res);
    if (handled || res.headersSent) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Not Found" }));
  }
}
