# Phase 0 KPI Matrix and Go/No-Go Gates

## Назначение

Документ фиксирует измеримые критерии, которые используются как ворота между фазами программы миграции.
Без прохождения ворот переход на следующую фазу запрещен.

## KPI Matrix

| KPI | Источник | Baseline (Phase 0) | Целевое ограничение | Блокирующий порог |
|---|---|---:|---:|---:|
| `Input-to-paint p95 (ms)` | RUM `performance` + board traces | фиксируется baseline-скриптом | `<= baseline + 10%` | `> baseline + 15%` |
| `Teacher->peer preview p95 (ms)` | realtime telemetry (`receive/apply`) | фиксируется baseline-скриптом | `<= 180ms` | `> 230ms` |
| `Realtime gap rate (%)` | `phase=gap` в realtime telemetry | фиксируется baseline-скриптом | `<= 1.0%` | `> 2.0%` |
| `Persist ack p95 (ms)` | `phase=persist_ack` | фиксируется baseline-скриптом | `<= 900ms` | `> 1200ms` |
| `Snapshot lag (seq)` | `latestSeq - snapshot.version` | фиксируется runtime замером | `<= 100` | `> 200` |
| `Workbook failure rate` | `/healthz -> telemetry.recentWorkbookFailureRate` | фиксируется runtime-check | `<= 0.10` | `> 0.20` |
| `Workbook trace p95 (ms)` | `/healthz -> telemetry.recentDurationP95Ms` | фиксируется runtime-check | `<= 350ms` | `> 450ms` |
| `Build size: WorkbookSessionPage chunk (gzip)` | dist assets | фиксируется baseline-скриптом | `<= baseline + 8%` | `> baseline + 12%` |
| `Build size: index chunk (gzip)` | dist assets | фиксируется baseline-скриптом | `<= baseline + 8%` | `> baseline + 12%` |

## Phase Gates

### Gate A (переход к декомпозиции фронта)

1. Есть утвержденный ADR target architecture.
2. Есть baseline report в `output/`.
3. CI `verify + phase0:verify` включены и зеленые.

### Gate B (переход к Zustand migration)

1. Нет деградации `Input-to-paint p95` выше целевого ограничения.
2. Нет роста `Build size` выше целевого ограничения.
3. Realtime gap rate не вышел за пределы.

### Gate C (переход к Nest write/realtime)

1. Shadow parity для read-path стабильный.
2. `Workbook failure rate` и `trace p95` в границах.
3. Нет блокирующих regressions по критическим сценариям доски.

### Gate D (перед canary release)

1. Все KPI в целевой зоне минимум 48 часов в staging.
2. Есть rollback checklist и подтвержденный owner по каждому флагу.
3. Нет открытых P0/P1 дефектов в workbook/audio/realtime слоях.

## Правило принятия решения

1. Если сработал любой блокирующий порог, статус `NO-GO`.
2. Если все KPI в целевой зоне, статус `GO`.
3. Если KPI между целевым и блокирующим порогом, статус `HOLD` до стабилизации или принятия risk waiver.

## Где брать данные

1. Local baseline: `npm run phase0:baseline`
2. Runtime readiness/telemetry: `npm run monitor:workbook -- --base-url <url>`
3. Сводный контроль артефактов фазы: `npm run phase0:verify`

