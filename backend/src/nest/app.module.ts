import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { RuntimeModule } from "./runtime/runtime.module";
import { WorkbookWriteModule } from "./write/write.module";
import { ProxyModule } from "./proxy/proxy.module";

@Module({
  imports: [HealthModule, RuntimeModule, WorkbookWriteModule, ProxyModule],
})
export class AppModule {}
