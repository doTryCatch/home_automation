import { z } from 'zod';

export const createScheduleSchema = z.object({
  device_id: z.string().uuid('Invalid device ID'),
  name: z.string().optional(),
  action: z.record(z.string(), z.unknown()),
  cron: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().default('UTC'),
  is_active: z.boolean().default(true),
});

export const updateScheduleSchema = z.object({
  name: z.string().optional(),
  action: z.record(z.string(), z.unknown()).optional(),
  cron: z.string().min(1).optional(),
  timezone: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
