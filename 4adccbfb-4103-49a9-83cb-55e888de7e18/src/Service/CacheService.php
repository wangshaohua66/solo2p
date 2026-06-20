<?php

namespace App\Service;

use Predis\Client;
use Psr\Log\LoggerInterface;

/**
 * Redis 缓存服务：缓存展位实时状态与观众流量统计数据。
 * 当 Redis 不可用时自动降级到进程内内存，保证演示可用。
 */
class CacheService
{
    private ?Client $redis = null;
    private bool $available = false;

    /** @var array<string,string> */
    private array $memScalar = [];

    /** @var array<string,array<string,string>> */
    private array $memHash = [];

    /** @var array<string,int> */
    private array $memCounter = [];

    public function __construct(string $redisUrl, private readonly LoggerInterface $logger)
    {
        try {
            $this->redis = new Client($redisUrl, ['parameters' => ['read_write_timeout' => 1]]);
            $this->redis->ping();
            $this->available = true;
        } catch (\Throwable $e) {
            $this->logger->warning('Redis 不可用，降级使用内存缓存：'.$e->getMessage());
            $this->redis = null;
            $this->available = false;
        }
    }

    public function isAvailable(): bool
    {
        return $this->available;
    }

    public function get(string $key): ?string
    {
        if ($this->redis) {
            try {
                $v = $this->redis->get($key);

                return null === $v ? null : (string) $v;
            } catch (\Throwable $e) {
                $this->logger->warning('Redis get 失败：'.$e->getMessage());
            }
        }

        return $this->memScalar[$key] ?? null;
    }

    public function set(string $key, string $value, ?int $ttl = null): void
    {
        if ($this->redis) {
            try {
                $this->redis->set($key, $value, $ttl ? 'EX' : null, $ttl);
            } catch (\Throwable $e) {
                $this->logger->warning('Redis set 失败：'.$e->getMessage());
            }
        }
        $this->memScalar[$key] = $value;
    }

    public function del(string $key): void
    {
        if ($this->redis) {
            try {
                $this->redis->del($key);
            } catch (\Throwable $e) {
                $this->logger->warning('Redis del 失败：'.$e->getMessage());
            }
        }
        unset($this->memScalar[$key], $this->memHash[$key], $this->memCounter[$key]);
    }

    public function incr(string $key): int
    {
        if ($this->redis) {
            try {
                return (int) $this->redis->incr($key);
            } catch (\Throwable $e) {
                $this->logger->warning('Redis incr 失败：'.$e->getMessage());
            }
        }
        $this->memCounter[$key] = ($this->memCounter[$key] ?? 0) + 1;

        return $this->memCounter[$key];
    }

    public function hSet(string $key, string $field, string $value): void
    {
        if ($this->redis) {
            try {
                $this->redis->hset($key, $field, $value);

                return;
            } catch (\Throwable $e) {
                $this->logger->warning('Redis hset 失败：'.$e->getMessage());
            }
        }
        $this->memHash[$key][$field] = $value;
    }

    /** @return array<string,string> */
    public function hGetAll(string $key): array
    {
        if ($this->redis) {
            try {
                return $this->redis->hgetall($key) ?: [];
            } catch (\Throwable $e) {
                $this->logger->warning('Redis hgetall 失败：'.$e->getMessage());
            }
        }

        return $this->memHash[$key] ?? [];
    }

    public function hDel(string $key, string $field): void
    {
        if ($this->redis) {
            try {
                $this->redis->hdel($key, [$field]);

                return;
            } catch (\Throwable $e) {
                $this->logger->warning('Redis hdel 失败：'.$e->getMessage());
            }
        }
        unset($this->memHash[$key][$field]);
    }

    /* ---------- 业务语义方法 ---------- */

    /** 缓存某展会的全部展位实时状态 */
    public function setBoothStatus(int $exhibitionId, int $boothId, string $status): void
    {
        $this->hSet("booth:status:{$exhibitionId}", (string) $boothId, $status);
    }

    public function getBoothStatuses(int $exhibitionId): array
    {
        return $this->hGetAll("booth:status:{$exhibitionId}");
    }

    public function invalidateBoothStatuses(int $exhibitionId): void
    {
        $this->del("booth:status:{$exhibitionId}");
    }

    /** 观众实时入场人数计数器 */
    public function incrVisitorFlow(int $exhibitionId): int
    {
        return $this->incr("visitor:flow:{$exhibitionId}");
    }

    public function getVisitorFlow(int $exhibitionId): int
    {
        $v = $this->get("visitor:flow:{$exhibitionId}");

        return null === $v ? 0 : (int) $v;
    }

    /** 观众流量热力图分区计数 */
    public function incrVisitorZone(int $exhibitionId, int $zone): int
    {
        return $this->hIncr("visitor:zone:{$exhibitionId}", (string) $zone);
    }

    /** @return array<string,string> */
    public function getVisitorZones(int $exhibitionId): array
    {
        return $this->hGetAll("visitor:zone:{$exhibitionId}");
    }

    private function hIncr(string $key, string $field): int
    {
        if ($this->redis) {
            try {
                return (int) $this->redis->hincrby($key, $field, 1);
            } catch (\Throwable $e) {
                $this->logger->warning('Redis hincrby 失败：'.$e->getMessage());
            }
        }
        $cur = (int) ($this->memHash[$key][$field] ?? 0) + 1;
        $this->memHash[$key][$field] = (string) $cur;

        return $cur;
    }
}
