import { z } from 'zod';

export const markReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).optional(),
  mark_all: z.boolean().default(false),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;
