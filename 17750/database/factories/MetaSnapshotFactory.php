<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class MetaSnapshotFactory extends Factory
{
    protected $model = \App\Models\MetaSnapshot::class;

    public function definition(): array
    {
        $sources = ['mtgtop8', 'mtggoldfish', 'tournament_report', 'local_tournament', 'manual'];
        $formats = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'historic'];
        
        return [
            'format' => fake()->randomElement($formats),
            'source' => fake()->randomElement($sources),
            'title' => fake()->sentence(),
            'description' => fake()->optional()->paragraph(),
            'snapshot_date' => fake()->dateTimeBetween('-3 months', 'now')->format('Y-m-d'),
            'total_matches' => fake()->numberBetween(100, 5000),
            'total_players' => fake()->numberBetween(50, 1000),
            'notes' => fake()->optional()->paragraph(),
        ];
    }

    public function standard(): static
    {
        return $this->state(fn (array $attributes) => [
            'format' => 'standard',
        ]);
    }

    public function modern(): static
    {
        return $this->state(fn (array $attributes) => [
            'format' => 'modern',
        ]);
    }
}
