import logging
import time
import json
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)

PUBLIC_PATHS = [
    '/api/auth/',
    '/admin/',
    '/media/',
    '/static/',
]


class JWTAuthMiddleware(MiddlewareMixin):
    def process_request(self, request):
        path = request.path_info
        for pp in PUBLIC_PATHS:
            if path.startswith(pp):
                return None
        if path.startswith('/api/'):
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header.startswith('Bearer '):
                return JsonResponse({
                    'code': 401,
                    'message': '未提供认证令牌',
                    'data': None
                }, status=401)
            token_str = auth_header.split(' ')[1]
            try:
                token = AccessToken(token_str)
                user_id = token.payload.get('user_id')
                user = User.objects.get(pk=user_id)
                request.user = user
                request.current_user = user
            except (InvalidToken, TokenError, User.DoesNotExist):
                return JsonResponse({
                    'code': 401,
                    'message': '认证令牌无效或已过期',
                    'data': None
                }, status=401)
        return None


class OperationLogMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._start_time = time.time()

    def process_response(self, request, response):
        if not hasattr(request, '_start_time'):
            return response
        path = request.path_info
        if not path.startswith('/api/') or path.startswith('/api/auth/'):
            return response
        duration = time.time() - request._start_time
        method = request.method
        status = response.status_code
        user = getattr(request, 'user', None)
        user_id = user.id if user and user.is_authenticated else None
        username = user.username if user and user.is_authenticated else 'anonymous'
        if method in ['POST', 'PUT', 'PATCH', 'DELETE'] and 200 <= status < 400:
            try:
                body = request.body.decode('utf-8') if request.body else ''
                if len(body) > 1000:
                    body = body[:1000] + '...'
                log = {
                    'user_id': user_id,
                    'username': username,
                    'method': method,
                    'path': path,
                    'status': status,
                    'duration': round(duration, 4),
                    'ip': self._get_client_ip(request),
                    'body': body,
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
                }
                logger.info(f'AUDIT: {json.dumps(log, ensure_ascii=False)}')
            except Exception as e:
                logger.debug(f'Log error: {e}')
        return response

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR', 'unknown')
