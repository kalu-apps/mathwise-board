# Post-Migration Tech Debt Plan

## Контекст

Документ фиксирует обязательный техдолг после полного cutover на новую архитектуру.

## P0 (сразу после cutover)

1. Удалить legacy shadow compare middleware и связанный diagnostics path.
2. Удалить/свернуть неиспользуемые legacy feature-flag aliases.
3. Зафиксировать единый source of truth по API contracts (Nest-first).
4. Довести CI gates до обязательного phase6/phase7 smoke на PR в `main`.

## P1 (1-2 спринта)

1. Удалить прямые legacy handlers, которые больше не участвуют в traffic path.
2. Консолидировать runtime diagnostics в единый endpoint/формат.
3. Нормализовать Nest module boundaries и ownership map.
4. Перенести операционные скрипты cutover в release pipeline.

## P2 (2-4 спринта)

1. Сократить число временных feature flags с истекшим TTL.
2. Провести cleanup старых docs и runbook веток.
3. Оптимизировать cost hot-path (Redis publish fanout, PG connection utilization).
4. Автоматизировать chaos drills по расписанию.

## Критерии закрытия техдолга

1. Нет production traffic через legacy ingress.
2. Нет флагов со статусом "временно" без owner/TTL.
3. SLO и rollback playbooks подтверждены в двух подряд релизных циклах.
