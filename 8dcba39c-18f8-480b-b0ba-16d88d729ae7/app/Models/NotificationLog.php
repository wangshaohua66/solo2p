<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationLog extends Model
{
    use HasFactory, BelongsToTenant;

    public const STATUS_PENDING = 0;
    public const STATUS_SENT = 1;
    public const STATUS_FAILED = 2;
    public const STATUS_DELIVERED = 3;

    protected $fillable = [
        'tenant_id', 'channel', 'event_type', 'template_id', 'ticket_id', 'user_id',
        'recipient', 'subject', 'content', 'status', 'error_message',
        'provider', 'provider_message_id', 'sent_at', 'delivered_at',
        'retry_count', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(NotificationTemplate::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isSent(): bool
    {
        return $this->status === self::STATUS_SENT;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    public function isDelivered(): bool
    {
        return $this->status === self::STATUS_DELIVERED;
    }

    public function markSent(?string $providerMessageId = null, ?string $provider = null): void
    {
        $this->forceFill([
            'status' => self::STATUS_SENT,
            'sent_at' => now(),
            'provider_message_id' => $providerMessageId,
            'provider' => $provider ?? $this->provider,
        ])->save();
    }

    public function markDelivered(): void
    {
        $this->forceFill([
            'status' => self::STATUS_DELIVERED,
            'delivered_at' => now(),
        ])->save();
    }

    public function markFailed(string $errorMessage, int $maxRetries = 3): bool
    {
        $newRetryCount = $this->retry_count + 1;
        $shouldRetry = $newRetryCount < $maxRetries;

        $this->forceFill([
            'status' => $shouldRetry ? self::STATUS_PENDING : self::STATUS_FAILED,
            'error_message' => $errorMessage,
            'retry_count' => $newRetryCount,
        ])->save();

        return $shouldRetry;
    }
}
