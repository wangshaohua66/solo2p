<?php

return [

    'default' => env('QUEUE_CONNECTION', 'redis'),

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'queue',
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => 90,
            'block_for' => 5,
            'after_commit' => false,
        ],

    ],

    'batching' => [
        'database' => env('DB_CONNECTION', 'mysql'),
        'table' => 'job_batches',
    ],

    'failed' => [
        'driver' => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'mysql'),
        'table' => 'failed_jobs',
    ],

    'queues' => [
        'priority_high' => 'high',
        'priority_default' => 'default',
        'priority_low' => 'low',
        'notification_email' => 'email',
        'notification_sms' => 'sms',
        'notification_webhook' => 'webhook',
        'sla_check' => 'sla',
        'stats_aggregate' => 'stats',
        'workflow_process' => 'workflow',
    ],

];
