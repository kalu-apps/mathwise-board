# Phase 3: Nest Read-Path (Shadow First)

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
3. Go/No-Go проверка паритета:
```bash
PHASE3_BASE_URL=http://127.0.0.1:4173 npm run phase3:parity
```

## Env-флаги

1. `FF_NEST_API=1` — включает Nest процесс в deployment-конфиге (отдельный сервис).
2. `FF_NEST_API_SHADOW=1` — включает legacy->nest shadow compare.
3. `NEST_API_BASE_URL` — адрес Nest контура для shadow.
4. `NEST_LEGACY_BASE_URL` — адрес legacy API, который читает Nest.
5. `NEST_PROXY_TIMEOUT_MS`, `NEST_SHADOW_TIMEOUT_MS`, `NEST_SHADOW_SAMPLE_RATE`.

## Phase 3 Go/No-Go

1. `phase3:parity` проходит (`mismatchRate <= 1%`, `errorRate <= 1%`, `totalCompared >= 100`).
2. Контрактные read-path вызовы в Nest совпадают с legacy по статусу и payload.
3. p95 latency/error-rate legacy не деградируют при включенном shadow.
