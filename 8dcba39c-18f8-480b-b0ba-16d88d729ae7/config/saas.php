<?php

return [

    'root_domain' => env('SAAS_ROOT_DOMAIN', 'saas.localhost'),

    'subdomain_pattern' => '{tenant}.{domain}',

    'default_plan' => env('SAAS_DEFAULT_PLAN', 'standard'),

    'plans' => [
        'trial' => [
            'name' => 'Trial',
            'price_monthly' => 0,
            'price_yearly' => 0,
            'max_agents' => 5,
            'max_tickets' => 1000,
            'max_storage_mb' => 500,
            'features' => ['basic_tickets', 'email_notifications', 'basic_reports'],
            'trial_days' => 14,
        ],
        'starter' => [
            'name' => 'Starter',
            'price_monthly' => 99,
            'price_yearly' => 999,
            'max_agents' => 10,
            'max_tickets' => 50000,
            'max_storage_mb' => 5000,
            'features' => ['all_basic', 'sla_monitoring', 'automation_rules_10', 'api_access'],
        ],
        'standard' => [
            'name' => 'Standard',
            'price_monthly' => 299,
            'price_yearly' => 2999,
            'max_agents' => 30,
            'max_tickets' => 200000,
            'max_storage_mb' => 20000,
            'features' => ['all_starter', 'advanced_workflows', 'custom_roles', 'priority_support'],
        ],
        'enterprise' => [
            'name' => 'Enterprise',
            'price_monthly' => 999,
            'price_yearly' => 9999,
            'max_agents' => 100,
            'max_tickets' => -1,
            'max_storage_mb' => -1,
            'features' => ['all_standard', 'dedicated_instance', 'sso_saml', 'custom_integration', '24_7_support'],
        ],
    ],

    'quotas' => [
        'warnings_threshold_percent' => 80,
        'hard_limit_percent' => 100,
    ],

    'default_roles' => [
        'owner' => ['name' => 'Owner', 'description' => 'Full system access'],
        'admin' => ['name' => 'Administrator', 'description' => 'Administer users and settings'],
        'supervisor' => ['name' => 'Supervisor', 'description' => 'Manage team and reports'],
        'agent' => ['name' => 'Agent', 'description' => 'Handle customer tickets'],
        'customer' => ['name' => 'Customer', 'description' => 'Submit and view tickets'],
    ],

    'default_sla_policies' => [
        ['priority' => 'urgent', 'first_response_minutes' => 15, 'resolution_minutes' => 240],
        ['priority' => 'high', 'first_response_minutes' => 60, 'resolution_minutes' => 480],
        ['priority' => 'medium', 'first_response_minutes' => 240, 'resolution_minutes' => 1440],
        ['priority' => 'low', 'first_response_minutes' => 480, 'resolution_minutes' => 2880],
        ['priority' => 'lowest', 'first_response_minutes' => 1440, 'resolution_minutes' => 10080],
    ],

    'business_hours' => [
        'timezone' => 'Asia/Shanghai',
        'work_start' => '09:00',
        'work_end' => '18:00',
        'work_days' => [1, 2, 3, 4, 5],
    ],

    'ticket_number' => [
        'prefix' => 'TK',
        'padding' => 6,
    ],

    'cache_ttl' => [
        'tenant_config' => 3600,
        'ticket_detail' => 300,
        'ticket_list' => 60,
        'stats_overview' => 300,
        'permissions' => 3600,
        'workflow' => 3600,
    ],

    'notifications' => [
        'retry_attempts' => 5,
        'retry_backoff_minutes' => [1, 2, 4, 8, 16],
        'webhook_timeout_seconds' => 10,
        'webhook_max_failures' => 10,
    ],

    'automation' => [
        'batch_size' => 1000,
        'max_runtime_seconds' => 300,
    ],

    'export' => [
        'max_rows' => 100000,
        'chunk_size' => 1000,
        'temp_directory' => storage_path('app/exports'),
        'expire_hours' => 24,
    ],
];
