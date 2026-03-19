import { Controller, Get } from "@nestjs/common";
import { getDb } from "../runtime/core/db";
import { getWorkbookWriteConsistencyDiagnostics } from "../runtime/core/workbookConsistency";

@Controller("/api/nest/write")
export class WorkbookWriteDiagnosticsController {
  @Get("/diagnostics")
  getDiagnostics() {
    return getWorkbookWriteConsistencyDiagnostics(getDb());
  }
}
