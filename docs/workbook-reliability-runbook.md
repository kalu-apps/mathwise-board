# Workbook Reliability Runbook

## Scope
Incident response for workbook sessions: lesson cards, invites, realtime sync, events/snapshots persistence, and recovery after server/network degradation.

## Core Guarantees
- `CLASS` invite links stay valid until the teacher deletes the session card.
- Session deletion removes session state end-to-end: participants, invites, events, snapshots, and sequence state.
- Realtime is best-effort; durability is guaranteed by persisted events + snapshots + local persistence queue replay.

## Health Signals
- Runtime readiness: `GET /api/runtime/readiness`
- Monolith health: `GET /healthz`
- Runtime diagnostics (authorized): `GET /api/telemetry/runtime?limit=100`
- Automated check command:
  - `npm run monitor:workbook -- --base-url https://api.board.mathwise.ru`

## Severity Matrix
- `SEV-1`: data loss risk, cannot create/open sessions globally, invite join failure globally.
- `SEV-2`: degraded realtime, delayed autosave replay, intermittent session open failures.
- `SEV-3`: isolated user/session issues, recoverable without platform actions.

## First 10 Minutes Checklist
1. Confirm current deploy revision and service status.
2. Run `GET /healthz` and inspect `readiness`, `storage`, `runtime`, `telemetry`.
3. If readiness is false:
   - `storage_not_ready` or `storage_driver_degraded`: treat as persistence incident.
   - `runtime_redis_not_connected` when required: treat as realtime distribution incident.
4. Validate user path quickly:
   - Teacher login
   - Open workbook hub
   - Create class session
   - Copy invite
   - Student join
5. Capture evidence: timestamps, failing request ids, session ids, affected %.

## Incident Playbooks

### A. Session Creation/Deletion Duplication
- Symptom: duplicated cards, conflicting delete/create results.
- Checks:
  - Verify `X-Idempotency-Key` is present in client requests.
  - Check backend idempotent operation records in state (`workbookOperations`).
- Actions:
  - Redeploy latest main.
  - Run temporary dedupe on persisted workbook state if historical duplicates remain.
  - Confirm one-card-per-session invariant in hub API response.

### B. Autosave/Persistence Degradation
- Symptom: UI warning about autosave queue, unsent changes.
- Checks:
  - `healthz.readiness.ready`
  - store write timeouts (`event_store_*_timeout`, `snapshot_store_*_timeout`)
- Actions:
  - Stabilize storage backend first.
  - Keep clients open; local persistence queue retries automatically.
  - After recovery, verify queue drains and snapshots update.

### C. Realtime Channel Instability
- Symptom: delayed participant sync, late updates, repeated reconnects.
- Checks:
  - Redis runtime status and network path.
  - `recentSlowWorkbookTraceCount`
- Actions:
  - Keep session running; poll + resync fallback should restore state.
  - If prolonged, restart service after capturing diagnostics.
  - Validate gap-resync by reopening affected session.

### D. Invite Join Failures
- Symptom: student cannot join by link.
- Checks:
  - Session exists and not deleted.
  - Invite token not revoked/expired.
- Actions:
  - Teacher regenerates invite from card.
  - If card deleted intentionally, confirm expected behavior with user.

## Recovery Verification
1. Teacher can create and open a new class session.
2. Student joins via copied invite.
3. Draw changes appear for both participants.
4. Refresh/reopen preserves board context.
5. Deleting card invalidates invite and removes session data.

## Preventive Controls
- Keep `BOARD_STORAGE_DRIVER=postgres` in production.
- Keep runtime readiness checks in deployment pipeline.
- Alert if:
  - readiness false > 2 min
  - slow workbook traces above threshold for 5 min
  - session create failure rate > 2%
- Perform monthly restore drills for persistence backups.
