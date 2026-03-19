import { Module } from "@nestjs/common";
import { WorkbookRuntimeHttpController } from "./workbook-runtime-http.controller";
import { WorkbookRuntimeHttpService } from "./workbook-runtime-http.service";
import { WorkbookRuntimeAuthController } from "./workbook-runtime-auth.controller";
import { WorkbookRuntimeAuthService } from "./workbook-runtime-auth.service";
import { WorkbookRuntimeInfraController } from "./workbook-runtime-infra.controller";
import { WorkbookRuntimeInfraService } from "./workbook-runtime-infra.service";
import { WorkbookRuntimeTelemetryController } from "./workbook-runtime-telemetry.controller";
import { WorkbookRuntimeTelemetryService } from "./workbook-runtime-telemetry.service";

@Module({
  controllers: [
    WorkbookRuntimeHttpController,
    WorkbookRuntimeAuthController,
    WorkbookRuntimeInfraController,
    WorkbookRuntimeTelemetryController,
  ],
  providers: [
    WorkbookRuntimeHttpService,
    WorkbookRuntimeAuthService,
    WorkbookRuntimeInfraService,
    WorkbookRuntimeTelemetryService,
  ],
})
export class RuntimeHttpModule {}
