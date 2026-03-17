import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { MediaModule } from "./media/media.module";
import { SessionsModule } from "./sessions/sessions.module";
import { TelemetryModule } from "./telemetry/telemetry.module";

@Module({
  imports: [HealthModule, AuthModule, SessionsModule, MediaModule, TelemetryModule],
})
export class AppModule {}
