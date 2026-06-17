<?php

return [

    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app'),
            'throw' => false,
        ],
        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
        ],
        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
        ],
        'oss' => [
            'driver' => 'oss',
            'access_key' => env('OSS_ACCESS_KEY_ID'),
            'secret_key' => env('OSS_ACCESS_KEY_SECRET'),
            'bucket' => env('OSS_BUCKET'),
            'endpoint' => env('OSS_ENDPOINT'),
            'region' => env('OSS_REGION'),
            'cdn' => env('OSS_CDN_DOMAIN'),
            'security_token' => env('OSS_SECURITY_TOKEN'),
            'use_ssl' => env('OSS_USE_SSL', true),
        ],
        'exports' => [
            'driver' => 'local',
            'root' => storage_path('app/exports'),
            'url' => env('APP_URL').'/storage/exports',
            'visibility' => 'private',
        ],
    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],
];
