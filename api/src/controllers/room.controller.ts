import { Response, NextFunction } from 'express';
import roomService from '../services/room.service';
import { CreateRoomInput, UpdateRoomInput } from '../validators';
import { ApiResponse } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';

export class RoomController {
  async create(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: CreateRoomInput = req.body;
      const room = await roomService.create(req.userId!, data);
      res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: room,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ROOM_CREATE_ERROR',
        });
      }
    }
  }

  async getAll(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const floorId = req.query.floor_id as string | undefined;
      const rooms = await roomService.getAll(req.userId!, floorId);
      res.status(200).json({
        success: true,
        data: rooms,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ROOM_GET_ERROR',
        });
      }
    }
  }

  async getById(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const room = await roomService.getById(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        data: room,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({
          success: false,
          message: error.message,
          error: 'ROOM_NOT_FOUND',
        });
      }
    }
  }

  async update(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: UpdateRoomInput = req.body;
      const room = await roomService.update(req.userId!, req.params.id, data);
      res.status(200).json({
        success: true,
        message: 'Room updated successfully',
        data: room,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ROOM_UPDATE_ERROR',
        });
      }
    }
  }

  async delete(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await roomService.delete(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ROOM_DELETE_ERROR',
        });
      }
    }
  }
}

export default new RoomController();
