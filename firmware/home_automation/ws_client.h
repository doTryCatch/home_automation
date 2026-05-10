#ifndef WS_CLIENT_H
#define WS_CLIENT_H

#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "config.h"

#if WS_USE_TLS
#include <WiFiClientSecure.h>
#else
#include <WiFiClient.h>
#endif

class WsClient {
private:
#if WS_USE_TLS
  WiFiClientSecure secClient;
#else
  WiFiClient tcpClient;
#endif
  WebSocketsClient webSocket;
  String macAddress;
  unsigned long lastHeartbeat;
  bool connected;
  bool authenticated;
  std::function<void(int pin, JsonObject state)> commandCallback;
  std::function<void(String action, JsonObject config)> configCallback;

  void handleEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
      case WStype_DISCONNECTED:
        connected = false;
        authenticated = false;
        Serial.println("[WS] Disconnected");
        break;

      case WStype_CONNECTED:
        connected = true;
        Serial.println("[WS] Connected to server");
        sendAuth();
        break;

      case WStype_TEXT: {
        char* text = (char*)payload;
        text[length] = '\0';
        handleTextMessage(text);
        break;
      }

      case WStype_ERROR:
        Serial.print("[WS] Error: ");
        if (payload && length > 0) {
          Serial.println((char*)payload);
        } else {
          Serial.println("unknown");
        }
        break;

      default:
        break;
    }
  }

  void handleTextMessage(const char* text) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, text);
    if (error) {
      Serial.print("[WS] JSON parse error: ");
      Serial.println(error.c_str());
      return;
    }

    String type = doc["type"].as<String>();

    if (type == "esp_auth") {
      bool success = doc["success"] | false;
      if (success) {
        authenticated = true;
        Serial.println("[WS] Authenticated with server");
        sendRegister();
      } else {
        Serial.println("[WS] Authentication failed");
      }
    }

    else if (type == "esp_sync") {
      Serial.println("[WS] Received device sync");
    }

    else if (type == "esp_command") {
      if (doc.containsKey("pin") && doc.containsKey("state")) {
        int pin = doc["pin"];
        JsonObject state = doc["state"];
        Serial.print("[WS] Command for pin ");
        Serial.print(pin);
        Serial.println();

        if (commandCallback) {
          commandCallback(pin, state);
        }
      }
    }

    else if (type == "esp_config") {
      if (doc.containsKey("action")) {
        String action = doc["action"].as<String>();
        Serial.print("[WS] Config: ");
        Serial.println(action);

        if (configCallback) {
          JsonObject configObj = doc.as<JsonObject>();
          configCallback(action, configObj);
        }
      }
    }
  }

  void sendAuth() {
    StaticJsonDocument<128> doc;
    doc["type"] = "esp_auth";
    doc["mac"] = WiFi.macAddress();

    char buffer[128];
    serializeJson(doc, buffer);
    webSocket.sendTXT(buffer);
    Serial.println("[WS] Sent auth");
  }

  void sendRegister() {
    StaticJsonDocument<256> doc;
    doc["type"] = "esp_register";
    doc["mac_address"] = WiFi.macAddress();
    doc["firmware_ver"] = FIRMWARE_VERSION;
    doc["ip_address"] = WiFi.localIP().toString();
    doc["wifi_ssid"] = WiFi.SSID();

    char buffer[256];
    serializeJson(doc, buffer);
    webSocket.sendTXT(buffer);
    Serial.println("[WS] Sent register");
  }

public:
  WsClient() : lastHeartbeat(0), connected(false), authenticated(false) {
    macAddress = WiFi.macAddress();
  }

  void begin() {
    Serial.print("[WS] Free heap: ");
    Serial.println(ESP.getFreeHeap());

    Serial.print("[WS] Resolving DNS for ");
    Serial.print(API_SERVER);
    IPAddress resolvedIP;
    if (WiFi.hostByName(API_SERVER, resolvedIP)) {
      Serial.print(" -> ");
      Serial.println(resolvedIP);
    } else {
      Serial.println(" FAILED");
    }

    Serial.print("[WS] Connecting to ");
    Serial.print(API_SERVER);
    Serial.print(":");
    Serial.println(API_PORT);

#if WS_USE_TLS
    webSocket.beginSSL(API_SERVER, API_PORT, WS_PATH);
#else
    webSocket.begin(API_SERVER, API_PORT, WS_PATH);
#endif

    webSocket.onEvent([this](WStype_t t, uint8_t* p, size_t l) {
      this->handleEvent(t, p, l);
    });

    webSocket.setExtraHeaders("ngrok-skip-browser-warning: true");
    webSocket.setReconnectInterval(RECONNECT_DELAY);
    webSocket.enableHeartbeat(15000, 30000, 2);
  }

  void loop() {
    webSocket.loop();

    if (authenticated && millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
      lastHeartbeat = millis();
      sendHeartbeat();
    }
  }

  void sendHeartbeat() {
    StaticJsonDocument<384> doc;
    doc["type"] = "esp_heartbeat";
    doc["mac"] = WiFi.macAddress();
    doc["ip_address"] = WiFi.localIP().toString();
    doc["firmware_ver"] = FIRMWARE_VERSION;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["uptime"] = millis() / 1000;

    char buffer[384];
    serializeJson(doc, buffer);
    webSocket.sendTXT(buffer);
  }

  void sendPinStatus(int pin, JsonObject state) {
    StaticJsonDocument<256> doc;
    doc["type"] = "esp_status";
    doc["mac"] = WiFi.macAddress();
    doc["pin"] = pin;
    doc["state"] = state;

    char buffer[256];
    serializeJson(doc, buffer);
    webSocket.sendTXT(buffer);
  }

  void sendAllPinStatus(JsonObject pinsState) {
    StaticJsonDocument<512> doc;
    doc["type"] = "esp_heartbeat";
    doc["mac"] = WiFi.macAddress();
    doc["pins_state"] = pinsState;

    char buffer[512];
    serializeJson(doc, buffer);
    webSocket.sendTXT(buffer);
  }

  void setCommandCallback(std::function<void(int pin, JsonObject state)> callback) {
    commandCallback = callback;
  }

  void setConfigCallback(std::function<void(String action, JsonObject config)> callback) {
    configCallback = callback;
  }

  bool isConnected() { return connected; }
  bool isAuthenticated() { return authenticated; }
  String getMacAddress() { return WiFi.macAddress(); }
};

#endif
