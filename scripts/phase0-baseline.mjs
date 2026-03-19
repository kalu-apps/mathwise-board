#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const WORKSPACE_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(WORKSPACE_ROOT, "output");
const DIST_ASSETS_DIR = path.resolve(WORKSPACE_ROOT, "dist", "assets");

const HOTSPOT_FILES = [
  "src/pages/workbook/WorkbookSessionPage.tsx",
  "src/features/workbook/ui/WorkbookCanvas.tsx",
  "src/mock/server.ts",
  "src/mock/db.ts",
  "backend/src/nest/main.ts",
];

const parseArgs = (argv) => {
  const options = {
    baseUrl: process.env.PHASE0_BASE_URL ? String(process.env.PHASE0_BASE_URL).trim() : "",
    timeoutMs: 10_000,
    outputPath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if ((arg === "--base-url" || arg === "-u") && argv[index + 1]) {
      options.baseUrl = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms" && argv[index + 1]) {
      const parsed = Number.parseInt(String(argv[index + 1]).trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.timeoutMs = parsed;
      }
      index += 1;
      continue;
    }
    if ((arg === "--output" || arg === "-o") && argv[index + 1]) {
      options.outputPath = String(argv[index + 1]).trim();
      index += 1;
    }
  }
  return options;
};

const safeExec = (command) => {
  try {
    return execSync(command, {
      cwd: WORKSPACE_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const countLines = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    if (raw.length === 0) return 0;
    return raw.split(/\r?\n/).length;
  } catch {
    return null;
  }
};

const toKb = (bytes) => Number((bytes / 1024).toFixed(2));

const readDistAssets = () => {
  if (!fs.existsSync(DIST_ASSETS_DIR)) {
    return {
      found: false,
      totalFiles: 0,
      totalBytes: 0,
      topAssets: [],
      workbookSessionPageJs: [],
      indexJs: [],
    };
  }

  const files = fs
    .readdirSync(DIST_ASSETS_DIR)
    .filter((entry) => entry.endsWith(".js") || entry.endsWith(".css"))
    .map((entry) => {
      const fullPath = path.resolve(DIST_ASSETS_DIR, entry);
      const stats = fs.statSync(fullPath);
      return {
        file: `dist/assets/${entry}`,
        sizeBytes: stats.size,
        sizeKb: toKb(stats.size),
      };
    })
    .sort((left, right) => right.sizeBytes - left.sizeBytes);

  const workbookSessionPageJs = files.filter(
    (entry) =>
      entry.file.includes("/WorkbookSessionPage-") &&
      entry.file.endsWith(".js")
  );
  const indexJs = files.filter(
    (entry) =>
      /\/index-[^/]+\.js$/.test(entry.file) &&
      !entry.file.includes("/index.es-") &&
      !entry.file.includes("/index-legacy-")
  );

  return {
    found: true,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, entry) => sum + entry.sizeBytes, 0),
    topAssets: files.slice(0, 15),
    workbookSessionPageJs,
    indexJs,
  };
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

const loadRuntimeHealth = async (baseUrl, timeoutMs) => {
  if (!baseUrl) {
    return {
      enabled: false,
      reason: "PHASE0_BASE_URL is not configured",
    };
  }
  const normalizedBase = baseUrl.replace(/\/+$/g, "");
  const healthUrl = `${normalizedBase}/healthz`;
  try {
    const result = await withTimeout(async (signal) => {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal,
      });
      const text = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
      return {
        ok: response.ok,
        status: response.status,
        payload,
      };
    }, timeoutMs);

    return {
      enabled: true,
      url: healthUrl,
      ok: result.ok,
      status: result.status,
      readiness: result.payload?.readiness ?? null,
      telemetry: result.payload?.telemetry ?? null,
    };
  } catch (error) {
    return {
      enabled: true,
      url: healthUrl,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString();
  const gitCommit = safeExec("git rev-parse --short HEAD");
  const gitBranch = safeExec("git rev-parse --abbrev-ref HEAD");

  const hotspots = HOTSPOT_FILES.map((relativePath) => {
    const absolutePath = path.resolve(WORKSPACE_ROOT, relativePath);
    return {
      file: relativePath,
      lines: countLines(absolutePath),
    };
  });

  const distAssets = readDistAssets();
  const runtimeHealth = await loadRuntimeHealth(options.baseUrl, options.timeoutMs);

  const report = {
    phase: "phase0",
    generatedAt: timestamp,
    workspace: WORKSPACE_ROOT,
    git: {
      commit: gitCommit,
      branch: gitBranch,
    },
    hotspots,
    distAssets,
    runtimeHealth,
  };

  const safeIso = timestamp.replace(/[:.]/g, "-");
  const outputPath = options.outputPath
    ? path.resolve(WORKSPACE_ROOT, options.outputPath)
    : path.resolve(OUTPUT_DIR, `phase0-baseline-${safeIso}.json`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportPath: path.relative(WORKSPACE_ROOT, outputPath),
        generatedAt: timestamp,
        runtimeHealthEnabled: Boolean(runtimeHealth.enabled),
      },
      null,
      2
    )
  );
};

void run().catch((error) => {
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
  process.exit(1);
});
