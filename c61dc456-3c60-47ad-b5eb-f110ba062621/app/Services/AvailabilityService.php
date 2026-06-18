<?php

namespace App\Services;

use App\Models\Venue;
use App\Models\TimeSlot;
use App\Models\Court;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

class AvailabilityService
{
    public function getAvailableSlots(int $venueId, string $date): array
    {
        $venue = Venue::findOrFail($venueId);

        $slots = TimeSlot::where('venue_id', $venueId)
            ->where('date', $date)
            ->where('is_active', true)
            ->orderBy('start_time')
            ->get();

        if ($slots->isEmpty()) {
            $slots = $this->generateTimeSlots($venue, $date);
        }

        $now = Carbon::now();
        $result = [];

        foreach ($slots as $slot) {
            $slotDateTime = Carbon::parse($date . ' ' . $slot->start_time);
            $isPast = $slotDateTime->isPast() || ($slotDateTime->isToday() && $slotDateTime->lt($now));

            $result[] = [
                'id' => $slot->id,
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
                'total_courts' => $slot->total_courts,
                'available_courts' => $slot->available_courts,
                'price' => (float)$slot->price,
                'is_peak' => (bool)$slot->is_peak,
                'is_available' => $slot->available_courts > 0 && !$isPast,
                'is_past' => $isPast,
            ];
        }

        return $result;
    }

    public function generateTimeSlots(Venue $venue, string $date): array
    {
        $slots = [];
        $openTime = Carbon::parse($venue->open_time);
        $closeTime = Carbon::parse($venue->close_time);
        $duration = $venue->slot_duration;
        $activeCourts = $venue->activeCourts()->count();

        $current = clone $openTime;
        $slotData = [];

        while ($current->lt($closeTime)) {
            $end = (clone $current)->addMinutes($duration);
            if ($end->gt($closeTime)) {
                break;
            }

            $isPeak = $venue->isPeakHour($current->format('H:i'));
            $price = $venue->getPriceForTime($current->format('H:i'));

            $slotData[] = [
                'venue_id' => $venue->id,
                'date' => $date,
                'start_time' => $current->format('H:i'),
                'end_time' => $end->format('H:i'),
                'total_courts' => $activeCourts,
                'booked_courts' => 0,
                'price' => $price,
                'is_peak' => $isPeak,
                'is_active' => true,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ];

            $slots[] = (object)end($slotData);
            $current = $end;
        }

        if (!empty($slotData)) {
            try {
                foreach ($slotData as $data) {
                    TimeSlot::firstOrCreate(
                        [
                            'venue_id' => $data['venue_id'],
                            'date' => $data['date'],
                            'start_time' => $data['start_time'],
                        ],
                        $data
                    );
                }
                $slots = TimeSlot::where('venue_id', $venue->id)
                    ->where('date', $date)
                    ->where('is_active', true)
                    ->orderBy('start_time')
                    ->get()
                    ->all();
            } catch (QueryException $e) {
                $slots = TimeSlot::where('venue_id', $venue->id)
                    ->where('date', $date)
                    ->where('is_active', true)
                    ->orderBy('start_time')
                    ->get()
                    ->all();
            }
        }

        return $slots;
    }

    public function lockSlot(int $slotId): ?TimeSlot
    {
        try {
            return DB::transaction(function () use ($slotId) {
                $slot = TimeSlot::where('id', $slotId)->first();

                if (!$slot || $slot->available_courts <= 0) {
                    return null;
                }

                return $slot;
            });
        } catch (QueryException $e) {
            return null;
        }
    }

    public function decrementSlot(int $slotId): bool
    {
        $updated = TimeSlot::where('id', $slotId)
            ->where('available_courts', '>', 0)
            ->decrement('booked_courts');

        return $updated > 0;
    }

    public function incrementSlot(int $slotId): bool
    {
        $slot = TimeSlot::find($slotId);
        if (!$slot) {
            return false;
        }

        if ($slot->booked_courts <= 0) {
            return true;
        }

        $updated = TimeSlot::where('id', $slotId)
            ->where('booked_courts', '>', 0)
            ->decrement('booked_courts');

        return $updated > 0;
    }

    public function checkConflict(int $venueId, string $date, string $startTime, string $endTime, ?int $excludeBookingId = null): bool
    {
        $query = TimeSlot::where('venue_id', $venueId)
            ->where('date', $date)
            ->where('start_time', '>=', $startTime)
            ->where('start_time', '<', $endTime)
            ->where('is_active', true);

        $slots = $query->get();

        foreach ($slots as $slot) {
            if ($slot->available_courts <= 0) {
                return true;
            }
        }

        return false;
    }

    public function regenerateSlotsForVenue(Venue $venue, string $startDate, string $endDate): void
    {
        $start = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);
        $activeCourts = $venue->activeCourts()->count();

        for ($date = clone $start; $date->lte($end); $date->addDay()) {
            $this->generateTimeSlotsForDate($venue, $date->format('Y-m-d'), $activeCourts);
        }
    }

    protected function generateTimeSlotsForDate(Venue $venue, string $date, int $courtCount): void
    {
        $openTime = Carbon::parse($venue->open_time);
        $closeTime = Carbon::parse($venue->close_time);
        $duration = $venue->slot_duration;

        $current = clone $openTime;

        while ($current->lt($closeTime)) {
            $end = (clone $current)->addMinutes($duration);
            if ($end->gt($closeTime)) {
                break;
            }

            $isPeak = $venue->isPeakHour($current->format('H:i'));
            $price = $venue->getPriceForTime($current->format('H:i'));

            TimeSlot::updateOrCreate(
                [
                    'venue_id' => $venue->id,
                    'date' => $date,
                    'start_time' => $current->format('H:i'),
                ],
                [
                    'end_time' => $end->format('H:i'),
                    'total_courts' => $courtCount,
                    'price' => $price,
                    'is_peak' => $isPeak,
                    'is_active' => true,
                ]
            );

            $current = $end;
        }
    }
}
