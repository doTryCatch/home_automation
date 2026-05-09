# AGENTS.md

## Project Overview

IoT home automation: ESP8266 firmware ↔ WebSocket ↔ Bun/Express 5 API ↔ PostgreSQL ↔ Expo React Native app.

The ESP8266 connects to the backend API via **WebSocket** (not MQTT). The app connects via HTTP + WebSocket. Both make **outbound** connections — only the API port needs to be exposed (e.g. via ngrok). No port forwarding or public IP needed on the ESP or phone network. MQTT broker runs locally alongside the API but is not required for ESP communication.

## Startup Order

1. `docker compose up -d` (Postgres 16 :5432, Mosquitto 2 :1883/:9001 — Mosquitto optional, retained for future use)
2. `cp api/.env.example api/.env && cd api && bun install && bunx prisma migrate dev && bun run dev`
3. `cd app && yarn && npx expo start` — uses **yarn** only (`packageManager` in `package.json`); the existing `package-lock.json` is stale, ignore it
4. Flash `firmware/home_automation.ino` to ESP8266 after updating `firmware/config.h` (set `API_SERVER` and `API_PORT`)

## Developer Commands

### API (`api/`)

| Command | Purpose |
|---|---|
| `bun run dev` | Dev server with `--watch` (entry: `src/server.ts`) |
| `bun run build` | Bundle to `dist/` |
| `bun run start` | Run compiled `dist/` output |
| `bun run prisma:migrate` | Run pending migrations |
| `bun run prisma:generate` | Regenerate Prisma client |
| `bun run prisma:push` | Push schema to DB without migration |
| `bun run prisma:studio` | Prisma GUI at `localhost:5555` |

No lint, typecheck, or test scripts configured.

### App (`app/`)

| Command | Purpose |
|---|---|
| `npx expo start` | Metro dev server |
| `npx expo start --android` | Run on Android |
| `npx expo lint` | ESLint via Expo |

No test scripts configured. Path alias: `@/*` → `src/*`.

## Architecture Gotchas

### API

- **Bun runtime** (not Node). **Express 5** (not v4) — middleware API differs.
- **Zod v4** (not v3) — `z` import works the same but some advanced APIs differ.
- **Services are singletons**: each service file does `export default new XService()` — import as instances, not classes.
- **Validation middleware**: `validate(schema)` validates body+query+params (does NOT replace `req.body`); `validateBody(schema)` body-only (replaces `req.body` with parsed result); `validateQuery(schema)` query-only (replaces `req.query` with parsed result). All in `src/middleware/validation.middleware.ts`.
- **Startup sequence** (`src/server.ts`): DB connect → HTTP server create → WebSocket init → schedule service start → `server.listen`. MQTT connection removed from startup; server starts without external broker dependency.
- **WebSocket handles both app and ESP**: single `WebSocketService` in `src/utils/websocket.ts` manages app client connections (by userId) and ESP connections (by MAC address). The barrel `src/utils/index.ts` re-exports it as `webSocketService`.
- **Config**: loaded from `src/config/index.ts` via `dotenv` with env var fallbacks. `server.ts` calls `import 'dotenv/config'` at the top so env is loaded early.
- **API routes**: all under `/api/` prefix (`auth`, `floors`, `rooms`, `devices`, `schedules`, `esp`). Health check at `/health`.

### WebSocket Protocol

- Path: `/ws` on the HTTP server — shared by both app and ESP
- **App auth**: client sends `{ "type": "auth", "userId": "<user_id>" }`
- **ESP auth**: ESP sends `{ "type": "esp_auth", "mac": "AA:BB:CC:DD:EE:FF" }`
- **ESP → API messages**: `esp_heartbeat`, `esp_status`, `esp_register`
- **API → ESP messages**: `esp_command` (pin control), `esp_config` (add/remove device), `esp_sync` (initial state sync)
- **App events**: `device_update` and `esp_status` broadcast to authenticated user connections
- Heartbeat/pong every 30s; dead connections auto-terminated

### Database (Prisma + PostgreSQL)

- All models use `@@map` to plural snake_case table names
- Entity hierarchy: `User → Floor → Room → Device`. `Device` links to `EspDevice` (by `esp_device_id` FK) and `DeviceType` (by `type_id` FK). **`EspDevice` holds the MAC address, not `Device`.**
- `Schedule` service is **in-memory cron** (checks every 60s, reloads on start, state lost on crash)
- `DeviceStateHistory` tracks every state change with source: `manual | schedule | automation | device`
- `Notification` model exists in schema but has no API routes or service yet

### App (`app/`)

- **Zustand stores**: `useAuthStore`, `useHomeStore`, `useDeviceStore`, `useScheduleStore`, `useSettingsStore` — all in single file `src/store/index.ts`
- **Services** in `src/services/` mirror API endpoints
- **Navigation**: `AppNavigator` → `AuthNavigator` / `MainNavigator` (stack + bottom tabs)
- **Server config**: API URL configured at runtime via `useSettingsStore` and persisted in AsyncStorage (default: `http://192.168.1.100:3000/api`) — NOT in `app.json` `extra`
- **Babel**: `react-native-reanimated/plugin` is required in `babel.config.js` — do not remove

### Firmware (`firmware/`)

- Entry: `home_automation.ino`; headers: `config.h`, `wifi_manager.h`, `ws_client.h`, `device_manager.h`
- **Uses WebSocket** (not MQTT) — connects to `ws://API_SERVER:API_PORT/ws` via `WebSocketsClient` library (by Links2004/arduinoWebSockets)
- Set `API_SERVER` and `API_PORT` in `config.h` before flashing. Set `WS_USE_TLS` to `true` if using ngrok/Cloudflare.
- Heartbeat every 60s; auto-reconnect every 5s; max 17 pins
- Legacy MQTT client preserved in `mqtt_client.h` (not compiled) for reference

## Environment

- `api/.env` required — see `api/.env.example` (DB URL, JWT secrets)
- `docker-compose.yml` uses `homeauto:homeauto123` for Postgres, database `home_automation`
- Mosquitto service still in `docker-compose.yml` but no longer required for ESP communication

## Exposing for Remote Access

For development across networks, expose only the API port:
```bash
ngrok http 3000
```
Set the ngrok URL as `API_SERVER` in `firmware/config.h` (strip `https://`, set `API_PORT` to `443`, set `WS_USE_TLS` to `true`). The app's API URL setting also needs the ngrok URL.
