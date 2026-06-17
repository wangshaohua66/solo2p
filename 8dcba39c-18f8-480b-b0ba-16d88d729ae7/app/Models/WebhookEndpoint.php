<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class WebhookEndpoint extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    public const STATUS_ACTIVE = 1;
    public const STATUS_INACTIVE = 0;
    public const STATUS_DISABLED_FAILED = 2;

    public const AUTH_NONE = 'none';
    public const AUTH_API_KEY = 'api_key';
    public const AUTH_BEARER = 'bearer';
    public const AUTH_BASIC = 'basic';

    protected $fillable = [
        'tenant_id', 'name', 'url', 'method', 'events', 'headers', 'secret',
        'authentication_type', 'authentication_config', 'timeout_seconds',
        'verify_ssl', 'status', 'failure_count', 'last_success_at', 'last_failure_at',
    ];

    protected $casts = [
        'events' => 'array',
        'headers' => 'array',
        'authentication_config' => 'array',
        'verify_ssl' => 'boolean',
        'last_success_at' => 'datetime',
        'last_failure_at' => 'datetime',
    ];

    public function logs(): HasMany
    {
        return $this->hasMany(WebhookLog::class, 'endpoint_id');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function listensTo(string $event): bool
    {
        $events = (array) $this->events;
        return in_array($event, $events, true) || in_array('*', $events, true);
    }

    public function generateSignature(string $body): string
    {
        if (empty($this->secret)) {
            return '';
        }
        return hash_hmac('sha256', $body, $this->secret);
    }

    public function getAuthHeaders(): array
    {
        $headers = (array) $this->headers;

        switch ($this->authentication_type) {
            case self::AUTH_API_KEY:
                $config = (array) $this->authentication_config;
                $headerName = $config['header_name'] ?? 'X-API-Key';
                $headers[$headerName] = $config['api_key'] ?? '';
                break;

            case self::AUTH_BEARER:
                $config = (array) $this->authentication_config;
                $headers['Authorization'] = 'Bearer ' . ($config['token'] ?? '');
                break;

            case self::AUTH_BASIC:
                $config = (array) $this->authentication_config;
                $credentials = base64_encode(($config['username'] ?? '') . ':' . ($config['password'] ?? ''));
                $headers['Authorization'] = 'Basic ' . $credentials;
                break;
        }

        return $headers;
    }

    public function recordSuccess(): void
    {
        $this->forceFill([
            'failure_count' => 0,
            'last_success_at' => now(),
            'status' => self::STATUS_ACTIVE,
        ])->save();
    }

    public function recordFailure(int $threshold = 10): bool
    {
        $newCount = $this->failure_count + 1;
        $disabled = $newCount >= $threshold;

        $this->forceFill([
            'failure_count' => $newCount,
            'last_failure_at' => now(),
            'status' => $disabled ? self::STATUS_DISABLED_FAILED : $this->status,
        ])->save();

        return $disabled;
    }

    public static function findForEvent(int $tenantId, string $event): \Illuminate\Database\Eloquent\Collection
    {
        return self::forTenant($tenantId)
            ->where('status', self::STATUS_ACTIVE)
            ->get()
            ->filter(fn (self $endpoint) => $endpoint->listensTo($event));
    }
}
