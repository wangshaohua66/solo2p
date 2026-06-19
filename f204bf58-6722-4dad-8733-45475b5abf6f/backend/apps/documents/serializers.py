from rest_framework import serializers
from .models import DocumentTemplate, GeneratedDocument
from apps.users.serializers import UserSimpleSerializer
from apps.cases.models import Case
from apps.clients.models import Client


class DocumentTemplateSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    applicable_court_display = serializers.CharField(source='get_applicable_court_display', read_only=True)
    case_type_display = serializers.CharField(source='get_case_type_display', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)
    share_scope_display = serializers.CharField(source='get_share_scope_display', read_only=True)
    owner_info = UserSimpleSerializer(source='owner', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = DocumentTemplate
        fields = '__all__'
        read_only_fields = ['id', 'template_code', 'use_count', 'rating', 'rating_count',
                            'created_at', 'updated_at', 'owner']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)


class GeneratedDocumentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    template_info = serializers.SerializerMethodField()
    case_info = serializers.SerializerMethodField()
    client_info = serializers.SerializerMethodField()
    reviewed_by_info = UserSimpleSerializer(source='reviewed_by', read_only=True)
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)
    parent_doc_info = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedDocument
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by',
                            'reviewed_at', 'signed_at', 'sent_at', 'version']

    def get_template_info(self, obj):
        if obj.template:
            return {
                'id': obj.template.id,
                'template_code': obj.template.template_code,
                'template_name': obj.template.template_name,
            }
        return None

    def get_case_info(self, obj):
        if obj.case:
            return {
                'id': obj.case.id,
                'case_no': obj.case.case_no,
                'case_name': obj.case.case_name,
            }
        return None

    def get_client_info(self, obj):
        if obj.client:
            return {
                'id': obj.client.id,
                'client_no': obj.client.client_no,
                'client_name': obj.client.client_name,
            }
        return None

    def get_parent_doc_info(self, obj):
        if obj.parent_doc:
            return {
                'id': obj.parent_doc.id,
                'doc_title': obj.parent_doc.doc_title,
                'version': obj.parent_doc.version,
            }
        return None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class DocumentGenerateSerializer(serializers.Serializer):
    template_id = serializers.IntegerField(required=True)
    case_id = serializers.IntegerField(required=False)
    client_id = serializers.IntegerField(required=False)
    doc_title = serializers.CharField(required=False, default='')
    custom_fields = serializers.DictField(required=False, default={})

    def validate(self, attrs):
        template = DocumentTemplate.objects.filter(pk=attrs.get('template_id')).first()
        if not template:
            raise serializers.ValidationError('模板不存在')
        attrs['template'] = template
        if attrs.get('case_id'):
            case = Case.objects.filter(pk=attrs['case_id']).first()
            if not case:
                raise serializers.ValidationError('案件不存在')
            attrs['case'] = case
        if attrs.get('client_id'):
            client = Client.objects.filter(pk=attrs['client_id']).first()
            if not client:
                raise serializers.ValidationError('客户不存在')
            attrs['client'] = client
        return attrs


class TemplateUsageSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5, required=False)
