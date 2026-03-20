#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  node scripts/maintenance-mode.mjs status",
      "  node scripts/maintenance-mode.mjs on",
      "  node scripts/maintenance-mode.mjs off",
      "",
      "Env overrides:",
      "  MAINTENANCE_FLAG_FILE (default: /opt/mathwise/board/MAINTENANCE_MODE)",
      "  MAINTENANCE_RELOAD_CMD (default: systemctl reload nginx)",
      "  MAINTENANCE_DRY_RUN=1 (do not mutate filesystem, print actions only)",
    ].join("\n")
  );
};

const action = String(process.argv[2] ?? "status").trim().toLowerCase();
const flagFile =
  String(process.env.MAINTENANCE_FLAG_FILE ?? "").trim() ||
  "/opt/mathwise/board/MAINTENANCE_MODE";
const reloadCmd =
  String(process.env.MAINTENANCE_RELOAD_CMD ?? "").trim() || "systemctl reload nginx";
const dryRun = ["1", "true", "yes", "on"].includes(
  String(process.env.MAINTENANCE_DRY_RUN ?? "").trim().toLowerCase()
);

const isEnabled = () => {
  try {
    readFileSync(flagFile, "utf8");
    return true;
  } catch {
    return false;
  }
};

const reloadNginx = () => {
  if (!reloadCmd) return;
  if (dryRun) {
    console.log(`[dry-run] would execute: ${reloadCmd}`);
    return;
  }
  execSync(reloadCmd, {
    stdio: "inherit",
    env: process.env,
  });
};

const writeFlag = () => {
  const payload = [
    `enabled_at=${new Date().toISOString()}`,
    `enabled_by=${process.env.USER ?? "unknown"}`,
    `cwd=${process.cwd()}`,
    "",
  ].join("\n");
  if (dryRun) {
    console.log(`[dry-run] would create file: ${flagFile}`);
    console.log(payload.trimEnd());
    return;
  }
  writeFileSync(flagFile, payload, "utf8");
};

const removeFlag = () => {
  if (dryRun) {
    console.log(`[dry-run] would remove file: ${flagFile}`);
    return;
  }
  unlinkSync(flagFile);
};

if (!["status", "on", "off"].includes(action)) {
  usage();
  process.exit(1);
}

try {
  const enabledBefore = isEnabled();

  if (action === "status") {
    console.log(
      JSON.stringify(
        {
          maintenanceEnabled: enabledBefore,
          flagFile,
          reloadCommand: reloadCmd || null,
          flagDir: dirname(flagFile),
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  if (action === "on" && !enabledBefore) {
    writeFlag();
    reloadNginx();
  }

  if (action === "off" && enabledBefore) {
    removeFlag();
    reloadNginx();
  }

  const enabledAfter = action === "on" ? true : action === "off" ? false : isEnabled();
  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        maintenanceEnabled: enabledAfter,
        changed: enabledBefore !== enabledAfter,
        dryRun,
        flagFile,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        action,
        flagFile,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
}
