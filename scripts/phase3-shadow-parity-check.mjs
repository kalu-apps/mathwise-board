#!/usr/bin/env node

const readPositiveInt = (value, fallback, cap) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(cap, parsed);
};

const readRatio = (value, fallback) => {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(1, parsed);
};

const baseUrl = String(process.env.PHASE3_BASE_URL ?? "http://127.0.0.1:4173")
  .trim()
  .replace(/\/+$/, "");
const minCompared = readPositiveInt(process.env.PHASE3_MIN_COMPARED, 100, 100_000);
const maxMismatchRate = readRatio(process.env.PHASE3_MAX_MISMATCH_RATE, 0.01);
const maxErrorRate = readRatio(process.env.PHASE3_MAX_ERROR_RATE, 0.01);

const endpoint = `${baseUrl}/api/nest/shadow/parity`;

const fail = (message, payload) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        endpoint,
        message,
        payload,
      },
      null,
      2
    )
  );
  process.exit(1);
};

const run = async () => {
  let response;
  try {
    response = await fetch(endpoint, { method: "GET" });
  } catch (error) {
    fail("phase3_parity_fetch_failed", { error: error instanceof Error ? error.message : String(error) });
    return;
  }

  let json;
  try {
    json = await response.json();
  } catch (error) {
    fail("phase3_parity_invalid_json", { error: error instanceof Error ? error.message : String(error) });
    return;
  }

  if (!response.ok) {
    fail("phase3_parity_endpoint_not_ok", { status: response.status, body: json });
    return;
  }

  const totalCompared = Number(json?.totalCompared ?? 0);
  const mismatchRate = Number(json?.mismatchRate ?? 1);
  const errorRate = Number(json?.errorRate ?? 1);
  const enabled = Boolean(json?.enabled);

  if (!enabled) {
    fail("phase3_shadow_disabled", { expected: true, actual: enabled, diagnostics: json });
    return;
  }
  if (totalCompared < minCompared) {
    fail("phase3_not_enough_samples", { totalCompared, minCompared, diagnostics: json });
    return;
  }
  if (mismatchRate > maxMismatchRate) {
    fail("phase3_mismatch_rate_too_high", {
      mismatchRate,
      threshold: maxMismatchRate,
      diagnostics: json,
    });
    return;
  }
  if (errorRate > maxErrorRate) {
    fail("phase3_error_rate_too_high", {
      errorRate,
      threshold: maxErrorRate,
      diagnostics: json,
    });
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        endpoint,
        totalCompared,
        mismatchRate,
        errorRate,
        maxMismatchRate,
        maxErrorRate,
      },
      null,
      2
    )
  );
};

void run();
