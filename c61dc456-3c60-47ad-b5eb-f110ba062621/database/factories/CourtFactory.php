<?php

namespace Database\Factories;

use App\Models\Court;
use App\Models\Venue;
use Illuminate\Database\Eloquent\Factories\Factory;

class CourtFactory extends Factory
{
    protected $model = Court::class;

    public function definition(): array
    {
        static $number = 0;
        $number++;

        return [
            'venue_id' => Venue::factory(),
            'name' => '场地' . $number . '号',
            'court_number' => sprintf('%03d', $number),
            'description' => $this->faker->sentence,
            'is_active' => true,
        ];
    }
}
