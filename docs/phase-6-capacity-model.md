# Phase 6: Capacity Model

## Исходные единицы

1. `active_session` — сессия с хотя бы одним online участником.
2. `events_per_sec` — persisted events (`POST /events`).
3. `volatile_events_per_sec` — preview/live events (`/events/live`, `/events/preview`).
4. `fanout_targets` — число получателей realtime обновлений в сессии.

## Упрощенная модель нагрузки

1. Redis publish rate:
- `redis_publish_ops ~= active_session_events_per_sec + active_session_volatile_events_per_sec`
2. Delivery pressure:
- `delivery_ops ~= redis_publish_ops * avg_fanout_targets`
3. Postgres write rate:
- `pg_write_ops ~= persisted_events_per_sec + snapshot_upserts_per_sec + presence_updates_per_sec`
4. Postgres read rate (core):
- `pg_read_ops ~= stream_poll_reads + session/meta reads`

## Практические таргеты пула/таймаутов

1. `BOARD_PG_POOL_MAX`:
- старт: `20`
- рост: `+5` на каждый существенный рост concurrent write bursts, пока `waitingCount` стабильно > 0.
2. `BOARD_PG_POOL_MIN`:
- старт: `2`
- для холодного старта под нагрузкой: `4-6`.
3. `BOARD_PG_QUERY_TIMEOUT_MS`:
- старт: `15000`
- для агрессивного fail-fast: `8000-12000`.

## Redis tuning baseline

1. `BOARD_RUNTIME_REDIS_COMMAND_TIMEOUT_MS=1500`
2. `BOARD_RUNTIME_REDIS_COMMAND_RETRIES=1`
3. `BOARD_RUNTIME_REDIS_PUBLISH_RETRIES=2`
4. `BOARD_RUNTIME_REDIS_RECONNECT_BASE_DELAY_MS=150`
5. `BOARD_RUNTIME_REDIS_RECONNECT_MAX_DELAY_MS=5000`

Цель: контролируемые retry без бесконечного block-loop.

## Affinity sizing

1. `WORKBOOK_SESSION_AFFINITY_BUCKETS=128` — базовый режим.
2. При росте числа инстансов/сессий можно повышать до `256/512`.
3. Нужен стабильный `WORKBOOK_SESSION_AFFINITY_SALT` во всех инстансах.

## Capacity gates (рекомендуемые)

1. `storage.postgresPool.waitingCount p95 <= 10`.
2. `runtime.redis.commandTimeouts` не должен расти непрерывно на стабильной нагрузке.
3. `telemetry.recentWorkbookFailureRate <= 0.10`.
4. `telemetry.recentDurationP95Ms <= 500`.
5. `phase6:load` error-rate <= `3%`, request p95 <= `450ms`.

## Когда масштабировать горизонтально

1. `waitingCount > 10` держится более 5 минут.
2. `recentDurationP95Ms` стабильно выше budget при нормальном Redis/Postgres health.
3. CPU на app-node > 70% при sustained classroom load.

В этом случае:
1. добавляем app инстансы;
2. включаем sticky routing по affinity-cookie/header;
3. проверяем `phase6:infra` и `phase6:load` после scale-out.
