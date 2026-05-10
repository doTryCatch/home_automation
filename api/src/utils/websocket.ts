import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verify } from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';

interface WSClient extends WebSocket {
  userId?: string;
  macAddress?: string;
  isEsp?: boolean;
  isAlive?: boolean;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WSClient>> = new Map();
  private espClients: Map<string, WSClient> = new Map();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WSClient) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message: Buffer) => {
        ws.isAlive = true;
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        if (ws.isEsp && ws.macAddress) {
          this.handleEspDisconnect(ws.macAddress);
        }
        if (ws.userId) {
          this.clients.get(ws.userId)?.delete(ws);
          if (this.clients.get(ws.userId)?.size === 0) {
            this.clients.delete(ws.userId);
          }
        }
      });
    });

    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws: WSClient) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => clearInterval(interval));

    console.log('🔌 WebSocket server initialized');
  }

  private async handleMessage(ws: WSClient, data: Record<string, unknown>): Promise<void> {
    switch (data.type) {
      case 'auth': {
        const token = data.token as string;
        if (token) {
          try {
            const decoded = verify(token, config.jwt.secret) as { userId: string };
            ws.userId = decoded.userId;
            if (!this.clients.has(decoded.userId)) {
              this.clients.set(decoded.userId, new Set());
            }
            this.clients.get(decoded.userId)!.add(ws);
            ws.send(JSON.stringify({ type: 'auth', success: true }));
          } catch {
            ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Invalid token' }));
          }
        }
        break;
      }

      case 'esp_auth':
        await this.handleEspAuth(ws, data);
        break;

      case 'esp_heartbeat':
        await this.handleEspHeartbeat(ws, data);
        break;

      case 'esp_status':
        await this.handleEspStatus(ws, data);
        break;

      case 'esp_register':
        await this.handleEspRegister(ws, data);
        break;
    }
  }

  private async handleEspAuth(ws: WSClient, data: Record<string, unknown>): Promise<void> {
    const mac = data.mac as string;
    if (!mac) return;

    ws.isEsp = true;
    ws.macAddress = mac;
    this.espClients.set(mac, ws);

    const espDevice = await prisma.espDevice.findUnique({
      where: { mac_address: mac },
    });

    if (espDevice) {
      await prisma.espDevice.update({
        where: { id: espDevice.id },
        data: { is_online: true, last_seen: new Date() },
      });

      if (espDevice.user_id) {
        this.broadcastEspStatus(espDevice.user_id, espDevice.id, true);
      }

      const devices = await prisma.device.findMany({
        where: { esp_device_id: espDevice.id, is_active: true },
        select: { id: true, pin: true, state: true },
      });

      ws.send(JSON.stringify({
        type: 'esp_sync',
        devices,
      }));
    } else {
      const newEsp = await prisma.espDevice.create({
        data: {
          name: `ESP-${mac.replace(/:/g, '').slice(-6)}`,
          mac_address: mac,
          is_online: true,
          last_seen: new Date(),
        },
      });
      console.log(`📋 Auto-registered new ESP: ${mac} (unclaimed)`);
    }

    ws.send(JSON.stringify({ type: 'esp_auth', success: true }));
    console.log(`🔌 ESP authenticated: ${mac}`);
  }

  private async handleEspHeartbeat(ws: WSClient, data: Record<string, unknown>): Promise<void> {
    const mac = ws.macAddress || (data.mac as string);
    if (!mac) return;

    const espDevice = await prisma.espDevice.findUnique({
      where: { mac_address: mac },
    });

    if (!espDevice) return;

    await prisma.espDevice.update({
      where: { id: espDevice.id },
      data: {
        is_online: true,
        last_seen: new Date(),
        ...(data.ip_address && { ip_address: data.ip_address as string }),
        ...(data.firmware_ver && { firmware_ver: data.firmware_ver as string }),
      },
    });

    if (data.pins_state) {
      await this.syncDeviceStates(espDevice.id, data.pins_state as Record<string, unknown>);
    }
  }

  private async handleEspStatus(ws: WSClient, data: Record<string, unknown>): Promise<void> {
    const mac = ws.macAddress || (data.mac as string);
    if (!mac || data.pin === undefined) return;

    const espDevice = await prisma.espDevice.findUnique({
      where: { mac_address: mac },
    });

    if (!espDevice) return;

    const device = await prisma.device.findFirst({
      where: { esp_device_id: espDevice.id, pin: data.pin as number },
    });

    if (device) {
      const state = data.state as Record<string, unknown>;

      await prisma.device.update({
        where: { id: device.id },
        data: { state, last_updated: new Date() },
      });

      await prisma.deviceStateHistory.create({
        data: {
          device_id: device.id,
          state,
          source: 'device',
        },
      });

      if (espDevice.user_id) {
        this.broadcastDeviceUpdate(espDevice.user_id, device.id, state);
      }
    }
  }

  private async handleEspRegister(ws: WSClient, data: Record<string, unknown>): Promise<void> {
    const mac = (data.mac_address as string) || ws.macAddress;
    if (!mac) return;

    console.log(`📋 ESP registration request: ${mac}`);

    const existing = await prisma.espDevice.findUnique({
      where: { mac_address: mac },
    });

    if (existing) {
      await prisma.espDevice.update({
        where: { id: existing.id },
        data: {
          is_online: true,
          last_seen: new Date(),
          ...(data.ip_address && { ip_address: data.ip_address as string }),
          ...(data.firmware_ver && { firmware_ver: data.firmware_ver as string }),
        },
      });

      const devices = await prisma.device.findMany({
        where: { esp_device_id: existing.id, is_active: true },
        select: { id: true, pin: true, state: true },
      });

      ws.send(JSON.stringify({
        type: 'esp_register',
        success: true,
        esp_id: existing.id,
        devices,
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'esp_register',
        success: false,
        message: 'Device not registered. Register via API first.',
      }));
    }
  }

  private handleEspDisconnect(mac: string): void {
    this.espClients.delete(mac);
    console.log(`🔌 ESP disconnected: ${mac}`);

    prisma.espDevice.findUnique({
      where: { mac_address: mac },
    }).then((espDevice) => {
      if (espDevice) {
        prisma.espDevice.update({
          where: { id: espDevice.id },
          data: { is_online: false },
        }).then(() => {
          if (espDevice.user_id) {
            this.broadcastEspStatus(espDevice.user_id, espDevice.id, false);
          }
        });
      }
    }).catch(console.error);
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

          const espDevice = await prisma.espDevice.findUnique({
            where: { id: espDeviceId },
          });
          if (espDevice && espDevice.user_id) {
            this.broadcastDeviceUpdate(espDevice.user_id, device.id, newState as Record<string, unknown>);
          }
        }
      }
    }
  }

  sendCommandToEsp(mac: string, pin: number, state: Record<string, unknown>): boolean {
    const ws = this.espClients.get(mac);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ ESP ${mac} not connected via WebSocket`);
      return false;
    }

    ws.send(JSON.stringify({
      type: 'esp_command',
      pin,
      state,
      timestamp: new Date().toISOString(),
    }));
    return true;
  }

  sendConfigToEsp(mac: string, action: string, payload: Record<string, unknown>): boolean {
    const ws = this.espClients.get(mac);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ ESP ${mac} not connected via WebSocket`);
      return false;
    }

    ws.send(JSON.stringify({
      type: 'esp_config',
      action,
      ...payload,
    }));
    return true;
  }

  isEspConnected(mac: string): boolean {
    const ws = this.espClients.get(mac);
    const connected = ws !== undefined && ws.readyState === WebSocket.OPEN;
    console.log(`🔍 ESP connection check: mac=${mac} found=${ws !== undefined} readyState=${ws?.readyState} open=${WebSocket.OPEN} result=${connected} totalClients=${this.espClients.size}`);
    return connected;
  }

  broadcastToUser(userId: string, data: { type: string; payload: unknown }): void {
    const clients = this.clients.get(userId);
    if (!clients) return;

    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastDeviceUpdate(userId: string, deviceId: string, state: Record<string, unknown>): void {
    this.broadcastToUser(userId, {
      type: 'device_update',
      payload: { deviceId, state, timestamp: new Date().toISOString() },
    });
  }

  broadcastEspStatus(userId: string, espId: string, online: boolean): void {
    this.broadcastToUser(userId, {
      type: 'esp_status',
      payload: { espId, online, timestamp: new Date().toISOString() },
    });
  }
}

export default new WebSocketService();
