#!/usr/bin/env node

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

const baseUrl = String(process.env.PHASE6_BASE_URL ?? "http://127.0.0.1:4173")
  .trim()
  .replace(/\/+$/, "");
const loginEmail = String(process.env.PHASE6_LOGIN_EMAIL ?? "teacher@axiom.demo").trim();
const loginPassword = String(process.env.PHASE6_LOGIN_PASSWORD ?? "magic");
const concurrency = readPositiveInt(process.env.PHASE6_LOAD_CONCURRENCY, 8, 200);
const iterationsPerWorker = readPositiveInt(process.env.PHASE6_LOAD_ITERATIONS, 30, 2000);
const timeoutMs = readPositiveInt(process.env.PHASE6_TIMEOUT_MS, 10_000, 120_000);
const maxErrorRate = readFloat(process.env.PHASE6_LOAD_MAX_ERROR_RATE, 0.03, 0, 1);
const maxP95Ms = readPositiveInt(process.env.PHASE6_LOAD_MAX_P95_MS, 450, 60_000);

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const percentile = (values, ratio) => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return Math.round(sorted[index]);
};

const withTimeout = async (task) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
};

const requestJson = async (path, options = {}) => {
  const response = await withTimeout((signal) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      signal,
    })
  );
  const text = await response.text();
  let payload = null;
  try {
    payload = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    payload,
  };
};

const cookieHeaderFromResponse = (response) => {
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length === 0) return "";
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
};

const createObjectEvent = (objectId, workerIndex, iteration) => ({
  clientEventId: `phase6-${workerIndex}-${iteration}-${objectId}`,
  type: "board.object.create",
  payload: {
    object: {
      id: objectId,
      type: "shape",
      shapeType: "rect",
      x: 50 + (iteration % 25) * 5,
      y: 40 + (workerIndex % 25) * 5,
      width: 72,
      height: 42,
      page: 1,
      layer: "board",
      color: "#1f6feb",
      strokeWidth: 2,
      authorUserId: "phase6-load-check",
      createdAt: new Date().toISOString(),
    },
    expectedVersion: 0,
  },
});

const run = async () => {
  const loginResponse = await requestJson("/api/auth/password/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      email: loginEmail,
      password: loginPassword,
    }),
  });

  if (loginResponse.status !== 200) {
    throw new Error(`phase6_login_failed:${loginResponse.status}`);
  }
  const cookie = cookieHeaderFromResponse(loginResponse);
  if (!cookie) {
    throw new Error("phase6_cookie_not_set");
  }

  const createSessionResponse = await requestJson("/api/workbook/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Cookie: cookie,
    },
    body: JSON.stringify({
      kind: "CLASS",
      title: "Phase6 load check",
    }),
  });
  if (createSessionResponse.status !== 200) {
    throw new Error(`phase6_create_session_failed:${createSessionResponse.status}`);
  }

  const sessionId = createSessionResponse.payload?.session?.id;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("phase6_session_id_missing");
  }

  const openResponse = await requestJson(`/api/workbook/sessions/${encodeURIComponent(sessionId)}/open`, {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
  });
  if (openResponse.status !== 200) {
    throw new Error(`phase6_open_session_failed:${openResponse.status}`);
  }

  const durations = [];
  let total = 0;
  let failed = 0;

  const workerTask = async (workerIndex) => {
    for (let iteration = 0; iteration < iterationsPerWorker; iteration += 1) {
      const objectId = `phase6-object-${workerIndex}-${iteration}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const startedAt = nowMs();
      const response = await requestJson(`/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Cookie: cookie,
          "X-Idempotency-Key": `phase6-${workerIndex}-${iteration}`,
        },
        body: JSON.stringify({
          events: [createObjectEvent(objectId, workerIndex, iteration)],
        }),
      });
      const durationMs = nowMs() - startedAt;
      durations.push(durationMs);
      total += 1;
      if (response.status !== 200) {
        failed += 1;
      }

      if (iteration % 8 === 0) {
        await requestJson(`/api/workbook/sessions/${encodeURIComponent(sessionId)}/presence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Cookie: cookie,
          },
          body: JSON.stringify({
            state: "active",
            tabId: `phase6-${workerIndex}`,
          }),
        }).catch(() => undefined);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, (_entry, index) => workerTask(index)));

  const infraResponse = await requestJson("/api/runtime/infra", {
    method: "GET",
  });

  const p50 = percentile(durations, 0.5);
  const p95 = percentile(durations, 0.95);
  const p99 = percentile(durations, 0.99);
  const averageMs = durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
  const errorRate = total > 0 ? failed / total : 1;

  const checks = [
    {
      name: "request_error_rate",
      ok: errorRate <= maxErrorRate,
      detail: {
        observed: Number(errorRate.toFixed(4)),
        threshold: maxErrorRate,
        failed,
        total,
      },
    },
    {
      name: "request_p95",
      ok: Number(p95 ?? Number.MAX_SAFE_INTEGER) <= maxP95Ms,
      detail: {
        observed: p95,
        threshold: maxP95Ms,
      },
    },
    {
      name: "infra_endpoint",
      ok: infraResponse.status === 200 || infraResponse.status === 503,
      detail: {
        status: infraResponse.status,
      },
    },
    {
      name: "infra_readiness",
      ok: Boolean(infraResponse.payload?.readiness?.ready),
      detail: infraResponse.payload?.readiness ?? null,
    },
    {
      name: "redis_runtime",
      ok:
        infraResponse.payload?.runtime?.redis?.required === true
          ? infraResponse.payload?.runtime?.redis?.connected === true
          : true,
      detail: infraResponse.payload?.runtime?.redis ?? null,
    },
  ];

  const failedChecks = checks.filter((entry) => entry.ok !== true);
  const report = {
    ok: failedChecks.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    sessionId,
    loadProfile: {
      concurrency,
      iterationsPerWorker,
      requests: total,
    },
    latency: {
      averageMs,
      p50,
      p95,
      p99,
    },
    errors: {
      failed,
      errorRate: Number(errorRate.toFixed(4)),
    },
    checks,
  };

  if (failedChecks.length === 0) {
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
