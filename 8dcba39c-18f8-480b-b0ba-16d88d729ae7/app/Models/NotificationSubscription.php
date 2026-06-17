<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationSubscription extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'event_key', 'channels',
        'target_roles', 'is_system', 'enabled',
    ];

    protected $casts = [
        'channels' => 'array',
        'target_roles' => 'array',
        'is_system' => 'boolean',
        'enabled' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hasChannel(string $channel): bool
    {
        return in_array($channel, (array) $this->channels, true);
    }

    public function getChannelsForEvent(User $user, string $eventType): array
    {
        $subscription = self::where('user_id', $user->id)
            ->where('event_key', $eventType)
            ->where('enabled', true)
            ->first();

        if ($subscription) {
            return $subscription->channels ?? [];
        }

        $defaults = config('notifications.default_channels', [
            'ticket_created' => ['email', 'in_app'],
            'ticket_assigned' => ['email', 'in_app', 'sms'],
            'ticket_updated' => ['in_app'],
            'ticket_urgent' => ['email', 'in_app', 'sms'],
            'ticket_sla_warning' => ['email', 'in_app'],
            'ticket_sla_breached' => ['email', 'in_app', 'sms'],
            'ticket_resolved' => ['email', 'in_app'],
            'ticket_commented' => ['in_app', 'email'],
            'approval_requested' => ['email', 'in_app', 'sms'],
        ]);

        return $defaults[$eventType] ?? ['email', 'in_app'];
    }
}
