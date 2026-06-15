import type { TrackPoint, NotificationMessage } from '@/types';

type TrackCallback = (point: TrackPoint) => void;
type NotifyCallback = (message: NotificationMessage) => void;
type ConnectionCallback = (connected: boolean) => void;

const WS_URL = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const WS_BASE = `${WS_URL}${window.location.host}/ws`;
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 30000;

abstract class BaseSocket {
  protected ws: WebSocket | null = null;
  protected url: string;
  protected reconnectAttempts = 0;
  protected heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  protected shouldReconnect = true;
  protected connectionCallbacks: ConnectionCallback[] = [];

  constructor(path: string) {
    const token = localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    this.url = `${WS_BASE}${path}${query}`;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.notifyConnection(true);
      this.startHeartbeat();
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.notifyConnection(false);
      if (this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), RECONNECT_DELAY);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  onConnection(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter((cb) => cb !== callback);
    };
  }

  protected notifyConnection(connected: boolean): void {
    this.connectionCallbacks.forEach((cb) => cb(connected));
  }

  protected startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, HEARTBEAT_INTERVAL);
  }

  protected stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

class PatrolSocket extends BaseSocket {
  private trackCallbacks: TrackCallback[] = [];
  private static instance: PatrolSocket | null = null;

  private constructor() {
    super('/patrol');
  }

  static getInstance(): PatrolSocket {
    if (!PatrolSocket.instance) {
      PatrolSocket.instance = new PatrolSocket();
    }
    return PatrolSocket.instance;
  }

  connect(): void {
    super.connect();

    if (this.ws) {
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'track_point') {
            this.trackCallbacks.forEach((cb) => cb(data.payload as TrackPoint));
          }
        } catch (e) {
          console.error('Failed to parse patrol message:', e);
        }
      };
    }
  }

  onTrackPoint(callback: TrackCallback): () => void {
    this.trackCallbacks.push(callback);
    return () => {
      this.trackCallbacks = this.trackCallbacks.filter((cb) => cb !== callback);
    };
  }

  reportTrack(point: Omit<TrackPoint, 'id' | 'timestamp'>): void {
    this.send({ type: 'track_point', payload: point });
  }
}

class NotifySocket extends BaseSocket {
  private messageCallbacks: NotifyCallback[] = [];
  private static instance: NotifySocket | null = null;

  private constructor() {
    super('/notify');
  }

  static getInstance(): NotifySocket {
    if (!NotifySocket.instance) {
      NotifySocket.instance = new NotifySocket();
    }
    return NotifySocket.instance;
  }

  connect(): void {
    super.connect();

    if (this.ws) {
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            this.messageCallbacks.forEach((cb) => cb(data.payload as NotificationMessage));
          }
        } catch (e) {
          console.error('Failed to parse notify message:', e);
        }
      };
    }
  }

  onMessage(callback: NotifyCallback): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }
}

export const patrolSocket = PatrolSocket.getInstance();
export const notifySocket = NotifySocket.getInstance();
