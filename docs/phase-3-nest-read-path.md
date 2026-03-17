# Phase 3: Nest Read-Path (Shadow First, Archived)

## Цель

Поднять `Nest` контур для read-path без переключения основного production-трафика и с контрактным паритетом к legacy API.

## Что внедрено

1. Отдельный Nest runtime: `backend/src/nest/main.ts`.
2. Модульная структура:
1. `AuthModule`
2. `SessionsModule` (включая drafts/events/snapshot/invite-resolve)
3. `MediaModule`
4. `TelemetryModule`
5. `HealthModule`
3. Read endpoints в Nest проксируются в legacy через `LegacyReadProxyService` с пробросом `cookie/authorization`.
4. Для SSE добавлен stream proxy: `/api/workbook/sessions/:id/events/stream`.
5. В legacy добавлен shadow compare middleware (`FF_NEST_API_SHADOW=1`) и diagnostics endpoint:
1. `GET /api/nest/shadow/parity`
2. метрики: `totalCompared`, `matched`, `mismatched`, `errors`, `mismatchRate`, `errorRate`.

## Команды запуска

1. Legacy API:
```bash
npm run backend:start
```
2. Nest read contour:
```bash
npm run backend:start:nest
```
3. Go/No-Go проверка паритета выполнялась в migration-периоде отдельным shadow parity скриптом (снят в phase E cleanup).

## Env-флаги

1. Исторические migration-флаги/параметры (`FF_NEST_API*`, `NEST_PROXY_MODE`, `NEST_SHADOW_*`) выведены из эксплуатации в phase E.

## Phase 3 Go/No-Go

1. Shadow parity в migration-периоде проходил (`mismatchRate <= 1%`, `errorRate <= 1%`, `totalCompared >= 100`).
2. Контрактные read-path вызовы в Nest совпадают с legacy по статусу и payload.
3. p95 latency/error-rate legacy не деградируют при включенном shadow.
