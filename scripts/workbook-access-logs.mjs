#!/usr/bin/env node

import process from "node:process";
import { Pool } from "pg";

const args = process.argv.slice(2);
const options = {
  sessionId: null,
  limit: 50,
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--session" || arg === "-s") {
    options.sessionId = String(args[index + 1] ?? "").trim() || null;
    index += 1;
    continue;
  }
  if (arg === "--limit" || arg === "-l") {
    const parsed = Number.parseInt(String(args[index + 1] ?? "").trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      options.limit = Math.max(1, Math.min(300, Math.floor(parsed)));
    }
    index += 1;
    continue;
  }
  if (arg === "--help" || arg === "-h") {
    console.log(
      [
        "Usage:",
        "  node scripts/workbook-access-logs.mjs --session <session-id> [--limit 50]",
        "",
        "Options:",
        "  -s, --session   Workbook session id (optional; without it shows latest global logs)",
        "  -l, --limit     Max rows to print (default 50, max 300)",
      ].join("\n")
    );
    process.exit(0);
  }
}

const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

try {
  const query = options.sessionId
    ? `
      SELECT
        created_at,
        session_id,
        event_type,
        actor_user_id,
        actor_role,
        actor_name,
        user_agent_family,
        device_class,
        ip_hash,
        device_id_hash,
        details
      FROM workbook_access_logs
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `
    : `
      SELECT
        created_at,
        session_id,
        event_type,
        actor_user_id,
        actor_role,
        actor_name,
        user_agent_family,
        device_class,
        ip_hash,
        device_id_hash,
        details
      FROM workbook_access_logs
      ORDER BY created_at DESC
      LIMIT $1
    `;
  const params = options.sessionId ? [options.sessionId, options.limit] : [options.limit];
  const result = await pool.query(query, params);
  if ((result.rowCount ?? 0) === 0) {
    console.log("No workbook access logs found.");
    process.exit(0);
  }
  console.table(
    result.rows.map((row) => ({
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      session_id: row.session_id,
      event_type: row.event_type,
      actor_user_id: row.actor_user_id ?? "",
      actor_role: row.actor_role ?? "",
      actor_name: row.actor_name ?? "",
      user_agent_family: row.user_agent_family ?? "",
      device_class: row.device_class ?? "",
      ip_hash: row.ip_hash ?? "",
      device_id_hash: row.device_id_hash ?? "",
      details: typeof row.details === "object" ? JSON.stringify(row.details) : String(row.details ?? ""),
    }))
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await pool.end().catch(() => undefined);
}
