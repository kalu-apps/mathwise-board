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
- состояние подключения к Redis (если `REDIS_URL` задан).

## Деплой в Timeweb
См. инструкцию: `TIMEWEB_DEPLOY.md`.
