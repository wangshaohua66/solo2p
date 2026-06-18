<?php

namespace Database\Factories;

use App\Models\TimeSlot;
use App\Models\Venue;
use Illuminate\Database\Eloquent\Factories\Factory;
use Carbon\Carbon;

class TimeSlotFactory extends Factory
{
    protected $model = TimeSlot::class;

    public function definition(): array
    {
        $venue = Venue::factory()->create();

        return [
            'venue_id' => $venue->id,
            'date' => Carbon::tomorrow()->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '10:00',
            'total_courts' => 5,
            'booked_courts' => 0,
            'price' => 50.00,
            'is_peak' => false,
            'is_active' => true,
        ];
    }

    public function forDate(string $date, string $startTime = '09:00'): static
    {
        return $this->state(fn (array $attributes) => [
            'date' => $date,
            'start_time' => $startTime,
            'end_time' => date('H:i', strtotime($startTime) + 3600),
        ]);
    }
}
