<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Listing;

class ListingPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Listing $listing): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isGenerator() || $user->isExchange();
    }

    public function cancel(User $user, Listing $listing): bool
    {
        if ($user->isExchange()) {
            return true;
        }

        return $listing->seller_id === $user->id && $user->isGenerator();
    }

    public function match(User $user): bool
    {
        return $user->isPurchaser() || $user->isExchange();
    }

    public function viewOwn(User $user, int $sellerId): bool
    {
        if ($user->isExchange() || $user->isRegulator()) {
            return true;
        }

        return $user->id === $sellerId;
    }
}
