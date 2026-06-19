from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CaseViewSet, TrialViewSet, EvidenceViewSet,
    PartyViewSet, CaseProgressViewSet
)

router = DefaultRouter()
router.register(r'trials', TrialViewSet, basename='trial')
router.register(r'evidences', EvidenceViewSet, basename='evidence')
router.register(r'(?P<case_pk>\d+)/parties', PartyViewSet, basename='case-party')
router.register(r'(?P<case_pk>\d+)/progress', CaseProgressViewSet, basename='case-progress')
router.register(r'', CaseViewSet, basename='case')

urlpatterns = [
    path('', include(router.urls)),
]
