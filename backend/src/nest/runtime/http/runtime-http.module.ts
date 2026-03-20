import { Module } from "@nestjs/common";
import { WorkbookRuntimeHttpController } from "./workbook-runtime-http.controller";
import { WorkbookRuntimeAuthController } from "./workbook-runtime-auth.controller";
import { WorkbookRuntimeInfraController } from "./workbook-runtime-infra.controller";
import { WorkbookRuntimeTelemetryController } from "./workbook-runtime-telemetry.controller";

@Module({
  controllers: [
    WorkbookRuntimeHttpController,
    WorkbookRuntimeAuthController,
    WorkbookRuntimeInfraController,
    WorkbookRuntimeTelemetryController,
  ],
})
export class RuntimeHttpModule {}
