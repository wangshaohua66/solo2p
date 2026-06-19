
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = user.role
        token['user_id'] = user.id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        user_info = {
            'id': user.id,
            'username': user.username,
            'full_name': user.get_full_name() or user.username,
            'role': user.role,
            'role_display': user.get_role_display(),
            'email': user.email or '',
            'phone': user.phone or '',
            'department': user.department or '',
            'position': getattr(user, 'position', '') or '',
            'is_active': user.is_active,
            'avatar': user.avatar.url if user.avatar else '',
        }
        return {
            'access': data['access'],
            'refresh': data['refresh'],
            'user': user_info,
        }


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            detail = e.detail if hasattr(e, 'detail') else str(e)
            msg = '用户名或密码错误'
            if isinstance(detail, dict):
                for k, v in detail.items():
                    if isinstance(v, list) and v:
                        msg = str(v[0])
                        break
                    elif isinstance(v, str):
                        msg = v
                        break
            return Response({
                'code': 401,
                'message': msg,
                'data': None
            }, status=200)

        data = serializer.validated_data
        return Response({
            'code': 200,
            'message': '登录成功',
            'data': data
        }, status=200)
