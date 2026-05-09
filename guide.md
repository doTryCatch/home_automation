# How Outbound Connection Works in This Project

## The Key Insight: Both Sides Connect OUT, Never IN

```
┌──────────────┐                           ┌──────────────┐
│  Your Phone  │                           │   ESP8266    │
│ (Mobile Net) │                           │ (Home WiFi)  │
│              │                           │              │
│  Behind:     │                           │  Behind:     │
│  Carrier NAT │                           │  Home Router │
│  No public IP│                           │  No public IP│
└──────┬───────┘                           └──────┬───────┘
       │                                          │
       │  OUTBOUND connection (TCP)               │  OUTBOUND connection (TCP)
       │  No firewall blocks this                 │  No firewall blocks this
       │                                          │
       ▼                                          ▼
┌──────────────────────────────────────────────────────────┐
│                                                          │
│              VPS / Cloud Server                          │
│              (Public IP: e.g., 203.0.113.5)              │
│                                                          │
│   ┌────────────────┐         ┌───────────────────┐       │
│   │   Mosquitto    │         │   Bun Backend     │       │
│   │   MQTT Broker  │◄───────►│   (Express API)   │       │
│   │   Port 1883    │         │   Port 3000       │       │
│   └────────────────┘         └───────────────────┘       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Why This Works Without Port Forwarding

Home routers and carrier networks block **INCOMING** connections, but allow all **OUTBOUND** connections.

1. **ESP8266** (inside your home) initiates an **outbound** TCP connection to `mqtt://203.0.113.5:1883` → your router sees this as a regular outgoing request (like browsing a website) → **allows it** → connection stays open persistently

2. **Phone app** (on mobile data) initiates an **outbound** TCP connection to the same broker → carrier allows it → connection stays open

3. **Mosquitto broker** (on VPS with public IP) **accepts** these incoming connections because it's listening on a public IP with no NAT

## How Messages Flow (Step by Step)

### You press "ON" for Bedroom Light on your phone:

```
Step 1: Phone → Backend API
─────────────────────────
Phone app calls POST /api/devices/{id}/control 
with { state: { power: true } }
    │
    ▼
Backend receives the HTTP request


Step 2: Backend → MQTT Broker → ESP8266
────────────────────────────────────────
Backend calls mqttService.publishCommand(mac, pin, state)
    │
    ▼
Backend publishes to MQTT topic:  home/AA:BB:CC:DD:EE:FF/cmd
with payload: { pin: 2, state: { power: true }, timestamp: "..." }
    │
    ▼
Mosquitto broker receives the message
    │
    ▼
Mosquitto sees ESP8266 is subscribed to  home/AA:BB:CC:DD:EE:FF/cmd
    │
    ▼
Mosquitto pushes message to ESP8266 
over the ALREADY-OPEN persistent TCP connection
    │
    ▼
ESP8266 receives message → sets pin 2 HIGH → relay turns ON light


Step 3: ESP8266 → MQTT Broker → Backend → WebSocket → Phone
────────────────────────────────────────────────────────────
ESP8266 publishes status to: home/AA:BB:CC:DD:EE:FF/devices/pin_2/status
with payload: { power: true }
    │
    ▼
Backend's MQTT client receives this (subscribed to all status topics)
    │
    ▼
Backend updates PostgreSQL: device.state = { power: true }
    │
    ▼
Backend pushes via WebSocket to phone: { type: "device_update", payload: {...} }
    │
    ▼
Phone UI updates instantly (switch shows ON)
```

## The Persistent Connection is Key

```
ESP8266 side (in firmware/mqtt_client.h):
──────────────────────────────────────────
1. WiFi.begin()          → connects to home router
2. mqtt.connect()        → opens TCP to broker (OUTBOUND)
3. mqtt.subscribe(".../cmd")  → tells broker "send me commands"
4. mqtt.loop()           → keeps connection alive, checks for new messages

This connection stays open forever. The router maintains the 
NAT mapping because the ESP8266 keeps sending data (heartbeats 
every 60 seconds).

    Home Router NAT Table:
    ┌───────────────────────────────────────────────────┐
    │ Internal: 192.168.1.50:12345  →  External: Port X │
    │          mapped to 203.0.113.5:1883               │
    │                                                    │
    │ When broker sends data back, router sees it's      │
    │ a response to the existing connection → FORWARDS IT│
    └───────────────────────────────────────────────────┘
```

## Why Port Forwarding Would Be Needed (Without MQTT)

```
WITHOUT MQTT (direct connection approach):
───────────────────────────────────────────
Phone tries to connect to ESP8266 at home...
    │
    ▼
Phone → 203.0.113.5 (home public IP) :80
    │
    ▼
Home router receives incoming connection
on a port that nobody inside requested
    │
    ▼
Router: "I didn't ask for this. REJECTED." ❌
(NAT drops the packet - ESP8266 never sees it)
```

## What You Need on Your VPS

```bash
# 1. Install Mosquitto
sudo apt install mosquitto mosquitto-clients

# 2. Configure /etc/mosquitto/mosquitto.conf
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd

# 3. Create credentials
sudo mosquitto_passwd -c /etc/mosquitto/passwd home_automation

# 4. Open firewall
sudo ufw allow 1883    # MQTT
sudo ufw allow 3000    # API
sudo ufw allow 8080    # MQTT WebSocket (for app direct MQTT later)
```

That's it. No router config, no DDNS, no Carrier NAT issues. Both devices reach out to the VPS, and the broker acts as the message bridge between them.
