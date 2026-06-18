<?php

namespace Database\Factories;

use App\Models\Venue;
use Illuminate\Database\Eloquent\Factories\Factory;

class VenueFactory extends Factory
{
    protected $model = Venue::class;

    public function definition(): array
    {
        $types = ['swimming', 'badminton', 'basketball', 'tennis', 'table_tennis'];
        $names = [
            'swimming' => '游泳馆',
            'badminton' => '羽毛球馆',
            'basketball' => '篮球馆',
            'tennis' => '网球馆',
            'table_tennis' => '乒乓球馆',
        ];

        $type = $this->faker->randomElement($types);

        return [
            'name' => $this->faker->city . $names[$type],
            'type' => $type,
            'description' => $this->faker->paragraph,
            'address' => $this->faker->address,
            'contact_phone' => $this->faker->phoneNumber,
            'open_time' => '09:00',
            'close_time' => '22:00',
            'slot_duration' => 60,
            'base_price' => $this->faker->randomFloat(2, 30, 100),
            'peak_price' => $this->faker->randomFloat(2, 50, 150),
            'peak_hours' => json_encode([
                ['start' => '18:00', 'end' => '22:00'],
            ]),
            'advance_booking_days' => 7,
            'daily_booking_limit' => 1,
            'is_active' => true,
        ];
    }

    public function swimming(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => '中心游泳馆',
            'type' => 'swimming',
            'base_price' => 50,
            'peak_price' => 75,
        ]);
    }

    public function badminton(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => '中心羽毛球馆',
            'type' => 'badminton',
            'base_price' => 40,
            'peak_price' => 60,
        ]);
    }
}
