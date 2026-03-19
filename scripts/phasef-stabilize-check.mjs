#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

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

const readBool = (value, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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
    url,
    status: Number.isFinite(status) ? status : 0,
    ok: status >= 200 && status < 300,
    payload,
    transport: "curl",
  };
};

const baseUrl = String(process.env.PHASEF_BASE_URL ?? "https://api.board.mathwise.ru")
  .trim()
  .replace(/\/+$/, "");
const timeoutMs = readPositiveInt(process.env.PHASEF_TIMEOUT_MS, 10_000, 120_000);
const durationSeconds = readPositiveInt(process.env.PHASEF_DURATION_SECONDS, 60, 3_600);
const intervalSeconds = readPositiveInt(process.env.PHASEF_INTERVAL_SECONDS, 5, 300);

const maxFailureRate = readFloat(process.env.PHASEF_MAX_FAILURE_RATE, 0.1, 0, 1);
const maxP95Ms = readPositiveInt(process.env.PHASEF_MAX_P95_MS, 500, 120_000);
const maxP99Ms = readPositiveInt(process.env.PHASEF_MAX_P99_MS, 1_000, 120_000);
const maxPgWaiting = readPositiveInt(process.env.PHASEF_MAX_PG_WAITING, 10, 10_000);
const expectedProxyMode = String(process.env.PHASEF_EXPECTED_PROXY_MODE ?? "none").trim() || "none";
const expectedWriteMode =
  String(process.env.PHASEF_EXPECTED_WRITE_MODE ?? "nest-native-api").trim() || "nest-native-api";
const proxyDiagnosticsRequired = readBool(process.env.PHASEF_PROXY_DIAG_REQUIRED, false);
const maxObjectConflictDelta = readPositiveInt(process.env.PHASEF_MAX_OBJECT_CONFLICT_DELTA, 0, 1_000_000);
const maxIdempotencyConflictDelta = readPositiveInt(
  process.env.PHASEF_MAX_IDEMPOTENCY_CONFLICT_DELTA,
  0,
  1_000_000
);

const outputFile =
  String(process.env.PHASEF_REPORT_FILE ?? "").trim() ||
  path.join(
    "output",
    `phasef-stabilization-report-${new Date().toISOString().replace(/[.:]/g, "-")}.json`
  );

const ensureOutputDir = (filePath) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
};

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
      url,
      status: response.status,
      ok: response.ok,
      payload,
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

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const aggregateNumbers = (values) => {
  if (values.length === 0) {
    return { min: null, max: null, avg: null };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { min, max, avg: Number(avg.toFixed(3)) };
};

const run = async () => {
  const startedAt = new Date().toISOString();
  const sampleCount = Math.max(1, Math.floor(durationSeconds / intervalSeconds));
  const samples = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const [infra, writeDiag, proxyDiag] = await Promise.all([
      getJson("/api/runtime/infra"),
      getJson("/api/nest/write/diagnostics"),
      getJson("/api/nest/proxy/diagnostics"),
    ]);

    const telemetry = infra.payload?.telemetry ?? {};
    const runtime = infra.payload?.runtime ?? {};
    const storage = infra.payload?.storage ?? {};
    const sample = {
      at: new Date().toISOString(),
      infraStatus: infra.status,
      writeStatus: writeDiag.status,
      proxyStatus: proxyDiag.status,
      readinessReady: Boolean(infra.payload?.readiness?.ready),
      redisRequired: runtime?.redis?.required === true,
      redisConnected: runtime?.redis?.connected === true,
      pgWaitingCount: toNumber(storage?.postgresPool?.waitingCount, 0),
      failureRate: toNumber(telemetry?.recentWorkbookFailureRate, 0),
      p95Ms: toNumber(telemetry?.recentDurationP95Ms, 0),
      p99Ms: toNumber(telemetry?.recentDurationP99Ms, 0),
      writeMode: String(writeDiag.payload?.mode ?? ""),
      proxyMode: String(proxyDiag.payload?.proxyMode ?? ""),
      objectConflicts: toNumber(writeDiag.payload?.objectVersions?.conflicts, 0),
      idempotencyConflicts: toNumber(writeDiag.payload?.idempotency?.conflicts, 0),
    };
    samples.push(sample);

    if (index < sampleCount - 1) {
      await sleep(intervalSeconds * 1000);
    }
  }

  const pgWaiting = samples.map((sample) => sample.pgWaitingCount);
  const failureRates = samples.map((sample) => sample.failureRate);
  const p95Values = samples.map((sample) => sample.p95Ms);
  const p99Values = samples.map((sample) => sample.p99Ms);

  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const objectConflictDelta = Math.max(
    0,
    toNumber(lastSample?.objectConflicts, 0) - toNumber(firstSample?.objectConflicts, 0)
  );
  const idempotencyConflictDelta = Math.max(
    0,
    toNumber(lastSample?.idempotencyConflicts, 0) -
      toNumber(firstSample?.idempotencyConflicts, 0)
  );

  const checks = [
    {
      name: "infra_endpoint_ok",
      ok: samples.every((sample) => sample.infraStatus === 200),
      detail: { expected: 200, observed: samples.map((sample) => sample.infraStatus) },
    },
    {
      name: "write_diag_endpoint_ok",
      ok: samples.every((sample) => sample.writeStatus === 200),
      detail: { expected: 200, observed: samples.map((sample) => sample.writeStatus) },
    },
    {
      name: "proxy_diag_endpoint_ok",
      ok: proxyDiagnosticsRequired
        ? samples.every((sample) => sample.proxyStatus === 200)
        : samples.every((sample) => sample.proxyStatus === 200 || sample.proxyStatus === 404),
      detail: {
        expected: proxyDiagnosticsRequired ? [200] : [200, 404],
        observed: samples.map((sample) => sample.proxyStatus),
      },
    },
    {
      name: "readiness_always_true",
      ok: samples.every((sample) => sample.readinessReady),
      detail: { violations: samples.filter((sample) => !sample.readinessReady).length },
    },
    {
      name: "redis_always_connected",
      ok: samples.every((sample) => !sample.redisRequired || sample.redisConnected),
      detail: {
        requiredSamples: samples.filter((sample) => sample.redisRequired).length,
        violations: samples.filter((sample) => sample.redisRequired && !sample.redisConnected).length,
      },
    },
    {
      name: "pg_waiting_budget",
      ok: pgWaiting.every((value) => value <= maxPgWaiting),
      detail: { threshold: maxPgWaiting, stats: aggregateNumbers(pgWaiting) },
    },
    {
      name: "failure_rate_budget",
      ok: failureRates.every((value) => value <= maxFailureRate),
      detail: { threshold: maxFailureRate, stats: aggregateNumbers(failureRates) },
    },
    {
      name: "p95_budget",
      ok: p95Values.every((value) => value <= maxP95Ms),
      detail: { threshold: maxP95Ms, stats: aggregateNumbers(p95Values) },
    },
    {
      name: "p99_budget",
      ok: p99Values.every((value) => value <= maxP99Ms),
      detail: { threshold: maxP99Ms, stats: aggregateNumbers(p99Values) },
    },
    {
      name: "proxy_mode_fixed",
      ok: proxyDiagnosticsRequired
        ? samples.every((sample) => sample.proxyMode === expectedProxyMode)
        : true,
      detail: {
        expected: proxyDiagnosticsRequired ? expectedProxyMode : "skipped_optional_proxy_diagnostics",
        observed: Array.from(new Set(samples.map((s) => s.proxyMode))),
      },
    },
    {
      name: "write_mode_fixed",
      ok: samples.every((sample) => sample.writeMode === expectedWriteMode),
      detail: { expected: expectedWriteMode, observed: Array.from(new Set(samples.map((s) => s.writeMode))) },
    },
    {
      name: "object_conflict_delta_budget",
      ok: objectConflictDelta <= maxObjectConflictDelta,
      detail: { threshold: maxObjectConflictDelta, observed: objectConflictDelta },
    },
    {
      name: "idempotency_conflict_delta_budget",
      ok: idempotencyConflictDelta <= maxIdempotencyConflictDelta,
      detail: { threshold: maxIdempotencyConflictDelta, observed: idempotencyConflictDelta },
    },
  ];

  const failedChecks = checks.filter((check) => !check.ok);
  const report = {
    ok: failedChecks.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    config: {
      durationSeconds,
      intervalSeconds,
      timeoutMs,
      expectedProxyMode,
      proxyDiagnosticsRequired,
      expectedWriteMode,
      maxFailureRate,
      maxP95Ms,
      maxP99Ms,
      maxPgWaiting,
      maxObjectConflictDelta,
      maxIdempotencyConflictDelta,
    },
    sampleCount: samples.length,
    checks,
    failedChecks,
    aggregates: {
      pgWaiting: aggregateNumbers(pgWaiting),
      failureRate: aggregateNumbers(failureRates),
      p95Ms: aggregateNumbers(p95Values),
      p99Ms: aggregateNumbers(p99Values),
      objectConflictDelta,
      idempotencyConflictDelta,
    },
    samples,
    reportFile: outputFile,
  };

  ensureOutputDir(outputFile);
  writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  if (report.ok) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
    return;
  }
  console.error(JSON.stringify(report, null, 2));
  process.exit(2);
};

run().catch((error) => {
  const report = {
    ok: false,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    baseUrl,
    error: error instanceof Error ? error.message : String(error),
    reportFile: outputFile,
  };
  ensureOutputDir(outputFile);
  writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  console.error(JSON.stringify(report, null, 2));
  process.exit(2);
});
