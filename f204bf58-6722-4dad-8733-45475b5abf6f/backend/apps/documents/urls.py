from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentTemplateViewSet, GeneratedDocumentViewSet

router = DefaultRouter()
router.register(r'templates', DocumentTemplateViewSet, basename='document-template')
router.register(r'generated', GeneratedDocumentViewSet, basename='generated-document')

urlpatterns = [
    path('', include(router.urls)),
]
