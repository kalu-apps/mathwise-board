import { Module } from "@nestjs/common";
import { WorkbookRuntimeGateway } from "./workbook-runtime.gateway";

@Module({
  providers: [WorkbookRuntimeGateway],
})
export class RuntimeLiveModule {}
