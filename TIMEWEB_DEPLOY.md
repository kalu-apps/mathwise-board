# Deploy в Timeweb (Math Realtime Board Service)

## 1) Frontend (App Platform)
- Тип: `Frontend`
- Build command: `npm ci && npm run build:board`
- Publish directory: `dist`

Переменные:
- `VITE_BOARD_MODE=realtime`
- `VITE_WHITEBOARD_ONLY=1`
- `VITE_API_BASE_URL=https://api.your-domain.tld`

Домены:
- `board.your-domain.tld` -> привязать в App Platform.

## 2) Backend (Cloud Server)
Запуск:
```bash
npm ci
npm run build:board
VITE_BOARD_MODE=realtime VITE_WHITEBOARD_ONLY=1 npm run backend:start:board
```

Переменные backend:
- `VITE_WHITEBOARD_TEACHER_PASSWORD=<strong-password>`
- `VITE_PUBLIC_BASE_URL=https://board.your-domain.tld`
- `CORS_ALLOWED_ORIGINS=https://board.your-domain.tld`
- `AUTH_COOKIE_DOMAIN=.your-domain.tld`
- `AUTH_COOKIE_SAME_SITE=Lax`
- `AUTH_COOKIE_SECURE=1`
- `PORT=4173`

## 3) DNS
- `board.your-domain.tld` -> App Platform frontend.
- `api.your-domain.tld` -> Cloud Server backend.

## 4) Проверка
1. Открыть `https://board.your-domain.tld`.
2. Авторизоваться преподавателем.
3. Создать сессию и invite-ссылку.
4. Открыть invite в отдельном браузере.
5. Проверить realtime синхронизацию и аудио.
