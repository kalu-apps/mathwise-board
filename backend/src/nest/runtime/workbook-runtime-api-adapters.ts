import type { IncomingMessage, ServerResponse } from "node:http";
import {
  routeWorkbookAuthApiRequest,
  routeWorkbookEmbeddedRuntimeApiRequest,
  routeWorkbookRuntimeApiRequest,
  routeWorkbookTelemetryApiRequest,
} from "./runtime-request-router";
import {
  ensureWorkbookLiveSocketServer,
  type HttpUpgradeServer,
} from "./live/workbook-runtime-live-upgrade";

type WorkbookApiNext = () => void;
type WorkbookApiMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: WorkbookApiNext
) => void | Promise<void>;

const assertDevOnlyEmbeddedRuntime = () => {
  const nodeEnv = String(process.env.NODE_ENV ?? "development")
    .trim()
    .toLowerCase();
  if (nodeEnv === "production") {
    throw new Error("[embedded-runtime-api] dev-only adapter cannot run in production.");
  }
};

export const handleWorkbookAuthApiRequest = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean | void> => {
  return routeWorkbookAuthApiRequest(req, res);
};

export const handleWorkbookRuntimeApiRequest = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean | void> => {
  return routeWorkbookRuntimeApiRequest(req, res);
};

export const handleWorkbookTelemetryApiRequest = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean | void> => {
  return routeWorkbookTelemetryApiRequest(req, res);
};

// Compatibility adapter for local Vite mock server; Nest runtime uses Nest controllers directly.
export const createWorkbookApiMiddleware = (): WorkbookApiMiddleware => {
  assertDevOnlyEmbeddedRuntime();
  return async (req, res, next) => {
    const handled = await routeWorkbookEmbeddedRuntimeApiRequest(req, res);
    if (handled === false) {
      next();
    }
  };
};

// Compatibility alias for local Vite mock server API.
export const attachWorkbookLiveSocketServer = (httpServer: HttpUpgradeServer | null | undefined) => {
  assertDevOnlyEmbeddedRuntime();
  ensureWorkbookLiveSocketServer(httpServer);
};
export type { HttpUpgradeServer };
