import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { isRedisAvailable, redisClient } from './client';

export const CHANNEL_PATROL_TRACK = 'patrol:track';
export const CHANNEL_NOTIFY_WORKORDER = 'notify:workorder';
export const CHANNEL_NOTIFY_ALERT = 'notify:alert';
export const CHANNEL_NOTIFY_DISORDER = 'notify:disorder';

export const PUBSUB_CHANNELS = {
  PATROL_TRACK: CHANNEL_PATROL_TRACK,
  NOTIFY_WORKORDER: CHANNEL_NOTIFY_WORKORDER,
  NOTIFY_ALERT: CHANNEL_NOTIFY_ALERT,
  NOTIFY_DISORDER: CHANNEL_NOTIFY_DISORDER
} as const;

export type PubSubChannel = typeof PUBSUB_CHANNELS[keyof typeof PUBSUB_CHANNELS];

type MessageCallback = (message: string, channel: string) => void;

const memoryEmitter = new EventEmitter();
memoryEmitter.setMaxListeners(100);

let _subscriber: Redis | null = null;
let _publisher: Redis | null = null;
const _subscriptions = new Map<string, Set<MessageCallback>>();

function ensureSubscriber(): Redis | null {
  if (_subscriber) return _subscriber;
  if (!isRedisAvailable()) return null;

  const rawClient = redisClient.getRawClient();
  if (!rawClient) return null;

  try {
    _subscriber = rawClient.duplicate();
    _subscriber.on('message', (channel: string, message: string) => {
      const callbacks = _subscriptions.get(channel);
      if (callbacks) {
        callbacks.forEach((cb) => {
          try {
            cb(message, channel);
          } catch (err) {
            console.error('[PubSub] Error in message callback:', err);
          }
        });
      }
    });
    _subscriber.on('error', (err) => {
      console.warn('[PubSub] Subscriber error:', err.message);
    });
    return _subscriber;
  } catch (err) {
    console.warn('[PubSub] Failed to create subscriber:', err);
    return null;
  }
}

function ensurePublisher(): Redis | null {
  if (_publisher) return _publisher;
  if (!isRedisAvailable()) return null;

  const rawClient = redisClient.getRawClient();
  if (!rawClient) return null;

  try {
    _publisher = rawClient.duplicate();
    _publisher.on('error', (err) => {
      console.warn('[PubSub] Publisher error:', err.message);
    });
    return _publisher;
  } catch (err) {
    console.warn('[PubSub] Failed to create publisher:', err);
    return null;
  }
}

export async function publish(channel: string, message: unknown): Promise<void> {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  if (isRedisAvailable()) {
    const publisher = ensurePublisher();
    if (publisher) {
      try {
        await publisher.publish(channel, messageStr);
        return;
      } catch (err) {
        console.warn('[PubSub] Redis publish failed, falling back to memory mode:', err);
      }
    }
  }

  memoryEmitter.emit(channel, messageStr, channel);
}

export async function subscribe(channel: string, callback: MessageCallback): Promise<void> {
  let callbacks = _subscriptions.get(channel);
  if (!callbacks) {
    callbacks = new Set();
    _subscriptions.set(channel, callbacks);
  }
  callbacks.add(callback);

  memoryEmitter.on(channel, callback);

  if (isRedisAvailable()) {
    const subscriber = ensureSubscriber();
    if (subscriber) {
      try {
        await subscriber.subscribe(channel);
        return;
      } catch (err) {
        console.warn('[PubSub] Redis subscribe failed, using memory mode:', err);
      }
    }
  }
}

export async function unsubscribe(channel: string): Promise<void> {
  const callbacks = _subscriptions.get(channel);
  if (callbacks) {
    callbacks.forEach((cb) => {
      memoryEmitter.off(channel, cb);
    });
    _subscriptions.delete(channel);
  }

  if (isRedisAvailable()) {
    const subscriber = ensureSubscriber();
    if (subscriber) {
      try {
        await subscriber.unsubscribe(channel);
      } catch (err) {
        console.warn('[PubSub] Redis unsubscribe failed:', err);
      }
    }
  }
}

export function unsubscribeAll(): void {
  _subscriptions.forEach((callbacks, channel) => {
    callbacks.forEach((cb) => {
      memoryEmitter.off(channel, cb);
    });
  });
  _subscriptions.clear();

  if (_subscriber && isRedisAvailable()) {
    _subscriber.quit().catch(() => {});
  }
  if (_publisher && isRedisAvailable()) {
    _publisher.quit().catch(() => {});
  }
  _subscriber = null;
  _publisher = null;
}
