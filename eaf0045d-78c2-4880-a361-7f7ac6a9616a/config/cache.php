<?php

return [

    'default' => env('CACHE_DRIVER', 'redis'),

    'stores' => [

        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'cache',
            'lock_connection' => 'default',
        ],

    ],

    'prefix' => env('CACHE_PREFIX', 'cache_'),

    'ttl' => [
        'certificate_balance' => 3600,
        'market_depth' => 60,
        'quarterly_report' => 3600,
    ],

];
