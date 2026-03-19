import { Controller, Get } from "@nestjs/common";

@Controller("/api/nest/proxy")
export class NestProxyDiagnosticsController {
  @Get("/diagnostics")
  getDiagnostics() {
    return {
      mode: "nest-native-ingress",
      proxyMode: "none",
    };
  }
}
