<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Contract;

class ContractPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Contract $contract): bool
    {
        if ($user->isExchange() || $user->isRegulator()) {
            return true;
        }

        return $contract->seller_id === $user->id || $contract->buyer_id === $user->id;
    }

    public function deliver(User $user, Contract $contract): bool
    {
        if ($user->isExchange()) {
            return true;
        }

        return $contract->seller_id === $user->id;
    }

    public function confirmReceipt(User $user, Contract $contract): bool
    {
        if ($user->isExchange()) {
            return true;
        }

        return $contract->buyer_id === $user->id;
    }

    public function viewOwn(User $user, int $userId): bool
    {
        if ($user->isExchange() || $user->isRegulator()) {
            return true;
        }

        return $user->id === $userId;
    }
}
