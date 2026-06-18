<?php

namespace Database\Factories;

use App\Models\Booking;
use App\Models\User;
use App\Models\Venue;
use App\Models\TimeSlot;
use App\Models\Court;
use Illuminate\Database\Eloquent\Factories\Factory;
use Carbon\Carbon;

class BookingFactory extends Factory
{
    protected $model = Booking::class;

    public function definition(): array
    {
        $venue = Venue::factory()->create();
        $user = User::factory()->create();
        $court = Court::factory()->create(['venue_id' => $venue->id]);
        $date = Carbon::tomorrow()->format('Y-m-d');

        $slot = TimeSlot::factory()->create([
            'venue_id' => $venue->id,
            'date' => $date,
        ]);

        return [
            'user_id' => $user->id,
            'venue_id' => $venue->id,
            'court_id' => $court->id,
            'time_slot_id' => $slot->id,
            'booking_date' => $date,
            'start_time' => '09:00',
            'end_time' => '10:00',
            'booking_no' => 'BK' . date('YmdHis') . rand(1000, 9999),
            'amount' => 50.00,
            'paid_amount' => 0,
            'status' => 'pending',
            'is_checked_in' => false,
            'is_violation' => false,
            'expires_at' => Carbon::now()->addMinutes(15),
        ];
    }

    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'paid',
            'paid_amount' => 50.00,
        ]);
    }

    public function cancelled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancel_reason' => '用户取消',
        ]);
    }

    public function checkedIn(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'checked_in',
            'is_checked_in' => true,
            'check_in_time' => now(),
        ]);
    }

    public function violation(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'violation',
            'is_violation' => true,
            'violation_reason' => '超时未签到',
        ]);
    }
}
