# Deploy в Timeweb Cloud (server-only)

Прод-контур:
- `mw-app-01` — frontend + API (`board.mathwise.ru`, `api.board.mathwise.ru`);
- `mw-media-01` — coturn (`turn.board.mathwise.ru`) + LiveKit (`rtc.board.mathwise.ru`);
- Timeweb DBaaS: PostgreSQL + Redis в приватной сети.

## 1) DNS
- `A board.mathwise.ru -> <mw-app-01 public IPv4>`
- `A api.board.mathwise.ru -> <mw-app-01 public IPv4>`
- `A turn.board.mathwise.ru -> <mw-media-01 public IPv4>`
- `A rtc.board.mathwise.ru -> <mw-media-01 public IPv4>`

## 2) Backend env на `mw-app-01`
Файл: `/opt/mathwise/board/.env.board`

```env
PORT=4173
HOST=0.0.0.0
VITE_BOARD_MODE=realtime
VITE_WHITEBOARD_ONLY=1
VITE_PUBLIC_BASE_URL=https://board.your-domain.tld
CORS_ALLOWED_ORIGINS=https://board.your-domain.tld
AUTH_COOKIE_DOMAIN=.your-domain.tld
AUTH_COOKIE_SAME_SITE=Lax
AUTH_COOKIE_SECURE=1
VITE_WHITEBOARD_TEACHER_PASSWORD=<strong-password>

BOARD_STORAGE_DRIVER=postgres
DATABASE_URL=postgresql://board_app:<url-encoded-password>@10.20.0.4:5432/board_prod?sslmode=no-verify
REDIS_URL=redis://default:<url-encoded-password>@10.20.0.5:6379/0

MEDIA_STUN_URLS=stun:stun.l.google.com:19302
MEDIA_TURN_URLS=turn:turn.your-domain.tld:3478?transport=udp,turns:turn.your-domain.tld:5349?transport=tcp
MEDIA_TURN_SECRET=<same-as-static-auth-secret-in-coturn>
MEDIA_TURN_TTL_SECONDS=3600
MEDIA_LIVEKIT_WS_URL=wss://rtc.board.your-domain.tld
MEDIA_LIVEKIT_API_KEY=<livekit-api-key>
MEDIA_LIVEKIT_API_SECRET=<livekit-api-secret>
MEDIA_LIVEKIT_TOKEN_TTL_SECONDS=3600
```

После изменений:
```bash
systemctl restart mathwise-board
curl -s https://api.your-domain.tld/healthz | python3 -m json.tool
```

## 3) Nginx + SSL на `mw-app-01`
- Nginx проксирует `board` и `api.board` на `127.0.0.1:4173`.
- SSL выпускается certbot для обоих доменов.

Проверки:
```bash
curl -I https://board.your-domain.tld
curl -s https://api.your-domain.tld/healthz | python3 -m json.tool
```

## 4) coturn на `mw-media-01`
Ключевые параметры `/etc/turnserver.conf`:
- `use-auth-secret`
- `static-auth-secret=<TURN_SECRET>`
- `realm=turn.your-domain.tld`
- `external-ip=<mw-media-01 public IPv4>`
- `listening-port=3478`
- `tls-listening-port=5349`
- `min-port=51000`
- `max-port=51999`

Должны быть открыты UDP/TCP порты:
- `3478`, `5349`, `51000-51999`.

## 5) LiveKit (обязателен для аудио)
- поднимается на `mw-media-01`;
- `rtc.board.your-domain.tld` проксируется на порт LiveKit;
- board backend выдаёт токен через `GET /api/workbook/sessions/:sessionId/media/livekit-token`;
- frontend подключается через `livekit-client` (без p2p сигналинга через workbook events).

## 6) Финальный smoke-check
1. Teacher логинится на `board.your-domain.tld`.
2. Создаёт урок, копирует invite.
3. Student входит по invite.
4. Проверка:
   - синхронность объектов;
   - чат realtime;
   - аудио в обе стороны (через TURN).
