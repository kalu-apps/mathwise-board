#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";

const DEFAULT_LIMIT = 1000;
const DEFAULT_TZ_OFFSET = "+03:00";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  DATABASE_URL=... node scripts/workbook-incident-history.mjs --session <id> --date YYYY-MM-DD --from HH:mm --until HH:mm [--out output/report.json]",
      "  DATABASE_URL=... node scripts/workbook-incident-history.mjs --session <id> --from 2026-04-30T20:30:00+03:00 --until 2026-04-30T22:30:00+03:00",
      "",
      "Options:",
      "  --session, -s          Workbook session id.",
      "  --date                 Local calendar date used with HH:mm --from/--until.",
      "  --from                 Start time, either HH:mm with --date or full ISO timestamp.",
      "  --until                End time, either HH:mm with --date or full ISO timestamp.",
      "  --tz                   Offset for HH:mm inputs, default +03:00.",
      "  --limit                Max rows per detailed section, default 1000.",
      "  --include-payload      Include full workbook event payloads.",
      "  --out                  Write JSON report to this file instead of stdout.",
    ].join("\n")
  );
};

const readArgs = () => {
  const options = {
    sessionId: "",
    date: "",
    from: "",
    until: "",
    tz: DEFAULT_TZ_OFFSET,
    limit: DEFAULT_LIMIT,
    includePayload: false,
    out: "",
  };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--session" || arg === "-s") {
      options.sessionId = String(args[++index] ?? "").trim();
      continue;
    }
    if (arg === "--date") {
      options.date = String(args[++index] ?? "").trim();
      continue;
    }
    if (arg === "--from") {
      options.from = String(args[++index] ?? "").trim();
      continue;
    }
    if (arg === "--until") {
      options.until = String(args[++index] ?? "").trim();
      continue;
    }
    if (arg === "--tz") {
      options.tz = String(args[++index] ?? "").trim() || DEFAULT_TZ_OFFSET;
      continue;
    }
    if (arg === "--limit") {
      const parsed = Number.parseInt(String(args[++index] ?? ""), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = Math.max(1, Math.min(10_000, Math.floor(parsed)));
      }
      continue;
    }
    if (arg === "--include-payload") {
      options.includePayload = true;
      continue;
    }
    if (arg === "--out") {
      options.out = String(args[++index] ?? "").trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
};

const normalizeOffset = (value) => {
  const normalized = String(value ?? "").trim();
  if (/^[+-]\d{2}:\d{2}$/.test(normalized)) return normalized;
  throw new Error(`Invalid timezone offset: ${value}`);
};

const parseTimeInput = (value, options) => {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Time range is required.");
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      throw new Error("HH:mm inputs require --date YYYY-MM-DD.");
    }
    const withSeconds = raw.length === 5 ? `${raw}:00` : raw;
    return new Date(`${options.date}T${withSeconds}${normalizeOffset(options.tz)}`);
  }
  return new Date(raw);
};

const toIso = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return value.toISOString();
};

const buildEventRows = (rows, includePayload) =>
  rows.map((row) => ({
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    seq: Number(row.seq),
    id: row.id,
    authorUserId: row.author_user_id ?? null,
    type: row.type,
    payloadBytes: Number(row.payload_bytes ?? 0),
    ...(includePayload ? { payload: row.payload ?? null } : {}),
  }));

const run = async () => {
  const options = readArgs();
  if (!options.sessionId) throw new Error("--session is required.");
  if (!options.from || !options.until) throw new Error("--from and --until are required.");
  const from = parseTimeInput(options.from, options);
  const until = parseTimeInput(options.until, options);
  if (from.getTime() >= until.getTime()) throw new Error("--from must be before --until.");

  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const params = [options.sessionId, from, until, options.limit];
    const [
      accessLogs,
      accessSummary,
      eventRows,
      eventSummary,
      eventMinuteSummary,
      seqBounds,
      snapshots,
    ] = await Promise.all([
      pool.query(
        `
          SELECT created_at, session_id, event_type, actor_user_id, actor_role,
                 actor_name, user_agent_family, device_class, ip_hash,
                 device_id_hash, details
          FROM workbook_access_logs
          WHERE session_id = $1 AND created_at >= $2 AND created_at <= $3
          ORDER BY created_at ASC
          LIMIT $4
        `,
        params
      ),
      pool.query(
        `
          SELECT event_type, actor_role, user_agent_family, device_class, count(*)::int AS count
          FROM workbook_access_logs
          WHERE session_id = $1 AND created_at >= $2 AND created_at <= $3
          GROUP BY event_type, actor_role, user_agent_family, device_class
          ORDER BY count DESC, event_type ASC
        `,
        params.slice(0, 3)
      ),
      pool.query(
        `
          SELECT created_at, seq, id, author_user_id, type,
                 pg_column_size(payload)::int AS payload_bytes,
                 CASE WHEN $5::boolean THEN payload ELSE NULL END AS payload
          FROM workbook_events
          WHERE session_id = $1 AND created_at >= $2 AND created_at <= $3
          ORDER BY seq ASC
          LIMIT $4
        `,
        [...params, options.includePayload]
      ),
      pool.query(
        `
          SELECT type, count(*)::int AS count, min(seq)::int AS first_seq,
                 max(seq)::int AS last_seq, min(created_at) AS first_at,
                 max(created_at) AS last_at
          FROM workbook_events
          WHERE session_id = $1 AND created_at >= $2 AND created_at <= $3
          GROUP BY type
          ORDER BY count DESC, type ASC
        `,
        params.slice(0, 3)
      ),
      pool.query(
        `
          SELECT date_trunc('minute', created_at) AS minute, count(*)::int AS count,
                 count(DISTINCT author_user_id)::int AS actors,
                 array_agg(DISTINCT type ORDER BY type) AS types
          FROM workbook_events
          WHERE session_id = $1 AND created_at >= $2 AND created_at <= $3
          GROUP BY minute
          ORDER BY minute ASC
        `,
        params.slice(0, 3)
      ),
      pool.query(
        `
          SELECT
            (SELECT max(seq)::int FROM workbook_events WHERE session_id = $1 AND created_at < $2) AS seq_before,
            (SELECT min(seq)::int FROM workbook_events WHERE session_id = $1 AND created_at >= $2 AND created_at <= $3) AS first_seq_in_range,
            (SELECT max(seq)::int FROM workbook_events WHERE session_id = $1 AND created_at >= $2 AND created_at <= $3) AS last_seq_in_range,
            (SELECT min(seq)::int FROM workbook_events WHERE session_id = $1 AND created_at > $3) AS seq_after
        `,
        params.slice(0, 3)
      ),
      pool.query(
        `
          SELECT layer, version, created_at, pg_column_size(payload)::int AS payload_bytes
          FROM workbook_snapshots
          WHERE session_id = $1
          ORDER BY layer ASC
        `,
        [options.sessionId]
      ),
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      sessionId: options.sessionId,
      range: {
        input: {
          date: options.date || null,
          from: options.from,
          until: options.until,
          timezoneOffset: options.tz,
        },
        utc: {
          from: toIso(from),
          until: toIso(until),
        },
      },
      limits: {
        detailedRows: options.limit,
        includePayload: options.includePayload,
      },
      seqBounds: seqBounds.rows[0] ?? null,
      counts: {
        accessLogs: accessLogs.rowCount ?? accessLogs.rows.length,
        workbookEvents: eventRows.rowCount ?? eventRows.rows.length,
        snapshots: snapshots.rowCount ?? snapshots.rows.length,
      },
      accessSummary: accessSummary.rows,
      eventSummary: eventSummary.rows.map((row) => ({
        ...row,
        firstAt: row.first_at instanceof Date ? row.first_at.toISOString() : row.first_at,
        lastAt: row.last_at instanceof Date ? row.last_at.toISOString() : row.last_at,
      })),
      eventMinuteSummary: eventMinuteSummary.rows.map((row) => ({
        minute: row.minute instanceof Date ? row.minute.toISOString() : String(row.minute),
        count: Number(row.count),
        actors: Number(row.actors),
        types: row.types,
      })),
      snapshots: snapshots.rows.map((row) => ({
        layer: row.layer,
        version: Number(row.version),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        payloadBytes: Number(row.payload_bytes ?? 0),
      })),
      accessLogs: accessLogs.rows.map((row) => ({
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        sessionId: row.session_id,
        eventType: row.event_type,
        actorUserId: row.actor_user_id ?? null,
        actorRole: row.actor_role ?? null,
        actorName: row.actor_name ?? null,
        userAgentFamily: row.user_agent_family ?? null,
        deviceClass: row.device_class ?? null,
        ipHash: row.ip_hash ?? null,
        deviceIdHash: row.device_id_hash ?? null,
        details: row.details ?? null,
      })),
      workbookEvents: buildEventRows(eventRows.rows, options.includePayload),
    };

    const payload = `${JSON.stringify(report, null, 2)}\n`;
    if (options.out) {
      mkdirSync(path.dirname(options.out), { recursive: true });
      writeFileSync(options.out, payload, "utf8");
      console.log(options.out);
    } else {
      process.stdout.write(payload);
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
