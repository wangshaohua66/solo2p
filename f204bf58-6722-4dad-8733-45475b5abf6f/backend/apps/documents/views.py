from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Count, Q
from django.template import Context, Template as DjangoTemplate
from django.utils import timezone
import os
from .models import DocumentTemplate, GeneratedDocument
from .serializers import (
    DocumentTemplateSerializer, GeneratedDocumentSerializer,
    DocumentGenerateSerializer, TemplateUsageSerializer
)


class DocumentTemplateViewSet(viewsets.ModelViewSet):
    queryset = DocumentTemplate.objects.select_related('owner').filter(is_published=True).all()
    serializer_class = DocumentTemplateSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['template_code', 'template_name', 'description', 'tags']
    filterset_fields = ['category', 'subcategory', 'case_type', 'applicable_court', 'file_type', 'share_scope', 'is_system']
    ordering_fields = ['created_at', 'use_count', 'rating']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(share_scope__in=['firm', 'public']) |
                Q(owner=user) |
                Q(share_scope='department')
            ).distinct()
        return qs

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        qs = DocumentTemplate.objects.filter(is_published=True)
        user = request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(share_scope__in=['firm', 'public']) |
                Q(owner=user)
            ).distinct()
        categories = list(qs.values('category').annotate(count=Count('id')).order_by('category'))
        result = []
        for cat in categories:
            items = qs.filter(category=cat['category']).values(
                'id', 'template_code', 'template_name', 'subcategory',
                'case_type', 'use_count', 'rating'
            )[:20]
            result.append({
                'category': cat['category'],
                'count': cat['count'],
                'items': list(items)
            })
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': result
        })

    @action(detail=True, methods=['post'])
    def rate(self, request, pk=None):
        template = self.get_object()
        serializer = TemplateUsageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rating = serializer.validated_data.get('rating')
        if rating:
            template.rating_count += 1
            template.rating = round(
                (float(template.rating) * (template.rating_count - 1) + rating) / template.rating_count, 1
            )
        template.use_count += 1
        template.save()
        return Response({
            'code': 200,
            'message': '评分成功',
            'data': {'use_count': template.use_count, 'rating': template.rating}
        })

    @action(detail=False, methods=['post'])
    def generate(self, request):
        serializer = DocumentGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        template = data['template']
        case = data.get('case')
        client = data.get('client')
        custom_fields = data.get('custom_fields', {})

        context_data = {}
        if case:
            context_data['case'] = {
                'case_no': case.case_no,
                'case_name': case.case_name,
                'case_type': case.get_case_type_display(),
                'cause': case.cause,
                'amount': float(case.amount),
                'claim': case.claim,
                'defense': case.defense,
                'court': case.court,
                'judge': case.judge,
                'accept_date': case.accept_date.strftime('%Y年%m月%d日') if case.accept_date else '',
                'filing_date': case.filing_date.strftime('%Y年%m月%d日') if case.filing_date else '',
                'lead_lawyer': {
                    'name': f'{case.lead_lawyer.first_name or ""}{case.lead_lawyer.last_name or ""}'.strip() if case.lead_lawyer else '',
                    'license_no': case.lead_lawyer.license_no if case.lead_lawyer else '',
                } if case.lead_lawyer else {},
            }
            parties = case.parties.all()
            plaintiffs = [{'name': p.name, 'phone': p.phone, 'address': p.address,
                          'id_no': p.id_no, 'legal_representative': p.legal_representative}
                         for p in parties if p.party_type == 'plaintiff' and p.is_represented]
            defendants = [{'name': p.name, 'phone': p.phone, 'address': p.address,
                          'id_no': p.id_no, 'legal_representative': p.legal_representative}
                         for p in parties if p.party_type == 'defendant']
            context_data['plaintiff'] = plaintiffs[0] if plaintiffs else {}
            context_data['plaintiffs'] = plaintiffs
            context_data['defendant'] = defendants[0] if defendants else {}
            context_data['defendants'] = defendants
        if client:
            context_data['client'] = {
                'client_no': client.client_no,
                'client_name': client.client_name,
                'phone': client.phone,
                'email': client.email,
                'address': client.address,
                'contact_person': client.contact_person,
                'id_no': client.id_no,
                'legal_representative': client.legal_representative,
                'tax_no': client.tax_no,
            }
        context_data.update(custom_fields)
        context_data['today'] = timezone.now().strftime('%Y年%m月%d日')
        context_data['firm_name'] = '[律师事务所名称]'

        try:
            django_template = DjangoTemplate(template.content)
            content = django_template.render(Context(context_data))
        except Exception as e:
            content = template.content
            for k, v in context_data.items():
                if isinstance(v, str):
                    content = content.replace('{{ ' + k + ' }}', v)

        doc = GeneratedDocument.objects.create(
            template=template,
            doc_title=data.get('doc_title') or f'{template.template_name}-{case.case_no if case else client.client_name if client else timezone.now().strftime("%Y%m%d")}',
            doc_type=template.category,
            case=case,
            client=client,
            content=content,
            html_content=content,
            filled_data=context_data,
            created_by=request.user,
        )
        return Response({
            'code': 200,
            'message': '文档生成成功',
            'data': GeneratedDocumentSerializer(doc, context={'request': request}).data
        })


class GeneratedDocumentViewSet(viewsets.ModelViewSet):
    queryset = GeneratedDocument.objects.select_related(
        'template', 'case', 'client', 'reviewed_by', 'created_by', 'parent_doc'
    ).all()
    serializer_class = GeneratedDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['doc_title', 'doc_type', 'case__case_no', 'client__client_name']
    filterset_fields = ['doc_type', 'status', 'template', 'case', 'client', 'is_final', 'shared_to_client']
    ordering_fields = ['created_at', 'version']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in ['admin', 'partner']:
            qs = qs.filter(
                Q(created_by=user) | Q(case__lead_lawyer=user) | Q(case__assistant=user) |
                Q(case__lawyers=user)
            ).distinct()
        return qs

    @action(detail=True, methods=['post'])
    def new_version(self, request, pk=None):
        parent = self.get_object()
        content = request.data.get('content', parent.content)
        doc = GeneratedDocument.objects.create(
            template=parent.template,
            doc_title=parent.doc_title,
            doc_type=parent.doc_type,
            case=parent.case,
            client=parent.client,
            content=content,
            html_content=request.data.get('html_content', parent.html_content),
            filled_data=parent.filled_data,
            status='generated',
            version=parent.version + 1,
            parent_doc=parent,
            created_by=request.user,
        )
        return Response({
            'code': 200,
            'message': '新版本创建成功',
            'data': GeneratedDocumentSerializer(doc, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        doc = self.get_object()
        is_approved = request.data.get('approved', True)
        note = request.data.get('note', '')
        doc.status = 'approved' if is_approved else 'generated'
        doc.reviewed_by = request.user
        doc.reviewed_at = timezone.now()
        doc.review_note = note
        doc.save()
        return Response({
            'code': 200,
            'message': '审核完成',
            'data': GeneratedDocumentSerializer(doc, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def share_to_client(self, request, pk=None):
        doc = self.get_object()
        doc.shared_to_client = True
        doc.sent_to_email = request.data.get('email', doc.client.email if doc.client else '')
        doc.sent_at = timezone.now()
        doc.save()
        return Response({
            'code': 200,
            'message': '已共享给客户',
            'data': None
        })

    @action(detail=True, methods=['post'])
    def mark_final(self, request, pk=None):
        doc = self.get_object()
        doc.is_final = True
        doc.status = 'archived'
        doc.save()
        return Response({
            'code': 200,
            'message': '已标记为终稿',
            'data': GeneratedDocumentSerializer(doc, context={'request': request}).data
        })
