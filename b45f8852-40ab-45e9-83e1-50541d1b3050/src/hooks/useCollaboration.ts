import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUser } from '@/mock/mockUsers';
import type { OnlineUser, CollabMessage, MaintenanceTask } from '@/types';

const WS_PATH = '/ws';
const TASK_VERSION_KEY = 'task_version_map';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

interface UseCollaborationOptions {
  onTaskUpdate?: (taskId: string, patch: Partial<MaintenanceTask>, version: number) => void;
  onTaskCreate?: (task: MaintenanceTask) => void;
  onTaskDelete?: (taskId: string) => void;
}

function buildWsUrl(): string {
  const currentUser = getCurrentUser();
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const params = new URLSearchParams();
  params.set('userId', currentUser.id);
  params.set('userName', currentUser.name);
  params.set('userRole', currentUser.role);
  params.set('colorSeed', currentUser.id);
  params.set('room', 'power-grid-main');
  return `${protocol}//${host}${WS_PATH}?${params.toString()}`;
}

export function useCollaboration(options: UseCollaborationOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<string>(getCurrentUser().id);

  const wsRef = useRef<WebSocket | null>(null);
  const taskVersionsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const manualCloseRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  const currentUserRef = useRef<OnlineUser>(getCurrentUser());

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    return () => {
      manualCloseRef.current = true;
      disconnect();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
      }
    };
  }, []);

  const loadTaskVersions = useCallback(() => {
    try {
      const stored = localStorage.getItem(TASK_VERSION_KEY);
      if (stored) {
        const versions = JSON.parse(stored);
        taskVersionsRef.current = new Map(Object.entries(versions));
      }
    } catch {
      taskVersionsRef.current = new Map();
    }
  }, []);

  const saveTaskVersions = useCallback(() => {
    try {
      const versions = Object.fromEntries(taskVersionsRef.current);
      localStorage.setItem(TASK_VERSION_KEY, JSON.stringify(versions));
    } catch {
      // ignore
    }
  }, []);

  const getTaskVersion = useCallback((taskId: string): number => {
    return taskVersionsRef.current.get(taskId) || 0;
  }, []);

  const setTaskVersion = useCallback((taskId: string, version: number) => {
    taskVersionsRef.current.set(taskId, version);
    saveTaskVersions();
  }, [saveTaskVersions]);

  const scheduleReconnect = useCallback(() => {
    if (manualCloseRef.current) return;

    const attempt = reconnectAttemptRef.current;
    const delay = attempt < RECONNECT_DELAYS.length
      ? RECONNECT_DELAYS[attempt]
      : RECONNECT_DELAYS[RECONNECT_DELAYS.length - 1];

    reconnectAttemptRef.current = attempt + 1;

    console.log(`[collab] Reconnecting in ${delay}ms (attempt ${attempt + 1})`);

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => {
      if (!manualCloseRef.current) {
        connect();
      }
    }, delay);
  }, []);

  const startPingLoop = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
    }
    pingTimerRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'ping',
            senderId: currentUserRef.current.id,
            data: { ts: Date.now() },
            timestamp: Date.now(),
          }));
        } catch {
          // ignore
        }
      }
    }, 25000);
  }, []);

  const stopPingLoop = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((raw: string) => {
    let message: CollabMessage;
    try {
      message = JSON.parse(raw) as CollabMessage;
    } catch {
      console.warn('[collab] Invalid JSON from server');
      return;
    }

    if (!message || !message.type) return;

    setLastSyncAt(message.timestamp);

    switch (message.type) {
      case 'connect': {
        const data = message.data as {
          user?: OnlineUser;
          roomId?: string;
          serverTime?: number;
          maxClients?: number;
          onlineUsers?: OnlineUser[];
        };
        if (data.user) {
          currentUserRef.current = data.user;
          setCurrentUserId(data.user.id);
        }
        if (Array.isArray(data.onlineUsers)) {
          setOnlineUsers(data.onlineUsers);
        }
        setConnected(true);
        reconnectAttemptRef.current = 0;
        break;
      }

      case 'presence':
        if (Array.isArray(message.data)) {
          setOnlineUsers(message.data as OnlineUser[]);
        }
        break;

      case 'user:join': {
        const newUser = message.data as OnlineUser;
        setOnlineUsers((prev) => {
          if (prev.some((u) => u.id === newUser.id)) return prev;
          return [...prev, newUser].sort((a, b) => a.name.localeCompare(b.name));
        });
        break;
      }

      case 'disconnect':
        setOnlineUsers((prev) => prev.filter((u) => u.id !== message.senderId));
        break;

      case 'task:update': {
        const { taskId, patch, version } = message.data as {
          taskId: string;
          patch: Partial<MaintenanceTask>;
          version: number;
        };

        const currentVersion = getTaskVersion(taskId);
        if (version > currentVersion) {
          setTaskVersion(taskId, version);
          optionsRef.current.onTaskUpdate?.(taskId, patch, version);
        }
        break;
      }

      case 'task:create': {
        const { task, version } = message.data as {
          task: MaintenanceTask;
          version: number;
        };

        const currentVersion = getTaskVersion(task.id);
        if (version > currentVersion) {
          setTaskVersion(task.id, version);
          optionsRef.current.onTaskCreate?.(task);
        }
        break;
      }

      case 'task:delete': {
        const { taskId, version } = message.data as {
          taskId: string;
          version: number;
        };

        const currentVersion = getTaskVersion(taskId);
        if (version > currentVersion) {
          setTaskVersion(taskId, version);
          optionsRef.current.onTaskDelete?.(taskId);
        }
        break;
      }

      case 'cursor':
      case 'pong':
        break;
    }
  }, [getTaskVersion, setTaskVersion]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    loadTaskVersions();
    manualCloseRef.current = false;

    try {
      const url = buildWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[collab] Connected to server');
        setConnected(true);
        startPingLoop();
      };

      ws.onmessage = (event) => {
        handleMessage(event.data as string);
      };

      ws.onerror = (event) => {
        console.error('[collab] WebSocket error', event);
        setConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`[collab] Connection closed: code=${event.code} reason=${event.reason}`);
        setConnected(false);
        stopPingLoop();
        wsRef.current = null;
        scheduleReconnect();
      };
    } catch (error) {
      console.error('[collab] Failed to create WebSocket:', error);
      setConnected(false);
      scheduleReconnect();
    }
  }, [loadTaskVersions, handleMessage, scheduleReconnect, startPingLoop, stopPingLoop]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    stopPingLoop();
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'client disconnect');
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setConnected(false);
    setOnlineUsers([]);
  }, [stopPingLoop]);

  const sendRaw = useCallback((message: Partial<CollabMessage> & { type: string; data?: unknown }) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const full: CollabMessage = {
        ...message,
        senderId: currentUserRef.current.id,
        timestamp: Date.now(),
        data: message.data ?? null,
      };
      ws.send(JSON.stringify(full));
      return true;
    } catch {
      return false;
    }
  }, []);

  const broadcastTaskUpdate = useCallback(
    (taskId: string, patch: Partial<MaintenanceTask>) => {
      const newVersion = getTaskVersion(taskId) + 1;
      setTaskVersion(taskId, newVersion);

      sendRaw({
        type: 'task:update',
        data: {
          taskId,
          patch,
          version: newVersion,
        },
        version: newVersion,
      });
    },
    [getTaskVersion, setTaskVersion, sendRaw]
  );

  const broadcastTaskCreate = useCallback(
    (task: MaintenanceTask) => {
      const newVersion = 1;
      setTaskVersion(task.id, newVersion);

      sendRaw({
        type: 'task:create',
        data: {
          task,
          version: newVersion,
        },
        version: newVersion,
      });
    },
    [setTaskVersion, sendRaw]
  );

  const broadcastTaskDelete = useCallback(
    (taskId: string) => {
      const newVersion = getTaskVersion(taskId) + 1;
      setTaskVersion(taskId, newVersion);

      sendRaw({
        type: 'task:delete',
        data: {
          taskId,
          version: newVersion,
        },
        version: newVersion,
      });
    },
    [getTaskVersion, setTaskVersion, sendRaw]
  );

  const sendCursorPosition = useCallback(
    (taskId: string | undefined) => {
      sendRaw({
        type: 'cursor',
        data: {
          taskId,
        },
      });
    },
    [sendRaw]
  );

  const reconnect = useCallback(() => {
    manualCloseRef.current = true;
    disconnect();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectAttemptRef.current = 0;
    reconnectTimerRef.current = setTimeout(() => {
      manualCloseRef.current = false;
      connect();
    }, 500);
  }, [connect, disconnect]);

  return {
    connected,
    onlineUsers,
    lastSyncAt,
    currentUserId,
    connect,
    disconnect,
    reconnect,
    broadcastTaskUpdate,
    broadcastTaskCreate,
    broadcastTaskDelete,
    sendCursorPosition,
  };
}

export type UseCollaborationReturn = ReturnType<typeof useCollaboration>;
