from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, ContractViewSet, PaymentPlanViewSet

router = DefaultRouter()
router.register(r'', ClientViewSet, basename='client')
router.register(r'(?P<client_pk>\d+)/contracts', ContractViewSet, basename='client-contract')
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'payment-plans', PaymentPlanViewSet, basename='payment-plan')

urlpatterns = [
    path('', include(router.urls)),
]
