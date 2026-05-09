import { z } from 'zod';

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const createRoomSchema = z.object({
  floor_id: z.string().uuid('Invalid floor ID'),
  name: z.string().min(1, 'Room name is required'),
  polygon_coords: z.array(pointSchema).min(3, 'At least 3 points required for a room shape'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4ECDC4'),
  icon: z.string().optional(),
  sort_order: z.number().int().default(0),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  polygon_coords: z.array(pointSchema).min(3).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
