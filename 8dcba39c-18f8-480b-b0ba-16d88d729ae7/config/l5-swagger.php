<?php

return [
    'default' => 'default',
    'documentations' => [
        'default' => [
            'api' => [
                'title' => 'SaaS Ticket Management System API',
                'description' => '
## 垂直行业SaaS工单管理与客户服务系统

### 核心能力
- **多租户架构**：支持300+企业客户独立数据空间
- **工单全生命周期**：创建→分配→处理→解决→关闭
- **自动化工作流**：自定义状态机 + 审批节点 + 自动分配
- **SLA监控**：5级优先级策略 + 3级违规告警 + 自动升级
- **智能通知**：邮件/短信/Webhook/站内信四渠道
- **实时统计**：9大报表模块 + 线性趋势预测

### 技术参数
- **QPS**: 单接口平均<200ms，支持500 TPS工单创建
- **认证方式**: OAuth 2.0 Bearer Token / API Key / Basic Auth
- **限流**: API全局 5000次/分钟，工单创建 500次/秒
- **数据隔离**: tenant_id 全局Scope + Redis分层缓存
                ',
                'version' => '1.0.0',
            ],
            'routes' => [
                'api' => 'api/documentation',
                'docs' => storage_path('api-docs'),
                'docs_json' => 'api-docs.json',
                'docs_yaml' => 'api-docs.yaml',
                'format_to_use_for_docs' => env('L5_FORMAT_TO_USE_FOR_DOCS', 'json'),
                'asset' => 'vendor/swagger-api/swagger-ui/dist/',
                'middleware' => [
                    'api',
                ],
            ],
            'paths' => [
                'docs' => storage_path('api-docs'),
                'docs_json' => 'api-docs.json',
                'docs_yaml' => 'api-docs.yaml',
                'annotations' => [
                    base_path('app/Http/Controllers'),
                    base_path('app/Http/Middleware'),
                ],
                'excludes' => [],
                'base' => env('L5_SWAGGER_BASE_PATH', '/api/v1'),
                'views' => base_path('resources/views/vendor/l5-swagger'),
            ],
            'securityDefinitions' => [
                'securitySchemes' => [
                    'OAuth2-Bearer' => [
                        'type' => 'oauth2',
                        'description' => 'OAuth 2.0 Bearer Token认证模式',
                        'name' => 'Authorization',
                        'in' => 'header',
                        'scheme' => 'bearer',
                        'bearerFormat' => 'JWT',
                        'flows' => [
                            'password' => [
                                'authorizationUrl' => '/api/v1/auth/login',
                                'tokenUrl' => '/api/v1/auth/refresh',
                                'scopes' => [
                                    'read' => 'Read access',
                                    'write' => 'Write access',
                                    'admin' => 'Admin access',
                                ],
                            ],
                        ],
                    ],
                    'API-Key' => [
                        'type' => 'apiKey',
                        'description' => 'API Key认证模式，通过X-API-Key请求头传递',
                        'name' => 'X-API-Key',
                        'in' => 'header',
                    ],
                    'Basic-Auth' => [
                        'type' => 'http',
                        'description' => 'HTTP Basic Auth认证 (subdomain+email : password)',
                        'scheme' => 'basic',
                    ],
                ],
                'security' => [
                    ['OAuth2-Bearer' => ['read', 'write']],
                    ['API-Key' => []],
                ],
            ],
            'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', false),
            'generate_yaml_copy' => env('L5_SWAGGER_GENERATE_YAML_COPY', false),
            'proxy' => false,
            'additional_config_url' => null,
            'operations_sort' => env('L5_SWAGGER_OPERATIONS_SORT', null),
            'validator_url' => null,
            'ui' => [
                'display' => [
                    'dark_mode' => env('L5_SWAGGER_UI_DARK_MODE', false),
                    'doc_expansion' => env('L5_SWAGGER_UI_DOC_EXPANSION', 'list'),
                    'filter' => env('L5_SWAGGER_UI_FILTERS', true),
                ],
                'authorization' => [
                    'persist_authorization' => env('L5_SWAGGER_UI_PERSIST_AUTHORIZATION', true),
                ],
            ],
            'constants' => [
                'L5_SWAGGER_CONST_HOST' => env('L5_SWAGGER_CONST_HOST', 'http://localhost/api/v1'),
            ],
        ],
    ],
    'defaults' => [
        'routes' => [
            'api' => 'api/{documentation}/documentation',
            'docs' => storage_path('api-docs/{documentation}'),
            'docs_json' => 'api-docs.json',
            'docs_yaml' => 'api-docs.yaml',
            'format_to_use_for_docs' => env('L5_FORMAT_TO_USE_FOR_DOCS', 'json'),
            'asset' => 'vendor/swagger-api/swagger-ui/dist/',
            'middleware' => [
                'api',
            ],
            'oauth2_callback' => 'api/oauth2-callback',
            'middleware' => [
                'api',
                \App\Http\Middleware\ApiAuthentication::class,
            ],
        ],
        'paths' => [
            'docs' => storage_path('api-docs/{documentation}'),
            'excludes' => [],
            'views' => base_path('resources/views/vendor/l5-swagger'),
            'base' => env('L5_SWAGGER_BASE_PATH', null),
        ],
        'scanOptions' => [
            'analyser' => null,
            'analysis' => null,
            'processors' => [
                new \OpenApi\Processors\OperationId(),
            ],
            'pattern' => '*.php',
            'exclude_pattern' => null,
            'open_api_spec_version' => env('L5_SWAGGER_OPEN_API_SPEC_VERSION', \L5Swagger\Generator::OPEN_API_DEFAULT_SPEC_VERSION),
        ],
        'securityDefinitions' => [
            'securitySchemes' => [],
            'security' => [],
        ],
        'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', false),
        'generate_yaml_copy' => env('L5_SWAGGER_GENERATE_YAML_COPY', false),
        'proxy' => false,
        'additional_config_url' => null,
        'operations_sort' => env('L5_SWAGGER_OPERATIONS_SORT', null),
        'validator_url' => null,
        'ui' => [
            'display' => [
                'dark_mode' => env('L5_SWAGGER_UI_DARK_MODE', false),
                'doc_expansion' => env('L5_SWAGGER_UI_DOC_EXPANSION', 'none'),
                'filter' => env('L5_SWAGGER_UI_FILTERS', true),
            ],
            'authorization' => [
                'persist_authorization' => env('L5_SWAGGER_UI_PERSIST_AUTHORIZATION', false),
                'oauth2' => [
                    'use_pkce_with_authorization_code_grant' => false,
                ],
            ],
        ],
        'constants' => [
            'L5_SWAGGER_CONST_HOST' => env('L5_SWAGGER_CONST_HOST', 'http://my-default-host.com'),
        ],
    ],
];
