import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("/livez")
  getLivez() {
    return {
      ok: true,
      service: "mathboard-nest",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/readyz")
  getReadyz() {
    return {
      ok: true,
      service: "mathboard-nest",
      timestamp: new Date().toISOString(),
      ready: true,
      reasons: [],
      shuttingDown: false,
      mode: "read-path-shadow",
    };
  }

  @Get("/healthz")
  getHealthz() {
    return {
      ok: true,
      service: "mathboard-nest",
      timestamp: new Date().toISOString(),
      mode: "read-path-shadow",
    };
  }
}
