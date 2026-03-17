# Phase 6: Scaling + Infra Hardening

## Цель

Подготовить production-контур к резкому росту нагрузки без outage: session-aware routing, предсказуемая деградация Redis/Postgres, проверяемые SLO-gates и load/chaos верификация.

## Что внедрено

1. Session-aware affinity для realtime workload:
1. во всех `workbook session` API-ответах выставляются headers:
- `x-workbook-session-affinity`
- `x-workbook-session-affinity-bucket`
- `x-workbook-runtime-node`
2. добавлена affinity-cookie (`mw_session_affinity` по умолчанию) для sticky-routing на L7.
3. доступна диагностика affinity в `/healthz` и `/api/runtime/infra`.
2. Redis runtime hardening:
1. tunable timeouts/retries/reconnect policy через env;
2. bounded command timeout + command retry/publish retry;
3. расширенная диагностика (`initAttempts`, `commandTimeouts`, `publishFailures`, `subscribedChannels`, `reconnectEvents`).
3. Postgres storage hardening:
1. tunable pool config (`max/min/idle/connection/query timeout/maxUses`);
2. retry policy на bootstrap/init pool;
3. расширенная диагностика `storage.postgresPool` (очередь, размеры пула, init stats).
4. Infrastructure observability endpoint:
1. `GET /api/runtime/infra` агрегирует readiness + storage/runtime + telemetry + affinity.
5. Phase-6 automation scripts:
1. `npm run phase6:infra` — SLO/gate-проверка инфраструктуры;
2. `npm run phase6:load` — load/pressure smoke под auth/session flow;
3. `npm run phase6:check` — полный phase-6 gate.

## Env (Phase 6)

### Session affinity

1. `WORKBOOK_SESSION_AFFINITY_BUCKETS=128`
2. `WORKBOOK_SESSION_AFFINITY_SALT=<random>`
3. `WORKBOOK_SESSION_AFFINITY_COOKIE_ENABLED=1`
4. `WORKBOOK_SESSION_AFFINITY_COOKIE_NAME=mw_session_affinity`
5. `WORKBOOK_SESSION_AFFINITY_COOKIE_TTL_SECONDS=28800`
6. `WORKBOOK_SESSION_AFFINITY_COOKIE_SAME_SITE=Lax`
7. `WORKBOOK_SESSION_AFFINITY_COOKIE_SECURE=1`
8. `WORKBOOK_SESSION_AFFINITY_COOKIE_HTTP_ONLY=0`
9. `WORKBOOK_SESSION_AFFINITY_COOKIE_DOMAIN=.your-domain.tld`

### Redis runtime

1. `BOARD_RUNTIME_REDIS_CONNECT_TIMEOUT_MS=4000`
2. `BOARD_RUNTIME_REDIS_INIT_TIMEOUT_MS=8000`
3. `BOARD_RUNTIME_REDIS_COMMAND_TIMEOUT_MS=1500`
4. `BOARD_RUNTIME_REDIS_RECONNECT_BASE_DELAY_MS=150`
5. `BOARD_RUNTIME_REDIS_RECONNECT_MAX_DELAY_MS=5000`
6. `BOARD_RUNTIME_REDIS_RECONNECT_MAX_ATTEMPTS=0`
7. `BOARD_RUNTIME_REDIS_INIT_MAX_ATTEMPTS=3`
8. `BOARD_RUNTIME_REDIS_INIT_RETRY_DELAY_MS=600`
9. `BOARD_RUNTIME_REDIS_COMMAND_RETRIES=1`
10. `BOARD_RUNTIME_REDIS_PUBLISH_RETRIES=2`
11. `BOARD_RUNTIME_REDIS_KEEPALIVE_MS=30000`
12. `BOARD_RUNTIME_REDIS_DISABLE_OFFLINE_QUEUE=0`

### Postgres storage

1. `BOARD_PG_POOL_MAX=20`
2. `BOARD_PG_POOL_MIN=2`
3. `BOARD_PG_POOL_IDLE_TIMEOUT_MS=30000`
4. `BOARD_PG_POOL_CONNECTION_TIMEOUT_MS=5000`
5. `BOARD_PG_POOL_MAX_USES=0`
6. `BOARD_PG_QUERY_TIMEOUT_MS=15000`
7. `BOARD_PG_INIT_RETRIES=3`
8. `BOARD_PG_INIT_RETRY_DELAY_MS=750`
9. `BOARD_PG_SSL_REJECT_UNAUTHORIZED=0`

## Go/No-Go (Phase 6)

1. `readiness.ready = true` на `/healthz` и `/api/runtime/infra`.
2. Если `runtime.redis.required=true`, тогда `runtime.redis.connected=true`.
3. `storage.postgresPool.waitingCount <= 10` (или ваш capacity-budget).
4. `telemetry.recentWorkbookFailureRate <= 0.10`.
5. `telemetry.recentDurationP95Ms <= 500`.
6. На load-check (`phase6:load`) `request error rate <= 3%`, `p95 <= 450ms`.
7. Нет P1/P0 consistency инцидентов при degrade/recovery.

## Проверка перед rollout

```bash
npm run lint
npm run build:board
npm run phase6:infra
npm run phase6:load
```

Для staging/prod:

```bash
PHASE6_BASE_URL=https://api.board.mathwise.ru npm run phase6:check
```

## Chaos матрица (операционно)

1. `node restart`:
- `systemctl restart mathwise-board`
- ожидание: `/readyz` восстанавливается без ручных фиксов, session-open/create path не ломается.
2. `redis degradation`:
- временно ограничить сеть до Redis (security group/firewall test window)
- ожидание: controlled degradation (`runtime.redis.connected=false`, readiness в degrade), без silent data corruption.
3. `db pressure`:
- synthetic burst + background DB load
- ожидание: рост `waitingCount`, но без loss persisted events.

Подробная операционная модель: `docs/phase-6-capacity-model.md` и `docs/phase-6-slo-alerts.md`.
