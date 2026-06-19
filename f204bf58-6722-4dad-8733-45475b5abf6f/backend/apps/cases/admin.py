from django.contrib import admin
from .models import Case, Party, CaseProgress, Trial, Evidence, EvidenceFlow, EvidenceAlert

@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ['case_no', 'case_name', 'case_type', 'status', 'lead_lawyer', 'accept_date', 'limit_date']
    list_filter = ['case_type', 'status', 'priority', 'risk_level']
    search_fields = ['case_no', 'case_name', 'cause', 'client__client_name']
    list_select_related = ['lead_lawyer', 'client']

@admin.register(Party)
class PartyAdmin(admin.ModelAdmin):
    list_display = ['case', 'party_type', 'name', 'is_represented', 'phone']
    list_filter = ['party_type', 'is_represented']
    search_fields = ['name', 'phone']

@admin.register(Trial)
class TrialAdmin(admin.ModelAdmin):
    list_display = ['trial_no', 'case', 'trial_type', 'start_time', 'location', 'presiding_lawyer', 'result']
    list_filter = ['trial_type', 'result', 'has_conflict']
    search_fields = ['case__case_no', 'location', 'judge']
    list_select_related = ['case', 'presiding_lawyer']

@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ['evidence_no', 'evidence_name', 'evidence_type', 'storage_status', 'case', 'uploaded_by']
    list_filter = ['evidence_type', 'storage_status', 'is_original']
    search_fields = ['evidence_no', 'evidence_name']

admin.site.register([CaseProgress, EvidenceFlow, EvidenceAlert])
