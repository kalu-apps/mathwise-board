import { Controller, Get } from "@nestjs/common";
import { nestEnv } from "../nest-env";

@Controller()
export class HealthController {
  private getMode() {
    return nestEnv.proxyMode === "all" ? "cutover-all-api" : "write-gateway";
  }

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
      mode: this.getMode(),
      proxyMode: nestEnv.proxyMode,
      ffNestApi: nestEnv.featureEnabled,
    };
  }

  @Get("/healthz")
  getHealthz() {
    return {
      ok: true,
      service: "mathboard-nest",
      timestamp: new Date().toISOString(),
      mode: this.getMode(),
      proxyMode: nestEnv.proxyMode,
      ffNestApi: nestEnv.featureEnabled,
    };
  }
}
