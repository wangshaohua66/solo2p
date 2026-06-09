<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class MetaArchetypeFactory extends Factory
{
    protected $model = \App\Models\MetaArchetype::class;

    public function definition(): array
    {
        $archetypes = [
            'Rakdos Midrange',
            'Azorius Control',
            'Gruul Aggro',
            'Blue-White Control',
            'Green-White Tokens',
            'Izzet Phoenix',
            'Jund Sacrifice',
            'Mono-Red Aggro',
            'Selesnya Company',
            'Grixis Shadow',
            'Amulet Titan',
            'Burn',
            'Death\'s Shadow',
            'Dredge',
            'Eldrazi Tron',
            'Gifts Storm',
            'Hardened Scales',
            'Humans',
            'Infect',
            'Jund',
            'Living End',
            'Merfolk',
            'Rin and Seri',
            'Storm',
            'Tron',
            'UW Control',
        ];

        return [
            'meta_snapshot_id' => \App\Models\MetaSnapshot::factory(),
            'name' => fake()->randomElement($archetypes),
            'percentage' => fake()->randomFloat(2, 1, 25),
            'win_rate' => fake()->randomFloat(2, 35, 65),
            'sample_size' => fake()->numberBetween(20, 500),
            'rank' => fake()->numberBetween(1, 20),
            'trend' => fake()->randomElement(['up', 'down', 'stable']),
            'notes' => fake()->optional()->sentence(),
        ];
    }

    public function tier1(): static
    {
        return $this->state(fn (array $attributes) => [
            'rank' => fake()->numberBetween(1, 3),
            'percentage' => fake()->randomFloat(2, 10, 25),
        ]);
    }

    public function tier2(): static
    {
        return $this->state(fn (array $attributes) => [
            'rank' => fake()->numberBetween(4, 8),
            'percentage' => fake()->randomFloat(2, 5, 10),
        ]);
    }
}
