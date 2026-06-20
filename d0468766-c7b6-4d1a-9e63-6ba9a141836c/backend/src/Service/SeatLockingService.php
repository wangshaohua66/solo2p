<?php

namespace App\Service;

use Ratchet\ConnectionInterface;
use Ratchet\MessageComponentInterface;

class SeatLockingService implements MessageComponentInterface
{
    public const LOCK_TTL_MS = 300000;

    private \SplObjectStorage $clients;
    private array $scheduleSubscribers = [];
    private array $lockedSeats = [];

    public function __construct()
    {
        $this->clients = new \SplObjectStorage();
    }

    public function onOpen(ConnectionInterface $conn): void
    {
        $this->clients->attach($conn);
        $query = $conn->httpRequest->getUri()->getQuery();
        parse_str($query, $params);
        $scheduleId = $params['scheduleId'] ?? '';
        $userId = $params['uid'] ?? '';
        $conn->scheduleId = $scheduleId;
        $conn->userId = $userId;

        if (!isset($this->scheduleSubscribers[$scheduleId])) {
            $this->scheduleSubscribers[$scheduleId] = [];
        }
        $this->scheduleSubscribers[$scheduleId][$conn->resourceId] = $conn;

        $conn->send(json_encode([
            'type' => 'welcome',
            'payload' => [
                'scheduleId' => $scheduleId,
                'userId' => $userId,
                'connectedAt' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            ],
        ]));

        if (isset($this->lockedSeats[$scheduleId])) {
            foreach ($this->lockedSeats[$scheduleId] as $seatId => $info) {
                if ($info['expiresAt'] > time() * 1000) {
                    $conn->send(json_encode([
                        'type' => 'seat.locked',
                        'payload' => $info,
                    ]));
                }
            }
        }

        echo "[SeatSocket] Client {$conn->resourceId} connected to schedule {$scheduleId} (uid: {$userId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg): void
    {
        $data = json_decode($msg, true);
        $type = $data['type'] ?? '';
        $payload = $data['payload'] ?? [];
        $scheduleId = $from->scheduleId;

        echo "[SeatSocket] Message from {$from->resourceId}: type={$type}\n";

        switch ($type) {
            case 'ping':
                $from->send(json_encode(['type' => 'pong', 'payload' => ['t' => $data['payload']['t'] ?? 0]]));
                break;

            case 'subscribe':
                $newScheduleId = $payload['scheduleId'] ?? '';
                if ($newScheduleId && $newScheduleId !== $scheduleId) {
                    unset($this->scheduleSubscribers[$scheduleId][$from->resourceId]);
                    $scheduleId = $newScheduleId;
                    $from->scheduleId = $scheduleId;
                    if (!isset($this->scheduleSubscribers[$scheduleId])) {
                        $this->scheduleSubscribers[$scheduleId] = [];
                    }
                    $this->scheduleSubscribers[$scheduleId][$from->resourceId] = $from;
                }
                break;

            case 'seat.lock':
                $this->handleSeatLock($from, $payload, $scheduleId);
                break;

            case 'seat.unlock':
                $this->handleSeatUnlock($from, $payload, $scheduleId);
                break;

            case 'seat.confirm':
                $this->handleSeatConfirm($from, $payload, $scheduleId);
                break;
        }
    }

    private function handleSeatLock(ConnectionInterface $from, array $payload, string $scheduleId): void
    {
        $seatId = $payload['seatId'] ?? '';
        $userId = $payload['userId'] ?? $from->userId;
        $ttl = $payload['ttl'] ?? self::LOCK_TTL_MS;

        if (isset($this->lockedSeats[$scheduleId][$seatId])) {
            $lock = $this->lockedSeats[$scheduleId][$seatId];
            if ($lock['expiresAt'] > time() * 1000 && $lock['userId'] !== $userId) {
                $from->send(json_encode([
                    'type' => 'lock.result',
                    'payload' => [
                        'success' => false,
                        'seatId' => $seatId,
                        'reason' => '座位已被其他用户锁定',
                    ],
                ]));
                return;
            }
        }

        $lock = [
            'scheduleId' => $scheduleId,
            'row' => $payload['row'] ?? 0,
            'col' => $payload['col'] ?? 0,
            'seatId' => $seatId,
            'userId' => $userId,
            'userName' => $payload['userName'] ?? '',
            'lockedAt' => time() * 1000,
            'expiresAt' => time() * 1000 + $ttl,
            'status' => 'locked',
        ];

        if (!isset($this->lockedSeats[$scheduleId])) {
            $this->lockedSeats[$scheduleId] = [];
        }
        $this->lockedSeats[$scheduleId][$seatId] = $lock;

        $from->send(json_encode([
            'type' => 'lock.result',
            'payload' => ['success' => true, 'seatId' => $seatId, 'expiresAt' => $lock['expiresAt']],
        ]));

        $this->broadcastToSchedule($scheduleId, [
            'type' => 'seat.locked',
            'payload' => $lock,
        ], $from->resourceId);
    }

    private function handleSeatUnlock(ConnectionInterface $from, array $payload, string $scheduleId): void
    {
        $seatId = $payload['seatId'] ?? '';
        $userId = $payload['userId'] ?? $from->userId;

        if (isset($this->lockedSeats[$scheduleId][$seatId])) {
            $lock = $this->lockedSeats[$scheduleId][$seatId];
            if ($lock['userId'] === $userId) {
                $lock['status'] = 'released';
                unset($this->lockedSeats[$scheduleId][$seatId]);
                $this->broadcastToSchedule($scheduleId, [
                    'type' => 'seat.unlocked',
                    'payload' => $lock,
                ]);
            }
        }
    }

    private function handleSeatConfirm(ConnectionInterface $from, array $payload, string $scheduleId): void
    {
        $seatId = $payload['seatId'] ?? '';
        $userId = $payload['userId'] ?? $from->userId;

        if (isset($this->lockedSeats[$scheduleId][$seatId])) {
            $lock = $this->lockedSeats[$scheduleId][$seatId];
            if ($lock['userId'] === $userId) {
                $lock['status'] = 'sold';
                $lock['orderId'] = $payload['orderId'] ?? '';
                $this->lockedSeats[$scheduleId][$seatId] = $lock;
                $this->broadcastToSchedule($scheduleId, [
                    'type' => 'seat.sold',
                    'payload' => $lock,
                ]);
            }
        }
    }

    private function broadcastToSchedule(string $scheduleId, array $message, ?int $excludeResourceId = null): void
    {
        $subscribers = $this->scheduleSubscribers[$scheduleId] ?? [];
        foreach ($subscribers as $resourceId => $conn) {
            if ($excludeResourceId !== null && (int)$resourceId === (int)$excludeResourceId) {
                continue;
            }
            try {
                $conn->send(json_encode($message));
            } catch (\Exception) {
                // skip dead connections
            }
        }
    }

    public function onClose(ConnectionInterface $conn): void
    {
        $scheduleId = $conn->scheduleId ?? '';
        unset($this->scheduleSubscribers[$scheduleId][$conn->resourceId]);
        if (isset($this->scheduleSubscribers[$scheduleId]) && count($this->scheduleSubscribers[$scheduleId]) === 0) {
            unset($this->scheduleSubscribers[$scheduleId]);
        }
        $this->clients->detach($conn);
        echo "[SeatSocket] Client {$conn->resourceId} disconnected\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        echo "[SeatSocket] Error on client {$conn->resourceId}: {$e->getMessage()}\n";
        try {
            $conn->close();
        } catch (\Exception) {
        }
    }
}
