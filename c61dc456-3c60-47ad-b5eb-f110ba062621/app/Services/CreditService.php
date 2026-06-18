<?php

namespace App\Services;

use App\Models\User;
use App\Models\CreditRecord;
use App\Models\Booking;
use Carbon\Carbon;

class CreditService
{
    public function getUserCreditInfo(User $user): array
    {
        $user->isBlacklisted();

        return [
            'user_id' => $user->id,
            'credit_score' => $user->credit_score,
            'max_score' => 120,
            'violation_count' => $user->violation_count,
            'is_blacklisted' => $user->is_blacklisted,
            'blacklist_until' => $user->blacklist_until,
            'discount_rate' => $user->getDiscountRate(),
            'can_book' => $user->canBook(),
            'level' => $this->getLevel($user->credit_score),
        ];
    }

    public function getLevel(int $score): string
    {
        if ($score >= 120) {
            return 'excellent';
        } elseif ($score >= 100) {
            return 'good';
        } elseif ($score >= 80) {
            return 'normal';
        } elseif ($score >= 60) {
            return 'warning';
        }
        return 'poor';
    }

    public function getRecords(User $user, array $filters = [], int $page = 1, int $perPage = 20): array
    {
        $query = CreditRecord::with(['booking' => function ($q) {
            $q->select('id', 'booking_no', 'booking_date', 'start_time');
        }])->where('user_id', $user->id);

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (!empty($filters['is_violation'])) {
            $query->where('is_violation', true);
        }

        if (!empty($filters['date_from'])) {
            $query->where('created_at', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->where('created_at', '<=', $filters['date_to'] . ' 23:59:59');
        }

        $total = $query->count();
        $records = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'list' => $records,
        ];
    }

    public function getBlacklist(int $page = 1, int $perPage = 20): array
    {
        $query = User::where('is_blacklisted', true)
            ->where(function ($q) {
                $q->whereNull('blacklist_until')
                    ->orWhere('blacklist_until', '>', Carbon::now());
            });

        $total = $query->count();
        $users = $query->orderBy('blacklist_until', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get(['id', 'phone', 'real_name', 'credit_score', 'violation_count', 'blacklist_until', 'created_at']);

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'list' => $users,
        ];
    }

    public function addToBlacklist(int $userId, int $days, string $reason): array
    {
        $user = User::findOrFail($userId);

        $user->update([
            'is_blacklisted' => true,
            'blacklist_until' => Carbon::now()->addDays($days),
        ]);

        $user->creditRecords()->create([
            'type' => 'penalty',
            'score_change' => 0,
            'balance_before' => $user->credit_score,
            'balance_after' => $user->credit_score,
            'reason' => $reason,
            'is_violation' => true,
            'is_blacklist_trigger' => true,
        ]);

        return [
            'success' => true,
            'message' => "已将用户加入黑名单{$days}天",
            'data' => [
                'user_id' => $userId,
                'blacklist_until' => $user->blacklist_until,
            ],
        ];
    }

    public function removeFromBlacklist(int $userId, string $reason = ''): array
    {
        $user = User::findOrFail($userId);

        $user->update([
            'is_blacklisted' => false,
            'blacklist_until' => null,
        ]);

        if (!empty($reason)) {
            $user->creditRecords()->create([
                'type' => 'reward',
                'score_change' => 0,
                'balance_before' => $user->credit_score,
                'balance_after' => $user->credit_score,
                'reason' => '解除黑名单：' . $reason,
                'is_violation' => false,
            ]);
        }

        return [
            'success' => true,
            'message' => '已将用户移出黑名单',
            'data' => [
                'user_id' => $userId,
            ],
        ];
    }

    public function processExpiredBlacklists(): int
    {
        $expired = User::where('is_blacklisted', true)
            ->where('blacklist_until', '<', Carbon::now())
            ->get();

        foreach ($expired as $user) {
            $user->update([
                'is_blacklisted' => false,
                'blacklist_until' => null,
            ]);
        }

        return $expired->count();
    }
}
