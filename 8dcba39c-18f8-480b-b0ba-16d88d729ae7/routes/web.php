<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'name' => 'SaaS Ticket Management System',
        'version' => '1.0.0',
        'api_version' => 'v1',
        'status' => 'online',
        'docs' => '/api/documentation',
        'health' => '/health',
    ]);
});

Route::get('/health', function () {
    $status = 'ok';
    $services = [];

    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        $services['database'] = 'ok';
    } catch (\Throwable $e) {
        $services['database'] = 'error: ' . $e->getMessage();
        $status = 'degraded';
    }

    try {
        \Illuminate\Support\Facades\Redis::ping();
        $services['redis'] = 'ok';
    } catch (\Throwable $e) {
        $services['redis'] = 'error: ' . $e->getMessage();
        $status = 'degraded';
    }

    return response()->json([
        'status' => $status,
        'timestamp' => now()->toISOString(),
        'services' => $services,
    ], $status === 'ok' ? 200 : 503);
});
