import json
import time
from functools import wraps
from datetime import datetime, timedelta
from flask_jwt_extended import get_jwt_identity
from app import redis_client
from app.config import Config


class RateLimiter:
    DEFAULT_LIMIT = Config.RATE_LIMIT_DEFAULT
    DEFAULT_WINDOW = 3600

    @classmethod
    def check_rate_limit(cls, identifier, limit=None, window=None):
        """
        检查是否超过限流
        
        Args:
            identifier: 标识符（IP、用户ID等）
            limit: 限制次数
            window: 时间窗口（秒）
        
        Returns:
            tuple: (是否超限, 剩余次数, 重置时间戳)
        """
        if limit is None:
            limit = cls.DEFAULT_LIMIT
        if window is None:
            window = cls.DEFAULT_WINDOW

        key = f'rate_limit:{identifier}'
        
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        current, ttl = pipe.execute()

        if current == 1 or ttl == -1:
            redis_client.expire(key, window)
            ttl = window

        remaining = max(0, limit - current)
        reset_time = int(time.time() + ttl)
        
        return current > limit, remaining, reset_time

    @classmethod
    def check_appointment_limit(cls, user_id):
        """预约接口专用限流：每分钟最多5次"""
        key = f'rate_limit:appointment:{user_id}'
        limit = 5
        window = 60
        
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        current, ttl = pipe.execute()

        if current == 1 or ttl == -1:
            redis_client.expire(key, window)
            ttl = window

        remaining = max(0, limit - current)
        reset_time = int(time.time() + ttl)
        
        return current > limit, remaining, reset_time

    @classmethod
    def check_login_limit(cls, ip):
        """登录接口专用限流：每小时最多10次"""
        key = f'rate_limit:login:{ip}'
        limit = 10
        window = 3600
        
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        current, ttl = pipe.execute()

        if current == 1 or ttl == -1:
            redis_client.expire(key, window)
            ttl = window

        remaining = max(0, limit - current)
        reset_time = int(time.time() + ttl)
        
        return current > limit, remaining, reset_time


rate_limit = RateLimiter


def cache_data(key, ttl=300):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cached = redis_client.get(key)
            if cached:
                try:
                    return json.loads(cached)
                except (json.JSONDecodeError, TypeError):
                    pass

            result = func(*args, **kwargs)
            try:
                redis_client.setex(key, ttl, json.dumps(result))
            except (TypeError, ValueError):
                pass
            return result
        return wrapper
    return decorator


def invalidate_cache(pattern):
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)


def get_current_user():
    user_id = get_jwt_identity()
    if not user_id:
        return None

    cache_key = f'user:{user_id}'
    cached = redis_client.get(cache_key)

    if cached:
        try:
            return json.loads(cached)
        except (json.JSONDecodeError, TypeError):
            pass

    from app.models.user import User
    user = User.query.get(user_id)
    if user:
        user_dict = user.to_dict()
        redis_client.setex(cache_key, 3600, json.dumps(user_dict))
        return user_dict

    return None


def rate_limit_decorator(key_prefix, limit=100, window=60):
    """限流装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            from flask import request
            
            identifier = request.remote_addr or 'unknown'
            key = f'{key_prefix}:{identifier}'
            
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window)
            current, _ = pipe.execute()
            
            if current > limit:
                from flask import jsonify
                return jsonify({
                    'message': '请求过于频繁，请稍后再试',
                    'limit': limit,
                    'retry_after': window
                }), 429
            
            return func(*args, **kwargs)
        return wrapper
    return decorator
