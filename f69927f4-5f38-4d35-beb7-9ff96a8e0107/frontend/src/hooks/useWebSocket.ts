import { useState, useEffect, useRef, useCallback } from 'react';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { TemperatureReading, WSAlert, WSScheduleUpdate } from '@/types';

export type WSMessage = TemperatureReading | WSAlert | WSScheduleUpdate | unknown;

interface UseWebSocketReturn {
  connected: boolean;
  messages: WSMessage[];
  subscribe: (destination: string, callback: (message: IMessage) => void) => (() => void) | null;
  send: (destination: string, body: unknown) => void;
  disconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const clientRef = useRef<Client | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());

  const connect = useCallback(() => {
    const socket = new SockJS('/ws');
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 0,
      debug: () => {},
    });

    client.onConnect = () => {
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      subscriptionsRef.current.forEach((sub, destination) => {
        try {
          sub.unsubscribe();
        } catch {
          // ignore
        }
        const newSub = client.subscribe(destination, (message) => {
          try {
            const parsed = JSON.parse(message.body);
            setMessages((prev) => [...prev, parsed]);
          } catch {
            setMessages((prev) => [...prev, message.body]);
          }
        });
        subscriptionsRef.current.set(destination, newSub);
      });
    };

    client.onDisconnect = () => {
      setConnected(false);
      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    client.onWebSocketClose = () => {
      setConnected(false);
    };

    client.onWebSocketError = () => {
      // error handled by disconnect
    };

    client.activate();
    clientRef.current = client;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (clientRef.current) {
      try {
        clientRef.current.deactivate();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
    setConnected(false);
  }, []);

  const subscribe = useCallback(
    (destination: string, callback: (message: IMessage) => void) => {
      if (!clientRef.current || !connected) {
        return null;
      }
      if (subscriptionsRef.current.has(destination)) {
        const existing = subscriptionsRef.current.get(destination);
        if (existing) {
          try {
            existing.unsubscribe();
          } catch {
            // ignore
          }
        }
      }
      const subscription = clientRef.current.subscribe(destination, (message) => {
        callback(message);
        try {
          const parsed = JSON.parse(message.body);
          setMessages((prev) => [...prev, parsed]);
        } catch {
          setMessages((prev) => [...prev, message.body]);
        }
      });
      subscriptionsRef.current.set(destination, subscription);
      return () => {
        try {
          subscription.unsubscribe();
        } catch {
          // ignore
        }
        subscriptionsRef.current.delete(destination);
      };
    },
    [connected],
  );

  const send = useCallback(
    (destination: string, body: unknown) => {
      if (!clientRef.current || !connected) {
        return;
      }
      clientRef.current.publish({
        destination,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    },
    [connected],
  );

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    messages,
    subscribe,
    send,
    disconnect,
  };
}
