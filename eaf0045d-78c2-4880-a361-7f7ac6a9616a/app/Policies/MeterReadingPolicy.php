<?php

namespace App\Policies;

use App\Models\User;
use App\Models\MeterReading;

class MeterReadingPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, MeterReading $reading): bool
    {
        if ($user->isExchange() || $user->isRegulator()) {
            return true;
        }

        return $reading->station->owner_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->isGenerator() || $user->isExchange();
    }

    public function review(User $user): bool
    {
        return $user->isExchange();
    }

    public function viewOwn(User $user, int $ownerId): bool
    {
        if ($user->isExchange() || $user->isRegulator()) {
            return true;
        }

        return $user->id === $ownerId;
    }
}
