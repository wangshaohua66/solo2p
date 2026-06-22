import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from api.services.match_engine import get_redis


def _rate_limit_key(api_key_hash: str, window: int) -> str:
    return f"rate_limit:{api_key_hash}:{window}"


class RateLimitResult:
    def __init__(self, allowed: bool, remaining: int, limit: int, reset_at: float):
        self.allowed = allowed
        self.remaining = remaining
        self.limit = limit
        self.reset_at = reset_at

    def to_headers(self) -> dict:
        return {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(self.remaining),
            "X-RateLimit-Reset": str(int(self.reset_at)),
        }


_in_memory_windows: dict[str, list[float]] = {}


async def check_rate_limit(
    api_key_hash: str,
    limit: int = 100,
    window: int = 60,
) -> RateLimitResult:
    key = _rate_limit_key(api_key_hash, window)
    now = time.time()
    window_start = now - window
    reset_at = window_start + window

    try:
        r = await get_redis()
        redis_working = False
        try:
            await r.ping()
            redis_working = True
        except Exception:
            redis_working = False

        if redis_working and hasattr(r, "zadd"):
            member = f"{now}_{id(object())}"
            await r.zadd(key, {member: now})
            await r.zremrangebyscore(key, 0, window_start)
            await r.expire(key, window + 1)
            count = await r.zcard(key)
            if count is None:
                count = 0
            remaining = max(0, limit - count)
            allowed = count <= limit
            return RateLimitResult(allowed, remaining, limit, reset_at)
    except Exception as e:
        logger.debug(f"Redis rate limit failed, fallback to memory: {e}")

    global _in_memory_windows
    if key not in _in_memory_windows:
        _in_memory_windows[key] = []

    timestamps = _in_memory_windows[key]
    _in_memory_windows[key] = [ts for ts in timestamps if ts > window_start]
    _in_memory_windows[key].append(now)

    count = len(_in_memory_windows[key])
    remaining = max(0, limit - count)
    allowed = count <= limit

    return RateLimitResult(allowed, remaining, limit, reset_at)
