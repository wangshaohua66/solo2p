import type { OnlineUser, CollabMessage } from '@/types';
import { generateRandomUsers, getCurrentUser } from './mockUsers';

type MessageHandler = (message: CollabMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;

const BROADCAST_CHANNEL_NAME = 'power-grid-collab-channel';
const MAX_ONLINE_USERS = 20;
const MIN_LATENCY = 50;
const MAX_LATENCY = 200;

const getRandomLatency = (): number => {
  return Math.floor(Math.random() * (MAX_LATENCY - MIN_LATENCY + 1)) + MIN_LATENCY;
};

type ConnectionState = 'connecting' | 'open' | 'closing' | 'closed';

export class MockWebSocket {
  private readyState: ConnectionState = 'closed';
  private onopen: ConnectionHandler | null = null;
  private onmessage: MessageHandler | null = null;
  private onclose: ConnectionHandler | null = null;
  private onerror: ErrorHandler | null = null;

  private userId: string = '';
  private broadcastChannel: BroadcastChannel | null = null;
  private presenceInterval: ReturnType<typeof setInterval> | null = null;
  private userActivityInterval: ReturnType<typeof setInterval> | null = null;
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isReconnecting: boolean = false;

  private readonly url: string;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    this.readyState = 'connecting';
    this.userId = getCurrentUser().id;

    setTimeout(() => {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = this.handleBroadcastMessage;

        this.initializeOnlineUsers();

        this.readyState = 'open';
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        this.onopen?.();

        this.broadcastMessage({
          type: 'connect',
          senderId: this.userId,
          data: getCurrentUser(),
          timestamp: Date.now(),
        });

        this.startPresenceUpdates();
        this.startUserActivitySimulation();
      } catch (error) {
          this.onerror?.(error as Error);
          this.close();
        }
    }, getRandomLatency());
  }

  private initializeOnlineUsers(): void {
    const currentUser = getCurrentUser();
    this.onlineUsers.set(currentUser.id, currentUser);

    const mockUsers = generateRandomUsers();
    const shuffled = mockUsers.sort(() => Math.random() - 0.5);
    const initialCount = Math.min(Math.floor(Math.random() * 10) + 8, shuffled.length);

    for (let i = 0; i < Math.min(initialCount, MAX_ONLINE_USERS - 1); i++) {
      this.onlineUsers.set(shuffled[i].id, shuffled[i]);
    }
  }

  private handleBroadcastMessage = (event: MessageEvent): void => {
    if (this.readyState !== 'open') return;

    const message = event.data as CollabMessage;
    if (!message || !message.type || !message.senderId) return;

    if (message.senderId === this.userId) return;

    setTimeout(() => {
      this.processMessage(message);
    }, getRandomLatency());
  };

  private processMessage(message: CollabMessage): void {
    switch (message.type) {
      case 'connect':
        this.handleUserConnect(message.data as OnlineUser);
        break;
      case 'disconnect':
        this.handleUserDisconnect(message.senderId);
        break;
      case 'presence':
        this.handlePresenceUpdate(message.data as OnlineUser[]);
        break;
      case 'cursor':
        this.handleCursorUpdate(message);
        break;
      case 'task:update':
      case 'task:create':
      case 'task:delete':
        this.onmessage?.(message);
        break;
      default:
        this.onmessage?.(message);
    }
  }

  private handleUserConnect(user: OnlineUser): void {
    if (this.onlineUsers.size >= MAX_ONLINE_USERS) {
      return;
    }

    this.onlineUsers.set(user.id, {
      ...user,
      lastActiveAt: Date.now(),
    });

    this.notifyPresenceUpdate();
  }

  private handleUserDisconnect(userId: string): void {
    this.onlineUsers.delete(userId);
    this.notifyPresenceUpdate();
  }

  private handlePresenceUpdate(users: OnlineUser[]): void {
    users.forEach((user) => {
      if (user.id !== this.userId) {
        this.onlineUsers.set(user.id, user);
      }
    });

    this.notifyPresenceUpdate();
  }

  private handleCursorUpdate(message: CollabMessage): void {
    const user = this.onlineUsers.get(message.senderId);
    if (user) {
      user.cursorTaskId = message.data.taskId;
      user.lastActiveAt = Date.now();
      this.notifyPresenceUpdate();
    }
  }

  private startPresenceUpdates(): void {
    this.presenceInterval = setInterval(() => {
      if (this.readyState !== 'open') return;

      const currentUser = getCurrentUser();
      currentUser.lastActiveAt = Date.now();
      this.onlineUsers.set(currentUser.id, currentUser);

      this.notifyPresenceUpdate();
    }, 10000);
  }

  private startUserActivitySimulation(): void {
    this.userActivityInterval = setInterval(() => {
      if (this.readyState !== 'open') return;

      const shouldSimulate = Math.random() < 0.3;
      if (!shouldSimulate) return;

      const allMockUsers = generateRandomUsers();
      const isOnline = Math.random() < 0.7;

      if (isOnline) {
        const offlineUsers = allMockUsers.filter(
          (u) => !this.onlineUsers.has(u.id)
        );
        if (
          offlineUsers.length > 0 &&
          this.onlineUsers.size < MAX_ONLINE_USERS
        ) {
          const randomUser =
            offlineUsers[Math.floor(Math.random() * offlineUsers.length)];
          this.onlineUsers.set(randomUser.id, {
            ...randomUser,
            lastActiveAt: Date.now(),
          });
          this.notifyPresenceUpdate();
        }
      } else {
        const onlineMockUsers = Array.from(this.onlineUsers.values()).filter(
          (u) => u.id !== this.userId
        );
        if (onlineMockUsers.length > 5) {
          const randomUser =
            onlineMockUsers[
              Math.floor(Math.random() * onlineMockUsers.length)
            ];
          this.onlineUsers.delete(randomUser.id);
          this.notifyPresenceUpdate();
        }
      }
    }, 8000);
  }

  private notifyPresenceUpdate(): void {
    const users = Array.from(this.onlineUsers.values());

    this.onmessage?.({
      type: 'presence',
      senderId: 'system',
      data: users,
      timestamp: Date.now(),
    });
  }

  send(message: CollabMessage): void {
    if (this.readyState !== 'open') {
      throw new Error('WebSocket is not open');
    }

    const messageWithMeta: CollabMessage = {
      ...message,
      senderId: this.userId,
      timestamp: Date.now(),
    };

    this.broadcastMessage(messageWithMeta);
  }

  private broadcastMessage(message: CollabMessage): void {
    if (!this.broadcastChannel) return;

    try {
      this.broadcastChannel.postMessage(message);
    } catch (error) {
      console.error('Failed to broadcast message:', error);
    }
  }

  close(): void {
    if (this.readyState === 'closed' || this.readyState === 'closing') return;

    this.readyState = 'closing';

    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }

    if (this.userActivityInterval) {
      clearInterval(this.userActivityInterval);
      this.userActivityInterval = null;
    }

    if (this.broadcastChannel) {
      this.broadcastMessage({
        type: 'disconnect',
        senderId: this.userId,
        data: null,
        timestamp: Date.now(),
      });

      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    this.onlineUsers.clear();
    this.readyState = 'closed';
    this.onclose?.();
  }

  reconnect(): void {
    if (this.isReconnecting) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    this.close();

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  set onOpen(handler: ConnectionHandler) {
    this.onopen = handler;
  }

  set onMessage(handler: MessageHandler) {
    this.onmessage = handler;
  }

  set onClose(handler: ConnectionHandler) {
    this.onclose = handler;
  }

  set onError(handler: ErrorHandler) {
    this.onerror = handler;
  }

  getUserId(): string {
    return this.userId;
  }

  getOnlineUsers(): OnlineUser[] {
    return Array.from(this.onlineUsers.values());
  }

  isConnected(): boolean {
    return this.readyState === 'open';
  }
}

export const createMockWebSocket = (url: string): MockWebSocket => {
  return new MockWebSocket(url);
};
