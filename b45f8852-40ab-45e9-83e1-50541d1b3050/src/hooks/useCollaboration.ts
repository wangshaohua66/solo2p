import { useState, useEffect, useCallback, useRef } from 'react';
import { MockWebSocket } from '@/mock/mockWebSocket';
import { getCurrentUser } from '@/mock/mockUsers';
import type { OnlineUser, CollabMessage, MaintenanceTask } from '@/types';

const WS_URL = 'ws://mock-server/collaboration';
const TASK_VERSION_KEY = 'task_version_map';

interface UseCollaborationOptions {
  onTaskUpdate?: (taskId: string, patch: Partial<MaintenanceTask>, version: number) => void;
  onTaskCreate?: (task: MaintenanceTask) => void;
  onTaskDelete?: (taskId: string) => void;
}

export function useCollaboration(options: UseCollaborationOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<string>(getCurrentUser().id);

  const wsRef = useRef<MockWebSocket | null>(null);
  const taskVersionsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    return () => {
      disconnect();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
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

  const handleMessage = useCallback((message: CollabMessage) => {
    setLastSyncAt(message.timestamp);

    switch (message.type) {
      case 'presence':
        setOnlineUsers(message.data as OnlineUser[]);
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

      case 'cursor': {
        break;
      }
    }
  }, [getTaskVersion, setTaskVersion]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.isConnected()) {
      return;
    }

    loadTaskVersions();

    try {
      const ws = new MockWebSocket(WS_URL);
      wsRef.current = ws;

      ws.onOpen = () => {
        setConnected(true);
        setCurrentUserId(ws.getUserId());
      };

      ws.onMessage = handleMessage;

      ws.onClose = () => {
        setConnected(false);
      };

      ws.onError = () => {
        setConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect to collaboration server:', error);
      setConnected(false);
    }
  }, [loadTaskVersions, handleMessage]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setOnlineUsers([]);
  }, []);

  const broadcastTaskUpdate = useCallback(
    (taskId: string, patch: Partial<MaintenanceTask>) => {
      if (!wsRef.current || !wsRef.current.isConnected()) {
        return;
      }

      const newVersion = getTaskVersion(taskId) + 1;
      setTaskVersion(taskId, newVersion);

      wsRef.current.send({
        type: 'task:update',
        senderId: currentUserId,
        data: {
          taskId,
          patch,
          version: newVersion,
        },
        timestamp: Date.now(),
        version: newVersion,
      });
    },
    [currentUserId, getTaskVersion, setTaskVersion]
  );

  const broadcastTaskCreate = useCallback(
    (task: MaintenanceTask) => {
      if (!wsRef.current || !wsRef.current.isConnected()) {
        return;
      }

      const newVersion = 1;
      setTaskVersion(task.id, newVersion);

      wsRef.current.send({
        type: 'task:create',
        senderId: currentUserId,
        data: {
          task,
          version: newVersion,
        },
        timestamp: Date.now(),
        version: newVersion,
      });
    },
    [currentUserId, setTaskVersion]
  );

  const broadcastTaskDelete = useCallback(
    (taskId: string) => {
      if (!wsRef.current || !wsRef.current.isConnected()) {
        return;
      }

      const newVersion = getTaskVersion(taskId) + 1;
      setTaskVersion(taskId, newVersion);

      wsRef.current.send({
        type: 'task:delete',
        senderId: currentUserId,
        data: {
          taskId,
          version: newVersion,
        },
        timestamp: Date.now(),
        version: newVersion,
      });
    },
    [currentUserId, getTaskVersion, setTaskVersion]
  );

  const sendCursorPosition = useCallback(
    (taskId: string | undefined) => {
      if (!wsRef.current || !wsRef.current.isConnected()) {
        return;
      }

      wsRef.current.send({
        type: 'cursor',
        senderId: currentUserId,
        data: {
          taskId,
        },
        timestamp: Date.now(),
      });
    },
    [currentUserId]
  );

  const reconnect = useCallback(() => {
    disconnect();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, 1000);
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
