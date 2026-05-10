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
  lastRun: Date | null;
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
        lastRun: schedule.last_run,
        intervalId: null,
      });
    }
  }

  private getNextRun(cron: string): Date {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) {
      return new Date(Date.now() + 60000);
    }

    const now = new Date();
    const [minuteStr, hourStr, domStr, monthStr, dowStr] = parts;

    const parseField = (field: string, min: number, max: number): number[] => {
      if (field === '*') {
        const values: number[] = [];
        for (let i = min; i <= max; i++) values.push(i);
        return values;
      }
      if (field.includes(',')) {
        return field.split(',').map(v => parseInt(v)).filter(v => !isNaN(v));
      }
      if (field.includes('/')) {
        const [range, stepStr] = field.split('/');
        const step = parseInt(stepStr) || 1;
        const start = range === '*' ? min : parseInt(range) || min;
        const values: number[] = [];
        for (let i = start; i <= max; i += step) values.push(i);
        return values;
      }
      if (field.includes('-')) {
        const [s, e] = field.split('-').map(v => parseInt(v));
        const values: number[] = [];
        for (let i = s; i <= e; i++) values.push(i);
        return values;
      }
      const val = parseInt(field);
      return isNaN(val) ? [] : [val];
    };

    const minutes = parseField(minuteStr, 0, 59);
    const hours = parseField(hourStr, 0, 23);
    const doms = parseField(domStr, 1, 31);
    const months = parseField(monthStr, 1, 12);
    const dows = parseField(dowStr, 0, 6);

    const DAYS_IN_MONTH = [31, 28, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);

    for (let yOffset = 0; yOffset <= 1; yOffset++) {
      const year = now.getFullYear() + yOffset;
      for (const month of (months.length > 0 ? months : Array.from({ length: 12 }, (_, i) => i + 1))) {
        if (yOffset === 0 && month < now.getMonth() + 1) continue;
        const maxDay = month === 2 ? (isLeapYear(year) ? 29 : 28) : DAYS_IN_MONTH[month - 1];
        for (const day of (doms.length > 0 ? doms : Array.from({ length: maxDay }, (_, i) => i + 1))) {
          if (day > maxDay) continue;
          const date = new Date(year, month - 1, day);
          if (dows.length > 0 && !dows.includes(date.getDay())) continue;
          for (const hour of (hours.length > 0 ? hours : Array.from({ length: 24 }, (_, i) => i))) {
            for (const minute of (minutes.length > 0 ? minutes : Array.from({ length: 60 }, (_, i) => i))) {
              const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
              if (candidate > now) {
                return candidate;
              }
            }
          }
        }
      }
    }

    return new Date(Date.now() + 60000);
  }

  private addJob(job: CronJob): void {
    const existing = this.jobs.get(job.id);
    if (existing?.intervalId) clearInterval(existing.intervalId);
    if (existing?.lastRun && !job.lastRun) {
      job.lastRun = existing.lastRun;
    }
    this.jobs.set(job.id, job);
  }

  removeJob(scheduleId: string): void {
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
