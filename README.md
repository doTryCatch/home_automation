# Home Automation — IoT System

ESP8266 firmware **WebSocket** Bun/Express 5 API **PostgreSQL** Expo React Native app.

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   ESP8266    │◄──WS───►│   Bun API :3000  │◄──WS───►│  Mobile App  │
│  (Firmware)  │         │   + PostgreSQL   │         │  (Expo/RN)   │
└──────────────┘         └──────────────────┘         └──────────────┘
```

Both ESP and phone make **outbound** connections — no port forwarding needed. Expose the API via ngrok/Cloudflare for remote access.

---

## Prerequisites

- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- [Bun](https://bun.sh/) runtime
- [Node.js](https://nodejs.org/) (for Expo)
- [Yarn](https://classic.yarnpkg.com/) (app only)
- [Expo Go](https://expo.dev/go) on your phone (or Android emulator)
- [Arduino IDE](https://www.arduino.cc/en/software) with ESP8266 board support (for flashing)

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd home_automation
```

### 2. Start PostgreSQL (and optional Mosquitto)

```bash
docker compose up -d
```

This starts:
- **Postgres 16** on `localhost:5432` (user: `homeauto`, pass: `homeauto123`, db: `home_automation`)
- **Mosquitto 2** on `localhost:1883` / `:9001` (optional — not required for ESP WebSocket communication)

### 3. Backend API

```bash
cd api

# Copy env file and fill in values
cp .env.example .env

# Install dependencies
bun install

# Run database migrations
bunx prisma migrate dev

# Start dev server (runs on http://localhost:3000)
bun run dev
```

Verify it's running:

```bash
curl http://localhost:3000/health
```

### 4. Mobile App

```bash
cd app

# Install dependencies (use yarn, NOT npm)
yarn

# Start Expo dev server
npx expo start
```

Then:
- Scan the QR code with **Expo Go** on your phone, or press `a` for Android emulator.
- In the app, go to **Settings** and set the API URL (e.g. `http://<your-ip>:3000/api`).

### 5. ESP8266 Firmware

1. Open `firmware/home_automation.ino` in Arduino IDE.
2. Edit `firmware/config.h`:

```c
#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"
#define API_SERVER "your-api-host"      // e.g. ngrok host or local IP
#define API_PORT 3000                   // 443 if using ngrok/tunnel
#define WS_USE_TLS false                // true if using ngrok/Cloudflare
```

3. Select your ESP8266 board and flash.

---

## Project Structure

```
home_automation/
├── api/                  # Bun + Express 5 backend
│   ├── prisma/           # Database schema & migrations
│   ├── src/
│   │   ├── config/       # Env config
│   │   ├── middleware/    # Auth, validation
│   │   ├── routes/       # Express routes (auth, devices, etc.)
│   │   ├── services/     # Business logic (singletons)
│   │   ├── utils/        # WebSocket service, helpers
│   │   └── server.ts     # Entry point
│   ├── .env.example
│   └── package.json
├── app/                  # Expo React Native app
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── navigation/   # React Navigation setup
│   │   ├── screens/      # App screens
│   │   ├── services/     # API service layer
│   │   └── store/        # Zustand state management
│   └── package.json
├── firmware/             # ESP8266 Arduino firmware
│   ├── home_automation.ino  # Main sketch
│   ├── config.h             # WiFi + API config
│   ├── ws_client.h          # WebSocket client
│   ├── device_manager.h     # Pin/device control
│   └── wifi_manager.h       # WiFi connection
├── mosquitto/            # MQTT broker config (optional)
│   └── config/
├── docker-compose.yml    # Postgres + Mosquitto
└── AGENTS.md             # Detailed architecture docs
```

---

## Remote Access (ngrok)

To control devices from outside your local network:

```bash
ngrok http 3000
```

Then update:
- **Firmware** `config.h`: set `API_SERVER` to the ngrok host, `API_PORT` to `443`, `WS_USE_TLS` to `true`
- **App Settings**: set API URL to `https://<ngrok-host>/api`
- Re-flash the ESP8266 after changing `config.h`

---

## API Endpoints

All routes are under `/api/`.

| Route | Description |
|---|---|
| `POST /api/auth/register` | Register user |
| `POST /api/auth/login` | Login |
| `GET /api/floors` | List floors |
| `POST /api/floors` | Create floor |
| `GET /api/rooms` | List rooms |
| `POST /api/rooms` | Create room |
| `GET /api/devices` | List devices |
| `POST /api/devices/:id/control` | Control device |
| `GET /api/schedules` | List schedules |
| `POST /api/schedules` | Create schedule |
| `POST /api/esp/register` | Register ESP device |
| `GET /health` | Health check |

---

## WebSocket Protocol

Connect to `/ws`. Both app and ESP use the same endpoint.

**App auth:**
```json
{ "type": "auth", "userId": "<user_id>" }
```

**ESP auth:**
```json
{ "type": "esp_auth", "mac": "AA:BB:CC:DD:EE:FF" }
```

App receives `device_update` and `esp_status` events in real time.
