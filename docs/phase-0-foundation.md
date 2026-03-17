# Phase 0: Foundation (Migration + Performance Program)

## Цель фазы

Подготовить проект к безопасной миграции `frontend -> zustand` и `backend -> nest` без потери текущего realtime UX и без скрытого роста технического риска.

Phase 0 считается завершенной только если:

1. зафиксированы целевые архитектурные решения и границы ответственности;
2. зафиксированы измеримые KPI/SLO и go/no-go ворота;
3. введен реестр фичефлагов и стратегия поэтапного rollout/rollback;
4. снят baseline для сравнения дальнейших изменений;
5. включены CI-проверки, блокирующие пропуск базовых quality gates.

## Scope фазы

В Scope входит:

1. подготовка документации, обязательной для миграции;
2. подготовка baseline-инструментов;
3. подготовка контролей качества и контролей релиза.

В Scope не входит:

1. перенос runtime state на zustand;
2. перенос API/realtime транспорта на nest;
3. изменение рендер-пайплайна.

## Артефакты фазы

Обязательный комплект:

1. [KPI и go/no-go матрица](/Users/ivankalugin/Documents/New project/mathwise-board/docs/phase-0-kpi-gates.md)
2. [Реестр feature flags и rollout стратегия](/Users/ivankalugin/Documents/New project/mathwise-board/docs/feature-flags-rollout.md)
3. [ADR целевой архитектуры](/Users/ivankalugin/Documents/New project/mathwise-board/docs/adr/ADR-001-zustand-nest-target-architecture.md)
4. baseline-скрипт: `scripts/phase0-baseline.mjs`
5. phase-0 verify-скрипт: `scripts/phase0-verify.mjs`
6. CI quality gates workflow

## Порядок выполнения (execution roadmap)

1. Архитектурный baseline:
1. Утвердить target architecture по frontend/backend.
2. Утвердить единый контракт DTO/event схем.

2. KPI baseline:
1. Запустить `npm run phase0:baseline`.
2. Зафиксировать отчеты в `output/`.
3. Сверить с KPI-матрицей и сохранить как reference.

3. Релизный контроль:
1. Включить CI-проверки (`verify` + `phase0:verify`).
2. Зафиксировать стратегию rollout по флагам.

## Definition of Done

Phase 0 закрывается, когда одновременно выполнены все пункты:

1. `npm run phase0:verify` проходит без ошибок.
2. `npm run verify` проходит без ошибок.
3. baseline-отчет сгенерирован и доступен в `output/phase0-baseline-*.json`.
4. каждый флаг из реестра имеет default, owner-домен и rollback-план.
5. все фазы с 1 по 7 обязаны использовать go/no-go критерии из KPI-матрицы.

## Команды фазы

```bash
npm run phase0:verify
npm run phase0:baseline
```

Опционально (с runtime проверкой production/staging контура):

```bash
PHASE0_BASE_URL=https://api.board.mathwise.ru npm run phase0:baseline
```

