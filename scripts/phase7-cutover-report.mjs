#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const reportsDir = String(process.env.PHASE7_REPORTS_DIR ?? "output").trim() || "output";
const explicitInput = String(process.env.PHASE7_REPORT_INPUT ?? "").trim();
const outputFile =
  String(process.env.PHASE7_REPORT_OUTPUT ?? "").trim() ||
  path.join(reportsDir, "phase7-cutover-final-report.md");

const resolveLatestReportFile = () => {
  if (explicitInput) return explicitInput;
  const entries = readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("phase7-cutover-report-") && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  if (entries.length === 0) {
    throw new Error(`No phase7 report json found in ${reportsDir}`);
  }
  return path.join(reportsDir, entries[entries.length - 1]);
};

const readJson = (filePath) => {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
};

const renderStageLine = (stage) => {
  const percent = Number(stage?.percent ?? 0);
  const status = String(stage?.status ?? "unknown");
  const failedChecks = Array.isArray(stage?.gate?.failedChecks)
    ? stage.gate.failedChecks.map((entry) => entry?.name).filter(Boolean)
    : [];
  const failedChecksText = failedChecks.length > 0 ? failedChecks.join(", ") : "-";
  return `| ${percent}% | ${status} | ${failedChecksText} |`;
};

const run = () => {
  const reportFile = resolveLatestReportFile();
  const report = readJson(reportFile);

  const stages = Array.isArray(report?.stages) ? report.stages : [];
  const reached = Number(report?.final?.reachedPercent ?? 0);
  const ok = Boolean(report?.final?.ok);
  const reason = report?.final?.reason ?? "-";
  const rollback = report?.rollback ?? null;

  const markdown = [
    "# Phase 7 Production Cutover Report",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Source report: ${reportFile}`,
    `- Base URL: ${report?.baseUrl ?? "-"}`,
    `- Result: ${ok ? "PASS" : "FAIL"}`,
    `- Reached traffic: ${reached}%`,
    `- Failure reason: ${reason}`,
    `- Rollback attempted: ${Boolean(rollback?.attempted)}`,
    `- Rollback result: ${rollback?.result ? JSON.stringify(rollback.result) : "-"}`,
    "",
    "## Stages",
    "",
    "| Traffic | Status | Failed checks |",
    "|---|---|---|",
    ...stages.map((stage) => renderStageLine(stage)),
    "",
    "## Raw summary",
    "",
    "```json",
    JSON.stringify(report?.final ?? {}, null, 2),
    "```",
    "",
  ].join("\n");

  writeFileSync(outputFile, markdown, "utf-8");
  console.log(
    JSON.stringify(
      {
        ok: true,
        reportFile,
        outputFile,
      },
      null,
      2
    )
  );
};

try {
  run();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(2);
}
