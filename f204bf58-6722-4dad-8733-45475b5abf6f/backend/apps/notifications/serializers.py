from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipient_info = serializers.SerializerMethodField()
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    related_case_info = serializers.SerializerMethodField()
    related_trial_info = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_info', 'title', 'content',
            'category', 'category_display', 'level', 'level_display',
            'channel', 'channel_display', 'status', 'status_display',
            'related_case', 'related_case_info', 'related_trial', 'related_trial_info',
            'extra_data', 'sent_at', 'read_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'sent_at', 'read_at']

    def get_recipient_info(self, obj):
        if not obj.recipient:
            return None
        u = obj.recipient
        name = f'{u.first_name or ""}{u.last_name or ""}'.strip() or u.username
        return {
            'id': u.id,
            'username': u.username,
            'full_name': name,
            'role': getattr(u, 'role', ''),
            'phone': getattr(u, 'phone', ''),
        }

    def get_related_case_info(self, obj):
        if not obj.related_case:
            return None
        return {
            'id': obj.related_case.id,
            'case_no': obj.related_case.case_no,
            'case_name': obj.related_case.case_name,
            'status': obj.related_case.status,
            'status_display': obj.related_case.get_status_display(),
        }

    def get_related_trial_info(self, obj):
        if not obj.related_trial:
            return None
        return {
            'id': obj.related_trial.id,
            'start_time': obj.related_trial.start_time,
            'trial_type': obj.related_trial.trial_type,
            'trial_type_display': obj.related_trial.get_trial_type_display(),
            'location': obj.related_trial.location,
        }
