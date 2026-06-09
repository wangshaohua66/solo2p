<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class MatchRecordFactory extends Factory
{
    protected $model = \App\Models\MatchRecord::class;

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
        ];

        return [
            'user_id' => \App\Models\User::factory(),
            'deck_id' => \App\Models\Deck::factory(),
            'opponent_archetype' => fake()->randomElement($archetypes),
            'opponent_name' => fake()->optional()->name(),
            'on_play' => fake()->boolean(),
            'is_winner' => fake()->boolean(),
            'game_wins' => fake()->numberBetween(0, 2),
            'game_losses' => fake()->numberBetween(0, 2),
            'notes' => fake()->optional()->paragraph(),
            'played_at' => fake()->dateTimeBetween('-6 months', 'now'),
            'event_name' => fake()->optional()->words(3, true),
        ];
    }

    public function win(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_winner' => true,
        ]);
    }

    public function loss(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_winner' => false,
        ]);
    }

    public function onPlay(): static
    {
        return $this->state(fn (array $attributes) => [
            'on_play' => true,
        ]);
    }

    public function onDraw(): static
    {
        return $this->state(fn (array $attributes) => [
            'on_play' => false,
        ]);
    }
}
