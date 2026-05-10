import { Router } from 'express';
import { NotificationController } from '../controllers';
import { validateBody } from '../middleware';
import { markReadSchema } from '../validators';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', NotificationController.getAll);
router.get('/unread-count', NotificationController.getUnreadCount);
router.put('/mark-read', validateBody(markReadSchema), NotificationController.markRead);
router.delete('/:id', NotificationController.delete);

export default router;
