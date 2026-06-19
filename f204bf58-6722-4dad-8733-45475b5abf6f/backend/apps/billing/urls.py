from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkLogViewSet, InvoiceViewSet, SettlementViewSet

router = DefaultRouter()
router.register(r'work-logs', WorkLogViewSet, basename='work-log')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'settlements', SettlementViewSet, basename='settlement')

urlpatterns = [
    path('', include(router.urls)),
]
