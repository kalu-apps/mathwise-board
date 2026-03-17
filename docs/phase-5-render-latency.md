# Phase 5: Render + Latency Optimization

## Цель

Стабилизировать realtime UX под classroom-нагрузкой (`100+` примитивов/сек) без фризов при одновременном `Audio + Board`.

## Что внедрено

1. Committed-layer вынесен в `Canvas2D`, интерактивный overlay оставлен в `SVG`:
1. `WorkbookCommittedCanvasLayer` встраивается через feature flag.
2. Для export/screenshot сохранен SVG fallback через `data-workbook-export-only`.
2. Тяжелая подготовка stroke batches вынесена в Web Worker:
1. culling по viewport/page;
2. point simplification и sampling;
3. batched draw payload для main-thread canvas draw.
3. Polling транспорта переведен на adaptive cycle:
1. event/idle/error-aware schedule;
2. jitter + backoff;
3. separate tuning для stream/live connected и media-audio connected режимов.
4. Введен backpressure для volatile preview:
1. queue trim по лимитам;
2. flush trim по recency;
3. drop stale preview без потери commit path;
4. отдельная observability метрика `phase=drop`.

## Runtime flags

1. `VITE_FF_NEW_RENDERER=1` включает committed Canvas2D layer (`ff_board_canvas_committed_layer`).
2. `VITE_FF_REALTIME_ADAPTIVE_POLLING=1` включает adaptive polling (`ff_realtime_adaptive_polling`).
3. `VITE_FF_REALTIME_BACKPRESSURE_V2=1` включает backpressure/drop policy (`ff_realtime_backpressure_v2`).

По умолчанию флаги выключены.

## Go/No-Go (Phase 5)

1. `p95 teacher-action -> peer-preview <= 230ms`.
2. `realtime gap rate <= 2.0%`.
3. `frame budget miss (input-to-paint p95)` не хуже baseline.
4. нет P1/P0 инцидентов по realtime/media в canary.
5. drop metric (`phase=drop`) не сопровождается ростом commit-loss (persisted events loss = 0).

## Проверка перед rollout

```bash
npm run lint
npm run build:board
```

Production/staging smoke:

```bash
npm run monitor:workbook
```

## Rollback

1. Отключить `VITE_FF_REALTIME_BACKPRESSURE_V2`.
2. Отключить `VITE_FF_REALTIME_ADAPTIVE_POLLING`.
3. Отключить `VITE_FF_NEW_RENDERER` (возврат committed-layer в SVG path).
