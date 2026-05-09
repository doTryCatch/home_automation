#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#define FIRMWARE_VERSION "2.0.0"

// WiFi credentials
#define WIFI_SSID "GHRCE-HOSTEL-S"
#define WIFI_PASSWORD "Passw0rd#ghrce"

// Backend API / WebSocket Server
#define API_SERVER "transparietal-batholitic-garnet.ngrok-free.dev"
#define API_PORT 443
#define WS_PATH "/ws"

// Use TLS (wss://) — set to true if using ngrok or Cloudflare tunnel
#define WS_USE_TLS true

// Pin Configuration
#define MAX_PINS 17
#define RELAY_ON HIGH
#define RELAY_OFF LOW

// Timing
#define HEARTBEAT_INTERVAL 60000
#define RECONNECT_DELAY 5000
#define WIFI_TIMEOUT 20000
#define WS_TIMEOUT 10000

// Buffer sizes
#define WS_MAX_PACKET_SIZE 512
#define JSON_BUFFER_SIZE 256

#endif
