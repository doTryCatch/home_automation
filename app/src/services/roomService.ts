import api from './api';
import { Room, Point } from '../types';

export const roomService = {
  async getAll(floorId?: string): Promise<Room[]> {
    const params = floorId ? { floor_id: floorId } : {};
    const res = await api.get('/rooms', { params });
    return res.data?.data ?? [];
  },

  async getById(id: string): Promise<Room> {
    const res = await api.get('/rooms/' + id);
    return res.data?.data;
  },

  async create(data: {
    floor_id: string;
    name: string;
    polygon_coords: Point[];
    color?: string;
    icon?: string;
  }): Promise<Room> {
    const res = await api.post('/rooms', data);
    return res.data?.data;
  },

  async update(
    id: string,
    data: Partial<{ name: string; polygon_coords: Point[]; color: string; icon: string }>
  ): Promise<Room> {
    const res = await api.put('/rooms/' + id, data);
    return res.data?.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete('/rooms/' + id);
  },
};
