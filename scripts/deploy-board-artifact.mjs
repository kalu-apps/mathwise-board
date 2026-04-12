#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const readPositiveInt = (value, fallback, cap) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, cap);
};

const required = (value, label) => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new Error(`missing_required_env:${label}`);
};

const parseRepo = (value) => {
  const raw = required(value, "DEPLOY_GH_REPO");
  const [owner, repo] = raw.split("/");
  if (!owner || !repo) {
    throw new Error("invalid_repo_format_expected_owner_repo");
  }
  return { owner, repo, full: `${owner}/${repo}` };
};

const runShell = (command, args, cwd) => {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
};

const runJson = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mathwise-board-artifact-deploy",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`github_api_error:${response.status}:${body.slice(0, 400)}`);
  }
  return response.json();
};

const run = async () => {
  const token = required(
    process.env.DEPLOY_GH_TOKEN ?? process.env.GITHUB_TOKEN,
    "DEPLOY_GH_TOKEN"
  );
  const repo = parseRepo(process.env.DEPLOY_GH_REPO ?? "kalu-apps/mathwise-board");
  const branch = String(process.env.DEPLOY_GH_BRANCH ?? "staging").trim();
  const workflow = String(process.env.DEPLOY_GH_WORKFLOW ?? "build-board-artifact.yml").trim();
  const artifactName = String(process.env.DEPLOY_GH_ARTIFACT_NAME ?? "board-dist").trim();
  const explicitSha = String(process.env.DEPLOY_GH_SHA ?? "").trim().toLowerCase();
  const explicitRunIdRaw = String(process.env.DEPLOY_GH_RUN_ID ?? "").trim();
  const explicitRunId =
    explicitRunIdRaw.length > 0 ? Math.max(1, Number.parseInt(explicitRunIdRaw, 10)) : null;
  const timeoutMs = readPositiveInt(process.env.DEPLOY_GH_TIMEOUT_MS, 20_000, 120_000);
  const workdir = resolve(process.env.DEPLOY_WORKDIR ?? process.cwd());
  const distDir = resolve(workdir, process.env.DEPLOY_DIST_DIR ?? "dist");
  const tempRoot = resolve(workdir, ".deploy-artifact-tmp");
  const tempZipPath = resolve(tempRoot, "artifact.zip");
  const extractedRoot = resolve(tempRoot, "artifact");
  const unpackRoot = resolve(tempRoot, "unpacked");
  const backupDir = resolve(workdir, "dist.__prev");
  const metadataPath = resolve(workdir, ".deploy-artifact-meta.json");

  rmSync(tempRoot, { recursive: true, force: true });
  mkdirSync(tempRoot, { recursive: true });

  try {
    const base = `https://api.github.com/repos/${repo.full}`;
    const workflowPath = `${base}/actions/workflows/${encodeURIComponent(workflow)}`;
    let runInfo = null;

    if (explicitRunId) {
      runInfo = await runJson(`${base}/actions/runs/${explicitRunId}`, token);
    } else {
      const runsResponse = await runJson(
        `${workflowPath}/runs?branch=${encodeURIComponent(branch)}&status=success&per_page=30`,
        token
      );
      const candidateRuns = Array.isArray(runsResponse.workflow_runs)
        ? runsResponse.workflow_runs
        : [];
      runInfo =
        candidateRuns.find((item) => {
          if (!item || item.conclusion !== "success") return false;
          if (!explicitSha) return true;
          return String(item.head_sha ?? "").toLowerCase() === explicitSha;
        }) ?? null;
    }

    if (!runInfo) {
      throw new Error("artifact_workflow_run_not_found");
    }

    if (explicitSha && String(runInfo.head_sha ?? "").toLowerCase() !== explicitSha) {
      throw new Error("artifact_run_sha_mismatch");
    }

    const artifactsResponse = await runJson(
      `${base}/actions/runs/${runInfo.id}/artifacts?per_page=100`,
      token
    );
    const artifact =
      (artifactsResponse.artifacts ?? []).find(
        (item) =>
          item &&
          item.name === artifactName &&
          item.expired === false &&
          Number.isFinite(item.id)
      ) ?? null;

    if (!artifact) {
      throw new Error(`artifact_not_found:${artifactName}`);
    }

    const archiveController = new AbortController();
    const timeoutId = setTimeout(() => archiveController.abort(), timeoutMs);
    let archiveResponse;
    try {
      archiveResponse = await fetch(artifact.archive_download_url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "mathwise-board-artifact-deploy",
        },
        redirect: "follow",
        signal: archiveController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!archiveResponse.ok) {
      const body = await archiveResponse.text();
      throw new Error(`artifact_download_failed:${archiveResponse.status}:${body.slice(0, 300)}`);
    }

    const archiveBuffer = Buffer.from(await archiveResponse.arrayBuffer());
    writeFileSync(tempZipPath, archiveBuffer);

    mkdirSync(extractedRoot, { recursive: true });
    runShell("unzip", ["-oq", tempZipPath, "-d", extractedRoot], workdir);

    const distTgzPath = resolve(extractedRoot, "dist.tgz");
    if (!existsSync(distTgzPath)) {
      throw new Error("artifact_dist_tgz_missing");
    }

    mkdirSync(unpackRoot, { recursive: true });
    runShell("tar", ["-xzf", distTgzPath, "-C", unpackRoot], workdir);

    const unpackedDistDir = resolve(unpackRoot, "dist");
    if (!existsSync(unpackedDistDir)) {
      throw new Error("artifact_dist_directory_missing");
    }

    let hasBackup = false;
    try {
      rmSync(backupDir, { recursive: true, force: true });
      if (existsSync(distDir)) {
        renameSync(distDir, backupDir);
        hasBackup = true;
      }
      renameSync(unpackedDistDir, distDir);
      rmSync(backupDir, { recursive: true, force: true });
      hasBackup = false;
    } catch (error) {
      if (!existsSync(distDir) && hasBackup && existsSync(backupDir)) {
        renameSync(backupDir, distDir);
      }
      throw error;
    } finally {
      if (!hasBackup) {
        rmSync(backupDir, { recursive: true, force: true });
      }
    }

    const buildInfoPath = resolve(extractedRoot, "build-info.json");
    let buildInfo = null;
    if (existsSync(buildInfoPath)) {
      try {
        buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8"));
      } catch {
        buildInfo = null;
      }
    }

    const metadata = {
      repo: repo.full,
      branch,
      workflow,
      artifactName,
      appliedAt: new Date().toISOString(),
      run: {
        id: runInfo.id,
        htmlUrl: runInfo.html_url,
        headSha: runInfo.head_sha,
        headBranch: runInfo.head_branch,
        event: runInfo.event,
      },
      buildInfo,
    };
    writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

    console.log(JSON.stringify({ ok: true, ...metadata }, null, 2));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
      },
      null,
      2
    )
  );
  process.exit(2);
});
