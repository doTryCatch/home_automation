export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  avatar_url?: string;
  theme: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface Floor {
  id: string;
  user_id: string;
  name: string;
  level: number;
  layout_data?: Record<string, unknown>;
  width: number;
  height: number;
  thumbnail?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  rooms: Room[];
}

export interface Room {
  id: string;
  floor_id: string;
  name: string;
  polygon_coords: Point[];
  color: string;
  icon?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  devices?: Device[];
}

export interface Point {
  x: number;
  y: number;
}

export interface EspDevice {
  id: string;
  user_id: string;
  name: string;
  mac_address: string;
  ip_address?: string;
  firmware_ver?: string;
  wifi_ssid?: string;
  is_online: boolean;
  last_seen?: string;
  config?: Record<string, unknown>;
  devices?: Device[];
}

export interface DeviceType {
  id: string;
  user_id?: string;
  name: string;
  icon: string;
  category: string;
  properties_schema: Record<string, unknown>;
  is_default: boolean;
  is_active: boolean;
}

export interface Device {
  id: string;
  room_id: string;
  esp_device_id: string;
  type_id: string;
  name: string;
  pin: number;
  state: Record<string, unknown>;
  config: Record<string, unknown>;
  is_active: boolean;
  last_updated?: string;
  type?: DeviceType;
  esp_device?: Partial<EspDevice>;
  room?: Partial<Room>;
  schedules?: Schedule[];
}

export interface Schedule {
  id: string;
  device_id: string;
  user_id: string;
  name?: string;
  action: Record<string, unknown>;
  cron: string;
  timezone: string;
  is_active: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
  updated_at: string;
  device?: Device;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
