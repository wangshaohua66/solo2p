from rest_framework import serializers
from django.db import transaction
from datetime import datetime
from .models import (
    Case, Party, CaseProgress, Trial, Evidence, EvidenceFlow, EvidenceAlert
)
from apps.users.serializers import UserSimpleSerializer
from apps.users.models import User


class PartySerializer(serializers.ModelSerializer):
    party_type_display = serializers.CharField(source='get_party_type_display', read_only=True)

    class Meta:
        model = Party
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class CaseProgressSerializer(serializers.ModelSerializer):
    from_status_display = serializers.CharField(source='get_from_status_display', read_only=True, default='')
    to_status_display = serializers.CharField(source='get_to_status_display', read_only=True)
    operation_type_display = serializers.CharField(source='get_operation_type_display', read_only=True)
    operator_info = UserSimpleSerializer(source='operator', read_only=True)
    approved_by_info = UserSimpleSerializer(source='approved_by', read_only=True)

    class Meta:
        model = CaseProgress
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'operator']

    def create(self, validated_data):
        validated_data['operator'] = self.context['request'].user
        return super().create(validated_data)


class TrialSerializer(serializers.ModelSerializer):
    trial_type_display = serializers.CharField(source='get_trial_type_display', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)
    presiding_lawyer_info = UserSimpleSerializer(source='presiding_lawyer', read_only=True)
    attending_lawyers_info = UserSimpleSerializer(source='attending_lawyers', many=True, read_only=True)
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)
    case_info = serializers.SerializerMethodField()

    class Meta:
        model = Trial
        fields = '__all__'
        read_only_fields = ['id', 'trial_no', 'has_conflict', 'conflict_info', 'created_at', 'updated_at', 'created_by']

    def get_case_info(self, obj):
        if obj.case:
            return {
                'id': obj.case.id,
                'case_no': obj.case.case_no,
                'case_name': obj.case.case_name,
                'case_type': obj.case.case_type,
            }
        return None

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        attending = validated_data.pop('attending_lawyers', [])
        trial = Trial.objects.create(**validated_data)
        if attending:
            trial.attending_lawyers.set(attending)
        return trial

    def update(self, instance, validated_data):
        attending = validated_data.pop('attending_lawyers', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if attending is not None:
            instance.attending_lawyers.set(attending)
        return instance


class EvidenceFlowSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    operator_info = UserSimpleSerializer(source='operator', read_only=True)
    from_person_info = UserSimpleSerializer(source='from_person', read_only=True)
    to_person_info = UserSimpleSerializer(source='to_person', read_only=True)

    class Meta:
        model = EvidenceFlow
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'operator']

    def create(self, validated_data):
        validated_data['operator'] = self.context['request'].user
        return super().create(validated_data)


class EvidenceAlertSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    handled_by_info = UserSimpleSerializer(source='handled_by', read_only=True)

    class Meta:
        model = EvidenceAlert
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class EvidenceSerializer(serializers.ModelSerializer):
    evidence_type_display = serializers.CharField(source='get_evidence_type_display', read_only=True)
    storage_status_display = serializers.CharField(source='get_storage_status_display', read_only=True)
    uploaded_by_info = UserSimpleSerializer(source='uploaded_by', read_only=True)
    borrower_info = UserSimpleSerializer(source='borrower', read_only=True)
    flow_logs = EvidenceFlowSerializer(many=True, read_only=True)
    alerts = EvidenceAlertSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Evidence
        fields = '__all__'
        read_only_fields = ['id', 'evidence_no', 'version', 'created_at', 'updated_at', 'uploaded_by']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        return super().create(validated_data)


class CaseListSerializer(serializers.ModelSerializer):
    case_type_display = serializers.CharField(source='get_case_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    billing_type_display = serializers.CharField(source='get_billing_type_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    lead_lawyer_info = UserSimpleSerializer(source='lead_lawyer', read_only=True)
    assistant_info = UserSimpleSerializer(source='assistant', read_only=True)
    client_info = serializers.SerializerMethodField()
    limit_warning_level = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()
    trial_count = serializers.IntegerField(read_only=True, default=0)
    evidence_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Case
        fields = [
            'id', 'case_no', 'case_name', 'case_type', 'case_type_display',
            'case_subtype', 'cause', 'status', 'status_display',
            'billing_type', 'billing_type_display', 'amount', 'fee_agreed',
            'accept_date', 'limit_date', 'filing_date', 'close_date',
            'lead_lawyer', 'lead_lawyer_info', 'assistant', 'assistant_info',
            'client_info', 'risk_level', 'risk_level_display',
            'priority', 'priority_display', 'limit_warning_level',
            'days_left', 'conflict_checked', 'trial_count', 'evidence_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'case_no', 'created_at', 'updated_at']

    def get_client_info(self, obj):
        if obj.client:
            return {
                'id': obj.client.id,
                'client_no': obj.client.client_no,
                'client_name': obj.client.client_name,
                'client_type': obj.client.client_type,
            }
        return None

    def get_limit_warning_level(self, obj):
        return obj.get_limit_warning_level()

    def get_days_left(self, obj):
        return obj.get_days_left()


class CaseDetailSerializer(serializers.ModelSerializer):
    case_type_display = serializers.CharField(source='get_case_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    billing_type_display = serializers.CharField(source='get_billing_type_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    lead_lawyer_info = UserSimpleSerializer(source='lead_lawyer', read_only=True)
    assistant_info = UserSimpleSerializer(source='assistant', read_only=True)
    lawyers_info = UserSimpleSerializer(source='lawyers', many=True, read_only=True)
    client_info = serializers.SerializerMethodField()
    parties = PartySerializer(many=True, read_only=True)
    progress_logs = CaseProgressSerializer(many=True, read_only=True)
    trials = TrialSerializer(many=True, read_only=True)
    evidences = EvidenceSerializer(many=True, read_only=True)
    limit_warning_level = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)

    class Meta:
        model = Case
        fields = '__all__'
        read_only_fields = ['id', 'case_no', 'created_at', 'updated_at', 'created_by']

    def get_client_info(self, obj):
        if obj.client:
            return {
                'id': obj.client.id,
                'client_no': obj.client.client_no,
                'client_name': obj.client.client_name,
                'client_type': obj.client.client_type,
                'phone': obj.client.phone,
                'email': obj.client.email,
                'contact_person': obj.client.contact_person,
            }
        return None

    def get_limit_warning_level(self, obj):
        return obj.get_limit_warning_level()

    def get_days_left(self, obj):
        return obj.get_days_left()


class CaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = '__all__'
        read_only_fields = ['id', 'case_no', 'created_at', 'updated_at', 'created_by']

    @transaction.atomic
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        parties_data = self.initial_data.get('parties', [])
        case = Case.objects.create(**validated_data)
        for party_data in parties_data:
            party_data.pop('id', None)
            Party.objects.create(case=case, **party_data)
        CaseProgress.objects.create(
            case=case,
            to_status=case.status,
            operator=self.context['request'].user,
            operation_type='update',
            description=f'案件创建，初始状态：{case.get_status_display()}'
        )
        return case

    @transaction.atomic
    def update(self, instance, validated_data):
        old_status = instance.status
        new_status = validated_data.get('status', old_status)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if old_status != new_status:
            CaseProgress.objects.create(
                case=instance,
                from_status=old_status,
                to_status=new_status,
                operator=self.context['request'].user,
                operation_type='update',
                description=f'状态变更：{instance.get_from_status_display(old_status)} → {instance.get_status_display()}'
            )
        return instance


class TrialConflictCheckSerializer(serializers.Serializer):
    presiding_lawyer = serializers.IntegerField(required=True)
    start_time = serializers.DateTimeField(required=True)
    end_time = serializers.DateTimeField(required=False)
    exclude_trial_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        if not attrs.get('end_time'):
            attrs['end_time'] = attrs['start_time']
        return attrs


class EvidenceBorrowSerializer(serializers.Serializer):
    borrower = serializers.IntegerField(required=True)
    expected_return_at = serializers.DateTimeField(required=False)
    remark = serializers.CharField(required=False, default='')


class EvidenceReturnSerializer(serializers.Serializer):
    remark = serializers.CharField(required=False, default='')


class CaseStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    by_type = serializers.ListField(child=serializers.DictField())
    by_status = serializers.ListField(child=serializers.DictField())
    by_month = serializers.ListField(child=serializers.DictField())
    warning_cases = serializers.ListField(child=serializers.DictField())
    urgent_warning = serializers.IntegerField()
