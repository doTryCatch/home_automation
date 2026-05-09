import mqtt from 'mqtt';
import { config } from '../config';
import prisma from '../config/database';

class MqttService {
  private client: mqtt.MqttClient | null = null;
  private messageHandlers: Map<string, (topic: string, payload: Record<string, unknown>) => void> = new Map();
  private connected = false;

  connect(): Promise<void> {
    return new Promise((resolve) => {
      this.client = mqtt.connect(config.mqtt.broker_url, {
        username: config.mqtt.username || undefined,
        password: config.mqtt.password || undefined,
        clientId: `home_automation_server_${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 5000,
      });

      this.client.on('connect', () => {
        this.connected = true;
        console.log('✅ Connected to MQTT broker');
        this.subscribeToTopics();
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('❌ MQTT connection error:', err.message);
        if (!this.connected) {
          console.log('⚠️  Server starting without MQTT. Broker may not be running.');
          resolve();
        }
      });

      this.client.on('message', (topic: string, message: Buffer) => {
        this.handleMessage(topic, message);
      });

      this.client.on('close', () => {
        this.connected = false;
        console.log('⚠️ MQTT connection closed');
      });

      this.client.on('reconnect', () => {
        console.log('🔄 Reconnecting to MQTT broker...');
      });
    });
  }

  private subscribeToTopics(): void {
    if (!this.client) return;

    const prefix = config.mqtt.topic_prefix;
    this.client.subscribe(`${prefix}/+/status`);
    this.client.subscribe(`${prefix}/+/heartbeat`);
    this.client.subscribe(`${prefix}/+/register`);
    this.client.subscribe(`${prefix}/+/devices/+/status`);
  }

  private async handleMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const payload = JSON.parse(message.toString());
      const parts = topic.split('/');
      const prefix = config.mqtt.topic_prefix;

      if (parts[0] !== prefix) return;

      const macAddress = parts[1];
      const action = parts.slice(2).join('/');

      const espDevice = await prisma.espDevice.findUnique({
        where: { mac_address: macAddress },
      });

      if (!espDevice) {
        if (action === 'register') {
          await this.handleEspRegistration(macAddress, payload);
        }
        return;
      }

      await prisma.espDevice.update({
        where: { id: espDevice.id },
        data: {
          is_online: true,
          last_seen: new Date(),
          ...(payload.ip_address && { ip_address: payload.ip_address }),
          ...(payload.firmware_ver && { firmware_ver: payload.firmware_ver }),
        },
      });

      if (action === 'heartbeat') {
        if (payload.pins_state) {
          await this.syncDeviceStates(espDevice.id, payload.pins_state as Record<string, unknown>);
        }
      }

      if (action === 'devices' && parts[3] === 'status') {
        const devicePin = parseInt(parts[2].replace('pin_', ''));
        await this.updateDeviceState(espDevice.id, devicePin, payload);
      }

      const handler = this.messageHandlers.get(topic);
      if (handler) {
        handler(topic, payload);
      }
    } catch (error) {
      console.error('Error handling MQTT message:', error);
    }
  }

  private async handleEspRegistration(macAddress: string, payload: Record<string, unknown>): Promise<void> {
    console.log(`📋 New ESP device registered: ${macAddress}`);
    const handler = this.messageHandlers.get('new_device');
    if (handler) {
      handler('new_device', { mac_address: macAddress, ...payload });
    }
  }

  private async syncDeviceStates(espDeviceId: string, pinsState: Record<string, unknown>): Promise<void> {
    const devices = await prisma.device.findMany({
      where: { esp_device_id: espDeviceId, is_active: true },
    });

    for (const device of devices) {
      const pinKey = `pin_${device.pin}`;
      if (pinsState[pinKey] !== undefined) {
        const newState = pinsState[pinKey];
        const currentState = device.state as Record<string, unknown>;

        if (JSON.stringify(currentState) !== JSON.stringify(newState)) {
          await prisma.device.update({
            where: { id: device.id },
            data: {
              state: newState as Record<string, unknown>,
              last_updated: new Date(),
            },
          });
        }
      }
    }
  }

  private async updateDeviceState(espDeviceId: string, pin: number, payload: Record<string, unknown>): Promise<void> {
    const device = await prisma.device.findFirst({
      where: { esp_device_id: espDeviceId, pin },
    });

    if (device) {
      await prisma.device.update({
        where: { id: device.id },
        data: {
          state: payload,
          last_updated: new Date(),
        },
      });

      await prisma.deviceStateHistory.create({
        data: {
          device_id: device.id,
          state: payload,
          source: 'device',
        },
      });
    }
  }

  publishCommand(espMacAddress: string, pin: number, state: Record<string, unknown>): void {
    if (!this.client || !this.connected) {
      console.warn('⚠️ MQTT not connected. Command queued will be lost.');
      return;
    }

    const topic = `${config.mqtt.topic_prefix}/${espMacAddress}/cmd`;
    const payload = JSON.stringify({
      pin,
      state,
      timestamp: new Date().toISOString(),
    });

    this.client.publish(topic, payload, { qos: 1 });
  }

  publishToEsp(espMacAddress: string, action: string, payload: Record<string, unknown>): void {
    if (!this.client || !this.connected) {
      console.warn('⚠️ MQTT not connected. Message to ESP will be lost.');
      return;
    }

    const topic = `${config.mqtt.topic_prefix}/${espMacAddress}/${action}`;
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  onMessage(topic: string, handler: (topic: string, payload: Record<string, unknown>) => void): void {
    this.messageHandlers.set(topic, handler);
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, () => {
          this.connected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default new MqttService();
