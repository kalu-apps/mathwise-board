# Feature Flags Registry and Rollout Plan

## Цель

Обеспечить управляемый переход на новую архитектуру без big-bang релиза.

## Реестр флагов

| Flag | Default | Область | Назначение | Rollback |
|---|---|---|---|---|
| `ff_realtime_adaptive_polling` | `false` | Frontend realtime | Адаптивный poll/backoff вместо фиксированного polling цикла | Вернуть фиксированные интервалы |
| `ff_realtime_backpressure_v2` | `false` | Realtime pipeline | Новый backpressure и drop-stale policy для preview | Вернуть старый runtime apply/send policy |
| `ff_board_canvas_committed_layer` | `false` | Rendering | Committed scene слой на Canvas2D | Вернуть SVG committed path |
| `ff_board_worker_compute` | `false` | Rendering/runtime | Off-main-thread вычисления тяжелых derive задач | Вернуть inline main-thread compute |

Runtime env mapping:

1. `ff_realtime_adaptive_polling` -> `VITE_FF_REALTIME_ADAPTIVE_POLLING=1` (alias: `VITE_FF_ADAPTIVE_POLLING=1`)
2. `ff_realtime_backpressure_v2` -> `VITE_FF_REALTIME_BACKPRESSURE_V2=1` (alias: `VITE_FF_BACKPRESSURE_V2=1`)
3. `ff_board_canvas_committed_layer` -> `VITE_FF_NEW_RENDERER=1` (aliases: `VITE_FF_BOARD_CANVAS_COMMITTED_LAYER=1`, `VITE_FF_FRONTEND_NEW_RENDERER=1`)
4. `ff_board_worker_compute` -> включается вместе с `ff_board_canvas_committed_layer` в текущей реализации (worker-path активируется внутри new renderer path)
5. consistency controls на Nest-path управляются env-параметрами `NEST_OBJECT_VERSION_STRICT` и `NEST_IDEMPOTENCY_*` без migration-флагов.

`ff_frontend_zustand_store` выведен из эксплуатации в фазе B: фронтовый hot-path работает только через Zustand slices.

## Политика включения

1. По умолчанию все новые флаги выключены.
2. Один флаг включается отдельно, без пакетного переключения.
3. Для каждого флага обязательны:
1. owner (доменная команда);
2. KPI для наблюдения;
3. rollback-команда/процедура;
4. TTL существования флага (чтобы не копить permanent flags).

## Rollout Strategy

Порядок rollout для production:

1. `0%` (shadow-only/disabled)
2. `10%` (canary)
3. `25%`
4. `50%`
5. `100%`

Переход на следующий шаг разрешен только если:

1. KPI из [phase-0-kpi-gates](/Users/ivankalugin/Documents/New project/mathwise-board/docs/phase-0-kpi-gates.md) в целевой зоне;
2. нет P0/P1 инцидентов;
3. нет роста gap/failure rate.

Phase-7 cutover завершен: backend работает в always-on Nest ingress режиме без migration-флагов `FF_NEST_API*` и `NEST_PROXY_MODE`.

## Автоматические rollback-триггеры

Rollback выполняется немедленно, если:

1. `Workbook failure rate > 0.20`;
2. `Teacher->peer preview p95 > 230ms`;
3. `Realtime gap rate > 2.0%`;
4. наблюдается потеря persisted событий или критичная консистентность снапшотов.

## Change Safety Checklist

Перед merge любой задачи миграции:

1. изменение защищено флагом;
2. есть fallback-path;
3. обновлены docs (owner + KPI + rollback);
4. пройден `npm run verify` и `npm run phase0:verify`.
