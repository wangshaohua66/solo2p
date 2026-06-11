import { create } from 'zustand';
import { Client, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { AppNotification, NotificationCategory, WSAlert, WSScheduleUpdate } from '@/types';

interface NotificationState {
  notifications: AppNotification[];
  wsConnected: boolean;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

let wsClient: Client | null = null;
let subscriptions: Map<string, StompSubscription> = new Map();
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

function createNotification(
  category: NotificationCategory,
  type: AppNotification['type'],
  title: string,
  content: string,
): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  return { category, type, title, content };
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  wsConnected: false,

  addNotification: (notification) => {
    const newNotification: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
    }));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  },

  clearAll: () => set({ notifications: [] }),

  connectWebSocket: () => {
    if (wsClient && wsClient.connected) {
      return;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    const socket = new SockJS('/ws');
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 0,
      debug: () => {},
    });

    client.onConnect = () => {
      set({ wsConnected: true });
      reconnectAttempts = 0;

      try {
        const scheduleSub = client.subscribe('/topic/schedule/update', (message) => {
          try {
            const data: WSScheduleUpdate = JSON.parse(message.body);
            get().addNotification(
              createNotification(
                'SCHEDULE',
                'info',
                '排程更新',
                data.message || `排程 ${data.scheduleId} 状态更新为 ${data.status}`,
              ),
            );
          } catch {
            // ignore parse error
          }
        });
        subscriptions.set('/topic/schedule/update', scheduleSub);
      } catch {
        // ignore
      }

      try {
        const alertSub = client.subscribe('/topic/alert', (message) => {
          try {
            const data: WSAlert = JSON.parse(message.body);
            const alertType = data.type;
            const notifType: AppNotification['type'] =
              alertType === 'TEMPERATURE_ANOMALY' || alertType === 'UNAUTHORIZED_OPEN'
                ? 'warning'
                : 'info';
            get().addNotification(
              createNotification('ALERT', notifType, '系统提醒', data.message),
            );
          } catch {
            // ignore parse error
          }
        });
        subscriptions.set('/topic/alert', alertSub);
      } catch {
        // ignore
      }

      try {
        const notifSub = client.subscribe('/user/queue/notifications', (message) => {
          try {
            const data = JSON.parse(message.body);
            get().addNotification(
              createNotification(
                'GENERAL',
                data.type || 'info',
                data.title || '通知',
                data.content || data.message || '',
              ),
            );
          } catch {
            // ignore parse error
          }
        });
        subscriptions.set('/user/queue/notifications', notifSub);
      } catch {
        // ignore
      }
    };

    client.onDisconnect = () => {
      set({ wsConnected: false });
      const attempts = reconnectAttempts;
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      reconnectAttempts += 1;
      reconnectTimeout = setTimeout(() => {
        get().connectWebSocket();
      }, delay);
    };

    client.onWebSocketClose = () => {
      set({ wsConnected: false });
    };

    client.activate();
    wsClient = client;
  },

  disconnectWebSocket: () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    subscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch {
        // ignore
      }
    });
    subscriptions.clear();
    if (wsClient) {
      try {
        wsClient.deactivate();
      } catch {
        // ignore
      }
      wsClient = null;
    }
    set({ wsConnected: false });
  },
}));
