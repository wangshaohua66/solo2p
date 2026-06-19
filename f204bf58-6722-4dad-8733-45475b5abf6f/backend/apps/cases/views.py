from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Case, Party, CaseProgress, Trial, Evidence, EvidenceFlow, EvidenceAlert
from .serializers import (
    CaseSerializer, CaseListSerializer, CaseDetailSerializer,
    PartySerializer, CaseProgressSerializer,
    TrialSerializer, TrialConflictCheckSerializer,
    EvidenceSerializer, EvidenceFlowSerializer, EvidenceAlertSerializer,
    EvidenceBorrowSerializer, EvidenceReturnSerializer,
    CaseStatsSerializer
)
from apps.users.models import User
from apps.common.services import ocr_recognize as real_ocr_recognize, OCR_TYPES, add_watermark as real_add_watermark


class CaseViewSet(viewsets.ModelViewSet):
    queryset = Case.objects.select_related(
        'lead_lawyer', 'assistant', 'client', 'created_by'
    ).prefetch_related('lawyers').all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['case_no', 'case_name', 'cause', 'court', 'judge']
    filterset_fields = ['case_type', 'status', 'billing_type', 'lead_lawyer', 'client', 'priority', 'risk_level']
    ordering_fields = ['created_at', 'accept_date', 'limit_date', 'amount']

    def get_serializer_class(self):
        if self.action == 'list':
            return CaseListSerializer
        elif self.action == 'retrieve':
            return CaseDetailSerializer
        return CaseSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(lead_lawyer=user) | Q(assistant=user) | Q(lawyers=user)
            ).distinct()
        if self.action == 'list':
            today = timezone.now().date()
            qs = qs.annotate(
                trial_count=Count('trials', distinct=True),
                evidence_count=Count('evidences', distinct=True)
            )
        return qs

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        today = timezone.now().date()
        warning_date_30 = today + timedelta(days=30)
        warning_date_7 = today + timedelta(days=7)
        warning_date_3 = today + timedelta(days=3)

        total = Case.objects.count()
        by_type = list(Case.objects.values('case_type').annotate(
            count=Count('id')
        ).order_by('case_type'))
        by_status = list(Case.objects.values('status').annotate(
            count=Count('id')
        ).order_by('status'))
        by_month = list(Case.objects.annotate(
            month=TruncMonth('accept_date')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')[:12])

        urgent_warning = Case.objects.filter(
            limit_date__lte=warning_date_3,
            limit_date__gte=today,
            status__in=['handling', 'trial', 'execution', 'assigned']
        ).count()

        warning_cases = list(Case.objects.filter(
            limit_date__lte=warning_date_30,
            limit_date__gte=today,
            status__in=['handling', 'trial', 'execution', 'assigned']
        ).order_by('limit_date').values(
            'id', 'case_no', 'case_name', 'limit_date', 'status'
        )[:10])

        for c in warning_cases:
            c['days_left'] = (c['limit_date'] - today).days

        stats = {
            'total': total,
            'by_type': by_type,
            'by_status': by_status,
            'by_month': by_month,
            'warning_cases': warning_cases,
            'urgent_warning': urgent_warning,
        }
        serializer = CaseStatsSerializer(stats)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'])
    def warning_list(self, request):
        today = timezone.now().date()
        level = request.query_params.get('level', 'all')
        qs = Case.objects.filter(
            limit_date__isnull=False,
            status__in=['handling', 'trial', 'execution', 'assigned', 'filing']
        )
        if level == 'critical':
            qs = qs.filter(limit_date__range=[today, today + timedelta(days=3)])
        elif level == 'urgent':
            qs = qs.filter(limit_date__range=[today + timedelta(days=4), today + timedelta(days=7)])
        elif level == 'warning':
            qs = qs.filter(limit_date__range=[today + timedelta(days=8), today + timedelta(days=15)])
        elif level == 'notice':
            qs = qs.filter(limit_date__range=[today + timedelta(days=16), today + timedelta(days=30)])
        elif level == 'expired':
            qs = qs.filter(limit_date__lt=today)
        else:
            qs = qs.filter(limit_date__lte=today + timedelta(days=30))

        user = request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(lead_lawyer=user) | Q(assistant=user) | Q(lawyers=user)
            )

        data = list(qs.order_by('limit_date').values(
            'id', 'case_no', 'case_name', 'limit_date', 'status',
            'lead_lawyer__first_name', 'lead_lawyer__last_name'
        ))
        for item in data:
            item['days_left'] = (item['limit_date'] - today).days
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': data
        })

    @action(detail=True, methods=['post'])
    def assign_lawyer(self, request, pk=None):
        case = self.get_object()
        lead_lawyer_id = request.data.get('lead_lawyer')
        assistant_id = request.data.get('assistant')
        lawyer_ids = request.data.get('lawyers', [])
        if lead_lawyer_id:
            case.lead_lawyer = User.objects.get(pk=lead_lawyer_id)
        if assistant_id:
            case.assistant = User.objects.get(pk=assistant_id)
        if lawyer_ids:
            case.lawyers.set(lawyer_ids)
        case.save()
        old_status = case.status
        if case.status == 'filing':
            case.status = 'assigned'
            case.save()
            CaseProgress.objects.create(
                case=case,
                from_status=old_status,
                to_status='assigned',
                operator=request.user,
                operation_type='update',
                description=f'律师分配完成，主办律师：{case.lead_lawyer.get_full_name()}'
            )
        return Response({
            'code': 200,
            'message': '分配成功',
            'data': CaseDetailSerializer(case, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        case = self.get_object()
        new_status = request.data.get('status')
        description = request.data.get('description', '')
        if new_status not in [s[0] for s in Case.STATUS_CHOICES]:
            return Response({
                'code': 400,
                'message': '无效的状态值',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        old_status = case.status
        case.status = new_status
        case.save()
        CaseProgress.objects.create(
            case=case,
            from_status=old_status,
            to_status=new_status,
            operator=request.user,
            operation_type='update',
            description=description or f'状态变更为：{case.get_status_display()}'
        )
        return Response({
            'code': 200,
            'message': '状态更新成功',
            'data': CaseDetailSerializer(case, context={'request': request}).data
        })

    @action(detail=True, methods=['get'])
    def progress_timeline(self, request, pk=None):
        case = self.get_object()
        logs = CaseProgress.objects.filter(case=case).order_by('created_at')
        serializer = CaseProgressSerializer(logs, many=True)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': serializer.data
        })


class TrialViewSet(viewsets.ModelViewSet):
    queryset = Trial.objects.select_related(
        'case', 'presiding_lawyer', 'created_by'
    ).prefetch_related('attending_lawyers').all()
    serializer_class = TrialSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['case__case_no', 'case__case_name', 'location', 'courtroom', 'judge']
    filterset_fields = ['case', 'trial_type', 'result', 'presiding_lawyer']
    ordering_fields = ['start_time', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(presiding_lawyer=user) | Q(attending_lawyers=user)
            ).distinct()
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if start:
            qs = qs.filter(start_time__gte=start)
        if end:
            qs = qs.filter(start_time__lte=end)
        return qs

    @action(detail=False, methods=['post'])
    def check_conflict(self, request):
        serializer = TrialConflictCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        exclude_id = data.get('exclude_trial_id', 0)
        conflicting = Trial.objects.filter(
            presiding_lawyer_id=data['presiding_lawyer'],
            start_time__lt=data['end_time'],
            end_time__gt=data['start_time'],
            result__in=['pending', 'ongoing']
        ).exclude(pk=exclude_id).select_related('case', 'presiding_lawyer')

        conflict_list = [{
            'id': t.id,
            'case_id': t.case.id,
            'case_no': t.case.case_no,
            'case_name': t.case.case_name,
            'trial_type': t.trial_type,
            'trial_type_display': t.get_trial_type_display(),
            'start_time': t.start_time,
            'end_time': t.end_time,
            'location': t.location,
        } for t in conflicting]

        available = []
        if conflict_list:
            lawyers = User.objects.filter(
                role__in=['partner', 'lawyer'],
                status=True
            ).exclude(id=data['presiding_lawyer'])
            from itertools import islice
            for lawyer in islice(lawyers, 0, 5):
                has_conflict = Trial.objects.filter(
                    presiding_lawyer=lawyer,
                    start_time__lt=data['end_time'],
                    end_time__gt=data['start_time'],
                    result__in=['pending', 'ongoing']
                ).exists()
                if not has_conflict:
                    available.append({
                        'id': lawyer.id,
                        'full_name': f'{lawyer.first_name or ""}{lawyer.last_name or ""}'.strip() or lawyer.username,
                        'role': lawyer.get_role_display(),
                        'department': lawyer.department,
                    })

        return Response({
            'code': 200,
            'message': '检测完成',
            'data': {
                'has_conflict': len(conflict_list) > 0,
                'conflicts': conflict_list,
                'available_lawyers': available
            }
        })

    @action(detail=False, methods=['get'])
    def calendar_data(self, request):
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        lawyer_id = request.query_params.get('lawyer')
        qs = self.get_queryset()
        if start:
            qs = qs.filter(start_time__gte=start)
        if end:
            qs = qs.filter(start_time__lte=end)
        if lawyer_id:
            qs = qs.filter(
                Q(presiding_lawyer_id=lawyer_id) | Q(attending_lawyers__id=lawyer_id)
            ).distinct()
        events = []
        for t in qs:
            events.append({
                'id': t.id,
                'title': f'{t.get_trial_type_display()} - {t.case.case_name[:20]}',
                'start': t.start_time.isoformat(),
                'end': (t.end_time or t.start_time).isoformat(),
                'allDay': False,
                'extendedProps': {
                    'case_id': t.case.id,
                    'case_no': t.case.case_no,
                    'case_name': t.case.case_name,
                    'trial_type': t.trial_type,
                    'result': t.result,
                    'result_display': t.get_result_display(),
                    'location': t.location,
                    'courtroom': t.courtroom,
                    'presiding_lawyer': {
                        'id': t.presiding_lawyer.id,
                        'name': f'{t.presiding_lawyer.first_name or ""}{t.presiding_lawyer.last_name or ""}'.strip() or t.presiding_lawyer.username
                    },
                    'has_conflict': t.has_conflict,
                    'trial_round': t.trial_round,
                },
                'backgroundColor': '#e53e3e' if t.has_conflict else '#4299e1' if t.result == 'pending' else '#38a169',
                'borderColor': '#e53e3e' if t.has_conflict else '#4299e1' if t.result == 'pending' else '#38a169',
            })
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': events
        })


class EvidenceViewSet(viewsets.ModelViewSet):
    queryset = Evidence.objects.select_related(
        'case', 'uploaded_by', 'borrower', 'parent_evidence'
    ).all()
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['evidence_no', 'evidence_name', 'description', 'prove_content', 'ocr_content']
    filterset_fields = ['case', 'evidence_type', 'storage_status', 'is_original', 'category']
    ordering_fields = ['created_at', 'obtained_date', 'version']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(case__lead_lawyer=user) | Q(case__assistant=user) | Q(case__lawyers=user)
            ).distinct()
        return qs

    @action(detail=True, methods=['post'])
    def borrow(self, request, pk=None):
        evidence = self.get_object()
        if evidence.storage_status not in ['in_store', 'returned']:
            return Response({
                'code': 400,
                'message': f'当前状态({evidence.get_storage_status_display()})无法借出',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        serializer = EvidenceBorrowSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        evidence.storage_status = 'borrowed'
        evidence.borrower = User.objects.get(pk=data['borrower'])
        evidence.borrowed_at = timezone.now()
        evidence.expected_return_at = data.get('expected_return_at')
        evidence.save()
        EvidenceFlow.objects.create(
            evidence=evidence,
            action='borrow',
            operator=request.user,
            to_person=evidence.borrower,
            remark=data.get('remark', ''),
            scan_code=request.data.get('scan_code', '')
        )
        return Response({
            'code': 200,
            'message': '借出登记成功',
            'data': EvidenceSerializer(evidence, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def return_evidence(self, request, pk=None):
        evidence = self.get_object()
        if evidence.storage_status != 'borrowed':
            return Response({
                'code': 400,
                'message': '当前证据未在借出状态',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        serializer = EvidenceReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        borrower = evidence.borrower
        evidence.storage_status = 'returned'
        evidence.returned_at = timezone.now()
        evidence.save()
        EvidenceFlow.objects.create(
            evidence=evidence,
            action='return',
            operator=request.user,
            from_person=borrower,
            to_person=request.user,
            remark=serializer.validated_data.get('remark', ''),
            scan_code=request.data.get('scan_code', '')
        )
        return Response({
            'code': 200,
            'message': '归还登记成功',
            'data': EvidenceSerializer(evidence, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def mark_lost(self, request, pk=None):
        evidence = self.get_object()
        evidence.storage_status = 'lost'
        evidence.save()
        EvidenceAlert.objects.create(
            evidence=evidence,
            alert_type='lost',
            level='critical',
            message=f'证据[{evidence.evidence_name}]编号{evidence.evidence_no}已标记为遗失'
        )
        EvidenceFlow.objects.create(
            evidence=evidence,
            action='modify',
            operator=request.user,
            remark='标记为遗失'
        )
        return Response({
            'code': 200,
            'message': '已标记遗失',
            'data': EvidenceSerializer(evidence, context={'request': request}).data
        })

    @action(detail=True, methods=['get'])
    def flow_log(self, request, pk=None):
        evidence = self.get_object()
        flows = EvidenceFlow.objects.filter(evidence=evidence).order_by('-created_at')
        serializer = EvidenceFlowSerializer(flows, many=True)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'])
    def alerts(self, request):
        qs = EvidenceAlert.objects.select_related(
            'evidence', 'handled_by'
        ).order_by('-created_at')
        is_read = request.query_params.get('is_read')
        level = request.query_params.get('level')
        if is_read is not None:
            qs = qs.filter(is_read=(is_read == 'true'))
        if level:
            qs = qs.filter(level=level)
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': EvidenceAlertSerializer(qs, many=True).data
        })

    @action(detail=False, methods=['post'])
    def batch_upload(self, request):
        case_id = request.data.get('case_id')
        files = request.FILES.getlist('files')
        results = []
        for f in files[:20]:
            try:
                ev = Evidence.objects.create(
                    case_id=case_id,
                    evidence_name=f.name,
                    evidence_type=request.data.get('evidence_type', 'document'),
                    category=request.data.get('category', ''),
                    is_original=False,
                    description=request.data.get('description', ''),
                    file=f,
                    file_name=f.name,
                    file_size=f.size,
                    file_type=f.content_type or '',
                    uploaded_by=request.user
                )
                results.append({
                    'success': True,
                    'id': ev.id,
                    'name': f.name,
                    'evidence_no': ev.evidence_no
                })
            except Exception as e:
                results.append({'success': False, 'name': f.name, 'error': str(e)})
        return Response({
            'code': 200,
            'message': f'批量上传完成：成功{sum(1 for r in results if r["success"])}/{len(results)}',
            'data': results
        })

    @action(detail=True, methods=['post'])
    def ocr_recognize(self, request, pk=None):
        evidence = self.get_object()
        ocr_type = request.data.get('ocr_type', 'general')
        lang = request.data.get('lang', 'chinese_english')

        if not evidence.file:
            return Response({
                'code': 400,
                'message': '证据文件不存在，无法识别',
                'data': None,
            }, status=status.HTTP_400_BAD_REQUEST)

        result = real_ocr_recognize(evidence.file, ocr_type=ocr_type, lang=lang)

        if not result.get('success'):
            return Response({
                'code': 500,
                'message': result.get('error', 'OCR识别失败'),
                'data': None,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        evidence.ocr_content = result.get('content', '')
        evidence.has_ocr = True
        evidence.ocr_info = {
            'ocr_type': ocr_type,
            'type_name': OCR_TYPES.get(ocr_type, ocr_type),
            'lang': lang,
            'words_count': result.get('words_count', 0),
            'applied_at': timezone.now().isoformat(),
        }
        evidence.save(update_fields=['ocr_content', 'has_ocr', 'ocr_info'])

        EvidenceFlow.objects.create(
            evidence=evidence,
            action='ocr',
            operator=request.user,
            remark=f'OCR识别完成，类型={ocr_type}，共{result.get("words_count", 0)}行'
        )

        return Response({
            'code': 200,
            'message': 'OCR识别完成',
            'data': {
                'id': evidence.id,
                'ocr_content': evidence.ocr_content,
                'has_ocr': True,
                'ocr_info': evidence.ocr_info,
                'words_count': result.get('words_count', 0),
            }
        })

    @action(detail=True, methods=['post'])
    def add_watermark(self, request, pk=None):
        evidence = self.get_object()
        watermark_text = request.data.get('text', f'机密 - {evidence.evidence_no} - 仅供本案使用')
        opacity = float(request.data.get('opacity', 0.3))
        position = request.data.get('position', 'diagonal')
        font_size = int(request.data.get('font_size', 36))
        color = request.data.get('color', '#888888')

        if not evidence.file:
            return Response({
                'code': 400,
                'message': '证据文件不存在，无法添加水印',
                'data': None,
            }, status=status.HTTP_400_BAD_REQUEST)

        file_path = evidence.file.path
        result = real_add_watermark(
            file_path, watermark_text,
            opacity=opacity, position=position,
            font_size=font_size, color=color
        )

        if not result.get('success'):
            return Response({
                'code': 500,
                'message': result.get('error', '水印添加失败'),
                'data': None,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        evidence.has_watermark = True
        evidence.watermark_info = result
        evidence.save(update_fields=['has_watermark', 'watermark_info'])

        EvidenceFlow.objects.create(
            evidence=evidence,
            action='watermark',
            operator=request.user,
            remark=f'添加水印：{watermark_text}（{position}）'
        )

        return Response({
            'code': 200,
            'message': '水印添加成功',
            'data': {
                'id': evidence.id,
                'has_watermark': True,
                'watermark_info': evidence.watermark_info,
            }
        })


class PartyViewSet(viewsets.ModelViewSet):
    queryset = Party.objects.all()
    serializer_class = PartySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['case', 'party_type', 'is_represented']


class CaseProgressViewSet(viewsets.ModelViewSet):
    queryset = CaseProgress.objects.select_related('case', 'operator', 'approved_by').all()
    serializer_class = CaseProgressSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['case', 'to_status', 'operation_type']
    ordering_fields = ['created_at']
