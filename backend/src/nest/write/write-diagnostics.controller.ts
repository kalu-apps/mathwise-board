import { Controller, Get } from "@nestjs/common";
import { nestEnv } from "../nest-env";
import { workbookObjectVersionGuard, workbookWriteIdempotency } from "./write-shared";

@Controller("/api/nest/write")
export class WorkbookWriteDiagnosticsController {
  private readonly idempotency = workbookWriteIdempotency;
  private readonly objectVersions = workbookObjectVersionGuard;

  @Get("/diagnostics")
  getDiagnostics() {
    return {
      mode: "nest-native-api",
      writeGuardActive: false,
      strictObjectVersion: nestEnv.objectVersionStrict,
      idempotency: this.idempotency.getDiagnostics(),
      objectVersions: this.objectVersions.getDiagnostics(),
    };
  }
}
