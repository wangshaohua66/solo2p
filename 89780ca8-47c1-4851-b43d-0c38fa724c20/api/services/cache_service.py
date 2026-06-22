import json
from typing import Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("redis package not available - using in-memory fallback")


REDIS_URL = "redis://localhost:6379/0"

_redis_pool: Optional[object] = None


async def _get_redis():
    if not REDIS_AVAILABLE:
        return None
    global _redis_pool
    try:
        if _redis_pool is None:
            _redis_pool = redis.ConnectionPool.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1, socket_timeout=1)
        r = redis.Redis(connection_pool=_redis_pool)
        await r.ping()
        return r
    except Exception as e:
        logger.debug(f"Redis connection failed, using in-memory fallback: {e}")
        return None


class InMemoryCache:
    def __init__(self):
        self._data: dict = {}
        self._pubsub_channels: dict[str, list] = {}

    async def get(self, key: str):
        return self._data.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self._data[key] = value

    async def delete(self, *keys: str):
        for k in keys:
            self._data.pop(k, None)

    async def publish(self, channel: str, message: str):
        if channel in self._pubsub_channels:
            for sub in self._pubsub_channels[channel]:
                sub.append(message)

    async def zadd(self, key: str, mapping: dict):
        if key not in self._data:
            self._data[key] = {}
        for member, score in mapping.items():
            self._data[key][member] = score

    async def zrange(self, key: str, start: int, end: int, withscores: bool = False):
        data = self._data.get(key, {})
        sorted_items = sorted(data.items(), key=lambda x: x[1])
        if end == -1:
            result_slice = sorted_items[start:]
        else:
            result_slice = sorted_items[start:end + 1]
        if withscores:
            return [(m, s) for m, s in result_slice]
        return [m for m, _ in result_slice]

    async def zrem(self, key: str, *members: str):
        removed = 0
        if key in self._data:
            for m in members:
                if m in self._data[key]:
                    del self._data[key][m]
                    removed += 1
        return removed

    async def aclose(self):
        self._data.clear()
        self._pubsub_channels.clear()


class CacheService:
    def __init__(self):
        self.redis = None
        self._fallback: Optional[InMemoryCache] = None
        self._initialized = False

    async def _ensure_redis(self):
        if not self._initialized:
            self.redis = await _get_redis()
            if self.redis is None:
                self._fallback = InMemoryCache()
            self._initialized = True
        return self.redis if self.redis is not None else self._fallback

    async def get_collection_cache(self, collection_id: int) -> Optional[dict]:
        r = await self._ensure_redis()
        try:
            data = await r.get(f"collection:{collection_id}")
            if data:
                return json.loads(data)
        except Exception as e:
            logger.debug(f"Cache get failed: {e}")
        return None

    async def set_collection_cache(self, collection_id: int, data: dict, ttl: int = 300):
        r = await self._ensure_redis()
        try:
            await r.setex(
                f"collection:{collection_id}",
                ttl,
                json.dumps(data, default=str),
            )
        except Exception as e:
            logger.debug(f"Cache set failed: {e}")

    async def invalidate_collection_cache(self, collection_id: int):
        r = await self._ensure_redis()
        try:
            await r.delete(f"collection:{collection_id}")
        except Exception as e:
            logger.debug(f"Cache invalidate failed: {e}")

    async def publish_orderbook_update(self, collection_id: int, data: dict):
        r = await self._ensure_redis()
        try:
            await r.publish(
                f"orderbook_updates:{collection_id}",
                json.dumps(data, default=str),
            )
        except Exception as e:
            logger.debug(f"Publish failed: {e}")

    async def subscribe_orderbook(self, collection_id: int):
        r = await self._ensure_redis()
        try:
            if hasattr(r, "pubsub"):
                pubsub = r.pubsub()
                await pubsub.subscribe(f"orderbook_updates:{collection_id}")
                return pubsub
        except Exception as e:
            logger.debug(f"Subscribe failed: {e}")
        return None

    async def get_stats_cache(self, key: str) -> Optional[dict]:
        r = await self._ensure_redis()
        try:
            data = await r.get(f"stats:{key}")
            if data:
                return json.loads(data)
        except Exception as e:
            logger.debug(f"Stats cache get failed: {e}")
        return None

    async def set_stats_cache(self, key: str, data: dict, ttl: int = 60):
        r = await self._ensure_redis()
        try:
            await r.setex(
                f"stats:{key}",
                ttl,
                json.dumps(data, default=str),
            )
        except Exception as e:
            logger.debug(f"Stats cache set failed: {e}")

    async def close(self):
        if self.redis:
            try:
                await self.redis.aclose()
            except Exception:
                pass
        if self._fallback:
            await self._fallback.aclose()


cache_service = CacheService()
