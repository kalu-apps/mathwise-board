import { NestIdempotencyService } from "./idempotency.service";
import { WorkbookObjectVersionGuardService } from "./object-version-guard.service";

export const workbookWriteIdempotency = new NestIdempotencyService();
export const workbookObjectVersionGuard = new WorkbookObjectVersionGuardService();
