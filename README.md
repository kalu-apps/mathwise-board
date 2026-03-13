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

## Git flow (prod + migration)

См. обязательные правила ветвления: `docs/branching-policy.md`.
