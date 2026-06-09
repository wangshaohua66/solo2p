<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CardFactory extends Factory
{
    protected $model = \App\Models\Card::class;

    public function definition(): array
    {
        $colors = ['W', 'U', 'B', 'R', 'G'];
        $selectedColors = fake()->randomElements($colors, fake()->numberBetween(0, 3));
        $name = fake()->words(fake()->numberBetween(1, 3), true);
        $typeLine = fake()->randomElement([
            'Creature — Human Wizard',
            'Instant',
            'Sorcery',
            'Enchantment',
            'Artifact',
            'Land',
            'Planeswalker',
        ]);
        $rarity = fake()->randomElement(['common', 'uncommon', 'rare', 'mythic']);

        return [
            'scryfall_id' => Str::uuid(),
            'oracle_id' => Str::uuid(),
            'name' => ucwords($name),
            'name_normalized' => strtolower($name),
            'type_line' => $typeLine,
            'oracle_text' => fake()->paragraph(),
            'mana_cost' => '{' . fake()->numberBetween(0, 5) . '}',
            'cmc' => fake()->numberBetween(0, 8),
            'colors' => $selectedColors,
            'color_identity' => $selectedColors,
            'rarity' => $rarity,
            'set_code' => strtoupper(fake()->lexify('???')),
            'set_name' => fake()->words(3, true),
            'collector_number' => (string) fake()->numberBetween(1, 300),
            'power' => str_contains($typeLine, 'Creature') ? (string) fake()->numberBetween(0, 8) : null,
            'toughness' => str_contains($typeLine, 'Creature') ? (string) fake()->numberBetween(0, 8) : null,
            'loyalty' => str_contains($typeLine, 'Planeswalker') ? fake()->numberBetween(2, 8) : null,
            'artist' => fake()->name(),
            'flavor_text' => fake()->sentence(),
            'price_usd' => fake()->randomFloat(2, 0.1, 100),
            'price_eur' => fake()->randomFloat(2, 0.1, 80),
            'price_tix' => fake()->randomFloat(2, 0.1, 50),
            'released_at' => fake()->dateTimeBetween('-10 years', 'now')->format('Y-m-d'),
            'is_foil' => fake()->boolean(),
            'is_nonfoil' => fake()->boolean(),
            'is_reprint' => fake()->boolean(30),
            'image_uri' => 'https://cards.scryfall.io/normal/front/' . fake()->lexify('?/?.jpg'),
            'scryfall_uri' => 'https://scryfall.com/card/' . fake()->lexify('???/???'),
            'legalities' => [
                'standard' => fake()->randomElement(['legal', 'not_legal', 'banned', 'restricted']),
                'modern' => fake()->randomElement(['legal', 'not_legal', 'banned', 'restricted']),
                'legacy' => fake()->randomElement(['legal', 'not_legal', 'banned', 'restricted']),
                'vintage' => fake()->randomElement(['legal', 'not_legal', 'banned', 'restricted']),
                'commander' => fake()->randomElement(['legal', 'not_legal', 'banned', 'restricted']),
                'pioneer' => fake()->randomElement(['legal', 'not_legal', 'banned', 'restricted']),
            ],
        ];
    }

    public function creature(): static
    {
        return $this->state(fn (array $attributes) => [
            'type_line' => 'Creature — ' . fake()->words(2, true),
            'power' => (string) fake()->numberBetween(1, 8),
            'toughness' => (string) fake()->numberBetween(1, 8),
        ]);
    }

    public function land(): static
    {
        return $this->state(fn (array $attributes) => [
            'type_line' => 'Basic Land — ' . fake()->randomElement(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']),
            'mana_cost' => null,
            'cmc' => 0,
            'colors' => [],
        ]);
    }

    public function rare(): static
    {
        return $this->state(fn (array $attributes) => [
            'rarity' => 'rare',
            'price_usd' => fake()->randomFloat(2, 2, 100),
        ]);
    }

    public function mythic(): static
    {
        return $this->state(fn (array $attributes) => [
            'rarity' => 'mythic',
            'price_usd' => fake()->randomFloat(2, 10, 500),
        ]);
    }
}
