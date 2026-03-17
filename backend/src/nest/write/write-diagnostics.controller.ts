import { Controller, Get } from "@nestjs/common";
import { getDb } from "../../../../src/mock/db";
import { getWorkbookWriteConsistencyDiagnostics } from "../../../../src/mock/workbookConsistency";

@Controller("/api/nest/write")
export class WorkbookWriteDiagnosticsController {
  @Get("/diagnostics")
  getDiagnostics() {
    return getWorkbookWriteConsistencyDiagnostics(getDb());
  }
}
