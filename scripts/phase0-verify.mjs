#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();

const REQUIRED_FILES = [
  {
    file: "docs/phase-0-foundation.md",
    requiredPatterns: [/^# Phase 0:/m, /^## Scope фазы/m, /^## Definition of Done/m],
  },
  {
    file: "docs/phase-0-kpi-gates.md",
    requiredPatterns: [/^# Phase 0 KPI Matrix/m, /^## KPI Matrix/m, /^## Phase Gates/m],
  },
  {
    file: "docs/feature-flags-rollout.md",
    requiredPatterns: [/^# Feature Flags Registry/m, /^## Реестр флагов/m, /^## Rollout Strategy/m],
  },
  {
    file: "docs/adr/ADR-001-zustand-nest-target-architecture.md",
    requiredPatterns: [/^# ADR-001:/m, /^## Решение/m, /^## Стратегия миграции/m],
  },
  {
    file: ".github/workflows/quality-gates.yml",
    requiredPatterns: [/name:\s*Quality Gates/m, /npm run phase0:verify/m],
  },
];

const REQUIRED_PACKAGE_SCRIPTS = [
  "phase0:verify",
  "phase0:baseline",
  "phase0:check",
];

const readFileSafe = (absolutePath) => {
  try {
    return fs.readFileSync(absolutePath, "utf-8");
  } catch {
    return null;
  }
};

const checks = [];

for (const entry of REQUIRED_FILES) {
  const absolutePath = path.resolve(WORKSPACE_ROOT, entry.file);
  const content = readFileSafe(absolutePath);
  if (content === null) {
    checks.push({
      check: `file:${entry.file}`,
      ok: false,
      reason: "missing_file",
    });
    continue;
  }
  checks.push({
    check: `file:${entry.file}`,
    ok: true,
  });
  for (const pattern of entry.requiredPatterns) {
    checks.push({
      check: `pattern:${entry.file}:${String(pattern)}`,
      ok: pattern.test(content),
    });
  }
}

const packageJsonPath = path.resolve(WORKSPACE_ROOT, "package.json");
const packageRaw = readFileSafe(packageJsonPath);
if (packageRaw === null) {
  checks.push({
    check: "package.json",
    ok: false,
    reason: "missing_file",
  });
} else {
  let packageJson = null;
  try {
    packageJson = JSON.parse(packageRaw);
  } catch {
    packageJson = null;
  }
  if (!packageJson || typeof packageJson !== "object") {
    checks.push({
      check: "package.json.parse",
      ok: false,
      reason: "invalid_json",
    });
  } else {
    checks.push({
      check: "package.json.parse",
      ok: true,
    });
    const scripts = packageJson.scripts && typeof packageJson.scripts === "object"
      ? packageJson.scripts
      : {};
    for (const scriptName of REQUIRED_PACKAGE_SCRIPTS) {
      checks.push({
        check: `package.script:${scriptName}`,
        ok: typeof scripts[scriptName] === "string" && scripts[scriptName].trim().length > 0,
      });
    }
  }
}

const failed = checks.filter((entry) => entry.ok !== true);
const result = {
  ok: failed.length === 0,
  checks,
  failedCount: failed.length,
  checkedAt: new Date().toISOString(),
};

if (result.ok) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.error(JSON.stringify(result, null, 2));
process.exit(1);

