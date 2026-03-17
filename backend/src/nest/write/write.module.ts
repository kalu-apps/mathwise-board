import { Module } from "@nestjs/common";
import { WorkbookWriteController } from "./write.controller";
import { WorkbookWriteDiagnosticsController } from "./write-diagnostics.controller";

@Module({
  controllers: [WorkbookWriteController, WorkbookWriteDiagnosticsController],
})
export class WorkbookWriteModule {}
