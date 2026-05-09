import { Response, NextFunction } from 'express';
import scheduleService from '../services/schedule.service';
import { CreateScheduleInput, UpdateScheduleInput } from '../validators';
import { ApiResponse } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';

export class ScheduleController {
  async create(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: CreateScheduleInput = req.body;
      const schedule = await scheduleService.create(req.userId!, data);
      res.status(201).json({
        success: true,
        message: 'Schedule created successfully',
        data: schedule,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'SCHEDULE_CREATE_ERROR',
        });
      }
    }
  }

  async getAll(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const deviceId = req.query.device_id as string | undefined;
      const schedules = await scheduleService.getAll(req.userId!, deviceId);
      res.status(200).json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'SCHEDULE_GET_ERROR',
        });
      }
    }
  }

  async getById(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const schedule = await scheduleService.getById(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({
          success: false,
          message: error.message,
          error: 'SCHEDULE_NOT_FOUND',
        });
      }
    }
  }

  async update(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: UpdateScheduleInput = req.body;
      const schedule = await scheduleService.update(req.userId!, req.params.id, data);
      res.status(200).json({
        success: true,
        message: 'Schedule updated successfully',
        data: schedule,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'SCHEDULE_UPDATE_ERROR',
        });
      }
    }
  }

  async delete(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await scheduleService.delete(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'SCHEDULE_DELETE_ERROR',
        });
      }
    }
  }

  async toggle(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const schedule = await scheduleService.toggle(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        message: `Schedule ${schedule.is_active ? 'activated' : 'deactivated'}`,
        data: schedule,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'SCHEDULE_TOGGLE_ERROR',
        });
      }
    }
  }
}

export default new ScheduleController();
