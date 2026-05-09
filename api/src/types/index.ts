export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface IUser {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  avatar_url?: string;
  theme: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IFloor {
  id: string;
  user_id: string;
  name: string;
  level: number;
  layout_data?: Record<string, unknown>;
  width: number;
  height: number;
  thumbnail?: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface IRoom {
  id: string;
  floor_id: string;
  name: string;
  polygon_coords: Array<{ x: number; y: number }>;
  color: string;
  icon?: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface IEspDevice {
  id: string;
  user_id: string;
  name: string;
  mac_address: string;
  ip_address?: string;
  firmware_ver?: string;
  wifi_ssid?: string;
  is_online: boolean;
  last_seen?: Date;
  config?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface IDevice {
  id: string;
  room_id: string;
  esp_device_id: string;
  type_id: string;
  name: string;
  pin: number;
  state: Record<string, unknown>;
  config: Record<string, unknown>;
  is_active: boolean;
  last_updated?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IDeviceType {
  id: string;
  user_id?: string;
  name: string;
  icon: string;
  category: string;
  properties_schema: Record<string, unknown>;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface ISchedule {
  id: string;
  device_id: string;
  user_id: string;
  name?: string;
  action: Record<string, unknown>;
  cron: string;
  timezone: string;
  is_active: boolean;
  last_run?: Date;
  next_run?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface MqttMessage {
  topic: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}
