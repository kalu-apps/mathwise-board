import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { WorkbookWriteModule } from "./write/write.module";

@Module({
  imports: [HealthModule, WorkbookWriteModule],
})
export class AppModule {}
