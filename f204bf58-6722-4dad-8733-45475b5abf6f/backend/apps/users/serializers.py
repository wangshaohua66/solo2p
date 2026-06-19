from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name',
                  'email', 'phone', 'role', 'role_display', 'id_card',
                  'license_no', 'department', 'position', 'hourly_rate',
                  'avatar', 'status', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined', 'is_active']
        extra_kwargs = {
            'password': {'write_only': True},
            'id_card': {'write_only': True},
        }

    def get_full_name(self, obj):
        name = f'{obj.first_name or ""}{obj.last_name or ""}'.strip()
        return name or obj.username


class UserSimpleSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'role', 'position', 'hourly_rate', 'avatar']

    def get_full_name(self, obj):
        name = f'{obj.first_name or ""}{obj.last_name or ""}'.strip()
        return name or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'first_name', 'last_name',
                  'email', 'phone', 'role', 'id_card', 'license_no',
                  'department', 'position', 'hourly_rate']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)
    confirm_password = serializers.CharField(required=True, min_length=6)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError('两次输入的新密码不一致')
        return attrs
