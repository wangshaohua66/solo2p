<?php

namespace App\Services;

use App\Models\User;
use App\Models\Venue;
use App\Models\Booking;
use App\Models\TimeSlot;
use Carbon\Carbon;

class BookingPolicyService
{
    public function canBook(User $user, Venue $venue, TimeSlot $slot): array
    {
        $errors = [];

        if (!$user->is_verified) {
            $errors[] = '请先完成实名认证';
        }

        if ($user->isBlacklisted()) {
            $errors[] = '您已被列入黑名单，解封时间：' . $user->blacklist_until->format('Y-m-d H:i');
        }

        if ($user->credit_score < 60) {
            $errors[] = '您的信用分不足60分，暂时无法预约';
        }

        if (!$slot->is_active) {
            $errors[] = '该时段已关闭预约';
        }

        if ($slot->isExpired()) {
            $errors[] = '该时段已过期';
        }

        if ($slot->available_courts <= 0) {
            $errors[] = '该时段场地已约满';
        }

        $maxAdvanceDays = $venue->advance_booking_days;
        $slotDate = Carbon::parse($slot->getStartTimeCarbon()->format('Y-m-d'));
        $maxDate = Carbon::today()->addDays($maxAdvanceDays);

        if ($slotDate->gt($maxDate)) {
            $errors[] = "最多可提前{$maxAdvanceDays}天预约";
        }

        $dailyLimit = $venue->daily_booking_limit;
        $todayBookings = Booking::where('user_id', $user->id)
            ->where('venue_id', $venue->id)
            ->where('booking_date', $slot->date)
            ->whereIn('status', [Booking::STATUS_PENDING, Booking::STATUS_PAID, Booking::STATUS_CHECKED_IN])
            ->count();

        if ($todayBookings >= $dailyLimit) {
            $errors[] = "每场馆每日限约{$dailyLimit}次，您已达上限";
        }

        return [
            'allowed' => empty($errors),
            'errors' => $errors,
        ];
    }

    public function canCancel(User $user, Booking $booking): array
    {
        $errors = [];

        if ($booking->user_id !== $user->id) {
            $errors[] = '无权操作此预约';
        }

        if (!$booking->canCancel()) {
            $errors[] = '该预约无法取消';
        }

        if (in_array($booking->status, [Booking::STATUS_CANCELLED, Booking::STATUS_EXPIRED, Booking::STATUS_VIOLATION])) {
            $errors[] = '预约已取消或过期';
        }

        return [
            'allowed' => empty($errors),
            'errors' => $errors,
        ];
    }

    public function canCheckIn(User $user, Booking $booking): array
    {
        $errors = [];

        if ($booking->user_id !== $user->id) {
            $errors[] = '无权操作此预约';
        }

        if ($booking->is_checked_in) {
            $errors[] = '已签到，请勿重复签到';
        }

        if ($booking->status !== Booking::STATUS_PAID) {
            $errors[] = '预约未支付，无法签到';
        }

        $startTime = Carbon::parse($booking->getBookingDateStr() . ' ' . $booking->start_time);
        $now = Carbon::now();

        if ($now->lt($startTime->subMinutes(30))) {
            $errors[] = '距离开场超过30分钟，暂不能签到';
        }

        return [
            'allowed' => empty($errors),
            'errors' => $errors,
        ];
    }

    public function calculatePrice(User $user, TimeSlot $slot): float
    {
        $basePrice = (float)$slot->price;
        $discountRate = $user->getDiscountRate();

        return round($basePrice * $discountRate, 2);
    }

    public function calculateRefundAmount(Booking $booking): array
    {
        $refundRate = $booking->getRefundRate();
        $refundAmount = round((float)$booking->paid_amount * $refundRate, 2);

        $reason = '';
        $startTime = Carbon::parse($booking->getBookingDateStr() . ' ' . $booking->start_time);
        $hoursDiff = Carbon::now()->diffInHours($startTime, false);

        if ($hoursDiff >= 24) {
            $reason = '开场前24小时以上取消，全额退款';
        } elseif ($hoursDiff >= 2) {
            $reason = '开场前2-24小时内取消，退还50%';
        } else {
            $reason = '开场前2小时内取消，不予退款';
        }

        return [
            'rate' => $refundRate,
            'amount' => $refundAmount,
            'reason' => $reason,
        ];
    }

    public function isViolation(Booking $booking): bool
    {
        if ($booking->status !== Booking::STATUS_PAID) {
            return false;
        }

        if ($booking->is_checked_in) {
            return false;
        }

        return $booking->isLateCheckIn();
    }
}
