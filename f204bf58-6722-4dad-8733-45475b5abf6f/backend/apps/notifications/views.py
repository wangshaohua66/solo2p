from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from .models import Notification
from .serializers import NotificationSerializer
from .services import push_case_limitation_warning, create_notification


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.select_related(
        'recipient', 'related_case', 'related_trial'
    ).all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category', 'level', 'channel', 'status']
    ordering_fields = ['created_at', 'level']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in ['admin', 'partner']:
            scope = self.request.query_params.get('scope', 'mine')
            if scope == 'all':
                return qs
        return qs.filter(recipient=user)

    @action(detail=False, methods=['get'])
    def unread(self, request):
        qs = self.get_queryset().filter(status__in=['pending', 'sent', 'delivered'])
        unread_count = qs.count()
        recent = list(qs.order_by('-created_at')[:10].values(
            'id', 'title', 'content', 'category', 'level', 'created_at',
            'related_case_id', 'related_trial_id'
        ))
        for r in recent:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': {
                'unread_count': unread_count,
                'recent': recent,
            }
        })

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.mark_read()
        return Response({
            'code': 200,
            'message': '已标记已读',
            'data': NotificationSerializer(notif, context={'request': request}).data
        })

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(
            status__in=['pending', 'sent', 'delivered']
        ).update(
            status='read',
            read_at=timezone.now()
        )
        return Response({
            'code': 200,
            'message': f'已批量标记{updated}条已读',
            'data': {'count': updated}
        })

    @action(detail=False, methods=['post'])
    def push_limitation(self, request):
        from apps.cases.models import Case
        from django.db.models import F, ExpressionWrapper, IntegerField
        today = timezone.now().date()
        qs = Case.objects.filter(
            limitation_date__isnull=False,
            status__in=['consulting', 'conflict_check', 'filing', 'assigned', 'handling', 'trial', 'execution']
        )
        pushed = 0
        for case in qs:
            days_left = (case.limitation_date - today).days if case.limitation_date else 999
            if days_left <= 30:
                level = 'critical' if days_left <= 0 else ('urgent' if days_left <= 7 else 'warning')
                push_case_limitation_warning(case, days_left, level)
                pushed += 1
        return Response({
            'code': 200,
            'message': f'已推送{pushed}条时效预警',
            'data': {'count': pushed}
        })

    @action(detail=False, methods=['post'])
    def test_push(self, request):
        user = request.user
        channels = request.data.get('channels', ['in_app'])
        notif = create_notification(
            recipient=user,
            title='🔔 测试推送消息',
            content='这是一条测试消息，用于验证消息推送功能正常工作。',
            category='system',
            level='info',
            channel='in_app',
            push_channels=channels,
            created_by=user,
        )
        return Response({
            'code': 200,
            'message': '测试推送已发送',
            'data': NotificationSerializer(notif, context={'request': request}).data
        })
