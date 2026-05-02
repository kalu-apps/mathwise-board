#!/usr/bin/env node

const readPositiveInt = (value, fallback, cap) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(cap, parsed);
};

const readFloat = (value, fallback, min, max) => {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const baseUrl = String(process.env.PHASE6_BASE_URL ?? "http://127.0.0.1:4173")
  .trim()
  .replace(/\/+$/, "");
const timeoutMs = readPositiveInt(process.env.PHASE6_TIMEOUT_MS, 10_000, 120_000);
const maxFailureRate = readFloat(process.env.PHASE6_MAX_FAILURE_RATE, 0.1, 0, 1);
const maxP95Ms = readPositiveInt(process.env.PHASE6_MAX_P95_MS, 500, 60_000);
const maxPgWaiting = readPositiveInt(process.env.PHASE6_MAX_PG_WAITING, 10, 10_000);
const maxRedisTimeouts = readPositiveInt(process.env.PHASE6_MAX_REDIS_TIMEOUTS, 20, 100_000);
const maxRedisPublishFailures = readPositiveInt(
  process.env.PHASE6_MAX_REDIS_PUBLISH_FAILURES,
  5,
  100_000
);
const minAffinityBuckets = readPositiveInt(process.env.PHASE6_MIN_AFFINITY_BUCKETS, 32, 8192);

const withTimeout = async (task, timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
};

const getJson = async (path) => {
  const url = `${baseUrl}${path}`;
  const response = await withTimeout((signal) => fetch(url, { method: "GET", signal }), timeoutMs);
  const text = await response.text();
  let payload = null;
  try {
    payload = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return {
    ok: response.ok,
    status: response.status,
    url,
    payload,
  };
};

const run = async () => {
  const [health, infra] = await Promise.all([getJson("/healthz"), getJson("/api/runtime/infra")]);

  const checks = [];
  const pushCheck = (name, ok, detail) => {
    checks.push({ name, ok: Boolean(ok), detail });
  };

  pushCheck("health_endpoint", health.ok && health.status === 200, {
    status: health.status,
    url: health.url,
  });
  pushCheck("infra_endpoint", infra.ok && (infra.status === 200 || infra.status === 503), {
    status: infra.status,
    url: infra.url,
  });

  const readiness = infra.payload?.readiness ?? health.payload?.readiness ?? null;
  pushCheck("readiness", Boolean(readiness?.ready), readiness ?? null);

  const storage = infra.payload?.storage ?? health.payload?.storage ?? null;
  const storageOk = storage?.required
    ? storage?.driver === "postgres" && storage?.ready === true
    : storage?.ready === true;
  pushCheck("storage_driver", storageOk, storage ?? null);

  const runtime = infra.payload?.runtime ?? health.payload?.runtime ?? null;
  const redis = runtime?.redis ?? null;
  const redisConnected = redis?.required
    ? redis?.connected === true && redis?.pubsubConnected === true && redis?.reconnecting !== true
    : true;
  pushCheck("redis_connected", redisConnected, redis ?? null);
  pushCheck("redis_timeouts", Number(redis?.commandTimeouts ?? 0) <= maxRedisTimeouts, {
    observed: Number(redis?.commandTimeouts ?? 0),
    threshold: maxRedisTimeouts,
  });
  pushCheck("redis_publish_failures", Number(redis?.publishFailures ?? 0) <= maxRedisPublishFailures, {
    observed: Number(redis?.publishFailures ?? 0),
    threshold: maxRedisPublishFailures,
  });

  const pgWaiting = Number(storage?.postgresPool?.waitingCount ?? 0);
  pushCheck("pg_waiting_queue", pgWaiting <= maxPgWaiting, {
    observed: pgWaiting,
    threshold: maxPgWaiting,
  });

  const telemetry = infra.payload?.telemetry ?? health.payload?.telemetry ?? null;
  pushCheck("trace_failure_rate", Number(telemetry?.recentWorkbookFailureRate ?? 0) <= maxFailureRate, {
    observed: Number(telemetry?.recentWorkbookFailureRate ?? 0),
    threshold: maxFailureRate,
  });
  pushCheck("trace_p95", Number(telemetry?.recentDurationP95Ms ?? 0) <= maxP95Ms, {
    observed: Number(telemetry?.recentDurationP95Ms ?? 0),
    threshold: maxP95Ms,
  });

  const affinity = infra.payload?.affinity ?? health.payload?.affinity ?? null;
  pushCheck("affinity_buckets", Number(affinity?.buckets ?? 0) >= minAffinityBuckets, {
    observed: Number(affinity?.buckets ?? 0),
    threshold: minAffinityBuckets,
  });
  pushCheck("affinity_headers_present", Boolean(affinity?.headers?.affinity), affinity?.headers ?? null);

  const failed = checks.filter((entry) => entry.ok !== true);
  const report = {
    ok: failed.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    checks,
    healthStatus: {
      status: health.status,
      readiness: health.payload?.readiness?.ready ?? null,
    },
    infraStatus: {
      status: infra.status,
      readiness: infra.payload?.readiness?.ready ?? null,
    },
  };

  if (failed.length === 0) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
    return;
  }

  console.error(JSON.stringify(report, null, 2));
  process.exit(2);
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        checkedAt: new Date().toISOString(),
        baseUrl,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(2);
});
