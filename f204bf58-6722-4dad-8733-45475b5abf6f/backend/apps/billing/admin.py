from django.contrib import admin
from apps.billing.models import WorkLog, Settlement, Invoice

@admin.register(WorkLog)
class WorkLogAdmin(admin.ModelAdmin):
    list_display = ('work_date', 'worker', 'work_type', 'duration', 'actual_amount', 'approval_status')
    list_filter = ('work_type', 'approval_status', 'work_date')
    search_fields = ('worker__full_name', 'work_content', 'case__case_name')
    date_hierarchy = 'work_date'
    readonly_fields = ('actual_amount',)

@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ('settlement_no', 'case', 'client', 'settlement_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at', 'due_date')
    search_fields = ('settlement_no', 'case__case_name', 'case__case_no')
    readonly_fields = ('settlement_no', 'total_amount', 'tax_amount')

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_no', 'invoice_type', 'buyer_name', 'total_amount', 'status', 'issue_date')
    list_filter = ('invoice_type', 'status', 'issue_date')
    search_fields = ('invoice_no', 'buyer_name', 'buyer_tax_no')
