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

3. Nest diagnostics routing:
- `/api/nest/proxy/diagnostics` обслуживается самим Nest и фиксирует `proxyMode=none`.

## Текущий runtime-контур

1. `backend:start`:
- запускает только Nest runtime (`backend/src/nest/main.ts`) как единую ingress-точку.

2. `backend/src/nest/main.ts`:
- Nest runtime с прямым подключением workbook API/WS через
  `createWorkbookApiMiddleware()` и `attachWorkbookLiveSocketServer(...)`
  без внешнего proxy-сервера.

3. Consistency controls:
- `NEST_OBJECT_VERSION_STRICT`
- `NEST_IDEMPOTENCY_*`

## Go/No-Go

1. `npm run verify` проходит.
2. `/api/nest/proxy/diagnostics` доступен и показывает `proxyMode=none`.
3. Нет использования удаленных migration-флагов в runtime-конфиге.
