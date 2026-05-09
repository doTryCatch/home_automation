import { z } from 'zod';

export const espHeartbeatSchema = z.object({
  mac_address: z.string(),
  ip_address: z.string().optional(),
  firmware_ver: z.string().optional(),
  wifi_ssid: z.string().optional(),
  pins_state: z.record(z.string(), z.unknown()).default({}),
  free_heap: z.number().optional(),
  uptime: z.number().optional(),
});

export const espRegisterSchema = z.object({
  mac_address: z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/),
  firmware_ver: z.string().optional(),
  wifi_ssid: z.string().optional(),
  ip_address: z.string().optional(),
  pin_config: z.array(z.object({
    pin: z.number(),
    mode: z.enum(['input', 'output', 'pwm', 'analog']),
    type: z.string().optional(),
  })).default([]),
});

export type EspHeartbeatInput = z.infer<typeof espHeartbeatSchema>;
export type EspRegisterInput = z.infer<typeof espRegisterSchema>;
