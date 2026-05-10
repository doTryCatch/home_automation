# AGENTS.md

## Project Overview

IoT home automation: ESP8266 firmware ↔ WebSocket ↔ Bun/Express 5 API ↔ PostgreSQL ↔ Expo React Native app.

The ESP8266 connects to the backend API via **WebSocket** (not MQTT). The app connects via HTTP + WebSocket. Both make **outbound** connections — only the API port needs to be exposed (e.g. via ngrok). No port forwarding or public IP needed on the ESP or phone network.

## Startup Order

1. `docker compose up -d` (Postgres 16 :5432, Mosquitto 2 :1883/:9001 — Mosquitto optional)
2. `cp api/.env.example api/.env && cd api && bun install && bunx prisma migrate dev && bun run dev`
3. `cd app && yarn && npx expo start` — **yarn only** (existing `package-lock.json` is stale, ignore it)
4. Flash `firmware/home_automation/home_automation.ino` to ESP8266 after updating `firmware/home_automation/config.h`

## Developer Commands

### API (`api/`)

| Command | Purpose |
|---|---|
| `bun run dev` | Dev server with `--watch` (entry: `src/server.ts`) |
| `bun run build` | Bundle to `dist/` |
| `bun run start` | Run compiled `dist/` output |
| `bun run prisma:migrate` | Run pending migrations |
| `bun run prisma:generate` | Regenerate Prisma client |
| `bun run prisma:push` | Push schema without migration |
| `bun run prisma:studio` | Prisma GUI at localhost:5555 |

No lint, typecheck, or test scripts configured. No test framework installed.

### App (`app/`)

| Command | Purpose |
|---|---|
| `npx expo start` | Metro dev server |
| `npx expo start --android` | Run on Android |
| `npx expo lint` | ESLint via Expo |

No test scripts configured. Path alias `@/*` → `src/*` is configured but **never used**; always use relative imports.

### Firmware (`firmware/`)

No build system — flash via Arduino IDE or PlatformIO after editing `config.h`.

## Code Style Guidelines

### General (All Layers)

- **2-space indentation**, no tabs
- **Single quotes** for strings; double quotes only in JSX attributes
- **Semicolons always**
- **Trailing commas** in multi-line objects, arrays, imports, params
- **K&R brace style** — opening brace on same line
- **No linter/formatter config files** — match existing code style exactly
- **No comments** unless explicitly requested

### API (`api/`)

**File naming:** `kebab-case.layer.ts` — e.g. `device.service.ts`, `auth.controller.ts`, `floor.routes.ts`, `esp.validator.ts`. Every directory has a barrel `index.ts`.

**Layered architecture** per entity: route → controller → service → Prisma. Adding a new entity "widget":
1. Prisma model (PascalCase, `@@map("widgets")`, UUID id, timestamps) → `src/validators/widget.validator.ts` → `src/services/widget.service.ts` → `src/controllers/widget.controller.ts` → `src/routes/widget.routes.ts` → mount in `app.ts` as `/api/widgets`

**Import order:** external packages → config → types → validators → middleware → services → utils. All imports use **relative paths** (no aliases). Barrel imports for multi-export dirs; direct file imports for service singletons.

**Services:** `export class FooService { ... }` + `export default new FooService()`. Import as instances: `import fooService from '../services/foo.service'`. Always filter queries by `userId` for ownership.

**Controllers:** Same singleton pattern. **Inline error handling** — never call `next(error)`. Catch blocks use `instanceof Error` → `res.status(N).json({ success: false, message: error.message, error: 'CODE' })`. Custom error classes exist but are unused; throw plain `Error`.

**Responses:** Always use `ApiResponse<T>` shape: `{ success, message?, data?, error? }`. Status codes: 201 for create, 401 for auth, 404 for not found, 400 for other errors.

**Validation:** Zod v4 schemas in `src/validators/`. Export schema + inferred type: `export const createFooSchema = z.object({...})` + `export type CreateFooInput = z.infer<typeof createFooSchema>`. Use `validateBody(schema)` in routes (replaces `req.body` with parsed result).

**Routes:** `const router = Router()` → `router.use(authMiddleware)` → CRUD methods with `validateBody` before controller → `export default router`.

**Prisma:** Singleton from `src/config/database.ts`, default export. Use `findFirst` (not `findUnique`) when filtering by ownership. Use `select` to exclude `password_hash`; `include` for relations.

### App (`app/`)

**File naming:** PascalCase for components/screens (`LoginScreen.tsx`, `FloorPlanViewer.tsx`); camelCase for modules (`api.ts`, `authService.ts`, `theme.ts`). Screen directories are PascalCase (`Auth/`, `Device/`).

**Components:** Functional arrow functions with `export default` at bottom. Props via inline `interface Props` at top. No `React.FC<>` (except legacy files). All screens wrapped in `SafeAreaView`.

**Import order:** React/hooks → react-native → third-party → stores → services → constants → types → components → type-only imports last.

**State:** Zustand stores all in `src/store/index.ts`. Pattern: `create<XState>((set, get) => ({ ... }))`. Async actions manage `isLoading` internally. Persistence via manual `AsyncStorage` calls.

**Services:** Exported object literals with async CRUD methods. All use `api` (Axios) from `services/api.ts`. Unwrap responses: `res.data?.data ?? []`.

**Styling:** `StyleSheet.create()` co-located at file bottom. Variable named `styles` (or `s` for large files). All tokens from `constants/theme.ts`: `COLORS`, `SPACING`, `FONT_SIZE`, `BORDER_RADIUS`. Color opacity via hex append: `COLORS.primary + '20'`.

**Error handling:** `try/catch/finally` + `Alert.alert('Error', msg)`. Deletions require `Alert.alert` confirmation. Loading states: `ActivityIndicator` replacing button text.

**Navigation:** `@react-navigation/native-stack` + `bottom-tabs`. Type-safe params via `NativeStackNavigationProp<ParamList, 'Screen'>`.

### Firmware (`firmware/`)

**File naming:** `snake_case.h` / `.ino`. Header-only architecture — all classes defined inline in `.h` files (no `.cpp`).

**Naming:** `PascalCase` classes, `camelCase` methods/variables, `ALL_CAPS_SNAKE_CASE` `#define` constants. Global instances abbreviated: `wifiMgr`, `ws`, `devices`.

**Include guards:** `#ifndef SYMBOL_H` / `#define SYMBOL_H` / `#endif` (not `#pragma once`). Each header is self-contained — includes its own deps + `"config.h"`.

**Patterns:** `std::function` + lambda `[this]` for callbacks. Fixed-size C arrays (`PinConfig pins[MAX_PINS]`). `StaticJsonDocument<N>` (ArduinoJson v6). `millis()` non-blocking timing — never `delay()` for periodic tasks. `Serial` debug with `[WS]` prefix. No inheritance or virtual dispatch.

## Architecture Gotchas

- **Bun runtime** (not Node), **Express 5** (not v4), **Zod v4** (not v3) — APIs differ from older versions
- **WebSocket at `/ws`** handles both app (auth by JWT token: `{ type: 'auth', token: '<jwt>' }`) and ESP (auth by MAC: `{ type: 'esp_auth', mac: 'AA:BB:CC:DD:EE:FF' }`). Single `WebSocketService` in `src/utils/websocket.ts`
- **`EspDevice` holds the MAC address**, not `Device` — `Device` links to `EspDevice` via FK
- **Schedule service is in-memory cron** — state lost on crash, reloads on start
- **App server URL** is configured at runtime via settings store, not in `app.json`
- `validate(schema)` validates body+query+params but does NOT replace `req.body`; `validateBody(schema)` body-only and REPLACES `req.body`
- Non-null assertions common: `req.userId!` (AuthRequest defines it as optional)
- `api/.env` required — see `api/.env.example` (DB URL, JWT secrets)
- `docker-compose.yml` uses `homeauto:homeauto123` for Postgres, database `home_automation`
