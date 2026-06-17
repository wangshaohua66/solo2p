<?php

return [
    'default' => env('BROADCAST_CONNECTION', 'null'),
    'connections' => [
        'redis' => [
            'driver' => 'redis',
            'connection' => 'default',
        ],
        'null' => [
            'driver' => 'null',
        ],
    ],
];
