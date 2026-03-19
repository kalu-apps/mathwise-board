# Phase C: Nest-Native API Cut-In (No Legacy Proxy/Fallback)

## Goal
Remove backend dependency on `legacy proxy/fallback` for primary `api/*` traffic and serve API logic inside the Nest process.

## Implemented
1. Nest boot now initializes storage/runtime and mounts the workbook API middleware directly:
   - `initializeDb()`
   - `initializeRuntimeServices()`
   - `createWorkbookApiMiddleware()` + `attachWorkbookLiveSocketServer(...)` in `backend/src/nest/main.ts`
2. Added passthrough guard for Nest internal diagnostics routes:
   - `/api/nest/*` bypass in `src/mock/server.ts`
3. Removed proxy/fallback layer from Nest app:
   - deleted `LegacyReadProxyService`
   - deleted fallback controller/module
   - deleted proxy response helper
   - deleted proxy-based auth/sessions/media/telemetry controllers+modules
   - deleted proxy-based workbook write controller
4. Simplified Nest module graph:
   - `AppModule` now imports only `HealthModule` and `WorkbookWriteModule` (diagnostics)

## Verification
1. `npm run verify` passes.
2. `rg` check for legacy proxy usage in `backend/src`:
   - no `LegacyReadProxyService`
   - no `legacy-fallback` module/controller
   - no `proxy-response` usage
3. Nest startup path reaches successful application initialization with new module set.

## Go/No-Go for Phase C
Go when production confirms:
1. 100% API ingress через Nest gateway stays stable.
2. Core API paths (`/api/auth/*`, `/api/workbook/*`, `/api/runtime/*`, `/api/telemetry/*`) return success from Nest path.
3. No `legacy_proxy_unavailable` / `nest_api_proxy_unavailable` spikes in logs.

## Notes
This phase removes the HTTP dependency on legacy fallback/proxy for main API handling.  
Consistency hardening (`idempotency`, strict `objectVersion`, snapshot barrier) is addressed in Phase D.
