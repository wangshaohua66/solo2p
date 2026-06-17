<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessHour extends Model
{
    use HasFactory, BelongsToTenant;

    public const DAY_SUNDAY = 0;
    public const DAY_MONDAY = 1;
    public const DAY_TUESDAY = 2;
    public const DAY_WEDNESDAY = 3;
    public const DAY_THURSDAY = 4;
    public const DAY_FRIDAY = 5;
    public const DAY_SATURDAY = 6;

    protected $fillable = [
        'tenant_id', 'day_of_week', 'name',
        'start_time', 'end_time', 'is_workday',
    ];

    protected $casts = [
        'is_workday' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isWorkday(): bool
    {
        return (bool) $this->is_workday && !empty($this->start_time) && !empty($this->end_time);
    }

    public function getDayName(): string
    {
        return match ((int) $this->day_of_week) {
            self::DAY_SUNDAY => '周日',
            self::DAY_MONDAY => '周一',
            self::DAY_TUESDAY => '周二',
            self::DAY_WEDNESDAY => '周三',
            self::DAY_THURSDAY => '周四',
            self::DAY_FRIDAY => '周五',
            self::DAY_SATURDAY => '周六',
            default => '未知',
        };
    }

    public static function getByTenant(int $tenantId): \Illuminate\Database\Eloquent\Collection
    {
        return self::forTenant($tenantId)
            ->orderBy('day_of_week')
            ->get()
            ->keyBy('day_of_week');
    }

    public static function getWorkdayByDow(int $tenantId, int $dayOfWeek): ?self
    {
        return self::forTenant($tenantId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_workday', true)
            ->first();
    }
}
