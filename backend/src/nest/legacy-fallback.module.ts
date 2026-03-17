import { Module } from "@nestjs/common";
import { LegacyFallbackController } from "./legacy-fallback.controller";

@Module({
  controllers: [LegacyFallbackController],
})
export class LegacyFallbackModule {}
