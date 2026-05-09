import prisma from '../config/database';
import webSocketService from '../utils/websocket';
import { CreateScheduleInput, UpdateScheduleInput } from '../validators';

interface CronJob {
  id: string;
  cron: string;
  action: Record<string, unknown>;
  deviceId: string;
  espMac: string;
  pin: number;
  isActive: boolean;
  nextRun: Date | null;
  intervalId: ReturnType<typeof setInterval> | null;
}

export class ScheduleService {
  private jobs: Map<string, CronJob> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.checkInterval = setInterval(() => this.checkSchedules(), 60000);
    this.loadActiveSchedules();
    console.log('⏰ Schedule service started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    for (const job of this.jobs.values()) {
      if (job.intervalId) clearInterval(job.intervalId);
    }
    this.jobs.clear();
  }

  private async loadActiveSchedules(): Promise<void> {
    const schedules = await prisma.schedule.findMany({
      where: { is_active: true },
      include: {
        device: {
          include: { esp_device: true },
        },
      },
    });

    for (const schedule of schedules) {
      this.addJob({
        id: schedule.id,
        cron: schedule.cron,
        action: schedule.action as Record<string, unknown>,
        deviceId: schedule.device_id,
        espMac: schedule.device.esp_device.mac_address,
        pin: schedule.device.pin,
        isActive: true,
        nextRun: this.getNextRun(schedule.cron),
        intervalId: null,
      });
    }
  }

  private getNextRun(cron: string): Date {
    const now = new Date();
    const parts = cron.split(' ');
    if (parts.length >= 2) {
      const minute = parseInt(parts[0]) || now.getMinutes();
      const hour = parseInt(parts[1]) || now.getHours();
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }
    return new Date(now.getTime() + 60000);
  }

  private addJob(job: CronJob): void {
    const existing = this.jobs.get(job.id);
    if (existing?.intervalId) clearInterval(existing.intervalId);
    this.jobs.set(job.id, job);
  }

  private removeJob(scheduleId: string): void {
    const job = this.jobs.get(scheduleId);
    if (job?.intervalId) clearInterval(job.intervalId);
    this.jobs.delete(scheduleId);
  }

  private async checkSchedules(): Promise<void> {
    const now = new Date();

    for (const [id, job] of this.jobs) {
      if (!job.isActive || !job.nextRun) continue;

      if (now >= job.nextRun) {
        try {
          webSocketService.sendCommandToEsp(job.espMac, job.pin, job.action);

          await prisma.device.update({
            where: { id: job.deviceId },
            data: { state: job.action, last_updated: new Date() },
          });

          await prisma.deviceStateHistory.create({
            data: {
              device_id: job.deviceId,
              state: job.action,
              source: 'schedule',
            },
          });

          await prisma.schedule.update({
            where: { id },
            data: {
              last_run: now,
              next_run: this.getNextRun(job.cron),
            },
          });

          job.nextRun = this.getNextRun(job.cron);
          job.lastRun = now;

          console.log(`⏰ Executed schedule ${id} for device pin ${job.pin}`);
        } catch (error) {
          console.error(`Failed to execute schedule ${id}:`, error);
        }
      }
    }
  }

  async create(userId: string, data: CreateScheduleInput) {
    const device = await prisma.device.findFirst({
      where: { id: data.device_id, esp_device: { user_id: userId } },
      include: { esp_device: true },
    });

    if (!device) throw new Error('Device not found');

    const nextRun = this.getNextRun(data.cron);

    const schedule = await prisma.schedule.create({
      data: {
        device_id: data.device_id,
        user_id: userId,
        name: data.name,
        action: data.action,
        cron: data.cron,
        timezone: data.timezone,
        is_active: data.is_active,
        next_run: nextRun,
      },
      include: {
        device: {
          include: {
            type: true,
            room: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (data.is_active) {
      this.addJob({
        id: schedule.id,
        cron: schedule.cron,
        action: schedule.action as Record<string, unknown>,
        deviceId: device.id,
        espMac: device.esp_device.mac_address,
        pin: device.pin,
        isActive: true,
        nextRun,
        intervalId: null,
      });
    }

    return schedule;
  }

  async getAll(userId: string, deviceId?: string) {
    const where: any = { user_id: userId };
    if (deviceId) where.device_id = deviceId;

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        device: {
          include: {
            type: true,
            room: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return schedules;
  }

  async getById(userId: string, scheduleId: string) {
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, user_id: userId },
      include: {
        device: {
          include: {
            type: true,
            room: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!schedule) throw new Error('Schedule not found');

    return schedule;
  }

  async update(userId: string, scheduleId: string, data: UpdateScheduleInput) {
    const existing = await prisma.schedule.findFirst({
      where: { id: scheduleId, user_id: userId },
      include: { device: { include: { esp_device: true } } },
    });

    if (!existing) throw new Error('Schedule not found');

    const nextRun = data.cron ? this.getNextRun(data.cron) : existing.next_run;

    const schedule = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...data,
        ...(data.cron && { next_run: nextRun }),
        updated_at: new Date(),
      },
      include: {
        device: {
          include: {
            type: true,
            room: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (data.is_active !== undefined || data.cron || data.action) {
      this.removeJob(scheduleId);
      if (schedule.is_active) {
        this.addJob({
          id: schedule.id,
          cron: schedule.cron,
          action: schedule.action as Record<string, unknown>,
          deviceId: existing.device_id,
          espMac: existing.device.esp_device.mac_address,
          pin: existing.device.pin,
          isActive: true,
          nextRun: nextRun,
          intervalId: null,
        });
      }
    }

    return schedule;
  }

  async delete(userId: string, scheduleId: string) {
    const existing = await prisma.schedule.findFirst({
      where: { id: scheduleId, user_id: userId },
    });

    if (!existing) throw new Error('Schedule not found');

    this.removeJob(scheduleId);

    await prisma.schedule.delete({
      where: { id: scheduleId },
    });

    return { message: 'Schedule deleted successfully' };
  }

  async toggle(userId: string, scheduleId: string) {
    const existing = await prisma.schedule.findFirst({
      where: { id: scheduleId, user_id: userId },
    });

    if (!existing) throw new Error('Schedule not found');

    return this.update(userId, scheduleId, { is_active: !existing.is_active });
  }
}

export default new ScheduleService();
