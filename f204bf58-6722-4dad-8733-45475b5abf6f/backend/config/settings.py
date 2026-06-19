import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-law-firm-secret-key-for-development-only'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'apps.users',
    'apps.cases',
    'apps.clients',
    'apps.documents',
    'apps.billing',
    'apps.notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.cases.middleware.JWTAuthMiddleware',
    'apps.cases.response_wrapper.ResponseWrapperMiddleware',
    'apps.cases.middleware.OperationLogMiddleware',
]

CORS_ORIGIN_ALLOW_ALL = True
CORS_ALLOW_CREDENTIALS = True

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {
            'timeout': 20,
        }
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'users.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

DATA_UPLOAD_MAX_MEMORY_SIZE = 104857600
FILE_UPLOAD_MAX_MEMORY_SIZE = 104857600

import os
ENV = os.environ.get

SMS_CONFIG = {
    'provider': ENV('SMS_PROVIDER', 'aliyun'),
    'enabled': ENV('SMS_ENABLED', 'false').lower() == 'true',
    'aliyun': {
        'access_key_id': ENV('ALIYUN_ACCESS_KEY_ID', ''),
        'access_key_secret': ENV('ALIYUN_ACCESS_KEY_SECRET', ''),
        'sign_name': ENV('ALIYUN_SMS_SIGN_NAME', '精诚律师事务所'),
        'templates': {
            'verification': ENV('ALIYUN_SMS_TPL_VERIFY', 'SMS_123456789'),
            'notification': ENV('ALIYUN_SMS_TPL_NOTIFY', 'SMS_123456790'),
            'trial_reminder': ENV('ALIYUN_SMS_TPL_TRIAL', 'SMS_123456791'),
            'limitation_warning': ENV('ALIYUN_SMS_TPL_LIMITATION', 'SMS_123456792'),
        },
    },
}

OCR_CONFIG = {
    'provider': ENV('OCR_PROVIDER', 'baidu'),
    'enabled': ENV('OCR_ENABLED', 'false').lower() == 'true',
    'baidu': {
        'app_id': ENV('BAIDU_OCR_APP_ID', ''),
        'api_key': ENV('BAIDU_OCR_API_KEY', ''),
        'secret_key': ENV('BAIDU_OCR_SECRET_KEY', ''),
    },
    'default_lang': ENV('OCR_DEFAULT_LANG', 'chinese_english'),
}

PUSH_CONFIG = {
    'provider': ENV('PUSH_PROVIDER', 'jpush'),
    'enabled': ENV('PUSH_ENABLED', 'false').lower() == 'true',
    'jpush': {
        'app_key': ENV('JPUSH_APP_KEY', ''),
        'master_secret': ENV('JPUSH_MASTER_SECRET', ''),
        'production': ENV('JPUSH_PRODUCTION', 'false').lower() == 'true',
    },
}

WATERMARK_CONFIG = {
    'default_text': ENV('WATERMARK_DEFAULT_TEXT', '机密 - {evidence_no} - 仅供本案使用'),
    'default_opacity': float(ENV('WATERMARK_DEFAULT_OPACITY', '0.3')),
    'default_position': ENV('WATERMARK_DEFAULT_POSITION', 'diagonal'),
    'default_font_size': int(ENV('WATERMARK_FONT_SIZE', '36')),
    'default_color': ENV('WATERMARK_COLOR', '#888888'),
}
