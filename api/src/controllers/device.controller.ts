import { Response, NextFunction } from 'express';
import deviceService from '../services/device.service';
import {
  RegisterEspInput,
  UpdateEspInput,
  CreateDeviceInput,
  UpdateDeviceInput,
  ControlDeviceInput,
  CreateDeviceTypeInput,
} from '../validators';
import { ApiResponse } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';

export class DeviceController {
  async registerEsp(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: RegisterEspInput = req.body;
      const device = await deviceService.registerEsp(req.userId!, data);
      res.status(201).json({
        success: true,
        message: 'ESP device registered successfully',
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ESP_REGISTER_ERROR',
        });
      }
    }
  }

  async getAllEspDevices(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const devices = await deviceService.getAllEspDevices(req.userId!);
      res.status(200).json({
        success: true,
        data: devices,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ESP_GET_ERROR',
        });
      }
    }
  }

  async getEspById(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const device = await deviceService.getEspById(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({
          success: false,
          message: error.message,
          error: 'ESP_NOT_FOUND',
        });
      }
    }
  }

  async updateEsp(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: UpdateEspInput = req.body;
      const device = await deviceService.updateEsp(req.userId!, req.params.id, data);
      res.status(200).json({
        success: true,
        message: 'ESP device updated successfully',
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ESP_UPDATE_ERROR',
        });
      }
    }
  }

  async deleteEsp(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await deviceService.deleteEsp(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ESP_DELETE_ERROR',
        });
      }
    }
  }

  async createDevice(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: CreateDeviceInput = req.body;
      const device = await deviceService.createDevice(req.userId!, data);
      res.status(201).json({
        success: true,
        message: 'Device created successfully',
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_CREATE_ERROR',
        });
      }
    }
  }

  async getAllDevices(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const roomId = req.query.room_id as string | undefined;
      const devices = await deviceService.getAllDevices(req.userId!, roomId);
      res.status(200).json({
        success: true,
        data: devices,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_GET_ERROR',
        });
      }
    }
  }

  async getDeviceById(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const device = await deviceService.getDeviceById(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({
          success: false,
          message: error.message,
          error: 'DEVICE_NOT_FOUND',
        });
      }
    }
  }

  async updateDevice(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: UpdateDeviceInput = req.body;
      const device = await deviceService.updateDevice(req.userId!, req.params.id, data);
      res.status(200).json({
        success: true,
        message: 'Device updated successfully',
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_UPDATE_ERROR',
        });
      }
    }
  }

  async controlDevice(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: ControlDeviceInput = req.body;
      const device = await deviceService.controlDevice(req.userId!, req.params.id, data);
      res.status(200).json({
        success: true,
        message: 'Device controlled successfully',
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_CONTROL_ERROR',
        });
      }
    }
  }

  async deleteDevice(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await deviceService.deleteDevice(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_DELETE_ERROR',
        });
      }
    }
  }

  async createDeviceType(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: CreateDeviceTypeInput = req.body;
      const deviceType = await deviceService.createDeviceType(req.userId!, data);
      res.status(201).json({
        success: true,
        message: 'Device type created successfully',
        data: deviceType,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_TYPE_CREATE_ERROR',
        });
      }
    }
  }

  async getAllDeviceTypes(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const types = await deviceService.getAllDeviceTypes(req.userId!);
      res.status(200).json({
        success: true,
        data: types,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_TYPE_GET_ERROR',
        });
      }
    }
  }

  async deleteDeviceType(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await deviceService.deleteDeviceType(req.userId!, req.params.id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'DEVICE_TYPE_DELETE_ERROR',
        });
      }
    }
  }

  async getUnclaimedEspDevices(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const devices = await deviceService.getUnclaimedEspDevices();
      res.status(200).json({
        success: true,
        data: devices,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ESP_UNCLAIMED_GET_ERROR',
        });
      }
    }
  }

  async claimEspDevice(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      const device = await deviceService.claimEspDevice(req.userId!, req.params.id, name);
      res.status(200).json({
        success: true,
        message: 'ESP device claimed successfully',
        data: device,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'ESP_CLAIM_ERROR',
        });
      }
    }
  }
}

export default new DeviceController();
