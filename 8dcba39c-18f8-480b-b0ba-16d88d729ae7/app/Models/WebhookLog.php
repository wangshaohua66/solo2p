<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookLog extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'endpoint_id', 'event', 'ticket_id',
        'request_headers', 'request_body', 'response_status',
        'response_body', 'response_time_ms', 'success',
        'error_message', 'retry_count',
    ];

    protected $casts = [
        'request_headers' => 'array',
        'success' => 'boolean',
        'response_time_ms' => 'integer',
        'retry_count' => 'integer',
    ];

    public function endpoint(): BelongsTo
    {
        return $this->belongsTo(WebhookEndpoint::class, 'endpoint_id');
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function isSuccess(): bool
    {
        return (bool) $this->success;
    }
}
