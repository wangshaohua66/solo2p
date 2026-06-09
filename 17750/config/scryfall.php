<?php

return [
    'api_base' => env('SCRYFALL_API_BASE', 'https://api.scryfall.com'),
    'api_key' => env('SCRYFALL_API_KEY'),
    'rate_limit' => env('SCRYFALL_RATE_LIMIT', 10),
    'sync_chunk_size' => env('SCRYFALL_SYNC_CHUNK_SIZE', 1000),
    'timeout' => env('SCRYFALL_TIMEOUT', 30),

    'endpoints' => [
        'bulk_data' => '/bulk-data',
        'cards_search' => '/cards/search',
        'cards_collection' => '/cards/collection',
        'sets' => '/sets',
        'symbology' => '/symbology',
    ],

    'sync' => [
        'enabled' => env('SCRYFALL_SYNC_ENABLED', true),
        'default_set_type' => ['expansion', 'core', 'masterpiece', 'draft_innovation'],
        'languages' => ['en', 'zh-CN', 'ja', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ko'],
        'image_sizes' => ['small', 'normal', 'large'],
    ],

    'price' => [
        'currencies' => ['usd', 'eur', 'tix'],
        'update_frequency' => 'daily',
    ],
];
