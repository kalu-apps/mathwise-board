import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BASELINE_PATH = path.resolve("scripts/file-size-baseline.json");
const args = new Set(process.argv.slice(2));
const writeBaseline = args.has("--write-baseline");
const strictMode = args.has("--strict");

const parseFiles = () => {
  const output = execFileSync(
    "rg",
    ["--files", "-g", "*.{ts,tsx,scss,css}", "src", "backend"],
    { encoding: "utf8" }
  );
  return output
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
};

const readLineCount = (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  if (source.length === 0) {
    return 0;
  }
  return source.split(/\r?\n/u).length;
};

const isTypeScript = (filePath) => /\.(ts|tsx)$/u.test(filePath);
const isStylesheet = (filePath) => /\.(scss|css)$/u.test(filePath);

const resolveLimit = (filePath) => {
  let limit = 1200;
  if (isTypeScript(filePath)) {
    if (/(^|\/)(pages?|controllers?)(\/|$)/u.test(filePath)) {
      limit = Math.min(limit, 800);
    }
    if (
      /(^|\/)(hooks?|services?|stores?|slices?)(\/|$)/u.test(filePath) ||
      /\/use[A-Z][^/]*\.(ts|tsx)$/u.test(filePath)
    ) {
      limit = Math.min(limit, 500);
    }
    if (/(^|\/)(model|lib|utils?|helpers?)(\/|$)/u.test(filePath)) {
      limit = Math.min(limit, 350);
    }
  }
  if (isStylesheet(filePath)) {
    limit = Math.min(limit, 1200);
  }
  return limit;
};

const readBaseline = () => {
  if (!fs.existsSync(BASELINE_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(BASELINE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return parsed;
};

const writeBaselineSnapshot = (entries) => {
  const snapshot = {};
  for (const entry of entries) {
    snapshot[entry.filePath] = entry.lineCount;
  }
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    `[file-size-gate] baseline updated: ${Object.keys(snapshot).length} oversized files -> ${path.relative(
      process.cwd(),
      BASELINE_PATH
    )}`
  );
};

const allFiles = parseFiles();
const oversizedEntries = allFiles
  .map((filePath) => {
    const lineCount = readLineCount(filePath);
    const limit = resolveLimit(filePath);
    return {
      filePath,
      lineCount,
      limit,
    };
  })
  .filter((entry) => entry.lineCount > entry.limit)
  .sort((left, right) => right.lineCount - left.lineCount);

if (writeBaseline) {
  writeBaselineSnapshot(oversizedEntries);
  process.exit(0);
}

const baseline = readBaseline();
const debtEntries = [];
const violations = [];

for (const entry of oversizedEntries) {
  const baselineLimit = baseline[entry.filePath];
  if (strictMode) {
    violations.push({
      ...entry,
      reason: "strict-mode",
    });
    continue;
  }
  if (baselineLimit === undefined) {
    violations.push({
      ...entry,
      reason: "new-oversized-file",
    });
    continue;
  }
  if (entry.lineCount > baselineLimit) {
    violations.push({
      ...entry,
      reason: "oversized-growth",
      baselineLimit,
    });
    continue;
  }
  debtEntries.push({
    ...entry,
    baselineLimit,
  });
}

if (debtEntries.length > 0) {
  console.log(
    `[file-size-gate] legacy oversized files (frozen, must not grow): ${debtEntries.length}`
  );
}

const staleBaselineEntries = Object.keys(baseline).filter((filePath) => !fs.existsSync(filePath));
if (staleBaselineEntries.length > 0) {
  console.log(
    `[file-size-gate] stale baseline entries detected (${staleBaselineEntries.length}); refresh baseline after cleanup with: node scripts/file-size-gate.mjs --write-baseline`
  );
}

if (violations.length > 0) {
  console.error("[file-size-gate] violations:");
  for (const violation of violations) {
    const reasonSuffix =
      violation.reason === "oversized-growth"
        ? `, baseline=${violation.baselineLimit}`
        : "";
    console.error(
      `  - ${violation.filePath}: lines=${violation.lineCount}, policy=${violation.limit}, reason=${violation.reason}${reasonSuffix}`
    );
  }
  process.exit(1);
}

console.log("[file-size-gate] passed");
