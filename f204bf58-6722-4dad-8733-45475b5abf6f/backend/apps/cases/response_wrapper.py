
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
import json


class ResponseWrapperMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        path = request.path_info or ''

        if path.startswith('/api/') and not path.startswith('/api/auth/') and not path.startswith('/admin/'):
            if isinstance(response, Response):
                status_code = response.status_code
                try:
                    if hasattr(response, 'data'):
                        data = response.data
                    else:
                        data = json.loads(response.content.decode('utf-8')) if response.content else None
                except Exception:
                    data = None

                if isinstance(data, dict) and 'code' in data:
                    resp = JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
                    resp.status_code = 200
                    resp["Content-Type"] = "application/json; charset=utf-8"
                    return resp

                if status_code >= 200 and status_code < 300:
                    wrapped = {
                        'code': 200,
                        'message': 'success',
                        'data': data
                    }
                else:
                    msg = '请求失败'
                    if isinstance(data, dict):
                        for k, v in data.items():
                            if isinstance(v, list) and v:
                                msg = f"{k}: {v[0]}"
                                break
                            elif isinstance(v, str):
                                msg = v
                                break
                    wrapped = {
                        'code': status_code,
                        'message': msg,
                        'data': data
                    }
                resp = JsonResponse(wrapped, safe=False, json_dumps_params={'ensure_ascii': False})
                resp.status_code = 200 if (status_code >= 200 and status_code < 300) else 200
                resp["Content-Type"] = "application/json; charset=utf-8"
                return resp

            elif isinstance(response, JsonResponse):
                try:
                    data = json.loads(response.content.decode('utf-8'))
                    status_code = response.status_code
                    if isinstance(data, dict) and 'code' in data:
                        response.status_code = 200
                        return response
                    if status_code >= 200 and status_code < 300 and isinstance(data, dict):
                        wrapped = {'code': 200, 'message': 'success', 'data': data}
                        resp = JsonResponse(wrapped, safe=False, json_dumps_params={'ensure_ascii': False})
                        resp.status_code = 200
                        resp["Content-Type"] = "application/json; charset=utf-8"
                        return resp
                except Exception:
                    pass

        return response
