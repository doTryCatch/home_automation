import { Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { RegisterInput, LoginInput, UpdateProfileInput, ChangePasswordInput } from '../validators';
import { ApiResponse } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  async register(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: RegisterInput = req.body;
      const result = await authService.register(data);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'REGISTRATION_ERROR',
        });
      }
    }
  }

  async login(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: LoginInput = req.body;
      const result = await authService.login(data);
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({
          success: false,
          message: error.message,
          error: 'LOGIN_ERROR',
        });
      }
    }
  }

  async getProfile(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getProfile(req.userId!);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({
          success: false,
          message: error.message,
          error: 'PROFILE_ERROR',
        });
      }
    }
  }

  async updateProfile(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: UpdateProfileInput = req.body;
      const user = await authService.updateProfile(req.userId!, data);
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'UPDATE_ERROR',
        });
      }
    }
  }

  async changePassword(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: ChangePasswordInput = req.body;
      const result = await authService.changePassword(req.userId!, data);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'CHANGE_PASSWORD_ERROR',
        });
      }
    }
  }

  async deleteAccount(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await authService.deleteAccount(req.userId!);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DELETE_ERROR',
        });
      }
    }
  }
}

export default new AuthController();
