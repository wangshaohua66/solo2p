<?php

return [

    'default' => env('QUEUE_CONNECTION', 'redis'),

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => 90,
            'block_for' => null,
            'after_commit' => false,
        ],

    ],

    'failed' => [
        'driver' => 'database',
        'database' => env('DB_CONNECTION', 'pgsql'),
        'table' => 'failed_jobs',
    ],

    'queues' => [
        'default' => 'default',
        'matching' => 'matching',
        'settlement' => 'settlement',
        'notification' => 'notification',
        'audit' => 'audit',
    ],

];
