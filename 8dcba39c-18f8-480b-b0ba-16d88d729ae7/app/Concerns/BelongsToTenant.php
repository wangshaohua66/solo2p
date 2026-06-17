<?php

namespace App\Concerns;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        $tenantId = app('currentTenantId') ?? null;

        if ($tenantId) {
            static::addGlobalScope('tenant', function (Builder $builder) use ($tenantId) {
                $builder->where("{$builder->getModel()->getTable()}.tenant_id", $tenantId);
            });

            static::creating(function ($model) use ($tenantId) {
                if (empty($model->tenant_id)) {
                    $model->tenant_id = $tenantId;
                }
            });
        }
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeWithoutTenant(Builder $builder): Builder
    {
        return $builder->withoutGlobalScope('tenant');
    }

    public function scopeForTenant(Builder $builder, int|Tenant $tenant): Builder
    {
        $id = $tenant instanceof Tenant ? $tenant->id : $tenant;
        return $builder->withoutGlobalScope('tenant')->where('tenant_id', $id);
    }
}
