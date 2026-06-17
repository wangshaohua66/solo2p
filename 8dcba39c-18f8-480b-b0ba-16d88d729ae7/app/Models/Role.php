<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Role extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'slug', 'display_name', 'description', 'is_system',
    ];

    protected $casts = [
        'is_system' => 'boolean',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'role_user', 'role_id', 'user_id')
            ->withPivot('tenant_id')
            ->withTimestamps();
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'permission_role')
            ->withTimestamps();
    }

    public function givePermissionTo(string|Permission $permission): self
    {
        $permissionInstance = is_string($permission)
            ? Permission::where('slug', $permission)->firstOrFail()
            : $permission;

        $this->permissions()->syncWithoutDetaching([$permissionInstance->id]);
        return $this;
    }

    public function revokePermissionTo(string|Permission $permission): self
    {
        $permissionInstance = is_string($permission)
            ? Permission::where('slug', $permission)->firstOrFail()
            : $permission;

        $this->permissions()->detach($permissionInstance->id);
        return $this;
    }

    public function hasPermission(string $permissionSlug): bool
    {
        return $this->permissions()->where('slug', $permissionSlug)->exists();
    }
}
