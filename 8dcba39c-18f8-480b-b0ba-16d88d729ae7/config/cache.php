<?php

use Illuminate\Support\Str;

return [

    'default' => env('CACHE_STORE', 'redis'),

    'stores' => [

        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        'file' => [
            'driver' => 'file',
            'path' => storage_path('framework/cache/data'),
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'cache',
            'lock_connection' => 'default',
        ],

        'database' => [
            'driver' => 'database',
            'table' => 'cache',
            'connection' => null,
            'lock_connection' => null,
        ],

    ],

    'prefix' => env('CACHE_PREFIX', 'cache_'),

    'ttl' => [
        'tenant_config' => 3600,
        'ticket_detail' => 300,
        'ticket_list' => 60,
        'stats_daily' => 300,
        'stats_realtime' => 10,
        'workflow_config' => 600,
        'user_permissions' => 1800,
        'sla_policy' => 600,
    ],

];
