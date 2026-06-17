<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillingRecord extends Model
{
    use HasFactory, BelongsToTenant;

    public const STATUS_DRAFT = 1;
    public const STATUS_ISSUED = 2;
    public const STATUS_PAID = 3;
    public const STATUS_OVERDUE = 4;
    public const STATUS_REFUNDED = 5;

    protected $fillable = [
        'tenant_id', 'invoice_number', 'amount', 'currency', 'billing_period',
        'billing_start_date', 'billing_end_date', 'due_date', 'paid_at',
        'status', 'payment_method', 'items', 'tax_info',
    ];

    protected $casts = [
        'billing_start_date' => 'date',
        'billing_end_date' => 'date',
        'due_date' => 'datetime',
        'paid_at' => 'datetime',
        'items' => 'array',
        'tax_info' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function isOverdue(): bool
    {
        return $this->status === self::STATUS_OVERDUE
            || ($this->status === self::STATUS_ISSUED && $this->due_date && now()->greaterThan($this->due_date));
    }

    public function markPaid(?string $paymentMethod = null): void
    {
        $this->forceFill([
            'status' => self::STATUS_PAID,
            'paid_at' => now(),
            'payment_method' => $paymentMethod ?? $this->payment_method,
        ])->save();
    }

    public function markRefunded(): void
    {
        $this->forceFill(['status' => self::STATUS_REFUNDED])->save();
    }

    public function markOverdue(): void
    {
        if ($this->status === self::STATUS_ISSUED) {
            $this->forceFill(['status' => self::STATUS_OVERDUE])->save();
        }
    }

    public function generateInvoiceNumber(): string
    {
        $prefix = now()->format('Ymd');
        $tenantPart = str_pad($this->tenant_id, 6, '0', STR_PAD_LEFT);
        $sequence = self::whereBetween('created_at', [now()->startOfDay(), now()->endOfDay()])->count() + 1;
        return "INV{$prefix}{$tenantPart}" . str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }
}
