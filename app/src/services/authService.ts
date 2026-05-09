import api from './api';
import { AuthResponse, User } from '../types';

export const authService = {
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const res = await api.post('/auth/register', { email, password, name });
    return res.data?.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await api.post('/auth/login', { email, password });
    return res.data?.data;
  },

  async getProfile(): Promise<User> {
    const res = await api.get('/auth/profile');
    return res.data?.data;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const res = await api.put('/auth/profile', data);
    return res.data?.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  async deleteAccount(): Promise<void> {
    await api.delete('/auth/account');
  },
};
