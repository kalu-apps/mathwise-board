import { Module } from "@nestjs/common";
import { WorkbookWriteDiagnosticsController } from "./write-diagnostics.controller";

@Module({
  controllers: [WorkbookWriteDiagnosticsController],
})
export class WorkbookWriteModule {}
