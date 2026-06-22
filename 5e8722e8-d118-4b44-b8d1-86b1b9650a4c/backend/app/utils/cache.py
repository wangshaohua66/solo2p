import json
from functools import wraps
from flask_jwt_extended import get_jwt_identity
from app import redis_client
from app.models import User


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

    user = User.query.get(user_id)
    if user:
        user_dict = user.to_dict()
        redis_client.setex(cache_key, 3600, json.dumps(user_dict))
        return user_dict

    return None


def rate_limit(key, limit=100, window=60):
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    current, _ = pipe.execute()
    return current <= limit, current
