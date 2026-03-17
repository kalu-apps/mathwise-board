#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const readBool = (value, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const readPositiveInt = (value, fallback, cap) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(cap, parsed);
};

const readFloat = (value, fallback, min, max) => {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const parseSteps = (value) => {
  const raw = String(value ?? "10,25,50,100")
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0 && entry <= 100);
  const unique = Array.from(new Set(raw));
  unique.sort((a, b) => a - b);
  if (unique.length === 0) return [10, 25, 50, 100];
  return unique;
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const withTimeout = async (task, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
};

const getJsonViaCurl = (url) => {
  const response = execFileSync(
    "curl",
    ["-sS", "--max-time", String(Math.max(1, Math.ceil(timeoutMs / 1000))), "-w", "\n%{http_code}", url],
    { encoding: "utf-8" }
  );
  const lines = response.replace(/\r/g, "").split("\n");
  const statusRaw = lines.pop() ?? "0";
  const bodyRaw = lines.join("\n");
  const status = Number.parseInt(statusRaw.trim(), 10);
  let payload = null;
  try {
    payload = bodyRaw.length > 0 ? JSON.parse(bodyRaw) : null;
  } catch {
    payload = { raw: bodyRaw };
  }
  return {
    status: Number.isFinite(status) ? status : 0,
    ok: status >= 200 && status < 300,
    payload,
    url,
    transport: "curl",
  };
};

const baseUrl = String(process.env.PHASE7_BASE_URL ?? "https://api.board.mathwise.ru")
  .trim()
  .replace(/\/+$/, "");
const steps = parseSteps(process.env.PHASE7_STEPS);
const settleSeconds = readPositiveInt(process.env.PHASE7_SETTLE_SECONDS, 120, 3600);
const timeoutMs = readPositiveInt(process.env.PHASE7_TIMEOUT_MS, 15000, 180000);
const maxFailureRate = readFloat(process.env.PHASE7_MAX_FAILURE_RATE, 0.1, 0, 1);
const maxP95Ms = readPositiveInt(process.env.PHASE7_MAX_P95_MS, 500, 120000);
const maxPgWaiting = readPositiveInt(process.env.PHASE7_MAX_PG_WAITING, 10, 10000);
const dryRun = readBool(process.env.PHASE7_DRY_RUN, true);
const runLoadCheck = readBool(process.env.PHASE7_RUN_LOAD_CHECK, false);
const trafficCommandTemplate = String(process.env.PHASE7_SET_TRAFFIC_CMD ?? "").trim();
const rollbackCommandTemplate = String(process.env.PHASE7_ROLLBACK_CMD ?? "").trim();
const loadCheckCommand =
  String(process.env.PHASE7_LOAD_CHECK_CMD ?? "").trim() ||
  `PHASE6_BASE_URL=${baseUrl} npm run phase6:load`;
const reportFile =
  String(process.env.PHASE7_REPORT_FILE ?? "").trim() ||
  path.join(
    "output",
    `phase7-cutover-report-${new Date().toISOString().replace(/[.:]/g, "-")}.json`
  );

const getJson = async (urlPath) => {
  const url = `${baseUrl}${urlPath}`;
  try {
    const response = await withTimeout((signal) => fetch(url, { method: "GET", signal }), timeoutMs);
    const text = await response.text();
    let payload = null;
    try {
      payload = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return {
      status: response.status,
      ok: response.ok,
      payload,
      url,
      transport: "fetch",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(message)) {
      return getJsonViaCurl(url);
    }
    throw error;
  }
};

const evaluateGate = (health, infra) => {
  const readiness = infra.payload?.readiness ?? health.payload?.readiness ?? null;
  const storage = infra.payload?.storage ?? health.payload?.storage ?? null;
  const runtime = infra.payload?.runtime ?? health.payload?.runtime ?? null;
  const telemetry = infra.payload?.telemetry ?? health.payload?.telemetry ?? null;

  const checks = [
    {
      name: "health_endpoint",
      ok: health.status === 200,
      detail: { status: health.status, url: health.url },
    },
    {
      name: "infra_endpoint",
      ok: infra.status === 200 || infra.status === 503,
      detail: { status: infra.status, url: infra.url },
    },
    {
      name: "readiness",
      ok: Boolean(readiness?.ready),
      detail: readiness ?? null,
    },
    {
      name: "redis_connected",
      ok: runtime?.redis?.required ? runtime.redis.connected === true : true,
      detail: runtime?.redis ?? null,
    },
    {
      name: "pg_waiting",
      ok: Number(storage?.postgresPool?.waitingCount ?? 0) <= maxPgWaiting,
      detail: {
        observed: Number(storage?.postgresPool?.waitingCount ?? 0),
        threshold: maxPgWaiting,
      },
    },
    {
      name: "trace_failure_rate",
      ok: Number(telemetry?.recentWorkbookFailureRate ?? 0) <= maxFailureRate,
      detail: {
        observed: Number(telemetry?.recentWorkbookFailureRate ?? 0),
        threshold: maxFailureRate,
      },
    },
    {
      name: "trace_p95",
      ok: Number(telemetry?.recentDurationP95Ms ?? 0) <= maxP95Ms,
      detail: {
        observed: Number(telemetry?.recentDurationP95Ms ?? 0),
        threshold: maxP95Ms,
      },
    },
  ];

  const failed = checks.filter((entry) => entry.ok !== true);
  return {
    ok: failed.length === 0,
    checks,
    failedChecks: failed,
  };
};

const renderCommand = (template, context) =>
  template
    .replaceAll("{percent}", String(context.percent))
    .replaceAll("{previous_percent}", String(context.previousPercent));

const runShell = (command, context) => {
  if (!command) return { ok: true, skipped: true };
  const rendered = renderCommand(command, context);
  if (dryRun) {
    return {
      ok: true,
      skipped: true,
      dryRun: true,
      command: rendered,
    };
  }
  try {
    execSync(rendered, {
      stdio: "inherit",
      env: process.env,
    });
    return {
      ok: true,
      skipped: false,
      command: rendered,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      command: rendered,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const ensureReportDir = (filePath) => {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
};

const run = async () => {
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl,
    dryRun,
    settleSeconds,
    steps,
    thresholds: {
      maxFailureRate,
      maxP95Ms,
      maxPgWaiting,
    },
    stages: [],
    rollback: {
      attempted: false,
      result: null,
    },
    final: {
      ok: false,
      reachedPercent: 0,
      failedStage: null,
      reason: null,
    },
  };

  let previousPercent = 0;

  for (const percent of steps) {
    const stage = {
      percent,
      startedAt: new Date().toISOString(),
      trafficCommand: null,
      waitedSeconds: settleSeconds,
      gate: null,
      loadCheck: null,
      status: "pending",
    };

    stage.trafficCommand = runShell(trafficCommandTemplate, {
      percent,
      previousPercent,
    });

    if (!stage.trafficCommand.ok) {
      stage.status = "failed";
      report.stages.push(stage);
      report.final.ok = false;
      report.final.reachedPercent = previousPercent;
      report.final.failedStage = percent;
      report.final.reason = "traffic_command_failed";
      break;
    }

    if (settleSeconds > 0) {
      await sleep(settleSeconds * 1000);
    }

    const [health, infra] = await Promise.all([getJson("/healthz"), getJson("/api/runtime/infra")]);
    stage.gate = evaluateGate(health, infra);

    if (runLoadCheck) {
      stage.loadCheck = runShell(loadCheckCommand, {
        percent,
        previousPercent,
      });
      if (!stage.loadCheck.ok) {
        stage.status = "failed";
      }
    }

    if (stage.status !== "failed" && stage.gate.ok) {
      stage.status = "passed";
      previousPercent = percent;
      report.stages.push(stage);
      continue;
    }

    stage.status = "failed";
    report.stages.push(stage);
    report.final.ok = false;
    report.final.reachedPercent = previousPercent;
    report.final.failedStage = percent;
    report.final.reason = stage.gate.ok ? "load_check_failed" : "slo_gate_failed";
    break;
  }

  if (report.stages.length === steps.length && report.stages.every((stage) => stage.status === "passed")) {
    report.final.ok = true;
    report.final.reachedPercent = steps[steps.length - 1] ?? 0;
    report.final.failedStage = null;
    report.final.reason = null;
  }

  if (!report.final.ok) {
    report.rollback.attempted = true;
    report.rollback.result = runShell(rollbackCommandTemplate, {
      percent: previousPercent,
      previousPercent,
    });
  }

  report.finishedAt = new Date().toISOString();
  ensureReportDir(reportFile);
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  if (report.final.ok) {
    console.log(JSON.stringify({ ok: true, reportFile, summary: report.final }, null, 2));
    process.exit(0);
    return;
  }

  console.error(JSON.stringify({ ok: false, reportFile, summary: report.final }, null, 2));
  process.exit(2);
};

run().catch((error) => {
  ensureReportDir(reportFile);
  const failure = {
    ok: false,
    startedAt: new Date().toISOString(),
    baseUrl,
    reportFile,
    error: error instanceof Error ? error.message : String(error),
  };
  writeFileSync(reportFile, `${JSON.stringify(failure, null, 2)}\n`, "utf-8");
  console.error(JSON.stringify(failure, null, 2));
  process.exit(2);
});
