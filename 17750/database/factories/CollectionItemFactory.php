<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class CollectionItemFactory extends Factory
{
    protected $model = \App\Models\CollectionItem::class;

    public function definition(): array
    {
        return [
            'user_id' => \App\Models\User::factory(),
            'card_id' => \App\Models\Card::factory(),
            'quantity' => fake()->numberBetween(1, 8),
            'condition' => fake()->randomElement(['NM', 'SP', 'MP', 'HP', 'DMG']),
            'language' => fake()->randomElement(['en', 'zh', 'ja', 'fr', 'de', 'es']),
            'is_foil' => fake()->boolean(20),
            'purchase_price' => fake()->randomFloat(2, 0.1, 100),
            'purchase_date' => fake()->dateTimeBetween('-5 years', 'now')->format('Y-m-d'),
            'notes' => fake()->optional()->sentence(),
        ];
    }

    public function foil(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_foil' => true,
            'purchase_price' => fake()->randomFloat(2, 1, 200),
        ]);
    }

    public function nearMint(): static
    {
        return $this->state(fn (array $attributes) => [
            'condition' => 'NM',
        ]);
    }
}
