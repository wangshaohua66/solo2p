<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'health'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [env('FRONTEND_URL', '*')],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-Request-ID',
    ],
    'max_age' => 86400,
    'supports_credentials' => false,
];
