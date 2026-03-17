# ADR-001: Target Architecture for Zustand/Nest Migration

- Status: Accepted
- Date: 2026-03-17
- Decision drivers:
1. Снизить риск дальнейшего роста монолитных компонентов.
2. Поддержать высокую производительность realtime-доски при расширении функционала.
3. Обеспечить безопасную эволюцию backend в multi-instance production.

## Контекст

Текущая система содержит крупные точки концентрации логики:

1. frontend orchestration в `WorkbookSessionPage.tsx` и `WorkbookCanvas.tsx`;
2. backend маршрутизация и runtime orchestration в монолитном `src/mock/server.ts`;
3. сложная связка realtime + persistence + media требует формализованных границ доменов.

Миграция на `zustand` и `nest` уже является обязательным направлением развития.

## Решение

### Frontend (target)

Вводим domain-driven store layer на `zustand`:

1. `sceneStore`:
1. committed strokes/objects/constraints/snapshots;
2. selectors для scene access и derived geometry.
2. `runtimeStore`:
1. transient local preview/runtime state;
2. apply queue, backpressure control.
3. `collabStore`:
1. realtime connection state, seq/gap handling, participant presence.
4. `uiStore`:
1. panel/tool states, dialogs, viewport UI shell.
5. `mediaStore`:
1. LiveKit/audio connection and device state.

Компоненты получают данные через узкие selectors и controller hooks.

### Backend (target)

Вводим модульную архитектуру на `NestJS`:

1. `AuthModule`
2. `WorkbookSessionsModule`
3. `WorkbookEventsModule`
4. `WorkbookSnapshotsModule`
5. `WorkbookPresenceModule`
6. `WorkbookRealtimeGatewayModule` (WS/SSE)
7. `MediaModule` (LiveKit token/config)
8. `TelemetryModule`

Redis используется для runtime pub/sub и sequence coordination.
Postgres используется как authoritative persistent storage для events/snapshots/meta.

### Shared contracts

Вводим единый слой контрактов:

1. versioned DTO/event schema;
2. runtime validation на boundary (`api`/`realtime`);
3. контрактная совместимость legacy и nest путей в период миграции.

## Стратегия миграции

Выбрана `strangler`-стратегия:

1. Сначала Nest read-path в shadow;
2. Затем Nest write-path под флагом;
3. Затем realtime gateway под флагом;
4. Финальный cutover после canary и SLO-stability.

## Рассмотренные альтернативы

1. Big-bang migration на zustand + nest:
1. отклонено из-за высокого blast radius.
2. Сохранение текущей архитектуры и локальные оптимизации:
1. отклонено из-за накопления техдолга и слабой масштабируемости.

## Последствия

Положительные:

1. управляемая декомпозиция с rollback-safe rollout;
2. прозрачные domain boundaries;
3. более предсказуемая эксплуатация под нагрузкой.

Негативные:

1. временное усложнение кода из-за dual-path и feature flags;
2. необходимость поддержки contract parity в период миграции.

## Инварианты

1. Ни один этап не закрывается без KPI gate.
2. Любой рискованный change обязан быть под feature flag.
3. Любой rollback должен выполняться без data-loss сценариев.

