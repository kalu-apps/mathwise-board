#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const reportsDir = String(process.env.PHASEF_REPORTS_DIR ?? "output").trim() || "output";
const explicitInput = String(process.env.PHASEF_REPORT_INPUT ?? "").trim();
const outputFile =
  String(process.env.PHASEF_REPORT_OUTPUT ?? "").trim() ||
  path.join(reportsDir, "phasef-stabilization-final-report.md");

const resolveLatestReportFile = () => {
  if (explicitInput) return explicitInput;
  const entries = readdirSync(reportsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith("phasef-stabilization-report-") &&
        entry.name.endsWith(".json")
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  if (entries.length === 0) {
    throw new Error(`No phasef stabilization report found in ${reportsDir}`);
  }
  return path.join(reportsDir, entries[entries.length - 1]);
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf-8"));

const fmt = (value) => {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3);
  }
  if (value == null) return "-";
  return String(value);
};

const run = () => {
  const reportFile = resolveLatestReportFile();
  const report = readJson(reportFile);
  const failedChecks = Array.isArray(report?.failedChecks) ? report.failedChecks : [];

  const markdown = [
    "# Phase F Stabilization Report",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Source report: ${reportFile}`,
    `- Base URL: ${report?.baseUrl ?? "-"}`,
    `- Result: ${report?.ok ? "PASS" : "FAIL"}`,
    `- Samples: ${fmt(report?.sampleCount)}`,
    `- Duration: ${fmt(report?.config?.durationSeconds)}s`,
    `- Interval: ${fmt(report?.config?.intervalSeconds)}s`,
    "",
    "## SLO Aggregates",
    "",
    `- failureRate avg/max: ${fmt(report?.aggregates?.failureRate?.avg)} / ${fmt(report?.aggregates?.failureRate?.max)}`,
    `- p95 avg/max (ms): ${fmt(report?.aggregates?.p95Ms?.avg)} / ${fmt(report?.aggregates?.p95Ms?.max)}`,
    `- p99 avg/max (ms): ${fmt(report?.aggregates?.p99Ms?.avg)} / ${fmt(report?.aggregates?.p99Ms?.max)}`,
    `- pg waiting avg/max: ${fmt(report?.aggregates?.pgWaiting?.avg)} / ${fmt(report?.aggregates?.pgWaiting?.max)}`,
    `- object conflict delta: ${fmt(report?.aggregates?.objectConflictDelta)}`,
    `- idempotency conflict delta: ${fmt(report?.aggregates?.idempotencyConflictDelta)}`,
    "",
    "## Gate Checks",
    "",
    "| Check | Status | Detail |",
    "|---|---|---|",
    ...(Array.isArray(report?.checks)
      ? report.checks.map((check) =>
          `| ${check.name} | ${check.ok ? "PASS" : "FAIL"} | ${JSON.stringify(check.detail)} |`
        )
      : []),
    "",
    "## Failed Checks",
    "",
    failedChecks.length === 0 ? "- None" : failedChecks.map((check) => `- ${check.name}`),
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
