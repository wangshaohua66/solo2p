import Redis from 'ioredis';

let _redisClient: Redis | null = null;
let _isRedisAvailable = false;

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);

const inMemoryStore = new Map<string, string>();

function createRedisClient(): Redis | null {
  try {
    const client = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      db: REDIS_DB,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      retryStrategy: () => null
    });

    client.on('connect', () => {
      console.log('[Redis] Connected to Redis server');
      _isRedisAvailable = true;
    });

    client.on('ready', () => {
      console.log('[Redis] Redis client ready');
      _isRedisAvailable = true;
    });

    client.on('error', (err) => {
      console.warn('[Redis] Redis error, falling back to in-memory mode:', err.message);
      _isRedisAvailable = false;
    });

    client.on('close', () => {
      console.warn('[Redis] Redis connection closed, falling back to in-memory mode');
      _isRedisAvailable = false;
    });

    client.connect().catch(() => {
      console.warn('[Redis] Failed to connect to Redis, using in-memory fallback');
      _isRedisAvailable = false;
    });

    return client;
  } catch (err) {
    console.warn('[Redis] Failed to create Redis client, using in-memory fallback:', err);
    _isRedisAvailable = false;
    return null;
  }
}

_redisClient = createRedisClient();

export const isRedisAvailable = (): boolean => _isRedisAvailable;

export const redisClient = {
  async get(key: string): Promise<string | null> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.get(key);
      } catch {
        return inMemoryStore.get(key) ?? null;
      }
    }
    return inMemoryStore.get(key) ?? null;
  },

  async set(key: string, value: string, ttl?: number): Promise<'OK' | null> {
    if (_isRedisAvailable && _redisClient) {
      try {
        if (ttl !== undefined) {
          return await _redisClient.set(key, value, 'EX', ttl);
        }
        return await _redisClient.set(key, value);
      } catch {
        inMemoryStore.set(key, value);
        return 'OK';
      }
    }
    inMemoryStore.set(key, value);
    return 'OK';
  },

  async del(key: string): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.del(key);
      } catch {
        return inMemoryStore.delete(key) ? 1 : 0;
      }
    }
    return inMemoryStore.delete(key) ? 1 : 0;
  },

  async exists(key: string): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.exists(key);
      } catch {
        return inMemoryStore.has(key) ? 1 : 0;
      }
    }
    return inMemoryStore.has(key) ? 1 : 0;
  },

  async expire(key: string, seconds: number): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.expire(key, seconds);
      } catch {
        return 0;
      }
    }
    return 0;
  },

  async incr(key: string): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.incr(key);
      } catch {
        const current = parseInt(inMemoryStore.get(key) || '0', 10);
        const next = current + 1;
        inMemoryStore.set(key, String(next));
        return next;
      }
    }
    const current = parseInt(inMemoryStore.get(key) || '0', 10);
    const next = current + 1;
    inMemoryStore.set(key, String(next));
    return next;
  },

  async hget(key: string, field: string): Promise<string | null> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.hget(key, field);
      } catch {
        const hashStr = inMemoryStore.get(key);
        if (!hashStr) return null;
        try {
          const hash = JSON.parse(hashStr);
          return hash[field] ?? null;
        } catch {
          return null;
        }
      }
    }
    const hashStr = inMemoryStore.get(key);
    if (!hashStr) return null;
    try {
      const hash = JSON.parse(hashStr);
      return hash[field] ?? null;
    } catch {
      return null;
    }
  },

  async hset(key: string, field: string, value: string): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.hset(key, field, value);
      } catch {
        const hashStr = inMemoryStore.get(key);
        const hash = hashStr ? JSON.parse(hashStr) : {};
        const isNew = !(field in hash);
        hash[field] = value;
        inMemoryStore.set(key, JSON.stringify(hash));
        return isNew ? 1 : 0;
      }
    }
    const hashStr = inMemoryStore.get(key);
    const hash = hashStr ? JSON.parse(hashStr) : {};
    const isNew = !(field in hash);
    hash[field] = value;
    inMemoryStore.set(key, JSON.stringify(hash));
    return isNew ? 1 : 0;
  },

  async hgetall(key: string): Promise<Record<string, string>> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.hgetall(key);
      } catch {
        const hashStr = inMemoryStore.get(key);
        return hashStr ? JSON.parse(hashStr) : {};
      }
    }
    const hashStr = inMemoryStore.get(key);
    return hashStr ? JSON.parse(hashStr) : {};
  },

  async lpush(key: string, value: string): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.lpush(key, value);
      } catch {
        const listStr = inMemoryStore.get(key);
        const list: string[] = listStr ? JSON.parse(listStr) : [];
        list.unshift(value);
        inMemoryStore.set(key, JSON.stringify(list));
        return list.length;
      }
    }
    const listStr = inMemoryStore.get(key);
    const list: string[] = listStr ? JSON.parse(listStr) : [];
    list.unshift(value);
    inMemoryStore.set(key, JSON.stringify(list));
    return list.length;
  },

  async rpush(key: string, value: string): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.rpush(key, value);
      } catch {
        const listStr = inMemoryStore.get(key);
        const list: string[] = listStr ? JSON.parse(listStr) : [];
        list.push(value);
        inMemoryStore.set(key, JSON.stringify(list));
        return list.length;
      }
    }
    const listStr = inMemoryStore.get(key);
    const list: string[] = listStr ? JSON.parse(listStr) : [];
    list.push(value);
    inMemoryStore.set(key, JSON.stringify(list));
    return list.length;
  },

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.lrange(key, start, stop);
      } catch {
        const listStr = inMemoryStore.get(key);
        const list: string[] = listStr ? JSON.parse(listStr) : [];
        const end = stop === -1 ? list.length : stop + 1;
        return list.slice(start, end);
      }
    }
    const listStr = inMemoryStore.get(key);
    const list: string[] = listStr ? JSON.parse(listStr) : [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  },

  async geoadd(key: string, lng: number, lat: number, member: string): Promise<number> {
    if (_isRedisAvailable && _redisClient) {
      try {
        return await _redisClient.geoadd(key, lng, lat, member);
      } catch {
        const geoKey = `geo:${key}`;
        const geoStr = inMemoryStore.get(geoKey);
        const geoData: Record<string, { lng: number; lat: number }> = geoStr ? JSON.parse(geoStr) : {};
        const isNew = !(member in geoData);
        geoData[member] = { lng, lat };
        inMemoryStore.set(geoKey, JSON.stringify(geoData));
        return isNew ? 1 : 0;
      }
    }
    const geoKey = `geo:${key}`;
    const geoStr = inMemoryStore.get(geoKey);
    const geoData: Record<string, { lng: number; lat: number }> = geoStr ? JSON.parse(geoStr) : {};
    const isNew = !(member in geoData);
    geoData[member] = { lng, lat };
    inMemoryStore.set(geoKey, JSON.stringify(geoData));
    return isNew ? 1 : 0;
  },

  getRawClient(): Redis | null {
    return _redisClient;
  }
};
