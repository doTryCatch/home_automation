import { z } from 'zod';

export const registerEspSchema = z.object({
  mac_address: z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, 'Invalid MAC address'),
  name: z.string().min(1, 'Device name is required'),
  firmware_ver: z.string().optional(),
  wifi_ssid: z.string().optional(),
  ip_address: z.string().optional(),
});

export const updateEspSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const createDeviceSchema = z.object({
  room_id: z.string().uuid('Invalid room ID'),
  esp_device_id: z.string().uuid('Invalid ESP device ID'),
  type_id: z.string().uuid('Invalid device type ID'),
  name: z.string().min(1, 'Device name is required'),
  pin: z.number().int().min(0).max(8, 'Pin must be between 0-8 (D0-D8)'),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const updateDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  pin: z.number().int().min(0).max(8).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  room_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

export const controlDeviceSchema = z.object({
  state: z.record(z.string(), z.unknown()),
  source: z.enum(['manual', 'schedule', 'automation']).default('manual'),
});

export const createDeviceTypeSchema = z.object({
  name: z.string().min(1, 'Type name is required'),
  icon: z.string().min(1, 'Icon is required'),
  category: z.string().default('appliance'),
  properties_schema: z.record(z.string(), z.unknown()).default({}),
});

export type RegisterEspInput = z.infer<typeof registerEspSchema>;
export type UpdateEspInput = z.infer<typeof updateEspSchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type ControlDeviceInput = z.infer<typeof controlDeviceSchema>;
export type CreateDeviceTypeInput = z.infer<typeof createDeviceTypeSchema>;
