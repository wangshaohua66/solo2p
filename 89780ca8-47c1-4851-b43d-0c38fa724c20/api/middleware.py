import hashlib
import json
import re
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from sqlalchemy import select

from api.database import async_session
from api.models.api_key import APIKey
from api.services.rate_limiter import check_rate_limit


OPEN_API_PREFIX = "/api/v1/open"
KEYS_MANAGEMENT_PREFIX = "/api/v1/openapi/keys"


def _should_skip_auth(path: str, method: str) -> bool:
    if method == "POST" and path == "/api/v1/openapi/keys":
        return True
    if path.startswith("/docs") or path.startswith("/openapi.json") or path.startswith("/redoc"):
        return True
    return False


class ApiKeyAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        method = request.method

        if not path.startswith(OPEN_API_PREFIX) and not path.startswith(KEYS_MANAGEMENT_PREFIX):
            return await call_next(request)

        if _should_skip_auth(path, method):
            return await call_next(request)

        api_key_raw = request.headers.get("X-API-Key")
        if not api_key_raw:
            return JSONResponse(
                status_code=401,
                content={"detail": "X-API-Key header is required"},
            )

        if not api_key_raw.startswith("nk_"):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid API key format"},
            )

        key_hash = hashlib.sha256(api_key_raw.encode("utf-8")).hexdigest()

        async with async_session() as db:
            result = await db.execute(select(APIKey).where(APIKey.key_hash == key_hash))
            api_key = result.scalar_one_or_none()

            if not api_key:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid API key"},
                )

            if not api_key.is_active:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "API key is revoked"},
                )

            rate_result = await check_rate_limit(
                key_hash,
                limit=api_key.rate_limit_per_min,
                window=60,
            )

            if not rate_result.allowed:
                resp = JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded"},
                )
                for k, v in rate_result.to_headers().items():
                    resp.headers[k] = v
                resp.headers["Retry-After"] = str(
                    max(1, int(rate_result.reset_at - datetime.now(timezone.utc).timestamp()))
                )
                return resp

            api_key.last_used_at = datetime.now(timezone.utc)
            await db.commit()

            api_key_info = {
                "id": api_key.id,
                "key_hash": key_hash,
                "key_name": api_key.key_name,
                "user_id": api_key.user_id,
                "scopes": api_key.scopes.split(",") if api_key.scopes else [],
                "rate_limit_per_min": api_key.rate_limit_per_min,
            }
            request.state.api_key_info = api_key_info

            response = await call_next(request)

            for k, v in rate_result.to_headers().items():
                response.headers[k] = v

            return response
