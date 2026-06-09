<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class DeckCardFactory extends Factory
{
    protected $model = \App\Models\DeckCard::class;

    public function definition(): array
    {
        return [
            'deck_id' => \App\Models\Deck::factory(),
            'card_id' => \App\Models\Card::factory(),
            'quantity' => fake()->numberBetween(1, 4),
            'is_sideboard' => fake()->boolean(15),
        ];
    }

    public function mainboard(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_sideboard' => false,
        ]);
    }

    public function sideboard(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_sideboard' => true,
        ]);
    }
}
