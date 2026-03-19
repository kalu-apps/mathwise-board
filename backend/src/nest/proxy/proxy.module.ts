import { Module } from "@nestjs/common";
import { NestProxyDiagnosticsController } from "./proxy-diagnostics.controller";

@Module({
  controllers: [NestProxyDiagnosticsController],
})
export class ProxyModule {}
