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
WHITEBOARD_TEACHER_PASSWORD=<strong-password>
WHITEBOARD_TEACHER_EMAIL=teacher@axiom.demo
VITE_WHITEBOARD_TEACHER_EMAIL_HINT=teacher@axiom.demo

BOARD_STORAGE_DRIVER=postgres
DATABASE_URL=postgresql://board_app:<url-encoded-password>@10.20.0.4:5432/board_prod?sslmode=require
BOARD_PG_POOL_MAX=20
BOARD_PG_POOL_MIN=2
BOARD_PG_POOL_IDLE_TIMEOUT_MS=30000
BOARD_PG_POOL_CONNECTION_TIMEOUT_MS=5000
BOARD_PG_POOL_MAX_USES=0
BOARD_PG_QUERY_TIMEOUT_MS=15000
BOARD_PG_INIT_RETRIES=3
BOARD_PG_INIT_RETRY_DELAY_MS=750
BOARD_PG_SSL_REJECT_UNAUTHORIZED=0
WORKBOOK_ACCESS_LOG_RETENTION_DAYS=90
WORKBOOK_ACCESS_LOG_HASH_SALT=<random-secret-salt>
REDIS_URL=redis://default:<url-encoded-password>@10.20.0.5:6379/0
BOARD_RUNTIME_REDIS_REQUIRED=1
BOARD_RUNTIME_REDIS_CONNECT_TIMEOUT_MS=4000
BOARD_RUNTIME_REDIS_INIT_TIMEOUT_MS=8000
BOARD_RUNTIME_REDIS_COMMAND_TIMEOUT_MS=1500
BOARD_RUNTIME_REDIS_RECONNECT_BASE_DELAY_MS=150
BOARD_RUNTIME_REDIS_RECONNECT_MAX_DELAY_MS=5000
BOARD_RUNTIME_REDIS_RECONNECT_MAX_ATTEMPTS=0
BOARD_RUNTIME_REDIS_INIT_MAX_ATTEMPTS=3
BOARD_RUNTIME_REDIS_INIT_RETRY_DELAY_MS=600
BOARD_RUNTIME_REDIS_COMMAND_RETRIES=1
BOARD_RUNTIME_REDIS_PUBLISH_RETRIES=2
BOARD_RUNTIME_REDIS_KEEPALIVE_MS=30000
BOARD_RUNTIME_REDIS_DISABLE_OFFLINE_QUEUE=0
WORKBOOK_SESSION_AFFINITY_BUCKETS=128
WORKBOOK_SESSION_AFFINITY_SALT=<random-affinity-salt>
WORKBOOK_SESSION_AFFINITY_COOKIE_ENABLED=1
WORKBOOK_SESSION_AFFINITY_COOKIE_NAME=mw_session_affinity
WORKBOOK_SESSION_AFFINITY_COOKIE_TTL_SECONDS=28800
WORKBOOK_SESSION_AFFINITY_COOKIE_SAME_SITE=Lax
WORKBOOK_SESSION_AFFINITY_COOKIE_SECURE=1
WORKBOOK_SESSION_AFFINITY_COOKIE_HTTP_ONLY=0
WORKBOOK_SESSION_AFFINITY_COOKIE_DOMAIN=.your-domain.tld

MEDIA_STUN_URLS=stun:stun.l.google.com:19302
MEDIA_TURN_URLS=turn:turn.your-domain.tld:3478?transport=udp,turns:turn.your-domain.tld:5349?transport=tcp
MEDIA_TURN_SECRET=<same-as-static-auth-secret-in-coturn>
MEDIA_TURN_TTL_SECONDS=3600
MEDIA_LIVEKIT_WS_URL=wss://rtc.board.your-domain.tld
MEDIA_LIVEKIT_API_KEY=<livekit-api-key>
MEDIA_LIVEKIT_API_SECRET=<livekit-api-secret>
MEDIA_LIVEKIT_TOKEN_TTL_SECONDS=3600
```

Примечание: migration-флаги `FF_NEST_API*` и `NEST_PROXY_MODE` выведены из эксплуатации; API ingress в Nest работает всегда.

После изменений:
```bash
systemctl restart mathwise-board
curl -s https://api.your-domain.tld/healthz | python3 -m json.tool
curl -s https://api.your-domain.tld/api/runtime/infra | python3 -m json.tool
```

Проверить обязательно:
- `storage.driver=postgres`
- `storage.required=true`
- `runtime.redis.required=true`
- `runtime.redis.connected=true`
- `storage.postgresPool.waitingCount` в норме (обычно `0`)
- `affinity.buckets` соответствует плану (`128` или ваш выбранный размер)

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
- `workbook_access_logs`

Логи входов/устройств сохраняются только в `PostgreSQL` и не отдаются через API. Чтение только через терминал сервера.

Быстрый просмотр через встроенный скрипт (на `mw-app-01`, из `/opt/mathwise/board`):
```bash
npm run logs:workbook -- --session <session-id> --limit 50
```

Пример команды (последние 50 событий по сессии):
```bash
PGPASSWORD='<strong-password>' psql \
  "host=10.20.0.4 port=5432 dbname=board_prod user=board_app sslmode=require" \
  -c "SELECT created_at, event_type, actor_user_id, actor_role, actor_name, user_agent_family, device_class, ip_hash, device_id_hash, details FROM workbook_access_logs WHERE session_id = '<session-id>' ORDER BY created_at DESC LIMIT 50;"
```

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

### 3.1) Maintenance-страница на время релиза (рекомендуется)
Цель: если backend перезапускается/недоступен, пользователю показывается фирменная страница обслуживания, а не `502/504`.

1. В nginx-конфиг server-блока `board.mathwise.ru` добавить сниппет из:
   - [`docs/nginx/board-maintenance.conf.example`](./docs/nginx/board-maintenance.conf.example)
2. Убедиться, что файл существует в собранном фронте:
   - `/opt/mathwise/board/dist/maintenance.html` (берётся из [`public/maintenance.html`](./public/maintenance.html))
3. Перезагрузить nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

Операционные команды (на `mw-app-01`, из `/opt/mathwise/board`):
```bash
npm run maintenance:status
npm run maintenance:on
npm run maintenance:off
```

По умолчанию скрипт работает с флагом `/opt/mathwise/board/MAINTENANCE_MODE` и делает `systemctl reload nginx`.
Можно переопределить:
```bash
MAINTENANCE_FLAG_FILE=/custom/path/MAINTENANCE_MODE \
MAINTENANCE_RELOAD_CMD='nginx -s reload' \
npm run maintenance:on
```

Смысл режима:
- `maintenance:on` => принудительно отдаётся `maintenance.html` на `board.mathwise.ru`.
- `maintenance:off` => возврат обычного трафика.
- Даже без флага, при `502/503/504` upstream nginx отдаст `maintenance.html` как fallback.

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

Рекомендуемая production-модель:
- `LiveKit` должен быть поднят через `systemd`, а не отдельным background-процессом;
- source of truth для `LiveKit keys` должен быть один, например `/etc/livekit.yaml`;
- `MEDIA_LIVEKIT_API_KEY` и `MEDIA_LIVEKIT_API_SECRET` на `mw-app-01` обязаны совпадать с `keys:` в `/etc/livekit.yaml`;
- если рядом есть `/opt/mathwise/media/.env.media`, он не должен расходиться с `/etc/livekit.yaml`.

Минимальные проверки на `mw-media-01`:
```bash
systemctl status livekit --no-pager -l
ps -ef | grep [l]ivekit
ss -ltnp | grep -E "7880|7881"
nginx -T 2>/dev/null | grep -nA20 -B5 "server_name rtc.board.your-domain.tld"
```

Если `ps` показывает живой `/livekit-server`, а `systemctl status livekit` — `inactive/dead`, значит сервис запущен вне supervisor-контура. Это источник плавающих аудио-сбоев и плохой диагностики.

## 6) Финальный smoke-check
1. Teacher логинится на `board.your-domain.tld`.
2. Создаёт урок, копирует invite.
3. Student входит по invite.
4. Проверка:
   - синхронность объектов;
   - чат realtime;
   - аудио в обе стороны (через TURN).
   - в `GET /api/telemetry/runtime?limit=20` появляются `append/publish_runtime/deliver_local/runtime_bridge` traces.

## 7) Phase-7 cutover

```bash
cd /opt/mathwise/board
PHASE7_BASE_URL=https://api.board.your-domain.tld \
PHASE7_DRY_RUN=0 \
PHASE7_SET_TRAFFIC_CMD='<set-lb-traffic-to-{percent}-percent>' \
PHASE7_ROLLBACK_CMD='<rollback-lb-to-{previous_percent}-percent>' \
npm run phase7:cutover

npm run phase7:report
```
