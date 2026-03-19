import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import {
  attachWorkbookLiveSocketServer,
  type HttpUpgradeServer,
} from "../../../../src/mock/server";

@Injectable()
export class WorkbookRealtimeBootstrap implements OnApplicationBootstrap {
  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  onApplicationBootstrap() {
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    attachWorkbookLiveSocketServer(httpServer as HttpUpgradeServer);
  }
}
