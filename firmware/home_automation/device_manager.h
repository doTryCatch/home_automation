#ifndef DEVICE_MANAGER_H
#define DEVICE_MANAGER_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"

struct PinConfig {
  int pin;
  String mode;
  String type;
  bool active;
};

class DeviceManager {
private:
  PinConfig pins[MAX_PINS];
  int pinCount;
  bool pinStates[MAX_PINS];

  int findPin(int pin) {
    for (int i = 0; i < pinCount; i++) {
      if (pins[i].pin == pin) return i;
    }
    return -1;
  }

public:
  DeviceManager() : pinCount(0) {
    for (int i = 0; i < MAX_PINS; i++) {
      pinStates[i] = false;
      pins[i].pin = -1;
      pins[i].active = false;
    }
  }

  void addPin(int pin, const String& mode, const String& type = "") {
    if (pinCount >= MAX_PINS) return;
    if (findPin(pin) >= 0) return;

    pins[pinCount].pin = pin;
    pins[pinCount].mode = mode;
    pins[pinCount].type = type;
    pins[pinCount].active = true;

    if (mode == "output" || mode == "pwm") {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, RELAY_OFF);
    } else if (mode == "input") {
      pinMode(pin, INPUT_PULLUP);
    }

    pinCount++;
    Serial.print("Pin ");
    Serial.print(pin);
    Serial.print(" configured as ");
    Serial.println(mode);
  }

  void removePin(int pin) {
    int idx = findPin(pin);
    if (idx >= 0) {
      if (pins[idx].mode == "output") {
        digitalWrite(pin, RELAY_OFF);
      }
      pins[idx].active = false;
    }
  }

  bool setPinState(int pin, bool state) {
    int idx = findPin(pin);
    if (idx < 0 || !pins[idx].active) return false;
    if (pins[idx].mode != "output" && pins[idx].mode != "pwm") return false;

    digitalWrite(pin, state ? RELAY_ON : RELAY_OFF);
    pinStates[idx] = state;

    Serial.print("Pin ");
    Serial.print(pin);
    Serial.print(" -> ");
    Serial.println(state ? "ON" : "OFF");

    return true;
  }

  bool setPinPWM(int pin, int value) {
    int idx = findPin(pin);
    if (idx < 0 || !pins[idx].active) return false;
    if (pins[idx].mode != "pwm") return false;

    analogWrite(pin, constrain(value, 0, 255));
    Serial.print("Pin ");
    Serial.print(pin);
    Serial.print(" PWM -> ");
    Serial.println(value);
    return true;
  }

  bool togglePin(int pin) {
    int idx = findPin(pin);
    if (idx < 0) return false;
    return setPinState(pin, !pinStates[idx]);
  }

  bool getPinState(int pin) {
    int idx = findPin(pin);
    if (idx < 0) return false;
    return pinStates[idx];
  }

  void handleCommand(int pin, JsonObject state) {
    if (state.containsKey("power")) {
      setPinState(pin, state["power"].as<bool>());
    }
    if (state.containsKey("brightness")) {
      int brightness = map(state["brightness"].as<int>(), 0, 100, 0, 255);
      setPinPWM(pin, brightness);
    }
    if (state.containsKey("level")) {
      setPinPWM(pin, state["level"].as<int>());
    }
  }

  JsonObject getAllStates(JsonDocument& doc) {
    JsonObject root = doc.to<JsonObject>();
    for (int i = 0; i < pinCount; i++) {
      if (pins[i].active) {
        String key = "pin_" + String(pins[i].pin);
        JsonObject pinObj = root.createNestedObject(key);
        pinObj["power"] = pinStates[i];
        if (pins[i].mode == "pwm") {
          pinObj["mode"] = "pwm";
        }
      }
    }
    return root;
  }

  int getPinCount() { return pinCount; }
  PinConfig* getPins() { return pins; }
};

#endif
