# Architecture Change: ESP MQTT → WebSocket

## Problem

The original architecture required the ESP8266 to connect directly to an MQTT broker (Mosquitto):

```
ESP8266 ──MQTT (port 1883)──► Mosquitto
Phone   ──HTTP/WS──► API ──MQTT──► Mosquitto
```

This created a deployment challenge: exposing the local MQTT broker to the internet so the ESP could reach it required either:
- A VPS with a public IP ($3-5/month)
- A TCP tunnel (ngrok TCP — changes port on every restart)
- Cloudflare Spectrum TCP proxy (paid feature)

Free options like Cloudflare Tunnel only proxy HTTP/WebSocket traffic on port 443 — **not raw TCP on port 1883** (that's the Spectrum product).

## Solution

The ESP now connects to the backend API via **WebSocket** instead of MQTT. Since the API and Mosquitto run on the same machine, only the API port needs to be exposed to the internet:

```
ESP8266 ──WebSocket──► API (port 3000) ──MQTT (local)──► Mosquitto
Phone   ──HTTP/WS──► API (port 3000) ──MQTT (local)──► Mosquitto
```

A single `ngrok http 3000` exposes everything needed. Both ESP and phone make outbound connections on port 443 — the most firewall-friendly port possible.

## What Changed

### API (`api/`)

#### `src/utils/websocket.ts` — Major rewrite
- **Before**: Only handled app client connections (auth by userId). Relied on MQTT service to relay ESP status.
- **After**: Now handles both app clients and ESP connections in a single WebSocket server.
  - Tracks app connections by `userId` (unchanged)
  - Tracks ESP connections by `macAddress` (new)
  - Handles ESP message types: `esp_auth`, `esp_heartbeat`, `esp_status`, `esp_register`
  - Sends command/config messages to ESP: `esp_command`, `esp_config`, `esp_sync`
  - On ESP connect: marks device online in DB, sends current device config
  - On ESP disconnect: marks device offline, notifies user apps
  - On ESP status update: writes to DB + `DeviceStateHistory`, broadcasts to user apps

#### `src/services/device.service.ts` — Swapped MQTT for WebSocket
- `controlDevice()`: uses `webSocketService.sendCommandToEsp()` instead of `mqttService.publishCommand()`
- `createDevice()`: uses `webSocketService.sendConfigToEsp()` instead of `mqttService.publishToEsp()`
- `deleteDevice()`: uses `webSocketService.sendConfigToEsp()` instead of `mqttService.publishToEsp()`
- Online check uses `webSocketService.isEspConnected()` instead of DB `is_online` field

#### `src/services/schedule.service.ts` — Swapped MQTT for WebSocket
- `checkSchedules()`: uses `webSocketService.sendCommandToEsp()` instead of `mqttService.publishCommand()`

#### `src/server.ts` — Simplified startup
- Removed MQTT connection from startup sequence
- Removed MQTT message listener (ESP status now arrives via WebSocket)
- Removed MQTT disconnect from shutdown handlers
- Startup is now: DB connect → HTTP server → WebSocket init → schedule start → listen

#### `src/services/mqtt.service.ts` — Unchanged but no longer called
- File preserved for future use (internal pub/sub, third-party integrations)
- No longer imported by `server.ts`, `device.service.ts`, or `schedule.service.ts`

### Firmware (`firmware/`)

#### `config.h` — Updated
- Removed: `MQTT_SERVER`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_TOPIC_PREFIX`, `MQTT_TIMEOUT`, `MQTT_MAX_PACKET_SIZE`
- Added: `WS_PATH`, `WS_USE_TLS`, `WS_TIMEOUT`, `WS_MAX_PACKET_SIZE`
- `API_SERVER` and `API_PORT` are now the primary connection settings
- Version bumped to `2.0.0`

#### `ws_client.h` — New file (replaces `mqtt_client.h`)
- Uses `WebSocketsClient` library (Links2004/arduinoWebSockets) instead of `PubSubClient`
- Connects to `ws://API_SERVER:API_PORT/ws` (or `wss://` if `WS_USE_TLS` is true)
- Connection flow: WebSocket connect → send `esp_auth` with MAC → send `esp_register` with device info
- Handles incoming messages: `esp_command` (pin control), `esp_config` (add/remove devices)
- Sends heartbeat every 60s with pin states, free heap, uptime
- Sends pin status updates after executing commands
- Auto-reconnects every 5s on disconnect
- TLS support via `WiFiClientSecure` when `WS_USE_TLS` is true

#### `home_automation.ino` — Updated
- Replaced `MqttClient mqtt` with `WsClient ws`
- Added `onConfig` callback for add/remove device configuration
- All pin status reporting now goes through WebSocket

#### `mqtt_client.h` — Preserved (not compiled)
- Kept for reference in case MQTT communication is needed in the future

## WebSocket Protocol

All messages are JSON over the `/ws` endpoint.

### ESP → API

| Message Type | Purpose | Fields |
|---|---|---|
| `esp_auth` | Authenticate ESP connection | `mac` |
| `esp_register` | Register/re-register device | `mac_address`, `firmware_ver`, `ip_address`, `wifi_ssid` |
| `esp_heartbeat` | Periodic health check | `mac`, `pins_state`, `free_heap`, `uptime` |
| `esp_status` | Pin state change report | `mac`, `pin`, `state` |

### API → ESP

| Message Type | Purpose | Fields |
|---|---|---|
| `esp_command` | Control a pin | `pin`, `state`, `timestamp` |
| `esp_config` | Add/remove device config | `action`, `pin`, `device_id`, `type` |
| `esp_sync` | Initial state sync on connect | `devices[]` |

### API → App (unchanged)

| Message Type | Purpose |
|---|---|
| `device_update` | Device state changed |
| `esp_status` | ESP online/offline status |

## Data Flow: Toggle a Bulb from the App

```
1. App        ──POST──► API          "turn bulb ON"
2. API        ──WS────► ESP          pushes esp_command {pin: 2, state: {power: true}}
3. ESP        ──WS────► API          esp_status {pin: 2, state: {power: true}}
4. API        ──DB──►  updates device state + history
5. API        ──WS────► App          device_update {deviceId, state}
```

Latency: ~50-100ms (same as the old MQTT path).

## Required Libraries

### Firmware (Arduino/PlatformIO)

Add to your platformio.ini or install via Arduino Library Manager:
```
WebSocketsClient (arduinoWebSockets by Markus Sattler)
ArduinoJson (by Benoit Blanchon)
WiFiManager (by tzapu)
ESP8266WiFi (built into ESP8266 board package)
```

## Deployment

### Local development (same network)
- Set `API_SERVER` to your machine's LAN IP (e.g. `192.168.1.100`)
- Set `API_PORT` to `3000`
- Set `WS_USE_TLS` to `false`

### Remote (different networks)
```bash
ngrok http 3000
```
- Set `API_SERVER` to the ngrok hostname (strip `https://`, e.g. `abc123.ngrok-free.app`)
- Set `API_PORT` to `443`
- Set `WS_USE_TLS` to `true`
- Set the same ngrok URL in the app's settings screen

## What Was NOT Changed

- Database schema (no Prisma migration needed)
- App code (API URL setting, HTTP/WebSocket to same server)
- `device_manager.h` firmware (pin management logic)
- `wifi_manager.h` firmware (WiFi connection logic)
- Auth, floor, room, schedule API routes and controllers
- ESP routes and controller (still available for HTTP fallback)
- Mosquitto in `docker-compose.yml` (retained for future use)
