# Phase 4: Nest Write/Realtime + Consistency

## Цель

Перевести mutate-path (`events/snapshot/presence/live/preview`) на Nest gateway и добавить deterministic consistency controls.

## Что внедрено

1. Legacy proxy gateway (`FF_NEST_API=1`) для mutate endpoint'ов:
1. `POST /api/workbook/sessions/:id/events`
2. `POST /api/workbook/sessions/:id/events/live`
3. `POST /api/workbook/sessions/:id/events/preview`
4. `PUT /api/workbook/sessions/:id/snapshot`
5. `POST /api/workbook/sessions/:id/presence`
6. `POST /api/workbook/sessions/:id/presence/leave`
2. Nest write controller + idempotency middleware:
1. body-fingerprint fallback при отсутствии `X-Idempotency-Key`
2. TTL/size лимиты кэша dedup
3. diagnostics: `GET /api/nest/write/diagnostics`
3. Object-level optimistic concurrency для `board.object.*`:
1. поддержка `expectedVersion`
2. серверное присвоение `objectVersion`
3. конфликт -> `409 object_version_conflict`
4. Snapshot barrier в storage trim:
1. trim событий только до `min(boardSnapshot.version, annotationsSnapshot.version)`
2. если barrier не подтвержден (нет обоих snapshot layers), aggressive trim отключен.

## Env

1. `FF_NEST_API=1`
2. `NEST_API_BASE_URL=http://127.0.0.1:4180`
3. `NEST_LEGACY_BASE_URL=http://127.0.0.1:4173`
4. `NEST_WRITE_PROXY_TIMEOUT_MS=8000`
5. `NEST_OBJECT_VERSION_STRICT=0|1`
6. `NEST_IDEMPOTENCY_TTL_MS=300000`
7. `NEST_IDEMPOTENCY_MAX_RECORDS=20000`
8. `NEST_IDEMPOTENCY_BODY_FALLBACK=1`
9. `NEST_IDEMPOTENCY_SAMPLE_RATE=1`

## Go/No-Go checkpoints

1. `FF_NEST_API=1` не ухудшает `health/runtime telemetry`.
2. Повтор mutate запроса не создает дубли persisted events (`idempotency` + `clientEventId` dedup).
3. Stale `expectedVersion` гарантированно дает `409`.
4. `/api/nest/write/diagnostics` показывает рабочий контур (`idempotency writes/hits`, `objectVersion conflicts`).
