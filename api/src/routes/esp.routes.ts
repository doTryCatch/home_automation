import { Router } from 'express';
import { EspController } from '../controllers';
import { validateBody } from '../middleware';
import { espHeartbeatSchema, espRegisterSchema } from '../validators';
import { authMiddleware } from '../middleware';

const router = Router();

router.post(
  '/heartbeat',
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
  EspController.getCommands
);

export default router;
