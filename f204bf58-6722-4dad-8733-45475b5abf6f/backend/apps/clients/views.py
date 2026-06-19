from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Count, Q, Sum
from .models import Client, Contract, PaymentPlan
from .serializers import ClientSerializer, ContractSerializer, PaymentPlanSerializer
from apps.users.models import User


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.select_related('account_manager', 'intro_by', 'created_by').all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['client_no', 'client_name', 'phone', 'email', 'id_no', 'contact_person', 'tax_no']
    filterset_fields = ['client_type', 'vip_level', 'is_active', 'account_manager', 'portal_enabled']
    ordering_fields = ['created_at', 'total_fee_amount', 'unpaid_amount', 'credit_rating']

    @action(detail=False, methods=['get'])
    def simple_list(self, request):
        qs = Client.objects.filter(is_active=True).values(
            'id', 'client_no', 'client_name', 'client_type', 'phone', 'contact_person'
        )
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': list(qs)
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total = Client.objects.count()
        by_type = list(Client.objects.values('client_type').annotate(count=Count('id')))
        by_vip = list(Client.objects.values('vip_level').annotate(count=Count('id')))
        active_count = Client.objects.filter(is_active=True).count()
        portal_count = Client.objects.filter(portal_enabled=True).count()
        total_unpaid = Client.objects.aggregate(Sum('unpaid_amount'))['unpaid_amount__sum'] or 0
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': {
                'total': total,
                'active_count': active_count,
                'portal_count': portal_count,
                'total_unpaid': float(total_unpaid),
                'by_type': by_type,
                'by_vip': by_vip,
            }
        })

    @action(detail=True, methods=['post'])
    def enable_portal(self, request, pk=None):
        client = self.get_object()
        username = request.data.get('portal_username')
        password = request.data.get('portal_password')
        if not username or not password:
            return Response({
                'code': 400,
                'message': '请设置门户账号和密码',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        client.portal_enabled = True
        client.portal_username = username
        client.portal_password = password
        client.save()
        return Response({
            'code': 200,
            'message': '客户门户已开通',
            'data': ClientSerializer(client, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def disable_portal(self, request, pk=None):
        client = self.get_object()
        client.portal_enabled = False
        client.save()
        return Response({
            'code': 200,
            'message': '客户门户已关闭',
            'data': None
        })


class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.select_related(
        'client', 'case', 'firm_signer', 'approved_by', 'template_used', 'created_by'
    ).prefetch_related('payment_plans').all()
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['contract_no', 'contract_name', 'client__client_name']
    filterset_fields = ['contract_type', 'status', 'payment_type', 'approval_status', 'client', 'case']
    ordering_fields = ['created_at', 'effective_date', 'expire_date', 'total_amount']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(firm_signer=user) | Q(created_by=user) | Q(client__account_manager=user)
            )
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        contract = self.get_object()
        is_approved = request.data.get('approved', True)
        note = request.data.get('note', '')
        contract.approval_status = 'approved' if is_approved else 'rejected'
        contract.approved_by = request.user
        from django.utils import timezone
        contract.approved_at = timezone.now()
        contract.approval_note = note
        if is_approved and contract.status == 'draft':
            contract.status = 'reviewing'
        contract.save()
        return Response({
            'code': 200,
            'message': '审批完成',
            'data': ContractSerializer(contract, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        plan_id = request.data.get('plan_id')
        amount = float(request.data.get('amount', 0))
        actual_date = request.data.get('actual_date')
        method = request.data.get('payment_method', 'bank')
        voucher = request.data.get('voucher_no', '')
        invoice = request.data.get('invoice_no', '')
        if not plan_id or amount <= 0:
            return Response({
                'code': 400,
                'message': '请提供正确的付款信息',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            plan = PaymentPlan.objects.get(pk=plan_id, contract_id=pk)
        except PaymentPlan.DoesNotExist:
            return Response({
                'code': 404,
                'message': '付款计划不存在',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        plan.actual_amount = plan.actual_amount + amount
        plan.actual_date = actual_date or plan.actual_date
        plan.payment_method = method
        plan.voucher_no = voucher
        plan.invoice_no = invoice
        if plan.actual_amount >= plan.amount:
            plan.status = 'paid'
        elif plan.actual_amount > 0:
            plan.status = 'partial'
        plan.save()
        contract = plan.contract
        contract.paid_amount = contract.paid_amount + amount
        contract.unpaid_amount = max(0, contract.total_amount - contract.paid_amount)
        contract.save()
        return Response({
            'code': 200,
            'message': '付款记录已更新',
            'data': ContractSerializer(contract, context={'request': request}).data
        })

    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        from datetime import timedelta
        from django.utils import timezone
        today = timezone.now().date()
        days = int(request.query_params.get('days', 30))
        qs = Contract.objects.filter(
            status__in=['effective', 'signed'],
            expire_date__range=[today, today + timedelta(days=days)]
        ).order_by('expire_date')
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': ContractSerializer(qs, many=True, context={'request': request}).data
        })


class PaymentPlanViewSet(viewsets.ModelViewSet):
    queryset = PaymentPlan.objects.select_related('contract').all()
    serializer_class = PaymentPlanSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['contract', 'status']
    ordering_fields = ['installment_no', 'due_date', 'amount']

    @action(detail=False, methods=['get'])
    def overdue_list(self, request):
        from django.utils import timezone
        today = timezone.now().date()
        qs = PaymentPlan.objects.filter(
            status__in=['pending', 'partial'],
            due_date__lt=today
        ).select_related('contract', 'contract__client').order_by('due_date')
        data = []
        for p in qs:
            data.append({
                'id': p.id,
                'installment_no': p.installment_no,
                'due_date': p.due_date,
                'amount': float(p.amount),
                'actual_amount': float(p.actual_amount),
                'unpaid': float(p.amount - p.actual_amount),
                'days_overdue': (today - p.due_date).days,
                'contract_no': p.contract.contract_no,
                'contract_name': p.contract.contract_name,
                'client_name': p.contract.client.client_name if p.contract.client else '',
                'client_phone': p.contract.client.phone if p.contract.client else '',
            })
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': data
        })
