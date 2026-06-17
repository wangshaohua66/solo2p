<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ApiKey extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    public const STATUS_ACTIVE = 1;
    public const STATUS_REVOKED = 2;

    protected $fillable = [
        'tenant_id', 'user_id', 'name', 'key', 'secret', 'rate_limit_per_minute',
        'requests_count', 'last_used_at', 'expires_at', 'allowed_ips', 'scopes', 'status',
    ];

    protected $casts = [
        'allowed_ips' => 'array',
        'scopes' => 'array',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return false;
        }
        if ($this->expires_at && now()->greaterThan($this->expires_at)) {
            return false;
        }
        return true;
    }

    public function isIpAllowed(?string $ip): bool
    {
        if (empty($this->allowed_ips)) {
            return true;
        }
        return in_array($ip, $this->allowed_ips, true);
    }

    public function hasScope(string $scope): bool
    {
        if (empty($this->scopes)) {
            return true;
        }
        return in_array($scope, $this->scopes, true) || in_array('*', $this->scopes, true);
    }

    public function validateSignature(string $body, string $signature): bool
    {
        $expected = hash_hmac('sha256', $body, $this->secret);
        return hash_equals($expected, $signature);
    }

    public function generateKeyPair(): array
    {
        return [
            'key' => 'tk_' . Str::random(40),
            'secret' => Str::random(64),
        ];
    }

    public function incrementRequests(): void
    {
        $this->forceFill([
            'requests_count' => $this->requests_count + 1,
            'last_used_at' => now(),
        ])->save();
    }

    public function isRateLimited(?string $ip): bool
    {
        $key = "apikey:{$this->id}:rate_limit:" . now()->format('Y-m-d-H-i');
        $requests = app('redis')->incr($key);
        if ($requests === 1) {
            app('redis')->expire($key, 60);
        }
        return $requests > $this->rate_limit_per_minute;
    }
}
