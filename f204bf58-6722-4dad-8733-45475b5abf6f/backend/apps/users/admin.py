from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'get_full_name', 'role', 'department', 'position', 'phone', 'status', 'date_joined']
    list_filter = ['role', 'status', 'department']
    search_fields = ['username', 'first_name', 'last_name', 'phone', 'email', 'license_no']
