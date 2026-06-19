from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import datetime
from .models import WorkLog, Invoice, Settlement
from .serializers import (
    WorkLogSerializer, InvoiceSerializer, SettlementSerializer,
    WorkLogSummarySerializer
)


class WorkLogViewSet(viewsets.ModelViewSet):
    queryset = WorkLog.objects.select_related(
        'worker', 'case', 'client', 'contract', 'approved_by', 'created_by'
    ).prefetch_related('participants').all()
    serializer_class = WorkLogSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['work_content', 'case__case_no', 'case__case_name', 'client__client_name']
    filterset_fields = ['worker', 'case', 'client', 'contract', 'work_type',
                        'billable_status', 'approval_status', 'billed', 'work_date']
    ordering_fields = ['work_date', 'start_time', 'duration', 'actual_amount']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(worker=user) | Q(created_by=user) | Q(participants=user) |
                Q(case__lead_lawyer=user) | Q(case__assistant=user)
            ).distinct()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(work_date__gte=start_date)
        if end_date:
            qs = qs.filter(work_date__lte=end_date)
        return qs

    @action(detail=False, methods=['get'])
    def my_logs(self, request):
        qs = self.get_queryset().filter(worker=request.user)
        serializer = self.get_serializer(qs, many=True)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'])
    def summary(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        worker_id = request.query_params.get('worker')
        case_id = request.query_params.get('case')
        client_id = request.query_params.get('client')

        qs = self.get_queryset().filter(approval_status__in=['submitted', 'approved', 'adjusted'])
        if start_date:
            qs = qs.filter(work_date__gte=start_date)
        if end_date:
            qs = qs.filter(work_date__lte=end_date)
        if worker_id:
            qs = qs.filter(worker_id=worker_id)
        if case_id:
            qs = qs.filter(case_id=case_id)
        if client_id:
            qs = qs.filter(client_id=client_id)

        agg = qs.aggregate(
            total_hours=Sum('duration') or 0,
            total_billable=Sum('billable_amount') or 0,
            total_actual=Sum('actual_amount') or 0,
            total_travel=Sum('travel_expense') or 0,
            total_other=Sum('other_expense') or 0,
            log_count=Count('id'),
        )

        by_type = list(qs.values('work_type').annotate(
            hours=Sum('duration'),
            amount=Sum('actual_amount')
        ).order_by('work_type'))

        by_worker = []
        if not worker_id:
            worker_qs = qs.values('worker_id', 'worker__first_name', 'worker__last_name', 'worker__username').annotate(
                total_hours=Sum('duration'),
                billable_hours=Sum('actual_amount'),
                log_count=Count('id')
            ).order_by('-total_hours')
            for w in worker_qs:
                name = f'{w["worker__first_name"] or ""}{w["worker__last_name"] or ""}'.strip() or w['worker__username']
                by_worker.append({
                    'worker_id': w['worker_id'],
                    'worker_name': name,
                    'total_hours': float(w['total_hours'] or 0),
                    'billable_amount': float(w['billable_hours'] or 0),
                    'log_count': w['log_count'],
                })

        by_date = list(qs.values('work_date').annotate(
            hours=Sum('duration'),
            amount=Sum('actual_amount')
        ).order_by('work_date'))[:30]

        return Response({
            'code': 200,
            'message': '获取成功',
            'data': {
                'total_hours': float(agg['total_hours'] or 0),
                'total_billable_amount': float(agg['total_billable'] or 0),
                'total_actual_amount': float(agg['total_actual'] or 0),
                'total_travel_expenses': float(agg['total_travel'] or 0),
                'total_other_expenses': float(agg['total_other'] or 0),
                'log_count': agg['log_count'] or 0,
                'by_type': by_type,
                'by_worker': by_worker,
                'by_date': by_date,
            }
        })

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        log = self.get_object()
        log.approval_status = 'submitted'
        log.save()
        return Response({
            'code': 200,
            'message': '已提交确认',
            'data': WorkLogSerializer(log, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        log = self.get_object()
        is_approved = request.data.get('approved', True)
        note = request.data.get('note', '')
        adjusted_amount = request.data.get('adjusted_amount')
        log.approval_status = 'approved' if is_approved else 'rejected'
        log.approved_by = request.user
        log.approved_at = timezone.now()
        log.approval_note = note
        if adjusted_amount is not None:
            log.actual_amount = adjusted_amount
            log.approval_status = 'adjusted'
        log.save()
        return Response({
            'code': 200,
            'message': '已处理',
            'data': WorkLogSerializer(log, context={'request': request}).data
        })

    @action(detail=False, methods=['post'])
    def batch_approve(self, request):
        ids = request.data.get('ids', [])
        approved = request.data.get('approved', True)
        note = request.data.get('note', '')
        updated = WorkLog.objects.filter(id__in=ids, approval_status='submitted').update(
            approval_status='approved' if approved else 'rejected',
            approved_by=request.user,
            approved_at=timezone.now(),
            approval_note=note
        )
        return Response({
            'code': 200,
            'message': f'已批量处理{updated}条记录',
            'data': {'count': updated}
        })


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related(
        'client', 'related_case', 'related_contract', 'settlement', 'created_by'
    ).all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['invoice_no', 'invoice_code', 'buyer_name', 'client__client_name']
    filterset_fields = ['invoice_type', 'status', 'client', 'related_case', 'related_contract', 'settlement']
    ordering_fields = ['issue_date', 'total_amount']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(created_by=user) | Q(related_case__lead_lawyer=user)
            )
        return qs

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        qs = self.get_queryset()
        total = qs.count()
        total_amount = qs.aggregate(s=Sum('total_amount'))['s'] or 0
        paid_amount = qs.filter(status__in=['received', 'sent', 'issued']).aggregate(s=Sum('total_amount'))['s'] or 0
        by_type = list(qs.values('invoice_type').annotate(count=Count('id'), amount=Sum('total_amount')))
        by_month = list(qs.annotate(month=TruncMonth('issue_date')).values('month').annotate(
            count=Count('id'), amount=Sum('total_amount')
        ).order_by('month')[:12])
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': {
                'total': total,
                'total_amount': float(total_amount),
                'paid_amount': float(paid_amount),
                'by_type': by_type,
                'by_month': by_month,
            }
        })

    @action(detail=True, methods=['post'])
    def mark_sent(self, request, pk=None):
        inv = self.get_object()
        inv.status = 'sent'
        inv.sent_date = request.data.get('sent_date', timezone.now().date())
        inv.courier_company = request.data.get('courier_company', inv.courier_company)
        inv.tracking_no = request.data.get('tracking_no', inv.tracking_no)
        inv.receiver_email = request.data.get('email', inv.receiver_email)
        inv.save()
        return Response({
            'code': 200,
            'message': '已标记寄出',
            'data': InvoiceSerializer(inv, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def void_invoice(self, request, pk=None):
        inv = self.get_object()
        inv.status = 'cancelled'
        inv.save()
        return Response({
            'code': 200,
            'message': '发票已作废',
            'data': None
        })


class SettlementViewSet(viewsets.ModelViewSet):
    queryset = Settlement.objects.select_related(
        'client', 'case', 'contract', 'approved_by', 'created_by'
    ).prefetch_related('work_logs').all()
    serializer_class = SettlementSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['settlement_no', 'client__client_name', 'case__case_no']
    filterset_fields = ['client', 'case', 'contract', 'status', 'approval_status']
    ordering_fields = ['created_at', 'due_date', 'settlement_amount']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(created_by=user) | Q(case__lead_lawyer=user) | Q(case__assistant=user)
            )
        return qs

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        qs = self.get_queryset()
        total = qs.count()
        total_amount = qs.aggregate(s=Sum('settlement_amount'))['s'] or 0
        total_paid = qs.aggregate(s=Sum('paid_amount'))['s'] or 0
        total_unpaid = qs.aggregate(s=Sum('unpaid_amount'))['s'] or 0
        overdue = qs.filter(status='overdue').count()
        pending = qs.filter(approval_status='pending').count()
        by_month = list(qs.annotate(month=TruncMonth('created_at')).values('month').annotate(
            count=Count('id'),
            amount=Sum('settlement_amount'),
            paid=Sum('paid_amount')
        ).order_by('month')[:12])
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': {
                'total': total,
                'total_amount': float(total_amount),
                'total_paid': float(total_paid),
                'total_unpaid': float(total_unpaid),
                'overdue_count': overdue,
                'pending_count': pending,
                'by_month': by_month,
            }
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        sm = self.get_object()
        is_approved = request.data.get('approved', True)
        note = request.data.get('note', '')
        sm.approval_status = 'approved' if is_approved else 'rejected'
        sm.approved_by = request.user
        sm.approved_at = timezone.now()
        sm.approval_note = note
        if is_approved and sm.status == 'draft':
            sm.status = 'invoicing'
        sm.save()
        return Response({
            'code': 200,
            'message': '审批完成',
            'data': SettlementSerializer(sm, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        sm = self.get_object()
        amount = float(request.data.get('amount', 0))
        if amount <= 0:
            return Response({
                'code': 400,
                'message': '金额错误',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        sm.paid_amount = sm.paid_amount + amount
        sm.unpaid_amount = max(0, sm.settlement_amount - sm.paid_amount)
        if sm.unpaid_amount == 0:
            sm.status = 'paid'
        elif sm.paid_amount > 0:
            sm.status = 'partial_paid'
        sm.save()
        return Response({
            'code': 200,
            'message': '到账记录已更新',
            'data': SettlementSerializer(sm, context={'request': request}).data
        })

    @action(detail=False, methods=['get'])
    def overdue_list(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(
            unpaid_amount__gt=0,
            due_date__lt=today,
            status__in=['draft', 'reviewing', 'approved', 'invoicing', 'completed', 'partial_paid']
        ).order_by('due_date')
        data = []
        for s in qs:
            data.append({
                'id': s.id,
                'settlement_no': s.settlement_no,
                'client_name': s.client.client_name if s.client else '',
                'case_name': s.case.case_name if s.case else '',
                'due_date': s.due_date,
                'days_overdue': (today - s.due_date).days,
                'settlement_amount': float(s.settlement_amount),
                'paid_amount': float(s.paid_amount),
                'unpaid_amount': float(s.unpaid_amount),
            })
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': data
        })
