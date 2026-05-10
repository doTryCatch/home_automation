import api from './api';
import { Notification } from '../types';

export const notificationService = {
  async getAll(): Promise<Notification[]> {
    const res = await api.get('/notifications');
    return res.data?.data ?? [];
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get('/notifications/unread-count');
    return res.data?.data?.count ?? 0;
  },

  async markRead(ids?: string[], markAll?: boolean): Promise<void> {
    await api.put('/notifications/mark-read', {
      notification_ids: ids,
      mark_all: markAll,
    });
  },

  async delete(id: string): Promise<void> {
    await api.delete('/notifications/' + id);
  },
};
