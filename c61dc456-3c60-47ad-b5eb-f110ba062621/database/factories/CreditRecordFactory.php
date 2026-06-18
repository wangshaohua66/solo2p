<?php

namespace Database\Factories;

use App\Models\CreditRecord;
use App\Models\User;
use App\Models\Booking;
use Illuminate\Database\Eloquent\Factories\Factory;

class CreditRecordFactory extends Factory
{
    protected $model = CreditRecord::class;

    public function definition(): array
    {
        $user = User::factory()->create();

        return [
            'user_id' => $user->id,
            'booking_id' => null,
            'type' => 'reward',
            'score_change' => 1,
            'balance_before' => 100,
            'balance_after' => 101,
            'reason' => $this->faker->sentence,
            'is_violation' => false,
            'is_blacklist_trigger' => false,
        ];
    }

    public function penalty(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'penalty',
            'score_change' => -10,
            'balance_before' => 100,
            'balance_after' => 90,
            'is_violation' => true,
            'reason' => '超时未签到',
        ]);
    }
}
