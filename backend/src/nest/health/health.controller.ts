import { Controller, Get } from "@nestjs/common";
const NEST_MODE = "nest-native-api" as const;

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
      mode: NEST_MODE,
    };
  }

  @Get("/healthz")
  getHealthz() {
    return {
      ok: true,
      service: "mathboard-nest",
      timestamp: new Date().toISOString(),
      mode: NEST_MODE,
    };
  }
}
