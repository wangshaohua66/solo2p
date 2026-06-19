from django.contrib import admin
from apps.documents.models import DocumentTemplate, GeneratedDocument

@admin.register(DocumentTemplate)
class DocumentTemplateAdmin(admin.ModelAdmin):
    list_display = ('template_code', 'template_name', 'category', 'case_type', 'version', 'is_system', 'use_count')
    list_filter = ('category', 'case_type', 'is_system', 'is_published')
    search_fields = ('template_code', 'template_name', 'description')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(GeneratedDocument)
class GeneratedDocumentAdmin(admin.ModelAdmin):
    list_display = ('id', 'doc_title', 'doc_type', 'case', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('doc_title', 'doc_type')
    readonly_fields = ('created_at',)
