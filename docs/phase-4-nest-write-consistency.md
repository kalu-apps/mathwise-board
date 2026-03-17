# Phase 4: Nest Write/Realtime + Consistency

## Цель

Закрепить deterministic consistency controls (`idempotency/objectVersion/snapshot barrier`) в текущем Nest-native mutate-path.

## Что внедрено

1. End-to-end idempotency для mutate endpoint'ов:
1. `POST /api/workbook/sessions/:id/events`
2. `POST /api/workbook/sessions/:id/events/live`
3. `POST /api/workbook/sessions/:id/events/preview`
4. `PUT /api/workbook/sessions/:id/snapshot`
5. `POST /api/workbook/sessions/:id/presence`
6. `POST /api/workbook/sessions/:id/presence/leave`
2. Object-level optimistic concurrency для `board.object.*`:
1. поддержка `expectedVersion`
2. серверное присвоение `objectVersion`
3. конфликт -> `409 object_version_conflict`
3. Snapshot barrier в storage trim:
1. trim событий только до `min(boardSnapshot.version, annotationsSnapshot.version)`
2. если barrier не подтвержден (нет обоих snapshot layers), trim overflow неактивен
3. snapshot version ограничен `latestSeq` (без ложного продвижения barrier)
4. diagnostics: `GET /api/nest/write/diagnostics`

## Env

1. `FF_NEST_API=1`
2. `NEST_PROXY_MODE=all`
3. `NEST_OBJECT_VERSION_STRICT=0|1`
4. `NEST_IDEMPOTENCY_TTL_MS=300000`
5. `NEST_IDEMPOTENCY_MAX_RECORDS=20000`
6. `NEST_IDEMPOTENCY_BODY_FALLBACK=1`
7. `NEST_IDEMPOTENCY_SAMPLE_RATE=1`

## Go/No-Go checkpoints

1. Повтор mutate запроса не создает дубли persisted-событий.
2. Stale `expectedVersion` гарантированно дает `409`.
3. Snapshot barrier подтверждает recoverable trim (оба snapshot слоя).
4. `/api/nest/write/diagnostics` отражает фактический runtime контур.
