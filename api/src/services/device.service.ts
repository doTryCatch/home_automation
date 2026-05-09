import prisma from '../config/database';
import webSocketService from '../utils/websocket';
import {
  RegisterEspInput,
  UpdateEspInput,
  CreateDeviceInput,
  UpdateDeviceInput,
  ControlDeviceInput,
  CreateDeviceTypeInput,
} from '../validators';

export class DeviceService {
  async registerEsp(userId: string, data: RegisterEspInput) {
    const existing = await prisma.espDevice.findUnique({
      where: { mac_address: data.mac_address },
    });

    if (existing) {
      const updated = await prisma.espDevice.update({
        where: { id: existing.id },
        data: {
          name: data.name || existing.name,
          is_online: true,
          last_seen: new Date(),
          firmware_ver: data.firmware_ver,
          wifi_ssid: data.wifi_ssid,
          ip_address: data.ip_address,
        },
      });
      return updated;
    }

    const espDevice = await prisma.espDevice.create({
      data: {
        user_id: userId,
        name: data.name,
        mac_address: data.mac_address,
        firmware_ver: data.firmware_ver,
        wifi_ssid: data.wifi_ssid,
        ip_address: data.ip_address,
        is_online: true,
        last_seen: new Date(),
      },
    });

    return espDevice;
  }

  async getAllEspDevices(userId: string) {
    const devices = await prisma.espDevice.findMany({
      where: { user_id: userId },
      include: {
        devices: {
          include: {
            type: true,
            room: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return devices;
  }

  async getEspById(userId: string, espId: string) {
    const device = await prisma.espDevice.findFirst({
      where: { id: espId, user_id: userId },
      include: {
        devices: {
          include: {
            type: true,
            room: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!device) throw new Error('ESP device not found');

    return device;
  }

  async updateEsp(userId: string, espId: string, data: UpdateEspInput) {
    const existing = await prisma.espDevice.findFirst({
      where: { id: espId, user_id: userId },
    });

    if (!existing) throw new Error('ESP device not found');

    const device = await prisma.espDevice.update({
      where: { id: espId },
      data: { ...data, updated_at: new Date() },
    });

    return device;
  }

  async deleteEsp(userId: string, espId: string) {
    const existing = await prisma.espDevice.findFirst({
      where: { id: espId, user_id: userId },
    });

    if (!existing) throw new Error('ESP device not found');

    await prisma.espDevice.delete({
      where: { id: espId },
    });

    return { message: 'ESP device deleted successfully' };
  }

  async createDevice(userId: string, data: CreateDeviceInput) {
    const room = await prisma.room.findFirst({
      where: { id: data.room_id, floor: { user_id: userId } },
    });

    if (!room) throw new Error('Room not found');

    const espDevice = await prisma.espDevice.findFirst({
      where: { id: data.esp_device_id, user_id: userId },
    });

    if (!espDevice) throw new Error('ESP device not found');

    const deviceType = await prisma.deviceType.findFirst({
      where: { id: data.type_id },
    });

    if (!deviceType) throw new Error('Device type not found');

    const existingPin = await prisma.device.findFirst({
      where: { esp_device_id: data.esp_device_id, pin: data.pin },
    });

    if (existingPin) throw new Error(`Pin ${data.pin} is already in use on this ESP device`);

    const device = await prisma.device.create({
      data: {
        room_id: data.room_id,
        esp_device_id: data.esp_device_id,
        type_id: data.type_id,
        name: data.name,
        pin: data.pin,
        state: { power: false },
        config: data.config,
      },
      include: {
        type: true,
        esp_device: {
          select: { id: true, name: true, mac_address: true, is_online: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    webSocketService.sendConfigToEsp(espDevice.mac_address, 'add_device', {
      action: 'add_device',
      device_id: device.id,
      pin: device.pin,
      type: deviceType.name,
    });

    return device;
  }

  async getAllDevices(userId: string, roomId?: string) {
    const where: any = {};
    if (roomId) {
      where.room = { id: roomId, floor: { user_id: userId } };
    } else {
      where.esp_device = { user_id: userId };
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        type: true,
        esp_device: {
          select: { id: true, name: true, mac_address: true, is_online: true },
        },
        room: {
          select: { id: true, name: true, floor: { select: { id: true, name: true } } },
        },
        schedules: {
          where: { is_active: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return devices;
  }

  async getDeviceById(userId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, esp_device: { user_id: userId } },
      include: {
        type: true,
        esp_device: {
          select: { id: true, name: true, mac_address: true, is_online: true },
        },
        room: {
          select: { id: true, name: true },
        },
        schedules: true,
        state_history: {
          orderBy: { created_at: 'desc' },
          take: 50,
        },
      },
    });

    if (!device) throw new Error('Device not found');

    return device;
  }

  async updateDevice(userId: string, deviceId: string, data: UpdateDeviceInput) {
    const existing = await prisma.device.findFirst({
      where: { id: deviceId, esp_device: { user_id: userId } },
    });

    if (!existing) throw new Error('Device not found');

    const device = await prisma.device.update({
      where: { id: deviceId },
      data: { ...data, updated_at: new Date() },
      include: {
        type: true,
        esp_device: {
          select: { id: true, name: true, mac_address: true, is_online: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    return device;
  }

  async controlDevice(userId: string, deviceId: string, data: ControlDeviceInput) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, esp_device: { user_id: userId } },
      include: {
        esp_device: true,
      },
    });

    if (!device) throw new Error('Device not found');

    if (!webSocketService.isEspConnected(device.esp_device.mac_address)) {
      throw new Error('ESP device is offline');
    }

    webSocketService.sendCommandToEsp(device.esp_device.mac_address, device.pin, data.state);

    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: {
        state: data.state,
        last_updated: new Date(),
      },
      include: {
        type: true,
        esp_device: {
          select: { id: true, name: true, is_online: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    await prisma.deviceStateHistory.create({
      data: {
        device_id: deviceId,
        state: data.state,
        source: data.source,
      },
    });

    return updatedDevice;
  }

  async deleteDevice(userId: string, deviceId: string) {
    const existing = await prisma.device.findFirst({
      where: { id: deviceId, esp_device: { user_id: userId } },
      include: { esp_device: true },
    });

    if (!existing) throw new Error('Device not found');

    webSocketService.sendConfigToEsp(existing.esp_device.mac_address, 'remove_device', {
      action: 'remove_device',
      pin: existing.pin,
    });

    await prisma.device.delete({
      where: { id: deviceId },
    });

    return { message: 'Device deleted successfully' };
  }

  async createDeviceType(userId: string, data: CreateDeviceTypeInput) {
    const deviceType = await prisma.deviceType.create({
      data: {
        user_id: userId,
        name: data.name,
        icon: data.icon,
        category: data.category,
        properties_schema: data.properties_schema,
      },
    });

    return deviceType;
  }

  async getAllDeviceTypes(userId: string) {
    const types = await prisma.deviceType.findMany({
      where: {
        OR: [
          { user_id: userId },
          { is_default: true, user_id: null },
        ],
        is_active: true,
      },
      orderBy: [
        { is_default: 'desc' },
        { name: 'asc' },
      ],
    });

    return types;
  }

  async deleteDeviceType(userId: string, typeId: string) {
    const existing = await prisma.deviceType.findFirst({
      where: { id: typeId, user_id: userId },
    });

    if (!existing) throw new Error('Device type not found');

    const devicesUsingType = await prisma.device.count({
      where: { type_id: typeId },
    });

    if (devicesUsingType > 0) {
      throw new Error('Cannot delete device type: devices are using it');
    }

    await prisma.deviceType.delete({
      where: { id: typeId },
    });

    return { message: 'Device type deleted successfully' };
  }
}

export default new DeviceService();
