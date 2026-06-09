<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class PriceHistoryFactory extends Factory
{
    protected $model = \App\Models\PriceHistory::class;

    public function definition(): array
    {
        return [
            'card_id' => \App\Models\Card::factory(),
            'price_date' => fake()->dateTimeBetween('-1 year', 'now')->format('Y-m-d'),
            'price_usd' => fake()->randomFloat(2, 0.1, 100),
            'price_eur' => fake()->randomFloat(2, 0.1, 80),
            'price_tix' => fake()->randomFloat(2, 0.1, 50),
        ];
    }
}
