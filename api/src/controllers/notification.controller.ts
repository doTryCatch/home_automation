import { Response, NextFunction } from 'express';
import notificationService from '../services/notification.service';
import { MarkReadInput } from '../validators';
import { ApiResponse } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';

export class NotificationController {
  async getAll(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const notifications = await notificationService.getAll(req.userId!);
      res.status(200).json({ success: true, data: notifications });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message, error: 'NOTIFICATION_GET_ERROR' });
      }
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const count = await notificationService.getUnreadCount(req.userId!);
      res.status(200).json({ success: true, data: { count } });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message, error: 'NOTIFICATION_COUNT_ERROR' });
      }
    }
  }

  async markRead(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: MarkReadInput = req.body;
      const result = await notificationService.markRead(req.userId!, data);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message, error: 'NOTIFICATION_READ_ERROR' });
      }
    }
  }

  async delete(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.delete(req.userId!, req.params.id);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message, error: 'NOTIFICATION_DELETE_ERROR' });
      }
    }
  }
}

export default new NotificationController();
