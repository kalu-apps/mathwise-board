# Math Realtime Board Service

Realtime-микросервис для совместной математической доски: преподаватель запускает сессию и приглашает учеников по временной ссылке.

## Назначение
- запуск коллективного урока на доске;
- совместная работа teacher/student в реальном времени;
- авторизация преподавателя и вход ученика по invite-ссылке;
- управление участниками, инструментами и состоянием сессии.

## Стек
- React + TypeScript + Vite
- MUI
- Node.js backend (mock API + SSE realtime) внутри этого репозитория

## Локальный запуск
```bash
npm install
npm run dev:board
```

Ключевые маршруты:
- `/` — экран входа и запуск урока
- `/workbook/session/:sessionId` — рабочая доска
- `/workbook/invite/:token` — вход ученика по приглашению

## Прод-запуск (единый сервис: frontend + backend)
```bash
npm run build:board
npm run backend:start:board
```

## Переменные окружения
Обязательные для frontend-сборки:
- `VITE_BOARD_MODE=realtime`
- `VITE_WHITEBOARD_ONLY=1`
- `VITE_API_BASE_URL=https://api.your-domain.tld` (если backend на отдельном домене)

Обязательные для backend runtime:
- `VITE_WHITEBOARD_TEACHER_PASSWORD=<strong-password>`
- `BOARD_STORAGE_DRIVER=postgres|file|auto`
- `DATABASE_URL=postgresql://...` (для `BOARD_STORAGE_DRIVER=postgres` или `auto`)

Опционально:
- `VITE_PUBLIC_BASE_URL=https://board.your-domain.tld`
- `CORS_ALLOWED_ORIGINS=https://board.your-domain.tld`
- `AUTH_COOKIE_DOMAIN=.your-domain.tld`
- `AUTH_COOKIE_SAME_SITE=Lax|None|Strict`
- `AUTH_COOKIE_SECURE=1`
- `REDIS_URL=redis://...` (runtime connectivity/ping)
- `BOARD_RUNTIME_REDIS_REQUIRED=1` (для production multi-node контура; не даёт тихо стартовать без Redis)
- `BOARD_RUNTIME_REDIS_CONNECT_TIMEOUT_MS=4000`
- `BOARD_RUNTIME_REDIS_INIT_TIMEOUT_MS=8000`
- `BOARD_RUNTIME_REDIS_COMMAND_TIMEOUT_MS=1500`
- `BOARD_RUNTIME_REDIS_RECONNECT_BASE_DELAY_MS=150`
- `BOARD_RUNTIME_REDIS_RECONNECT_MAX_DELAY_MS=5000`
- `BOARD_RUNTIME_REDIS_RECONNECT_MAX_ATTEMPTS=0` (`0` = без hard-limit, controlled retry)
- `BOARD_RUNTIME_REDIS_INIT_MAX_ATTEMPTS=3`
- `BOARD_RUNTIME_REDIS_INIT_RETRY_DELAY_MS=600`
- `BOARD_RUNTIME_REDIS_COMMAND_RETRIES=1`
- `BOARD_RUNTIME_REDIS_PUBLISH_RETRIES=2`
- `BOARD_RUNTIME_REDIS_KEEPALIVE_MS=30000`
- `BOARD_RUNTIME_REDIS_DISABLE_OFFLINE_QUEUE=0`
- `BOARD_PG_POOL_MAX=20`
- `BOARD_PG_POOL_MIN=2`
- `BOARD_PG_POOL_IDLE_TIMEOUT_MS=30000`
- `BOARD_PG_POOL_CONNECTION_TIMEOUT_MS=5000`
- `BOARD_PG_POOL_MAX_USES=0`
- `BOARD_PG_QUERY_TIMEOUT_MS=15000`
- `BOARD_PG_INIT_RETRIES=3`
- `BOARD_PG_INIT_RETRY_DELAY_MS=750`
- `BOARD_PG_SSL_REJECT_UNAUTHORIZED=0`
- `WORKBOOK_SESSION_AFFINITY_BUCKETS=128`
- `WORKBOOK_SESSION_AFFINITY_SALT=<random-affinity-salt>`
- `WORKBOOK_SESSION_AFFINITY_COOKIE_ENABLED=1`
- `WORKBOOK_SESSION_AFFINITY_COOKIE_NAME=mw_session_affinity`
- `WORKBOOK_SESSION_AFFINITY_COOKIE_TTL_SECONDS=28800`
- `WORKBOOK_SESSION_AFFINITY_COOKIE_SAME_SITE=Lax|None|Strict`
- `WORKBOOK_SESSION_AFFINITY_COOKIE_SECURE=1`
- `WORKBOOK_SESSION_AFFINITY_COOKIE_HTTP_ONLY=0`
- `WORKBOOK_SESSION_AFFINITY_COOKIE_DOMAIN=.your-domain.tld`
- `MEDIA_STUN_URLS=stun:stun.l.google.com:19302`
- `MEDIA_TURN_URLS=turn:turn.your-domain.tld:3478?transport=udp,turns:turn.your-domain.tld:5349?transport=tcp`
- `MEDIA_TURN_SECRET=<coturn static-auth-secret>` (предпочтительно)  
  или пара `MEDIA_TURN_STATIC_USERNAME` + `MEDIA_TURN_STATIC_CREDENTIAL`
- `MEDIA_TURN_TTL_SECONDS=3600`
- `MEDIA_LIVEKIT_WS_URL=wss://rtc.your-domain.tld`
- `MEDIA_LIVEKIT_API_KEY=<livekit-api-key>`
- `MEDIA_LIVEKIT_API_SECRET=<livekit-api-secret>`
- `MEDIA_LIVEKIT_TOKEN_TTL_SECONDS=3600`
- `VITE_BOARD_AUTO_LOGIN_EMAIL`
- `VITE_BOARD_AUTO_LOGIN_PASSWORD`
- `PORT`

Локальный пример переменных: `.env.board.example`.

## Доступ
- Преподаватель: вход по логину/паролю.
- Ученик: вход по временной invite-ссылке без пароля.

## Healthcheck
`GET /healthz` возвращает статус сервиса и runtime-диагностику:
- активный драйвер хранения (`file`/`postgres`);
- preferred/required состояние storage/runtime контуров;
- состояние подключения к Redis (если `REDIS_URL` задан);
- медиа-конфиг (`media.turnAuthMode`, количество STUN/TURN URL, статус `media.livekit.configured`).
- telemetry summary (`telemetry.rumBuffered`, `telemetry.workbookServerTracesBuffered`, `telemetry.recentSlowWorkbookTraceCount`).
- session affinity diagnostics (`affinity.headers/buckets/nodeId/stats`).

Инфраструктурный runtime срез (phase 6):
- `GET /api/runtime/infra`
- включает `readiness`, `storage.postgresPool`, `runtime.redis`, `telemetry`, `affinity`.

Auth-protected runtime telemetry:
- `GET /api/telemetry/runtime?limit=50`
- в `rumEvents` можно смотреть клиентские `media` события для диагностики LiveKit token/connect ошибок и transient reconnect.
- для `board realtime`-сборки RUM включён по умолчанию, чтобы production-диагностика доски не зависела от отдельного флага.

WebRTC ICE-конфиг для аудио выдаётся runtime-эндпоинтом:
- `GET /api/workbook/sessions/:sessionId/media/config`

LiveKit token для подключения к аудио-комнате:
- `GET /api/workbook/sessions/:sessionId/media/livekit-token`

## Деплой в Timeweb
См. инструкцию: `TIMEWEB_DEPLOY.md`.

## Phase 0 (migration foundation)

Перед работами по миграции `frontend -> zustand` и `backend -> nest` используйте Phase 0 артефакты:

- roadmap и Definition of Done: `docs/phase-0-foundation.md`
- KPI и go/no-go ворота: `docs/phase-0-kpi-gates.md`
- фичефлаги и rollout/rollback: `docs/feature-flags-rollout.md`
- target architecture ADR: `docs/adr/ADR-001-zustand-nest-target-architecture.md`

Команды:

```bash
npm run phase0:verify
npm run phase0:baseline
```

С runtime baseline (production/staging):

```bash
PHASE0_BASE_URL=https://api.board.mathwise.ru npm run phase0:baseline
```

## Phase 3 (Nest read-path shadow, archived)

Документация и go/no-go: `docs/phase-3-nest-read-path.md`.

Команды:

```bash
npm run backend:start:nest
```

## Phase 4 (Nest write consistency gateway)

Документация: `docs/phase-4-nest-write-consistency.md`.

## Phase 5 (Render + latency optimization)

Документация: `docs/phase-5-render-latency.md`.

## Phase 6 (Scaling + infra hardening)

Документация: `docs/phase-6-infra-hardening.md`.

Команды:

```bash
npm run phase6:infra
npm run phase6:load
npm run phase6:check
```

## Phase 7 (Cutover + legacy cleanup)

Документация: `docs/phase-7-cutover.md`.

Команды:

```bash
npm run phase7:cutover
npm run phase7:report
```

Phase E cleanup артефакт: `docs/phase-e-legacy-cleanup.md`.

## Phase F (Cutover verification + stabilization)

Документация: `docs/phase-f-cutover-stabilization.md`.

Команды:

```bash
npm run phasef:stabilize
npm run phasef:report
npm run phasef:check
```

## Git flow (prod + migration)

См. обязательные правила ветвления: `docs/branching-policy.md`.
