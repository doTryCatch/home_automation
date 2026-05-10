import api from './api';
import { Device, EspDevice, DeviceType } from '../types';

export const deviceService = {
  async getAll(roomId?: string): Promise<Device[]> {
    const params = roomId ? { room_id: roomId } : {};
    const res = await api.get('/devices', { params });
    return res.data?.data ?? [];
  },

  async getById(id: string): Promise<Device> {
    const res = await api.get('/devices/' + id);
    return res.data?.data;
  },

  async create(data: {
    room_id: string;
    esp_device_id: string;
    type_id: string;
    name: string;
    pin: number;
    config?: Record<string, unknown>;
  }): Promise<Device> {
    const res = await api.post('/devices', data);
    return res.data?.data;
  },

  async update(
    id: string,
    data: Partial<{ name: string; pin: number; config: Record<string, unknown>; room_id: string }>
  ): Promise<Device> {
    const res = await api.put('/devices/' + id, data);
    return res.data?.data;
  },

  async control(id: string, state: Record<string, unknown>): Promise<Device> {
    const res = await api.post('/devices/' + id + '/control', { state });
    return res.data?.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete('/devices/' + id);
  },

  async getAllDeviceTypes(): Promise<DeviceType[]> {
    const res = await api.get('/devices/types');
    return res.data?.data ?? [];
  },

  async createDeviceType(data: {
    name: string;
    icon: string;
    category?: string;
    properties_schema?: Record<string, unknown>;
  }): Promise<DeviceType> {
    const res = await api.post('/devices/types', data);
    return res.data?.data;
  },

  async deleteDeviceType(id: string): Promise<void> {
    await api.delete('/devices/types/' + id);
  },

  async getAllEspDevices(): Promise<EspDevice[]> {
    const res = await api.get('/devices/esp');
    return res.data?.data ?? [];
  },

  async registerEsp(data: {
    mac_address: string;
    name: string;
    firmware_ver?: string;
  }): Promise<EspDevice | null> {
    const res = await api.post('/devices/esp/register', data);
    return res.data?.data ?? null;
  },

  async deleteEsp(id: string): Promise<void> {
    await api.delete('/devices/esp/' + id);
  },

  async getUnclaimedEspDevices(): Promise<EspDevice[]> {
    const res = await api.get('/devices/esp/unclaimed');
    return res.data?.data ?? [];
  },

  async claimEspDevice(id: string, name?: string): Promise<EspDevice> {
    const res = await api.post('/devices/esp/' + id + '/claim', { name });
    return res.data?.data;
  },
};
