<?php

use Illuminate\Support\Str;

return [

    'domain' => env('HORIZON_DOMAIN'),

    'path' => env('HORIZON_PATH', 'horizon'),

    'use' => 'default',

    'middleware' => [
        'web',
    ],

    'prefix' => env('HORIZON_PREFIX', 'horizon:'),

    'waits' => [
        'redis:high' => 5,
        'redis:default' => 60,
        'redis:low' => 180,
        'redis:sla' => 30,
        'redis:stats' => 120,
        'redis:workflow' => 60,
        'redis:email' => 120,
        'redis:sms' => 120,
        'redis:webhook' => 180,
    ],

    'trim' => [
        'recent' => 60,
        'pending' => 60,
        'completed' => 24 * 60,
        'recent_failed' => 10080,
        'failed' => 10080,
        'monitored' => 10080,
    ],

    'silenced' => [
    ],

    'metrics' => [
        'trim_snapshots' => [
            'job' => 24 * 60,
            'queue' => 24 * 60,
        ],
    ],

    'fast_termination' => false,

    'memory_limit' => 256,

    'defaults' => [
        'high-priority' => [
            'connection' => 'redis',
            'queue' => ['high'],
            'balance' => 'auto',
            'autoScalingStrategy' => 'time',
            'maxProcesses' => 8,
            'maxTime' => 0,
            'maxJobs' => 0,
            'memory' => 128,
            'tries' => 3,
            'timeout' => 60,
            'nice' => 0,
        ],
        'ticket-processing' => [
            'connection' => 'redis',
            'queue' => ['default', 'workflow', 'sla'],
            'balance' => 'auto',
            'autoScalingStrategy' => 'size',
            'maxProcesses' => 16,
            'maxTime' => 0,
            'maxJobs' => 1000,
            'memory' => 128,
            'tries' => 3,
            'timeout' => 120,
            'nice' => 0,
        ],
        'notifications' => [
            'connection' => 'redis',
            'queue' => ['email', 'sms', 'webhook'],
            'balance' => 'auto',
            'autoScalingStrategy' => 'time',
            'maxProcesses' => 8,
            'maxTime' => 0,
            'maxJobs' => 0,
            'memory' => 128,
            'tries' => 5,
            'timeout' => 180,
            'nice' => 0,
        ],
        'analytics' => [
            'connection' => 'redis',
            'queue' => ['stats', 'low'],
            'balance' => 'simple',
            'processes' => 4,
            'tries' => 2,
            'timeout' => 900,
            'nice' => 5,
        ],
    ],

    'environments' => [
        'production' => [
            'high-priority' => [
                'maxProcesses' => 20,
            ],
            'ticket-processing' => [
                'minProcesses' => 8,
                'maxProcesses' => 64,
            ],
            'notifications' => [
                'minProcesses' => 4,
                'maxProcesses' => 32,
            ],
            'analytics' => [
                'minProcesses' => 2,
                'processes' => 8,
            ],
        ],

        'local' => [
            'high-priority' => [
                'maxProcesses' => 3,
            ],
            'ticket-processing' => [
                'minProcesses' => 1,
                'maxProcesses' => 8,
            ],
            'notifications' => [
                'maxProcesses' => 3,
            ],
            'analytics' => [
                'processes' => 2,
            ],
        ],
    ],
];
