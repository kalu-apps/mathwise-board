#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://api.board.mathwise.ru";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_SLOW_TRACE_COUNT = 30;

const parseArgs = (argv) => {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxSlowTraceCount: DEFAULT_MAX_SLOW_TRACE_COUNT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if ((arg === "--base-url" || arg === "-u") && argv[index + 1]) {
      options.baseUrl = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms" && argv[index + 1]) {
      options.timeoutMs = Math.max(1000, Number.parseInt(argv[index + 1], 10) || DEFAULT_TIMEOUT_MS);
      index += 1;
      continue;
    }
    if (arg === "--max-slow-traces" && argv[index + 1]) {
      options.maxSlowTraceCount = Math.max(
        1,
        Number.parseInt(argv[index + 1], 10) || DEFAULT_MAX_SLOW_TRACE_COUNT
      );
      index += 1;
    }
  }

  return options;
};

const withTimeout = async (task, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
};

const loadHealth = async (baseUrl, timeoutMs) => {
  const url = `${baseUrl.replace(/\/+$/g, "")}/healthz`;
  return withTimeout(async (signal) => {
    const response = await fetch(url, { method: "GET", signal });
    const bodyText = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = { raw: bodyText };
    }
    return {
      url,
      ok: response.ok,
      status: response.status,
      payload,
    };
  }, timeoutMs);
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  const checks = [];
  let exitCode = 0;

  try {
    const health = await loadHealth(options.baseUrl, options.timeoutMs);
    checks.push({
      name: "health_status",
      ok: health.ok && health.status === 200,
      detail: {
        status: health.status,
        url: health.url,
      },
    });

    const readiness = health.payload?.readiness;
    checks.push({
      name: "workbook_readiness",
      ok: Boolean(readiness?.ready),
      detail: readiness ?? null,
    });

    const runtime = readiness?.runtime ?? health.payload?.runtime ?? null;
    checks.push({
      name: "redis_runtime",
      ok: runtime?.redis?.required ? Boolean(runtime.redis.connected) : true,
      detail: runtime?.redis ?? null,
    });

    const storage = readiness?.storage ?? health.payload?.storage ?? null;
    const storageOk = storage?.required
      ? storage.driver === "postgres" && storage.ready
      : Boolean(storage?.ready);
    checks.push({
      name: "storage_driver",
      ok: storageOk,
      detail: storage ?? null,
    });

    const telemetry = health.payload?.telemetry ?? null;
    const slowTraceCount = Number(telemetry?.recentSlowWorkbookTraceCount ?? 0);
    checks.push({
      name: "slow_workbook_traces",
      ok: slowTraceCount <= options.maxSlowTraceCount,
      detail: {
        recentSlowWorkbookTraceCount: slowTraceCount,
        threshold: options.maxSlowTraceCount,
      },
    });

    const failed = ensureArray(checks).filter((entry) => entry.ok !== true);
    if (failed.length > 0) {
      exitCode = 2;
    }

    const report = {
      ok: exitCode === 0,
      checkedAt: new Date().toISOString(),
      baseUrl: options.baseUrl,
      checks,
    };

    if (exitCode === 0) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.error(JSON.stringify(report, null, 2));
    }
  } catch (error) {
    exitCode = 2;
    console.error(
      JSON.stringify(
        {
          ok: false,
          checkedAt: new Date().toISOString(),
          baseUrl: options.baseUrl,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
  }

  process.exit(exitCode);
};

void run();
