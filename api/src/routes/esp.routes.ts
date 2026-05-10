import { Router } from 'express';
import { EspController } from '../controllers';
import { validateBody } from '../middleware';
import { espHeartbeatSchema, espRegisterSchema } from '../validators';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';

const router = Router();

router.post(
  '/heartbeat',
  optionalAuthMiddleware,
  validateBody(espHeartbeatSchema),
  EspController.heartbeat
);

router.post(
  '/register',
  authMiddleware,
  validateBody(espRegisterSchema),
  EspController.register
);

router.get(
  '/:mac/commands',
  authMiddleware,
  EspController.getCommands
);

export default router;
