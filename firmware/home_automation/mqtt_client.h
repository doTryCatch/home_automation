#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <PubSubClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include "config.h"

class MqttClient {
private:
  WiFiClient espClient;
  PubSubClient client;
  String macAddress;
  String baseTopic;
  unsigned long lastHeartbeat;
  bool connected;
  std::function<void(int pin, JsonObject state)> commandCallback;

  void callback(char* topic, byte* payload, unsigned int length) {
    char buffer[MQTT_MAX_PACKET_SIZE];
    if (length >= MQTT_MAX_PACKET_SIZE) length = MQTT_MAX_PACKET_SIZE - 1;
    memcpy(buffer, payload, length);
    buffer[length] = '\0';

    Serial.print("MQTT message [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(buffer);

    String topicStr = String(topic);
    String cmdSuffix = "/cmd";

    if (topicStr.endsWith(cmdSuffix)) {
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, buffer);
      if (error) {
        Serial.print("JSON parse error: ");
        Serial.println(error.c_str());
        return;
      }

      if (doc.containsKey("pin") && doc.containsKey("state")) {
        int pin = doc["pin"];
        JsonObject state = doc["state"];
        if (commandCallback) {
          commandCallback(pin, state);
        }
      }
    }

    String configSuffix = "/config";
    if (topicStr.endsWith(configSuffix)) {
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, buffer);
      if (!error) {
        String action = doc["action"];
        if (action == "add_device" || action == "remove_device") {
          Serial.print("Config update: ");
          Serial.println(action);
        }
      }
    }
  }

  void reconnect() {
    int attempts = 0;
    while (!client.connected() && attempts < 3) {
      Serial.print("MQTT connecting... attempt ");
      Serial.println(attempts + 1);

      String clientId = "ESP8266_" + macAddress;
      clientId.replace(":", "");

      if (client.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
        Serial.println("MQTT connected");
        connected = true;
        subscribe();
        publishRegister();
      } else {
        Serial.print("MQTT failed, rc=");
        Serial.println(client.state());
        connected = false;
        attempts++;
        delay(RECONNECT_DELAY);
      }
    }
  }

  void subscribe() {
    String cmdTopic = baseTopic + "/cmd";
    String configTopic = baseTopic + "/config";
    client.subscribe(cmdTopic.c_str());
    client.subscribe(configTopic.c_str());
    Serial.print("Subscribed to: ");
    Serial.println(cmdTopic);
  }

  void publishRegister() {
    String topic = baseTopic + "/register";
    StaticJsonDocument<256> doc;
    doc["mac_address"] = macAddress;
    doc["firmware_ver"] = FIRMWARE_VERSION;
    doc["ip_address"] = WiFi.localIP().toString();
    doc["wifi_ssid"] = WiFi.SSID();

    char buffer[256];
    serializeJson(doc, buffer);
    client.publish(topic.c_str(), buffer);
  }

public:
  MqttClient() : client(espClient), lastHeartbeat(0), connected(false) {
    macAddress = WiFi.macAddress();
    macAddress.replace(":", "");
    baseTopic = String(MQTT_TOPIC_PREFIX) + "/" + WiFi.macAddress();
    client.setServer(MQTT_SERVER, MQTT_PORT);
    client.setCallback([this](char* t, byte* p, unsigned int l) { this->callback(t, p, l); });
    client.setBufferSize(MQTT_MAX_PACKET_SIZE);
  }

  bool begin() {
    reconnect();
    return connected;
  }

  void loop() {
    if (!client.connected()) {
      connected = false;
      reconnect();
    }
    client.loop();

    if (connected && millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
      lastHeartbeat = millis();
      publishHeartbeat();
    }
  }

  void publishHeartbeat() {
    String topic = baseTopic + "/heartbeat";
    StaticJsonDocument<384> doc;
    doc["mac_address"] = WiFi.macAddress();
    doc["ip_address"] = WiFi.localIP().toString();
    doc["firmware_ver"] = FIRMWARE_VERSION;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["uptime"] = millis() / 1000;

    char buffer[384];
    serializeJson(doc, buffer);
    client.publish(topic.c_str(), buffer);
  }

  void publishPinStatus(int pin, JsonObject state) {
    String topic = baseTopic + "/devices/pin_" + String(pin) + "/status";
    char buffer[256];
    serializeJson(state, buffer);
    client.publish(topic.c_str(), buffer);
  }

  void publishAllPinStatus(JsonObject pinsState) {
    String topic = baseTopic + "/status";
    char buffer[512];
    serializeJson(pinsState, buffer);
    client.publish(topic.c_str(), buffer);
  }

  void setCommandCallback(std::function<void(int pin, JsonObject state)> callback) {
    commandCallback = callback;
  }

  bool isConnected() { return connected; }

  String getMacAddress() { return WiFi.macAddress(); }
};

#endif
