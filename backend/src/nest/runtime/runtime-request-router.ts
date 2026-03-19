import type { IncomingMessage, ServerResponse } from "node:http";
import {
  handleWorkbookApiRequest,
  handleWorkbookApiRequestByDomains,
  type RuntimeApiDomain,
} from "./workbook-runtime-engine";

const AUTH_DOMAIN_SET = new Set<RuntimeApiDomain>(["auth"]);
const RUNTIME_DOMAIN_SET = new Set<RuntimeApiDomain>(["runtime"]);
const TELEMETRY_DOMAIN_SET = new Set<RuntimeApiDomain>(["telemetry"]);
const ALL_RUNTIME_DOMAIN_SET = new Set<RuntimeApiDomain>([
  "auth",
  "runtime",
  "telemetry",
  "workbook",
]);

export const routeWorkbookApiRequest = (req: IncomingMessage, res: ServerResponse) =>
  handleWorkbookApiRequest(req, res);

export const routeWorkbookAuthApiRequest = (req: IncomingMessage, res: ServerResponse) =>
  handleWorkbookApiRequestByDomains(req, res, AUTH_DOMAIN_SET);

export const routeWorkbookRuntimeApiRequest = (req: IncomingMessage, res: ServerResponse) =>
  handleWorkbookApiRequestByDomains(req, res, RUNTIME_DOMAIN_SET);

export const routeWorkbookTelemetryApiRequest = (req: IncomingMessage, res: ServerResponse) =>
  handleWorkbookApiRequestByDomains(req, res, TELEMETRY_DOMAIN_SET);

export const routeWorkbookEmbeddedRuntimeApiRequest = (
  req: IncomingMessage,
  res: ServerResponse
) => handleWorkbookApiRequestByDomains(req, res, ALL_RUNTIME_DOMAIN_SET);
