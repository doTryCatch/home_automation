import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types';

const STORAGE_KEY = 'api_base_url';
const DEFAULT_BASE_URL = 'http://192.168.1.100:3000/api';

export const getStoredApiUrl = (): Promise<string> =>
  AsyncStorage.getItem(STORAGE_KEY).then((v) => v || DEFAULT_BASE_URL);

export const setStoredApiUrl = (url: string): Promise<void> =>
  AsyncStorage.setItem(STORAGE_KEY, url);

const api: AxiosInstance = axios.create({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

getStoredApiUrl().then((url) => {
  api.defaults.baseURL = url;
});

export const updateApiBaseUrl = (url: string) => {
  api.defaults.baseURL = url;
};

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['auth_token', 'user_data']);
    }
    return Promise.reject(error);
  }
);

export default api;
