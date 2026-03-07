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
Обязательные:
- `VITE_BOARD_MODE=realtime`
- `WHITEBOARD_ONLY=1`
- `VITE_WHITEBOARD_TEACHER_LOGIN=teacher@axiom.demo`
- `VITE_WHITEBOARD_TEACHER_PASSWORD=magic`

Опционально:
- `VITE_BOARD_AUTO_LOGIN_EMAIL`
- `VITE_BOARD_AUTO_LOGIN_PASSWORD`
- `PORT`

Локальный пример переменных: `.env.board.example`.

## Доступ
- Преподаватель: вход по логину/паролю.
- Ученик: вход по временной invite-ссылке без пароля.

## Деплой на Amvera
См. инструкцию: `AMVERA_DEPLOY.md`.
