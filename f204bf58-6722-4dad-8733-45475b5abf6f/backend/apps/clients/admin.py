from django.contrib import admin
from .models import Client, Contract, PaymentPlan

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['client_no', 'client_name', 'client_type', 'vip_level', 'phone', 'account_manager', 'total_case_count']
    list_filter = ['client_type', 'vip_level', 'is_active', 'portal_enabled']
    search_fields = ['client_no', 'client_name', 'phone', 'email', 'contact_person']

@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ['contract_no', 'contract_name', 'client', 'contract_type', 'total_amount', 'status', 'effective_date', 'expire_date']
    list_filter = ['contract_type', 'status', 'payment_type', 'approval_status']
    search_fields = ['contract_no', 'contract_name', 'client__client_name']

@admin.register(PaymentPlan)
class PaymentPlanAdmin(admin.ModelAdmin):
    list_display = ['contract', 'installment_no', 'due_date', 'amount', 'actual_amount', 'status']
    list_filter = ['status']
