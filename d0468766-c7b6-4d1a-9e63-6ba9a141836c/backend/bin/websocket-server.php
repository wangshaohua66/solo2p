#!/usr/bin/env php
<?php

require dirname(__DIR__).'/vendor/autoload.php';

use App\Service\SeatLockingService;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;

$host = getenv('WEBSOCKET_HOST') ?: '0.0.0.0';
$port = (int)(getenv('WEBSOCKET_PORT') ?: 8080);

echo "==========================================\n";
echo "光影院线座位锁定 WebSocket 服务\n";
echo "==========================================\n";
echo "监听地址: ws://{$host}:{$port}\n";
echo "启动时间: " . date('Y-m-d H:i:s') . "\n";
echo "==========================================\n";

try {
    $server = IoServer::factory(
        new HttpServer(
            new WsServer(
                new SeatLockingService()
            )
        ),
        $port,
        $host
    );

    echo "服务已就绪，等待客户端连接...\n\n";
    $server->run();
} catch (\Exception $e) {
    echo "启动失败: {$e->getMessage()}\n";
    exit(1);
}
