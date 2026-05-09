import api from './api';
import { Schedule } from '../types';

export const scheduleService = {
  async getAll(deviceId?: string): Promise<Schedule[]> {
    const params = deviceId ? { device_id: deviceId } : {};
    const res = await api.get('/schedules', { params });
    return res.data?.data ?? [];
  },

  async getById(id: string): Promise<Schedule> {
    const res = await api.get('/schedules/' + id);
    return res.data?.data;
  },

  async create(data: {
    device_id: string;
    name?: string;
    action: Record<string, unknown>;
    cron: string;
    timezone?: string;
    is_active?: boolean;
  }): Promise<Schedule> {
    const res = await api.post('/schedules', data);
    return res.data?.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      action: Record<string, unknown>;
      cron: string;
      timezone: string;
      is_active: boolean;
    }>
  ): Promise<Schedule> {
    const res = await api.put('/schedules/' + id, data);
    return res.data?.data;
  },

  async toggle(id: string): Promise<Schedule> {
    const res = await api.post('/schedules/' + id + '/toggle');
    return res.data?.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete('/schedules/' + id);
  },
};
