import prisma from '../config/database';

export class NotificationService {
  async getAll(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return notifications;
  }

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
    return count;
  }

  async markRead(userId: string, data: { notification_ids?: string[]; mark_all?: boolean }) {
    if (data.mark_all) {
      await prisma.notification.updateMany({
        where: { user_id: userId, is_read: false },
        data: { is_read: true, read_at: new Date() },
      });
    } else if (data.notification_ids?.length) {
      await prisma.notification.updateMany({
        where: {
          id: { in: data.notification_ids },
          user_id: userId,
        },
        data: { is_read: true, read_at: new Date() },
      });
    }
    return { message: 'Notifications marked as read' };
  }

  async delete(userId: string, notificationId: string) {
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId },
    });
    if (!existing) throw new Error('Notification not found');
    await prisma.notification.delete({ where: { id: notificationId } });
    return { message: 'Notification deleted' };
  }
}

export default new NotificationService();
