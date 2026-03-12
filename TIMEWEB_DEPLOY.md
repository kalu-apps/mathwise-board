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
BOARD_RUNTIME_REDIS_REQUIRED=1

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

Проверить обязательно:
- `storage.driver=postgres`
- `storage.required=true`
- `runtime.redis.required=true`
- `runtime.redis.connected=true`

## 2.1) PostgreSQL на Timeweb DBaaS
Нужно, чтобы backend реально работал не в file-mode, а в production `PostgreSQL`.

Если база и пользователь ещё не созданы, выполни из SQL-консоли Timeweb или через `psql` под админом:

```sql
CREATE ROLE board_app WITH LOGIN PASSWORD '<strong-password>';
CREATE DATABASE board_prod OWNER board_app;
GRANT ALL PRIVILEGES ON DATABASE board_prod TO board_app;
```

Проверка подключения с `mw-app-01`:
```bash
PGPASSWORD='<strong-password>' psql \
  "host=10.20.0.4 port=5432 dbname=board_prod user=board_app sslmode=require" \
  -c "select current_database(), current_user, now();"
```

После первого запуска backend сам создаст таблицы:
- `app_state`
- `workbook_events`
- `workbook_session_seq`
- `workbook_snapshots`

Проверка после старта приложения:
```bash
PGPASSWORD='<strong-password>' psql \
  "host=10.20.0.4 port=5432 dbname=board_prod user=board_app sslmode=require" \
  -c "\\dt"
```

## 2.2) Redis на Timeweb DBaaS
Redis нужен как обязательный runtime-контур для multi-node realtime fanout.

Проверка подключения с `mw-app-01`:
```bash
redis-cli -u "redis://default:<url-encoded-password>@10.20.0.5:6379/0" ping
```

Ожидаемый ответ:
```text
PONG
```

## 3) Nginx + SSL на `mw-app-01`
- Nginx проксирует `board` и `api.board` на `127.0.0.1:4173`.
- SSL выпускается certbot для обоих доменов.

Проверки:
```bash
curl -I https://board.your-domain.tld
curl -s https://api.your-domain.tld/healthz | python3 -m json.tool
```

Дополнительно проверить auth-protected runtime telemetry:
```bash
curl -si -c /tmp/board.cookies \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@axiom.demo","password":"<strong-password>"}' \
  https://api.your-domain.tld/api/auth/password/login

curl -s -b /tmp/board.cookies \
  'https://api.your-domain.tld/api/telemetry/runtime?limit=20' | python3 -m json.tool
```

В ответе должны быть:
- `diagnostics.rumBuffered`
- `diagnostics.workbookServerTracesBuffered`
- `workbookServerTraces`
- `rumEvents`

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
   - в `GET /api/telemetry/runtime?limit=20` появляются `append/publish_runtime/deliver_local/runtime_bridge` traces.
