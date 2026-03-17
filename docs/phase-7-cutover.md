# Phase 7: Production Cutover + Legacy Cleanup

## Цель

Безопасно перевести production на целевую архитектуру (`Nest/Zustand-ready`), пройти канареечный rollout `10% -> 25% -> 50% -> 100%`, включить авто-rollback и зафиксировать финальный cutover report.

## Что внедрено

1. Cutover orchestrator script:
- `npm run phase7:cutover`
- stage-by-stage rollout с SLO gate на каждом шаге;
- авто-rollback при провале gate.
2. Cutover report generator:
- `npm run phase7:report`
- собирает markdown-отчет из JSON-артефакта cutover запуска.
3. Nest ingress cutover mode:
- `NEST_PROXY_MODE=all` включает 100% проксирование `/api/*` через Nest gateway;
- fallback controller в Nest закрывает неизвестные API пути через legacy-прокси (без прямого ingress в legacy handlers).
4. Legacy cleanup readiness:
- phase-7 процесс переводит legacy в fallback-only режим;
- после окна стабилизации можно удалять legacy code-path по чеклисту ниже.

## Env

1. `FF_NEST_API=1`
2. `NEST_PROXY_MODE=all`
3. `FF_NEST_API_SHADOW=0` (на полном cutover shadow больше не нужен)
4. `PHASE7_BASE_URL=https://api.board.your-domain.tld`
5. `PHASE7_DRY_RUN=0|1`
6. `PHASE7_SET_TRAFFIC_CMD='<set-lb-traffic-to-{percent}-percent>'`
7. `PHASE7_ROLLBACK_CMD='<rollback-lb-to-{previous_percent}-percent>'`
8. `PHASE7_SETTLE_SECONDS=120`
9. `PHASE7_RUN_LOAD_CHECK=1` (рекомендуется)

## Go/No-Go (Phase 7)

1. Канареечные этапы проходят без rollback на 10/25/50/100.
2. На каждом этапе `readiness.ready=true`.
3. SLO в бюджете: failure rate, p95 latency, redis/db health.
4. Нет критических consistency инцидентов.
5. После 100% трафика SLO стабильны в течение окна стабилизации.

## Запуск

```bash
PHASE7_BASE_URL=https://api.board.mathwise.ru \
PHASE7_DRY_RUN=0 \
PHASE7_SET_TRAFFIC_CMD='<set-lb-traffic-to-{percent}-percent>' \
PHASE7_ROLLBACK_CMD='<rollback-lb-to-{previous_percent}-percent>' \
PHASE7_RUN_LOAD_CHECK=1 \
npm run phase7:cutover

npm run phase7:report
```

Артефакты пишутся в `output/`:

1. `phase7-cutover-report-*.json`
2. `phase7-cutover-final-report.md`

## Legacy cleanup checklist (после стабилизации)

1. Отключить/удалить shadow parity path.
2. Удалить прямой legacy ingress для `/api/*` (оставить только Nest ingress).
3. Удалить устаревшие fallback-ветки после подтвержденного стабильного окна.
4. Обновить runbook и инцидентные playbook под новую архитектуру.
5. Зафиксировать post-migration техдолг: `docs/phase-7-post-migration-tech-debt.md`.
