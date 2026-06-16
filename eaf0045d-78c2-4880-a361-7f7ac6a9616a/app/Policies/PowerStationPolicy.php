<?php

namespace App\Policies;

use App\Models\User;
use App\Models\PowerStation;
use Illuminate\Auth\Access\Response;

class PowerStationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, PowerStation $station): bool
    {
        if ($user->isExchange() || $user->isRegulator()) {
            return true;
        }

        return $station->owner_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->isGenerator() || $user->isExchange();
    }

    public function update(User $user, PowerStation $station): bool
    {
        if ($user->isExchange()) {
            return true;
        }

        return $station->owner_id === $user->id && $user->isGenerator();
    }

    public function delete(User $user, PowerStation $station): bool
    {
        return $user->isExchange();
    }

    public function viewOwnerStations(User $user, int $ownerId): bool
    {
        if ($user->isExchange() || $user->isRegulator()) {
            return true;
        }

        return $user->id === $ownerId;
    }
}
