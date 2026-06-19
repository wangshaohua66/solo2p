from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.hashers import check_password
from rest_framework.pagination import PageNumberPagination
from .serializers import (
    UserSerializer, UserSimpleSerializer, UserCreateSerializer,
    UserLoginSerializer, ChangePasswordSerializer
)

User = get_user_model()


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    pagination_class = StandardPagination
    search_fields = ['username', 'first_name', 'last_name', 'email', 'phone', 'license_no']
    filterset_fields = ['role', 'status', 'department']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['login', 'register']:
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'])
    @permission_classes([AllowAny])
    def login(self, request):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({
                'code': 401,
                'message': '用户名或密码错误',
                'data': None
            }, status=status.HTTP_401_UNAUTHORIZED)
        if not user.status:
            return Response({
                'code': 403,
                'message': '账户已被禁用，请联系管理员',
                'data': None
            }, status=status.HTTP_403_FORBIDDEN)
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        return Response({
            'code': 200,
            'message': '登录成功',
            'data': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSimpleSerializer(user).data
            }
        })

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        user = self.get_object()
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not check_password(serializer.validated_data['old_password'], user.password):
            return Response({
                'code': 400,
                'message': '原密码错误',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({
            'code': 200,
            'message': '密码修改成功',
            'data': None
        })

    @action(detail=False, methods=['get'])
    def lawyers(self, request):
        lawyers = User.objects.filter(
            role__in=['partner', 'lawyer'],
            status=True
        ).order_by('department', 'username')
        serializer = UserSimpleSerializer(lawyers, many=True)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'])
    def assistants(self, request):
        assistants = User.objects.filter(
            role__in=['assistant', 'lawyer'],
            status=True
        ).order_by('department', 'username')
        serializer = UserSimpleSerializer(assistants, many=True)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'])
    def simple_list(self, request):
        users = User.objects.filter(status=True).values(
            'id', 'username', 'first_name', 'last_name', 'role', 'department'
        )
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': list(users)
        })
