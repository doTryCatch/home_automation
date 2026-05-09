import { Response, NextFunction } from 'express';
import floorService from '../services/floor.service';
import { CreateFloorInput, UpdateFloorInput } from '../validators';
import { ApiResponse } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';

export class FloorController {
  async create(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: CreateFloorInput = req.body;
      const floor = await floorService.create(req.userId!, data);
      res.status(201).json({
        success: true,
        message: 'Floor created successfully',
        data: floor,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'FLOOR_CREATE_ERROR',
        });
      }
    }
  }

  async getAll(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const floors = await floorService.getAll(req.userId!);
      res.status(200).json({
        success: true,
        data: floors,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'FLOOR_GET_ERROR',
        });
      }
    }
  }

  async getById(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const floor = await floorService.getById(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        data: floor,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({
          success: false,
          message: error.message,
          error: 'FLOOR_NOT_FOUND',
        });
      }
    }
  }

  async update(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: UpdateFloorInput = req.body;
      const floor = await floorService.update(req.userId!, req.params.id, data);
      res.status(200).json({
        success: true,
        message: 'Floor updated successfully',
        data: floor,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'FLOOR_UPDATE_ERROR',
        });
      }
    }
  }

  async delete(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await floorService.delete(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'FLOOR_DELETE_ERROR',
        });
      }
    }
  }
}

export default new FloorController();
