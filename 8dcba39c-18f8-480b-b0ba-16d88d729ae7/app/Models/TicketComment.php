<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TicketComment extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    public const TYPE_REPLY = 'reply';
    public const TYPE_NOTE = 'note';
    public const TYPE_INTERNAL = 'internal';
    public const TYPE_PUBLIC = 'public';
    public const TYPE_SYSTEM = 'system';

    protected $fillable = [
        'tenant_id', 'ticket_id', 'user_id', 'content', 'type',
        'is_public', 'is_first_response', 'attachment_count',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'is_first_response' => 'boolean',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function author(): BelongsTo
    {
        return $this->user();
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class, 'comment_id');
    }

    public function isReply(): bool
    {
        return $this->type === self::TYPE_REPLY;
    }

    public function isNote(): bool
    {
        return $this->type === self::TYPE_NOTE;
    }

    public function isSystem(): bool
    {
        return $this->type === self::TYPE_SYSTEM;
    }

    public function isInternal(): bool
    {
        return !$this->is_public || $this->isNote();
    }
}
