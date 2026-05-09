import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from '../validators';
import { JwtPayload } from '../types';

export class AuthService {
  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      config.jwt.secret,
      { expiresIn: config.jwt.expires_in }
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      config.jwt.secret + '_refresh',
      { expiresIn: config.jwt.refresh_expires_in }
    );
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await this.hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password_hash: hashedPassword,
        name: data.name,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        theme: true,
        created_at: true,
      },
    });

    await this.createDefaultDeviceTypes(user.id);

    const token = this.generateToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id);

    return { user, token, refreshToken };
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    const isValidPassword = await this.comparePassword(data.password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    const token = this.generateToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id);

    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token, refreshToken };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        avatar_url: true,
        theme: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            floors: true,
            esp_devices: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { ...data, updated_at: new Date() },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        avatar_url: true,
        theme: true,
        created_at: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await this.comparePassword(data.current_password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await this.hashPassword(data.new_password);

    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async deleteAccount(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Account deleted successfully' };
  }

  private async createDefaultDeviceTypes(userId: string) {
    const defaultTypes = [
      { name: 'Light', icon: 'lightbulb', category: 'lighting', properties_schema: { power: { type: 'boolean' }, brightness: { type: 'number', min: 0, max: 100 } } },
      { name: 'Fan', icon: 'fan', category: 'appliance', properties_schema: { power: { type: 'boolean' }, speed: { type: 'number', min: 0, max: 5 } } },
      { name: 'Switch', icon: 'toggle-switch', category: 'switch', properties_schema: { power: { type: 'boolean' } } },
      { name: 'Dimmer', icon: 'brightness', category: 'lighting', properties_schema: { power: { type: 'boolean' }, level: { type: 'number', min: 0, max: 255 } } },
      { name: 'AC', icon: 'air-conditioner', category: 'appliance', properties_schema: { power: { type: 'boolean' }, temperature: { type: 'number', min: 16, max: 30 }, mode: { type: 'enum', values: ['cool', 'heat', 'fan', 'auto'] } } },
      { name: 'TV', icon: 'television', category: 'entertainment', properties_schema: { power: { type: 'boolean' } } },
      { name: 'Motor', icon: 'motor', category: 'appliance', properties_schema: { power: { type: 'boolean' }, direction: { type: 'enum', values: ['forward', 'reverse'] } } },
      { name: 'Temperature Sensor', icon: 'thermometer', category: 'sensor', properties_schema: { temperature: { type: 'number', unit: '°C' }, humidity: { type: 'number', unit: '%' } } },
      { name: 'Motion Sensor', icon: 'motion-sensor', category: 'sensor', properties_schema: { motion: { type: 'boolean' } } },
      { name: 'Door Sensor', icon: 'door', category: 'sensor', properties_schema: { open: { type: 'boolean' } } },
      { name: 'Water Pump', icon: 'water-pump', category: 'appliance', properties_schema: { power: { type: 'boolean' } } },
      { name: 'Geyser', icon: 'water-heater', category: 'appliance', properties_schema: { power: { type: 'boolean' } } },
    ];

    for (const type of defaultTypes) {
      await prisma.deviceType.create({
        data: {
          user_id: userId,
          ...type,
          is_default: true,
        },
      });
    }
  }
}

export default new AuthService();
