import prisma from '../config/database';
import { CreateRoomInput, UpdateRoomInput } from '../validators';

export class RoomService {
  async create(userId: string, data: CreateRoomInput) {
    const floor = await prisma.floor.findFirst({
      where: { id: data.floor_id, user_id: userId },
    });

    if (!floor) {
      throw new Error('Floor not found');
    }

    const room = await prisma.room.create({
      data: {
        floor_id: data.floor_id,
        name: data.name,
        polygon_coords: data.polygon_coords as any,
        color: data.color,
        icon: data.icon,
        sort_order: data.sort_order,
      },
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
    });

    return room;
  }

  async getAll(userId: string, floorId?: string) {
    const where: any = {};
    if (floorId) {
      const floor = await prisma.floor.findFirst({
        where: { id: floorId, user_id: userId },
      });
      if (!floor) throw new Error('Floor not found');
      where.floor_id = floorId;
    } else {
      where.floor = { user_id: userId };
    }

    const rooms = await prisma.room.findMany({
      where,
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
    });

    return rooms;
  }

  async getById(userId: string, roomId: string) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, floor: { user_id: userId } },
      include: {
        devices: {
          include: {
            type: true,
            esp_device: {
              select: { id: true, name: true, is_online: true },
            },
            schedules: {
              where: { is_active: true },
            },
          },
        },
        floor: {
          select: { id: true, name: true, level: true },
        },
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    return room;
  }

  async update(userId: string, roomId: string, data: UpdateRoomInput) {
    const existing = await prisma.room.findFirst({
      where: { id: roomId, floor: { user_id: userId } },
    });

    if (!existing) {
      throw new Error('Room not found');
    }

    const room = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...data,
        ...(data.polygon_coords && { polygon_coords: data.polygon_coords as any }),
        updated_at: new Date(),
      },
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
    });

    return room;
  }

  async delete(userId: string, roomId: string) {
    const existing = await prisma.room.findFirst({
      where: { id: roomId, floor: { user_id: userId } },
    });

    if (!existing) {
      throw new Error('Room not found');
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    return { message: 'Room deleted successfully' };
  }
}

export default new RoomService();
