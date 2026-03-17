# Phase E: Legacy Cleanup (Single Architecture)

## Цель

Убрать migration-only ветки и флаги, закрепить один production-путь:
- frontend hot-path только Zustand;
- backend ingress только через Nest API gateway.

## Что удалено

1. Backend migration flags:
- `FF_NEST_API`
- `FF_NEST_API_SHADOW`
- `NEST_PROXY_MODE`
- `NEST_LEGACY_BASE_URL`
- `NEST_SHADOW_TIMEOUT_MS`
- `NEST_SHADOW_SAMPLE_RATE`

2. Shadow parity code-path:
- удален `backend/src/nest/shadowParity.ts`
- удален `scripts/phase3-shadow-parity-check.mjs`
- удален npm script `phase3:parity`

3. Nest proxy routing:
- proxy middleware работает в always-on режиме для всех `/api/*` (кроме `/api/nest/proxy/diagnostics`).

## Текущий runtime-контур

1. `backend/src/server.ts`:
- единая точка ingress для API и статики;
- API всегда проксируется в Nest runtime.

2. `backend/src/nest/main.ts`:
- Nest runtime с реальным workbook API middleware (`setupMockServer(...)`).

3. Consistency controls:
- `NEST_OBJECT_VERSION_STRICT`
- `NEST_IDEMPOTENCY_*`

## Go/No-Go

1. `npm run verify` проходит.
2. `/api/nest/proxy/diagnostics` доступен и показывает `mode=nest-api-only`.
3. Нет использования удаленных migration-флагов в runtime-конфиге.
