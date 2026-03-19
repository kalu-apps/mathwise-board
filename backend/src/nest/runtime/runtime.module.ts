import { Module } from "@nestjs/common";
import { RuntimeHttpModule } from "./http/runtime-http.module";
import { RuntimeLiveModule } from "./live/runtime-live.module";

@Module({
  imports: [RuntimeHttpModule, RuntimeLiveModule],
})
export class RuntimeModule {}
