from rest_framework import serializers
from .models import WorkLog, Invoice, Settlement
from apps.users.serializers import UserSimpleSerializer


class WorkLogSerializer(serializers.ModelSerializer):
    work_type_display = serializers.CharField(source='get_work_type_display', read_only=True)
    billable_status_display = serializers.CharField(source='get_billable_status_display', read_only=True)
    approval_status_display = serializers.CharField(source='get_approval_status_display', read_only=True)
    worker_info = UserSimpleSerializer(source='worker', read_only=True)
    case_info = serializers.SerializerMethodField()
    client_info = serializers.SerializerMethodField()
    contract_info = serializers.SerializerMethodField()
    approved_by_info = UserSimpleSerializer(source='approved_by', read_only=True)
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)
    participants_info = UserSimpleSerializer(source='participants', many=True, read_only=True)

    class Meta:
        model = WorkLog
        fields = '__all__'
        read_only_fields = ['id', 'duration', 'overtime_duration', 'weekend_duration', 'holiday_duration',
                            'billable_amount', 'actual_amount', 'created_at', 'updated_at', 'created_by']

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

    def get_contract_info(self, obj):
        if obj.contract:
            return {
                'id': obj.contract.id,
                'contract_no': obj.contract.contract_no,
                'contract_name': obj.contract.contract_name,
            }
        return None

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        participants = validated_data.pop('participants', [])
        log = WorkLog.objects.create(**validated_data)
        if participants:
            log.participants.set(participants)
        return log

    def update(self, instance, validated_data):
        participants = validated_data.pop('participants', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if participants is not None:
            instance.participants.set(participants)
        return instance


class WorkLogSummarySerializer(serializers.Serializer):
    worker_id = serializers.IntegerField()
    worker_name = serializers.CharField()
    total_hours = serializers.DecimalField(max_digits=12, decimal_places=2)
    billable_hours = serializers.DecimalField(max_digits=12, decimal_places=2)
    overtime_hours = serializers.DecimalField(max_digits=12, decimal_places=2)
    billable_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    actual_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    log_count = serializers.IntegerField()
    by_type = serializers.ListField(child=serializers.DictField())


class InvoiceSerializer(serializers.ModelSerializer):
    invoice_type_display = serializers.CharField(source='get_invoice_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_method_display = serializers.CharField(source='get_delivery_method_display', read_only=True)
    client_info = serializers.SerializerMethodField()
    related_case_info = serializers.SerializerMethodField()
    related_contract_info = serializers.SerializerMethodField()
    settlement_info = serializers.SerializerMethodField()
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['id', 'invoice_no', 'issue_date', 'subtotal', 'tax_amount', 'total_amount',
                            'created_at', 'updated_at', 'created_by']

    def get_client_info(self, obj):
        if obj.client:
            return {
                'id': obj.client.id,
                'client_no': obj.client.client_no,
                'client_name': obj.client.client_name,
            }
        return None

    def get_related_case_info(self, obj):
        if obj.related_case:
            return {
                'id': obj.related_case.id,
                'case_no': obj.related_case.case_no,
                'case_name': obj.related_case.case_name,
            }
        return None

    def get_related_contract_info(self, obj):
        if obj.related_contract:
            return {
                'id': obj.related_contract.id,
                'contract_no': obj.related_contract.contract_no,
                'contract_name': obj.related_contract.contract_name,
            }
        return None

    def get_settlement_info(self, obj):
        if obj.settlement:
            return {
                'id': obj.settlement.id,
                'settlement_no': obj.settlement.settlement_no,
                'settlement_amount': float(obj.settlement.settlement_amount),
            }
        return None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        items = validated_data.get('items', [])
        subtotal = sum(float(item.get('amount', 0)) for item in items)
        tax_rate = float(validated_data.get('tax_rate', 6))
        validated_data['subtotal'] = subtotal
        validated_data['tax_amount'] = round(subtotal * tax_rate / 100, 2)
        validated_data['total_amount'] = round(subtotal + validated_data['tax_amount'], 2)
        return super().create(validated_data)


class SettlementSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approval_status_display = serializers.CharField(source='get_approval_status_display', read_only=True)
    client_info = serializers.SerializerMethodField()
    case_info = serializers.SerializerMethodField()
    contract_info = serializers.SerializerMethodField()
    approved_by_info = UserSimpleSerializer(source='approved_by', read_only=True)
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Settlement
        fields = '__all__'
        read_only_fields = ['id', 'settlement_no', 'total_hours', 'service_fee', 'travel_expenses',
                            'other_expenses', 'subtotal', 'settlement_amount', 'tax_amount',
                            'total_amount', 'unpaid_amount', 'created_at', 'updated_at', 'created_by', 'approved_at']

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

    def get_contract_info(self, obj):
        if obj.contract:
            return {
                'id': obj.contract.id,
                'contract_no': obj.contract.contract_no,
                'contract_name': obj.contract.contract_name,
                'billing_type': obj.contract.payment_type,
            }
        return None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        discount = float(validated_data.get('discount_amount', 0))
        tax_rate = float(validated_data.get('tax_rate', 6))
        work_log_ids = self.initial_data.get('work_log_ids', [])
        if work_log_ids:
            from .models import WorkLog
            logs = WorkLog.objects.filter(id__in=work_log_ids)
            total_hours = sum(float(log.duration) for log in logs)
            service_fee = sum(float(log.actual_amount) for log in logs)
            travel_expenses = sum(float(log.travel_expense) for log in logs)
            other_expenses = sum(float(log.other_expense) for log in logs)
            validated_data['total_hours'] = total_hours
            validated_data['service_fee'] = service_fee
            validated_data['travel_expenses'] = travel_expenses
            validated_data['other_expenses'] = other_expenses
            subtotal = service_fee + travel_expenses + other_expenses
            validated_data['subtotal'] = subtotal
            settlement_amount = max(0, subtotal - discount)
            validated_data['settlement_amount'] = settlement_amount
            validated_data['tax_amount'] = round(settlement_amount * tax_rate / 100, 2)
            validated_data['total_amount'] = round(settlement_amount + validated_data['tax_amount'], 2)
            settlement = super().create(validated_data)
            settlement.work_logs.set(work_log_ids)
            return settlement
        return super().create(validated_data)


class SettlementStatsSerializer(serializers.Serializer):
    month = serializers.CharField()
    count = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    unpaid_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
