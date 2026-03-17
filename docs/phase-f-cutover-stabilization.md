# Phase F: Production Cutover Verification + Stabilization

## Цель

Финально зафиксировать, что production после Phase E работает стабильно в целевом режиме:
1. API ingress только через Nest gateway.
2. SLO стабильны в течение окна наблюдения.
3. Нет роста конфликтов консистентности write-path.

## Что используется

1. `npm run phase7:cutover` — канареечный go/no-go оркестратор (в финальной фазе обычно запускается без traffic-команд, как контроль gate-ов).
2. `npm run phasef:stabilize` — циклический сбор SLO/infra/write diagnostics.
3. `npm run phase7:report` и `npm run phasef:report` — финальные markdown-отчеты.

## Env

1. `PHASE7_BASE_URL=https://api.board.mathwise.ru`
2. `PHASE7_DRY_RUN=0|1`
3. `PHASE7_SETTLE_SECONDS=5..120`
4. `PHASEF_BASE_URL=https://api.board.mathwise.ru`
5. `PHASEF_DURATION_SECONDS=60..3600`
6. `PHASEF_INTERVAL_SECONDS=5..60`
7. `PHASEF_MAX_FAILURE_RATE=0.1`
8. `PHASEF_MAX_P95_MS=500`
9. `PHASEF_MAX_P99_MS=1000`
10. `PHASEF_MAX_PG_WAITING=10`
11. `PHASEF_EXPECTED_PROXY_MODE=all`
12. `PHASEF_EXPECTED_WRITE_MODE=nest-native-api`

## Команды

```bash
PHASE7_BASE_URL=https://api.board.mathwise.ru \
PHASE7_DRY_RUN=0 \
PHASE7_SETTLE_SECONDS=5 \
PHASE7_RUN_LOAD_CHECK=0 \
npm run phase7:cutover

PHASEF_BASE_URL=https://api.board.mathwise.ru \
PHASEF_DURATION_SECONDS=60 \
PHASEF_INTERVAL_SECONDS=5 \
npm run phasef:stabilize

npm run phase7:report
npm run phasef:report
```

## Артефакты

1. `output/phase7-cutover-report-*.json`
2. `output/phase7-cutover-final-report.md`
3. `output/phasef-stabilization-report-*.json`
4. `output/phasef-stabilization-final-report.md`

## Go/No-Go

1. `phase7:cutover` завершен `ok=true`.
2. `phasef:stabilize` завершен `ok=true`.
3. В отчете нет failed checks по readiness/redis/pg/slo/proxyMode/writeMode.
