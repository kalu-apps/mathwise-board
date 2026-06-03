import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { nestEnv } from "../nest-env";
import { getWorkbookRuntimeReadiness } from "../runtime/core/runtimeReadiness";
import { isRuntimeShuttingDown } from "./runtime-readiness-state";

const NEST_MODE = "nest-native-api" as const;

@Controller()
export class HealthController {
  private buildReadinessPayload() {
    const runtimeReadiness = getWorkbookRuntimeReadiness();
    const shuttingDown = isRuntimeShuttingDown();
    const reasons = [...runtimeReadiness.reasons];
    if (shuttingDown) {
      reasons.push("shutting_down");
    }

    return {
      service: "mathboard-nest",
      timestamp: new Date().toISOString(),
      ready: !shuttingDown && runtimeReadiness.ready,
      reasons,
      shuttingDown,
      mode: NEST_MODE,
      storage: runtimeReadiness.storage,
      runtime: runtimeReadiness.runtime,
      ingress: {
        bodyLimitMb: nestEnv.bodyLimitMb,
      },
    };
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
  getReadyz(@Res() res: Response) {
    const readiness = this.buildReadinessPayload();
    res.status(readiness.ready ? 200 : 503).json({
      ok: readiness.ready,
      ...readiness,
    });
  }

  @Get("/healthz")
  getHealthz() {
    const readiness = this.buildReadinessPayload();
    return {
      ok: true,
      service: "mathboard-nest",
      timestamp: new Date().toISOString(),
      mode: NEST_MODE,
      readiness: {
        ready: readiness.ready,
        reasons: readiness.reasons,
        shuttingDown: readiness.shuttingDown,
      },
      ingress: readiness.ingress,
      storage: readiness.storage,
      runtime: readiness.runtime,
    };
  }
}
