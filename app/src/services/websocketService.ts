import AsyncStorage from '@react-native-async-storage/async-storage';

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    const baseUrl = await AsyncStorage.getItem('api_base_url');
    if (!baseUrl) return;

    const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/api$/, '/ws');
    if (this.ws && this.isConnected && this.url === wsUrl) return;

    this.url = wsUrl;
    this.disconnect();
    this.doConnect();
  }

  private doConnect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = async () => {
        this.isConnected = true;
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          this.send({ type: 'auth', token });
        }
        this.startHeartbeat();
        this.emit('connection', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('connection', { connected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  send(data: Record<string, unknown>): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      this.handlers.set(event, handlers.filter(h => h !== handler));
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, 5000);
  }
}

export default new WebSocketService();
