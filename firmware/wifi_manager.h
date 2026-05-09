#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include "config.h"

class WifiManager {
private:
  bool connected;
  unsigned long lastCheck;
  String ssid;

public:
  WifiManager() : connected(false), lastCheck(0) {}

  bool begin(bool autoConnect = true) {
    if (autoConnect) {
      WiFiManager wm;
      wm.setConnectTimeout(10);
      wm.setConfigPortalTimeout(180);
      wm.setDebugOutput(true);

      String apName = "HomeAuto_" + String(ESP.getChipId(), HEX);
      
      if (!wm.autoConnect(apName.c_str(), "homeauto123")) {
        Serial.println("Failed to connect to WiFi");
        connected = false;
        return false;
      }
    } else {
      WiFi.mode(WIFI_STA);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

      unsigned long startAttemptTime = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < WIFI_TIMEOUT) {
        delay(500);
        Serial.print(".");
      }
    }

    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      ssid = WiFi.SSID();
      Serial.println("");
      Serial.print("WiFi connected. IP: ");
      Serial.println(WiFi.localIP());
      return true;
    }

    connected = false;
    return false;
  }

  void loop() {
    if (millis() - lastCheck > 10000) {
      lastCheck = millis();
      if (WiFi.status() != WL_CONNECTED) {
        connected = false;
        Serial.println("WiFi disconnected, reconnecting...");
        WiFi.reconnect();
      } else {
        connected = true;
      }
    }
  }

  bool isConnected() { return connected; }
  String getIP() { return WiFi.localIP().toString(); }
  String getSSID() { return ssid; }
  String getMAC() { return WiFi.macAddress(); }
  int getRSSI() { return WiFi.RSSI(); }
};

#endif
