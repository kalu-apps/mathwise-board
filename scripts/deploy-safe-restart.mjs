#!/usr/bin/env node

import { execSync } from "node:child_process";

const readPositiveInt = (value, fallback, cap) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, cap);
};

const readBool = (value, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const timeoutMs = readPositiveInt(process.env.DEPLOY_WAIT_TIMEOUT_MS, 240_000, 900_000);
const pollIntervalMs = readPositiveInt(process.env.DEPLOY_POLL_INTERVAL_MS, 2_500, 60_000);
const baseUrl = String(process.env.DEPLOY_API_BASE_URL ?? "https://api.board.mathwise.ru")
  .trim()
  .replace(/\/+$/g, "");
const restartCommand = String(process.env.DEPLOY_RESTART_CMD ?? "systemctl restart mathwise-board").trim();
const maintenanceOnCommand = String(process.env.DEPLOY_MAINTENANCE_ON_CMD ?? "npm run maintenance:on").trim();
const maintenanceOffCommand = String(
  process.env.DEPLOY_MAINTENANCE_OFF_CMD ?? "npm run maintenance:off"
).trim();
const skipMaintenance = readBool(process.env.DEPLOY_SKIP_MAINTENANCE, false);
const dryRun = readBool(process.env.DEPLOY_DRY_RUN, false);
const postCheckCommand = String(process.env.DEPLOY_POST_CHECK_CMD ?? "").trim();

const runShell = (label, command) => {
  if (!command) return;
  if (dryRun) {
    console.log(`[dry-run] ${label}: ${command}`);
    return;
  }
  execSync(command, {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
};

const getJson = async (path) => {
  const url = `${baseUrl}${path}`;
  try {
    const response = await withTimeout((signal) => fetch(url, { method: "GET", signal }), 8_000);
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
      error: null,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const checkReadiness = async () => {
  const [health, infra] = await Promise.all([getJson("/healthz"), getJson("/api/runtime/infra")]);
  const healthReady =
    health.status === 200 &&
    health.payload?.readiness?.ready !== false &&
    health.payload?.readiness?.shuttingDown !== true;
  const infraReady = infra.status === 200 && infra.payload?.readiness?.ready === true;
  return {
    ready: healthReady && infraReady,
    health,
    infra,
  };
};

const run = async () => {
  const startedAt = Date.now();
  let maintenanceEnabled = false;

  try {
    if (!skipMaintenance) {
      runShell("maintenance:on", maintenanceOnCommand);
      maintenanceEnabled = true;
    }

    runShell("restart", restartCommand);

    if (dryRun) {
      if (postCheckCommand) {
        runShell("post-check", postCheckCommand);
      }
      if (maintenanceEnabled && !skipMaintenance) {
        runShell("maintenance:off", maintenanceOffCommand);
      }
      console.log(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            baseUrl,
            timeoutMs,
            pollIntervalMs,
            readinessCheckSkipped: true,
          },
          null,
          2
        )
      );
      process.exit(0);
      return;
    }

    let readiness = null;
    while (Date.now() - startedAt <= timeoutMs) {
      readiness = await checkReadiness();
      if (readiness.ready) break;
      await sleep(pollIntervalMs);
    }

    if (!readiness?.ready) {
      throw new Error("deploy_timeout_waiting_for_readiness");
    }

    if (postCheckCommand) {
      runShell("post-check", postCheckCommand);
    }

    if (maintenanceEnabled && !skipMaintenance) {
      runShell("maintenance:off", maintenanceOffCommand);
      maintenanceEnabled = false;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          waitMs: Date.now() - startedAt,
          timeoutMs,
          pollIntervalMs,
          dryRun,
        },
        null,
        2
      )
    );
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: message,
          baseUrl,
          waitMs: Date.now() - startedAt,
          timeoutMs,
          pollIntervalMs,
          dryRun,
          maintenanceStillEnabled: maintenanceEnabled,
        },
        null,
        2
      )
    );
    process.exit(2);
  }
};

run();
