#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "wifi_manager.h"
#include "ws_client.h"
#include "device_manager.h"

WifiManager wifiMgr;
WsClient ws;
DeviceManager devices;

void setupPins() {
  devices.addPin(D0, "output", "relay");
  devices.addPin(D1, "output", "relay");
  devices.addPin(D2, "output", "relay");
  devices.addPin(D3, "output", "relay");
  devices.addPin(D5, "output", "relay");
  devices.addPin(D6, "output", "relay");
  devices.addPin(D7, "output", "relay");
  devices.addPin(D8, "output", "relay");
}

void onCommand(int pin, JsonObject state) {
  Serial.println("====== COMMAND RECEIVED ======");
  Serial.print("[CMD] Pin: D");
  Serial.println(pin);

  if (state.containsKey("power")) {
    Serial.print("[CMD] Power: ");
    Serial.println(state["power"].as<bool>() ? "ON" : "OFF");
  }
  if (state.containsKey("brightness")) {
    Serial.print("[CMD] Brightness: ");
    Serial.println(state["brightness"].as<int>());
  }

  devices.handleCommand(pin, state);

  Serial.print("[CMD] Pin D");
  Serial.print(pin);
  Serial.print(" actual state: ");
  Serial.println(devices.getPinState(pin) ? "ON (HIGH)" : "OFF (LOW)");
  Serial.println("==============================");

  StaticJsonDocument<128> statusDoc;
  JsonObject status = statusDoc.to<JsonObject>();
  status["power"] = devices.getPinState(pin);
  ws.sendPinStatus(pin, status);
  Serial.print("[CMD] Sent status back to server for pin D");
  Serial.println(pin);
}

void onConfig(String action, JsonObject config) {
  Serial.print("Config update: ");
  Serial.println(action);

  if (action == "add_device") {
    int pin = config["pin"];
    String type = config["type"] | "relay";
    devices.addPin(pin, "output", type);
  } else if (action == "remove_device") {
    int pin = config["pin"];
    devices.removePin(pin);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== Home Automation ESP8266 ===");
  Serial.print("Firmware: ");
  Serial.println(FIRMWARE_VERSION);

  setupPins();

  Serial.println("Connecting to WiFi...");
  if (!wifiMgr.begin(true)) {
    Serial.println("WiFi failed! Restarting...");
    ESP.restart();
  }

  Serial.print("MAC Address: ");
  Serial.println(wifiMgr.getMAC());
  Serial.print("IP Address: ");
  Serial.println(wifiMgr.getIP());

  ws.setCommandCallback(onCommand);
  ws.setConfigCallback(onConfig);

  Serial.println("Connecting to server via WebSocket...");
  ws.begin();
}

void loop() {
  wifiMgr.loop();

  if (!wifiMgr.isConnected()) {
    delay(1000);
    return;
  }

  ws.loop();

  static unsigned long lastStatusUpdate = 0;
  if (millis() - lastStatusUpdate > 30000) {
    lastStatusUpdate = millis();
    if (ws.isAuthenticated()) {
      StaticJsonDocument<512> doc;
      devices.getAllStates(doc);
      ws.sendAllPinStatus(doc.as<JsonObject>());
    }
  }
}
