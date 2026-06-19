from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'recipient', 'category', 'level', 'channel', 'status', 'created_at', 'read_at']
    list_filter = ['category', 'level', 'channel', 'status']
    search_fields = ['title', 'content', 'recipient__username']
    readonly_fields = ['created_at', 'sent_at', 'read_at']
