import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Floor, Room, Device, EspDevice, Schedule, DeviceType } from '../types';
import { authService } from '../services/authService';
import { floorService } from '../services/floorService';
import { roomService } from '../services/roomService';
import { deviceService } from '../services/deviceService';
import { scheduleService } from '../services/scheduleService';
import { getStoredApiUrl, setStoredApiUrl, updateApiBaseUrl } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const res = await authService.login(email, password);
    if (!res?.token || !res?.user) throw new Error('Invalid login response');
    await AsyncStorage.setItem('auth_token', res.token);
    await AsyncStorage.setItem('user_data', JSON.stringify(res.user));
    set({ user: res.user, token: res.token, isAuthenticated: true });
  },

  register: async (email, password, name) => {
    const res = await authService.register(email, password, name);
    if (!res?.token || !res?.user) throw new Error('Invalid register response');
    await AsyncStorage.setItem('auth_token', res.token);
    await AsyncStorage.setItem('user_data', JSON.stringify(res.user));
    set({ user: res.user, token: res.token, isAuthenticated: true });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['auth_token', 'user_data']);
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');
      if (token && userData) {
        set({ token, user: JSON.parse(userData), isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: (user) => set({ user }),
}));

interface HomeState {
  floors: Floor[];
  espDevices: EspDevice[];
  deviceTypes: DeviceType[];
  isLoading: boolean;
  pinnedFloorIds: string[];
  loadHome: () => Promise<void>;
  setFloors: (floors: Floor[]) => void;
  togglePin: (floorId: string) => Promise<void>;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  floors: [],
  espDevices: [],
  deviceTypes: [],
  isLoading: false,
  pinnedFloorIds: [],

  loadHome: async () => {
    set({ isLoading: true });
    try {
      const [floors, espDevices, deviceTypes] = await Promise.all([
        floorService.getAll(),
        deviceService.getAllEspDevices(),
        deviceService.getAllDeviceTypes(),
      ]);
      let pinnedFloorIds: string[] = [];
      try {
        const raw = await AsyncStorage.getItem('pinned_floors');
        if (raw) pinnedFloorIds = JSON.parse(raw);
      } catch {}
      set({
        floors: floors || [],
        espDevices: espDevices || [],
        deviceTypes: deviceTypes || [],
        pinnedFloorIds,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  setFloors: (floors) => set({ floors }),

  togglePin: async (floorId) => {
    const current = get().pinnedFloorIds;
    const updated = current.includes(floorId)
      ? current.filter(id => id !== floorId)
      : [...current, floorId];
    await AsyncStorage.setItem('pinned_floors', JSON.stringify(updated));
    set({ pinnedFloorIds: updated });
  },
}));

interface DeviceState {
  devices: Device[];
  currentRoom: Room | null;
  isLoading: boolean;
  loadDevices: (roomId?: string) => Promise<void>;
  setCurrentRoom: (room: Room | null) => void;
  updateDeviceState: (deviceId: string, state: Record<string, unknown>) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  currentRoom: null,
  isLoading: false,

  loadDevices: async (roomId) => {
    set({ isLoading: true });
    try {
      const devices = await deviceService.getAll(roomId);
      set({ devices: devices || [], isLoading: false });
    } catch {
      set({ devices: [], isLoading: false });
    }
  },

  setCurrentRoom: (room) => set({ currentRoom: room }),

  updateDeviceState: (deviceId, state) => {
    const devices = get().devices.map((d) =>
      d.id === deviceId ? { ...d, state } : d
    );
    set({ devices });
  },
}));

interface ScheduleState {
  schedules: Schedule[];
  isLoading: boolean;
  loadSchedules: (deviceId?: string) => Promise<void>;
  toggleSchedule: (id: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  isLoading: false,

  loadSchedules: async (deviceId) => {
    set({ isLoading: true });
    try {
      const schedules = await scheduleService.getAll(deviceId);
      set({ schedules: schedules || [], isLoading: false });
    } catch {
      set({ schedules: [], isLoading: false });
    }
  },

  toggleSchedule: async (id) => {
    const updated = await scheduleService.toggle(id);
    if (!updated) return;
    const schedules = get().schedules.map((s) =>
      s.id === id ? updated : s
    );
    set({ schedules });
  },
}));

interface SettingsState {
  apiUrl: string;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setApiUrl: (url: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  apiUrl: '',
  isLoading: true,

  loadSettings: async () => {
    const url = await getStoredApiUrl();
    set({ apiUrl: url, isLoading: false });
  },

  setApiUrl: async (url) => {
    await setStoredApiUrl(url);
    updateApiBaseUrl(url);
    set({ apiUrl: url });
  },
}));
