import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { LegacyFallbackController } from "./legacy-fallback.controller";
import { MediaModule } from "./media/media.module";
import { SessionsModule } from "./sessions/sessions.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { WorkbookWriteModule } from "./write/write.module";

@Module({
  imports: [HealthModule, AuthModule, SessionsModule, MediaModule, TelemetryModule, WorkbookWriteModule],
  controllers: [LegacyFallbackController],
})
export class AppModule {}
