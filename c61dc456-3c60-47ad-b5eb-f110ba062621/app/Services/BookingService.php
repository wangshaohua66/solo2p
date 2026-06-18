<?php

namespace App\Services;

use App\Models\User;
use App\Models\Venue;
use App\Models\TimeSlot;
use App\Models\Booking;
use App\Models\Court;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class BookingService
{
    protected AvailabilityService $availabilityService;
    protected BookingPolicyService $policyService;

    public function __construct(AvailabilityService $availabilityService, BookingPolicyService $policyService)
    {
        $this->availabilityService = $availabilityService;
        $this->policyService = $policyService;
    }

    public function createBooking(User $user, int $venueId, int $slotId): array
    {
        return DB::transaction(function () use ($user, $venueId, $slotId) {
            $venue = Venue::findOrFail($venueId);
            $slot = TimeSlot::where('id', $slotId)
                ->where('venue_id', $venueId)
                ->firstOrFail();

            $policyCheck = $this->policyService->canBook($user, $venue, $slot);
            if (!$policyCheck['allowed']) {
                return [
                    'success' => false,
                    'message' => implode('；', $policyCheck['errors']),
                    'data' => null,
                ];
            }

            if ($slot->available_courts <= 0) {
                return [
                    'success' => false,
                    'message' => '该时段场地已约满',
                    'data' => null,
                ];
            }

            $court = Court::where('venue_id', $venueId)
                ->where('is_active', true)
                ->whereNotIn('id', function ($query) use ($slotId) {
                    $query->select('court_id')
                        ->from('bookings')
                        ->where('time_slot_id', $slotId)
                        ->whereIn('status', [Booking::STATUS_PENDING, Booking::STATUS_PAID, Booking::STATUS_CHECKED_IN])
                        ->whereNotNull('court_id');
                })
                ->first();

            if (!$court) {
                return [
                    'success' => false,
                    'message' => '暂无可用场地',
                    'data' => null,
                ];
            }

            $price = $this->policyService->calculatePrice($user, $slot);
            $expiresAt = Carbon::now()->addMinutes(15);

            $booking = Booking::create([
                'user_id' => $user->id,
                'venue_id' => $venueId,
                'court_id' => $court->id,
                'time_slot_id' => $slotId,
                'booking_no' => Booking::generateBookingNo(),
                'booking_date' => $slot->date,
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
                'amount' => $price,
                'paid_amount' => 0,
                'status' => Booking::STATUS_PENDING,
                'expires_at' => $expiresAt,
            ]);

            $slot->increment('booked_courts');

            return [
                'success' => true,
                'message' => '预约创建成功，请在15分钟内完成支付',
                'data' => $booking->load(['venue', 'timeSlot', 'court']),
            ];
        });
    }

    public function cancelBooking(User $user, int $bookingId): array
    {
        return DB::transaction(function () use ($user, $bookingId) {
            $booking = Booking::with(['timeSlot', 'payment'])->findOrFail($bookingId);

            $policyCheck = $this->policyService->canCancel($user, $booking);
            if (!$policyCheck['allowed']) {
                return [
                    'success' => false,
                    'message' => implode('；', $policyCheck['errors']),
                    'data' => null,
                ];
            }

            $refundInfo = $this->policyService->calculateRefundAmount($booking);

            $booking->update([
                'status' => Booking::STATUS_CANCELLED,
                'cancel_reason' => $refundInfo['reason'],
                'cancelled_at' => Carbon::now(),
            ]);

            if ($booking->timeSlot) {
                $this->availabilityService->incrementSlot($booking->time_slot_id);
            }

            if ($booking->payment && $booking->payment->isPaid() && $refundInfo['amount'] > 0) {
                $refund = Payment::create([
                    'user_id' => $user->id,
                    'booking_id' => $bookingId,
                    'payment_no' => 'REF' . date('YmdHis') . rand(1000, 9999),
                    'payment_method' => $booking->payment->payment_method,
                    'amount' => -$refundInfo['amount'],
                    'status' => Payment::STATUS_REFUNDING,
                    'refund_reason' => $refundInfo['reason'],
                ]);
            }

            return [
                'success' => true,
                'message' => '预约已取消',
                'data' => [
                    'booking' => $booking->fresh(),
                    'refund_amount' => $refundInfo['amount'] ?? 0,
                    'refund_reason' => $refundInfo['reason'] ?? '',
                ],
            ];
        });
    }

    public function checkIn(User $user, int $bookingId): array
    {
        $booking = Booking::findOrFail($bookingId);

        $policyCheck = $this->policyService->canCheckIn($user, $booking);
        if (!$policyCheck['allowed']) {
            return [
                'success' => false,
                'message' => implode('；', $policyCheck['errors']),
                'data' => null,
            ];
        }

        $isLate = $booking->isLateCheckIn();

        $booking->update([
            'status' => Booking::STATUS_CHECKED_IN,
            'is_checked_in' => true,
            'check_in_time' => Carbon::now(),
        ]);

        if (!$isLate) {
            $user->addCreditScore(1, '按时签到', $booking);
        }

        return [
            'success' => true,
            'message' => $isLate ? '签到成功，您已迟到' : '签到成功',
            'data' => [
                'booking' => $booking->fresh(),
                'is_late' => $isLate,
            ],
        ];
    }

    public function processExpiredBookings(): int
    {
        $expiredBookings = Booking::where('status', Booking::STATUS_PENDING)
            ->where('expires_at', '<', Carbon::now())
            ->get();

        $count = 0;

        foreach ($expiredBookings as $booking) {
            DB::transaction(function () use ($booking) {
                $booking->update(['status' => Booking::STATUS_EXPIRED]);

                if ($booking->time_slot_id) {
                    $this->availabilityService->incrementSlot($booking->time_slot_id);
                }
            });
            $count++;
        }

        return $count;
    }

    public function processNoShows(): int
    {
        $noShows = Booking::where('status', Booking::STATUS_PAID)
            ->where('is_checked_in', false)
            ->where('is_violation', false)
            ->whereRaw("datetime(booking_date || ' ' || start_time) < datetime('now', '-30 minutes')")
            ->get();

        $count = 0;

        foreach ($noShows as $booking) {
            DB::transaction(function () use ($booking) {
                $booking->update([
                    'status' => Booking::STATUS_VIOLATION,
                    'is_violation' => true,
                    'violation_reason' => '超时30分钟未签到',
                ]);

                $booking->user->deductCreditScore(10, '超时未签到', $booking);
            });
            $count++;
        }

        return $count;
    }

    public function getUserBookings(User $user, array $filters = [], int $page = 1, int $perPage = 20): array
    {
        $query = Booking::with(['venue', 'timeSlot', 'court', 'payment'])
            ->where('user_id', $user->id);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['venue_id'])) {
            $query->where('venue_id', $filters['venue_id']);
        }

        if (!empty($filters['date_from'])) {
            $query->where('booking_date', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->where('booking_date', '<=', $filters['date_to']);
        }

        $total = $query->count();
        $bookings = $query->orderBy('booking_date', 'desc')
            ->orderBy('start_time', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'list' => $bookings,
        ];
    }
}
