import prisma from '../config/database';
import webSocketService from '../utils/websocket';
import { CreateFloorInput, UpdateFloorInput } from '../validators';

export class FloorService {
  async create(userId: string, data: CreateFloorInput) {
    const floor = await prisma.floor.create({
      data: {
        user_id: userId,
        name: data.name,
        level: data.level,
        layout_data: data.layout_data || {},
        width: data.width,
        height: data.height,
        sort_order: data.sort_order,
      },
      include: {
        rooms: {
          include: {
            devices: {
              include: {
                type: true,
                esp_device: {
                  select: { id: true, name: true, is_online: true },
                },
              },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    return floor;
  }

  async getAll(userId: string) {
    const floors = await prisma.floor.findMany({
      where: { user_id: userId },
      include: {
        rooms: {
          include: {
            devices: {
              include: {
                type: true,
                esp_device: {
                  select: { id: true, name: true, is_online: true },
                },
              },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
      },
      orderBy: [{ level: 'asc' }, { sort_order: 'asc' }],
    });

    return floors;
  }

  async getById(userId: string, floorId: string) {
    const floor = await prisma.floor.findFirst({
      where: { id: floorId, user_id: userId },
      include: {
        rooms: {
          include: {
            devices: {
              include: {
                type: true,
                esp_device: {
                  select: { id: true, name: true, is_online: true },
                },
              },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    if (!floor) {
      throw new Error('Floor not found');
    }

    return floor;
  }

  async update(userId: string, floorId: string, data: UpdateFloorInput) {
    const existing = await prisma.floor.findFirst({
      where: { id: floorId, user_id: userId },
    });

    if (!existing) {
      throw new Error('Floor not found');
    }

    const floor = await prisma.floor.update({
      where: { id: floorId },
      data: { ...data, updated_at: new Date() },
      include: {
        rooms: {
          include: {
            devices: {
              include: {
                type: true,
                esp_device: {
                  select: { id: true, name: true, is_online: true },
                },
              },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    return floor;
  }

  async delete(userId: string, floorId: string) {
    const existing = await prisma.floor.findFirst({
      where: { id: floorId, user_id: userId },
      include: {
        rooms: {
          include: {
            devices: {
              include: {
                esp_device: {
                  select: { mac_address: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new Error('Floor not found');
    }

    const notified = new Set<string>();
    for (const room of existing.rooms) {
      for (const device of room.devices) {
        if (device.esp_device?.mac_address && !notified.has(device.esp_device.mac_address)) {
          webSocketService.sendConfigToEsp(device.esp_device.mac_address, 'remove_device', {
            action: 'remove_device',
            pin: device.pin,
          });
          notified.add(device.esp_device.mac_address);
        }
      }
    }

    await prisma.floor.delete({
      where: { id: floorId },
    });

    return { message: 'Floor deleted successfully' };
  }
}

export default new FloorService();
