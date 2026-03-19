import { Module } from "@nestjs/common";
import { WorkbookRealtimeBootstrap } from "./workbook-realtime.bootstrap";

@Module({
  providers: [WorkbookRealtimeBootstrap],
})
export class RuntimeModule {}
