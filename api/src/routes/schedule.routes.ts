import { Router } from 'express';
import { ScheduleController } from '../controllers';
import { validateBody } from '../middleware';
import { createScheduleSchema, updateScheduleSchema } from '../validators';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validateBody(createScheduleSchema),
  ScheduleController.create
);

router.get(
  '/',
  ScheduleController.getAll
);

router.get(
  '/:id',
  ScheduleController.getById
);

router.put(
  '/:id',
  validateBody(updateScheduleSchema),
  ScheduleController.update
);

router.post(
  '/:id/toggle',
  ScheduleController.toggle
);

router.delete(
  '/:id',
  ScheduleController.delete
);

export default router;
