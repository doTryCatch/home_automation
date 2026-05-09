import { Router } from 'express';
import { FloorController } from '../controllers';
import { validateBody } from '../middleware';
import { createFloorSchema, updateFloorSchema } from '../validators';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validateBody(createFloorSchema),
  FloorController.create
);

router.get(
  '/',
  FloorController.getAll
);

router.get(
  '/:id',
  FloorController.getById
);

router.put(
  '/:id',
  validateBody(updateFloorSchema),
  FloorController.update
);

router.delete(
  '/:id',
  FloorController.delete
);

export default router;
