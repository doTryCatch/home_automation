import api from './api';
import { Floor } from '../types';

export const floorService = {
  async getAll(): Promise<Floor[]> {
    const res = await api.get('/floors');
    return res.data?.data ?? [];
  },

  async getById(id: string): Promise<Floor> {
    const res = await api.get('/floors/' + id);
    return res.data?.data;
  },

  async create(data: { name: string; level?: number; width?: number; height?: number }): Promise<Floor> {
    const res = await api.post('/floors', data);
    return res.data?.data;
  },

  async update(id: string, data: Partial<Floor>): Promise<Floor> {
    const res = await api.put('/floors/' + id, data);
    return res.data?.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete('/floors/' + id);
  },
};
