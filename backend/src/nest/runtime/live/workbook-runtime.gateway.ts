import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import {
  ensureWorkbookLiveSocketServer,
  type HttpUpgradeServer,
} from "./workbook-runtime-live-upgrade";

@Injectable()
export class WorkbookRuntimeGateway implements OnApplicationBootstrap {
  private readonly adapterHost: HttpAdapterHost;

  constructor(@Inject(HttpAdapterHost) adapterHost: HttpAdapterHost) {
    this.adapterHost = adapterHost;
  }

  onApplicationBootstrap() {
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    ensureWorkbookLiveSocketServer(httpServer as HttpUpgradeServer);
  }
}
