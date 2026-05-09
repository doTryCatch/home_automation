import { z } from 'zod';

export const createFloorSchema = z.object({
  name: z.string().min(1, 'Floor name is required'),
  level: z.number().int().min(0).default(0),
  layout_data: z.record(z.string(), z.unknown()).optional(),
  width: z.number().positive().default(800),
  height: z.number().positive().default(600),
  sort_order: z.number().int().default(0),
});

export const updateFloorSchema = z.object({
  name: z.string().min(1).optional(),
  level: z.number().int().min(0).optional(),
  layout_data: z.record(z.string(), z.unknown()).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  thumbnail: z.string().optional(),
  sort_order: z.number().int().optional(),
});

export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
