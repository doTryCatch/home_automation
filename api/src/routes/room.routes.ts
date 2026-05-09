import { Router } from 'express';
import { RoomController } from '../controllers';
import { validateBody } from '../middleware';
import { createRoomSchema, updateRoomSchema } from '../validators';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validateBody(createRoomSchema),
  RoomController.create
);

router.get(
  '/',
  RoomController.getAll
);

router.get(
  '/:id',
  RoomController.getById
);

router.put(
  '/:id',
  validateBody(updateRoomSchema),
  RoomController.update
);

router.delete(
  '/:id',
  RoomController.delete
);

export default router;
