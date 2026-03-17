# Phase 6: SLO Alerts

## Источники

1. `/healthz`
2. `/api/runtime/infra`
3. `/api/telemetry/runtime?limit=...`

## Alert rules

1. `readiness_false` (P1)
- condition: `readiness.ready=false` > 2 мин
- action: incident page + rollback/check runtime dependencies.

2. `redis_required_disconnected` (P1/P2)
- condition: `runtime.redis.required=true` and `runtime.redis.connected=false` > 1 мин
- action: Redis network + auth + latency diagnostics.

3. `pg_wait_queue_high` (P2)
- condition: `storage.postgresPool.waitingCount > 10` > 5 мин
- action: scale DB/app, проверить долгие запросы.

4. `workbook_failure_rate_high` (P2)
- condition: `telemetry.recentWorkbookFailureRate > 0.10` > 5 мин
- action: inspect traces and error bucket by op/channel.

5. `workbook_latency_p95_high` (P2)
- condition: `telemetry.recentDurationP95Ms > 500` > 10 мин
- action: identify bottleneck (Redis, DB, node CPU, fanout pressure).

6. `redis_timeout_spike` (P2)
- condition: monotonic growth of `runtime.redis.commandTimeouts` with request drop
- action: check network jitter, Redis CPU/memory, reconnect storm.

## Controlled degradation criteria

1. Сервис должен отдавать диагностируемый degrade (`readyz/healthz/infra`), а не silent outage.
2. Persist path не должен терять подтвержденные события.
3. После восстановления Redis/Postgres метрики возвращаются в baseline без ручного cleanup данных.

## Rollback triggers

1. `readiness_false` + `failure_rate_high` одновременно > 3 мин.
2. Неконтролируемый рост ошибок publish/persist.
3. Признаки data-consistency инцидента.

Rollback порядок:
1. выключить новые фичи/настройки phase-6, если изменялись флагами/infra vars;
2. откатиться на предыдущий стабильный deploy;
3. повторно выполнить `phase6:infra` + smoke после восстановления.
