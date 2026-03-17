# Phase D: Consistency & Resilience (End-to-End)

## Goal
Закрепить `idempotency`, `objectVersion/expectedVersion` и `snapshot barrier` прямо в активном mutate-path (`/api/workbook/sessions/*`) после Phase C.

## Implemented
1. End-to-end idempotency для mutate endpoint'ов:
   - `POST /api/workbook/sessions/:id/events`
   - `POST /api/workbook/sessions/:id/events/live`
   - `POST /api/workbook/sessions/:id/events/preview`
   - `PUT /api/workbook/sessions/:id/snapshot`
   - `POST /api/workbook/sessions/:id/presence`
   - `POST /api/workbook/sessions/:id/presence/leave`
2. Object-level optimistic concurrency в `events`:
   - серверная проверка `expectedVersion`
   - серверное выставление `objectVersion`
   - deterministic `409 object_version_conflict` при stale mutation
3. Snapshot barrier hardening:
   - snapshot version ограничивается `latestSeq` (без “прыжка” барьера вперед событий)
   - trim overflow выполняется только при подтвержденном барьере (оба слоя snapshot)
4. Диагностика consistency в `GET /api/nest/write/diagnostics` теперь показывает фактические метрики активного write-path.

## Diagnostics Fields
1. `idempotency`: hits/misses/writes/conflicts/evictions + TTL/limits/body-fallback.
2. `objectVersions`: acceptedMutations/conflicts + trackedSessions/objects.
3. `snapshotBarrier`: confirmed/pending sessions + barrier seq envelope.

## Go/No-Go
1. Повторные mutate запросы с тем же idempotency-key не создают дублей.
2. Stale update с неверным `expectedVersion` стабильно отдает `409`.
3. После restart/перезапуска диагностика показывает стабильные counters и отсутствие потерь восстановимости.
