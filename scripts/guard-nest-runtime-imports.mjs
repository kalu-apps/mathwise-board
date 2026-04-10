#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NEST_ROOT = path.resolve(ROOT, "backend/src/nest");

const toPosix = (value) => value.split(path.sep).join("/");

const ALLOWED_RUNTIME_CORE_IMPORTERS = new Set([
  "backend/src/nest/main.ts",
  "backend/src/nest/health/health.controller.ts",
  "backend/src/nest/write/write-diagnostics.controller.ts",
  "backend/src/nest/runtime/workbook-runtime-engine.ts",
]);
const FORBIDDEN_ENGINE_BRIDGE_IMPORTERS_PREFIXES = [
  "backend/src/nest/runtime/http/",
  "backend/src/nest/runtime/live/",
];
const ALLOWED_ENGINE_BRIDGE_IMPORTERS = new Set();

const SOURCE_FILES = [];
const EXTRA_GUARD_FILES = [
  "src/features/auth/model/AuthProvider.tsx",
  "vite.config.ts",
];

const walk = (dirPath) => {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    SOURCE_FILES.push(fullPath);
  }
};

walk(NEST_ROOT);

const violations = [];

for (const fullPath of SOURCE_FILES) {
  const relativePath = toPosix(path.relative(ROOT, fullPath));
  const source = fs.readFileSync(fullPath, "utf8");
  if (source.includes("src/mock/")) {
    violations.push(
      `${relativePath}: forbidden import path contains "src/mock/" (legacy path is prohibited)`
    );
  }

  if (source.includes("runtime/mock-runtime/")) {
    violations.push(
      `${relativePath}: forbidden import path contains "runtime/mock-runtime/" (transition layer is prohibited)`
    );
  }

  if (source.includes("runtime/core/")) {
    if (!ALLOWED_RUNTIME_CORE_IMPORTERS.has(relativePath)) {
      violations.push(
        `${relativePath}: import from "runtime/core/*" is not in allowlist`
      );
    }
  }

  if (
    FORBIDDEN_ENGINE_BRIDGE_IMPORTERS_PREFIXES.some((prefix) =>
      relativePath.startsWith(prefix)
    ) &&
    !ALLOWED_ENGINE_BRIDGE_IMPORTERS.has(relativePath) &&
    source.includes("workbook-runtime-engine")
  ) {
    violations.push(
      `${relativePath}: bridge import from "workbook-runtime-engine" is forbidden in http/live modules`
    );
  }

  if (source.includes("workbook-runtime-api-adapters")) {
    violations.push(
      `${relativePath}: import from "workbook-runtime-api-adapters" is forbidden in Nest runtime`
    );
  }

}

if (violations.length > 0) {
  console.error("[guard:nest-runtime] violations:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

for (const relativePath of EXTRA_GUARD_FILES) {
  const fullPath = path.resolve(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) continue;
  const source = fs.readFileSync(fullPath, "utf8");
  if (
    relativePath === "src/features/auth/model/AuthProvider.tsx" &&
    source.includes('?? "magic"')
  ) {
    violations.push(`${relativePath}: forbidden fallback password literal "magic"`);
  }
  if (relativePath === "vite.config.ts") {
    if (!source.includes('command === "serve"')) {
      violations.push(
        `${relativePath}: embedded runtime guard must stay dev-only (command === "serve")`
      );
    }
    if (!source.includes("VITE_ENABLE_EMBEDDED_RUNTIME")) {
      violations.push(
        `${relativePath}: embedded runtime feature flag VITE_ENABLE_EMBEDDED_RUNTIME must be explicit`
      );
    }
  }
}

for (const fullPath of SOURCE_FILES) {
  const relativePath = toPosix(path.relative(ROOT, fullPath));
  const source = fs.readFileSync(fullPath, "utf8");
  if (
    source.includes("VITE_WHITEBOARD_TEACHER_PASSWORD") &&
    relativePath !== "backend/src/nest/main.ts"
  ) {
    violations.push(
      `${relativePath}: VITE_WHITEBOARD_TEACHER_PASSWORD is forbidden in Nest runtime`
    );
  }
}

if (violations.length > 0) {
  console.error("[guard:nest-runtime] violations:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("[guard:nest-runtime] passed");
