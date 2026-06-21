import hashlib
from typing import Optional

import redis
from simhash import Simhash
from loguru import logger

from config.settings import Settings


class DedupPipeline:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, settings: Optional[Settings] = None):
        if self._initialized:
            return
        self._settings = settings or Settings()
        redis_cfg = self._settings.get_redis_config()
        self._threshold = redis_cfg.get("simhash_threshold", 3)
        self._dedup_db = redis_cfg.get("dedup_db", 1)
        self._redis: Optional[redis.Redis] = None
        self._connect()
        self._initialized = True

    def _connect(self):
        redis_cfg = self._settings.get_redis_config()
        try:
            self._redis = redis.Redis(
                host=redis_cfg.get("host", "127.0.0.1"),
                port=redis_cfg.get("port", 6379),
                password=redis_cfg.get("password") or None,
                db=self._dedup_db,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            self._redis.ping()
            logger.info("DedupPipeline: Redis connected")
        except Exception as e:
            logger.error(f"DedupPipeline: Redis connection failed: {e}")
            self._redis = None

    def _compute_simhash(self, text: str) -> int:
        if not text:
            return 0
        return Simhash(text).value

    def _compute_url_fingerprint(self, url: str) -> str:
        return hashlib.md5(url.encode()).hexdigest()

    def _is_similar(self, hash1: int, hash2: int) -> bool:
        distance = bin(hash1 ^ hash2).count("1")
        return distance <= self._threshold

    def is_duplicate(self, item: dict) -> bool:
        if not self._redis:
            return False

        url = item.get("detail_url", "") or item.get("url", "")
        title = item.get("title", "")
        content = item.get("content", "")
        channel_code = item.get("channel_code", "unknown")

        if url:
            url_fp = self._compute_url_fingerprint(url)
            url_key = f"dedup:url:{channel_code}:{url_fp}"
            if self._redis.exists(url_key):
                logger.debug(f"URL duplicate: {url[:80]}")
                return True

        text = f"{title} {content}" if content else title
        if not text:
            return False

        item_hash = self._compute_simhash(text)
        channel_key = f"dedup:simhash:{channel_code}"

        existing_hashes = self._redis.lrange(channel_key, 0, -1)
        for h_str in existing_hashes:
            try:
                existing_hash = int(h_str)
                if self._is_similar(item_hash, existing_hash):
                    logger.debug(f"SimHash duplicate: {title[:50]}")
                    return True
            except (ValueError, TypeError):
                continue

        return False

    def mark_processed(self, item: dict):
        if not self._redis:
            return

        url = item.get("detail_url", "") or item.get("url", "")
        title = item.get("title", "")
        content = item.get("content", "")
        channel_code = item.get("channel_code", "unknown")

        if url:
            url_fp = self._compute_url_fingerprint(url)
            url_key = f"dedup:url:{channel_code}:{url_fp}"
            self._redis.setex(url_key, 86400 * 30, "1")

        text = f"{title} {content}" if content else title
        if text:
            item_hash = self._compute_simhash(text)
            channel_key = f"dedup:simhash:{channel_code}"
            self._redis.rpush(channel_key, str(item_hash))
            self._redis.ltrim(channel_key, -10000, -1)
            self._redis.expire(channel_key, 86400 * 7)

    def process(self, item: dict) -> Optional[dict]:
        if self.is_duplicate(item):
            return None
        self.mark_processed(item)
        return item

    def get_stats(self) -> dict:
        if not self._redis:
            return {"status": "disconnected"}
        try:
            keys = self._redis.keys("dedup:simhash:*")
            url_keys = self._redis.keys("dedup:url:*")
            return {
                "status": "connected",
                "simhash_channels": len(keys),
                "url_records": len(url_keys),
            }
        except Exception:
            return {"status": "error"}

    def cleanup_channel(self, channel_code: str):
        if not self._redis:
            return
        simhash_key = f"dedup:simhash:{channel_code}"
        url_pattern = f"dedup:url:{channel_code}:*"
        self._redis.delete(simhash_key)
        for key in self._redis.scan_iter(url_pattern):
            self._redis.delete(key)
        logger.info(f"Cleaned up dedup records for channel: {channel_code}")
