from rest_framework import serializers
from .models import Client, Contract, PaymentPlan
from apps.users.serializers import UserSimpleSerializer


class ClientSerializer(serializers.ModelSerializer):
    client_type_display = serializers.CharField(source='get_client_type_display', read_only=True)
    vip_level_display = serializers.CharField(source='get_vip_level_display', read_only=True)
    account_manager_info = UserSimpleSerializer(source='account_manager', read_only=True)
    intro_by_info = serializers.SerializerMethodField()
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['id', 'client_no', 'total_case_count', 'total_fee_amount',
                            'unpaid_amount', 'created_at', 'updated_at', 'created_by', 'portal_last_login']

    def get_intro_by_info(self, obj):
        if obj.intro_by:
            return {'id': obj.intro_by.id, 'client_name': obj.intro_by.client_name}
        return None

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class PaymentPlanSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = PaymentPlan
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class ContractSerializer(serializers.ModelSerializer):
    contract_type_display = serializers.CharField(source='get_contract_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_type_display = serializers.CharField(source='get_payment_type_display', read_only=True)
    approval_status_display = serializers.CharField(source='get_approval_status_display', read_only=True)
    client_info = serializers.SerializerMethodField()
    case_info = serializers.SerializerMethodField()
    firm_signer_info = UserSimpleSerializer(source='firm_signer', read_only=True)
    approved_by_info = UserSimpleSerializer(source='approved_by', read_only=True)
    template_used_info = serializers.SerializerMethodField()
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)
    payment_plans = PaymentPlanSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = '__all__'
        read_only_fields = ['id', 'contract_no', 'paid_amount', 'unpaid_amount',
                            'created_at', 'updated_at', 'created_by', 'approved_at']

    def get_client_info(self, obj):
        if obj.client:
            return {
                'id': obj.client.id,
                'client_no': obj.client.client_no,
                'client_name': obj.client.client_name,
                'phone': obj.client.phone,
                'contact_person': obj.client.contact_person,
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

    def get_template_used_info(self, obj):
        if obj.template_used:
            return {
                'id': obj.template_used.id,
                'template_code': obj.template_used.template_code,
                'template_name': obj.template_used.template_name,
            }
        return None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        plans = self.initial_data.get('payment_plans', [])
        contract = Contract.objects.create(**validated_data)
        for plan_data in plans:
            plan_data.pop('id', None)
            plan_data.pop('contract', None)
            PaymentPlan.objects.create(contract=contract, **plan_data)
        return contract

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        plans = self.initial_data.get('payment_plans', None)
        if plans is not None:
            PaymentPlan.objects.filter(contract=instance).delete()
            for plan_data in plans:
                plan_data.pop('id', None)
                PaymentPlan.objects.create(contract=instance, **plan_data)
        return instance
