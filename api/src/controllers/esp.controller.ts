import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { EspHeartbeatInput, EspRegisterInput } from '../validators';
import { ApiResponse } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';

export class EspController {
  async heartbeat(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: EspHeartbeatInput = req.body;

      const espDevice = await prisma.espDevice.findUnique({
        where: { mac_address: data.mac_address },
      });

      if (!espDevice) {
        res.status(404).json({
          success: false,
          message: 'ESP device not registered',
          error: 'ESP_NOT_REGISTERED',
        });
        return;
      }

      await prisma.espDevice.update({
        where: { id: espDevice.id },
        data: {
          is_online: true,
          last_seen: new Date(),
          ip_address: data.ip_address,
          firmware_ver: data.firmware_ver,
          wifi_ssid: data.wifi_ssid,
        },
      });

      if (data.pins_state) {
        const devices = await prisma.device.findMany({
          where: { esp_device_id: espDevice.id, is_active: true },
        });

        for (const device of devices) {
          const pinKey = `pin_${device.pin}`;
          const pinsState = data.pins_state as Record<string, unknown>;
          if (pinsState[pinKey] !== undefined) {
            await prisma.device.update({
              where: { id: device.id },
              data: {
                state: pinsState[pinKey] as Record<string, unknown>,
                last_updated: new Date(),
              },
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        message: 'Heartbeat received',
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'HEARTBEAT_ERROR',
        });
      }
    }
  }

  async register(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data: EspRegisterInput = req.body;

      const existing = await prisma.espDevice.findUnique({
        where: { mac_address: data.mac_address },
      });

      if (existing) {
        await prisma.espDevice.update({
          where: { id: existing.id },
          data: {
            is_online: true,
            last_seen: new Date(),
            ip_address: data.ip_address,
            firmware_ver: data.firmware_ver,
            wifi_ssid: data.wifi_ssid,
          },
        });

        const devices = await prisma.device.findMany({
          where: { esp_device_id: existing.id, is_active: true },
          select: { id: true, pin: true, state: true },
        });

        res.status(200).json({
          success: true,
          message: 'Device already registered, synced',
          data: {
            esp_id: existing.id,
            name: existing.name,
            devices,
          },
        });
        return;
      }

      const espDevice = await prisma.espDevice.create({
        data: {
          user_id: req.userId!,
          name: `ESP-${data.mac_address.slice(-5)}`,
          mac_address: data.mac_address,
          ip_address: data.ip_address,
          firmware_ver: data.firmware_ver,
          wifi_ssid: data.wifi_ssid,
          is_online: true,
          last_seen: new Date(),
          config: {
            pin_config: data.pin_config,
          },
        },
      });

      res.status(201).json({
        success: true,
        message: 'ESP device registered successfully',
        data: {
          esp_id: espDevice.id,
          name: espDevice.name,
          pin_config: data.pin_config,
        },
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

  async getCommands(req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const macAddress = req.params.mac;

      const espDevice = await prisma.espDevice.findUnique({
        where: { mac_address: macAddress },
        include: {
          devices: {
            where: { is_active: true },
            select: { id: true, pin: true, state: true },
          },
        },
      });

      if (!espDevice) {
        res.status(404).json({
          success: false,
          message: 'Device not found',
          error: 'NOT_FOUND',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          devices: espDevice.devices,
          config: espDevice.config,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'COMMAND_GET_ERROR',
        });
      }
    }
  }
}

export default new EspController();
