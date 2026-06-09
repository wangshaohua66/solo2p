<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class DeckFactory extends Factory
{
    protected $model = \App\Models\Deck::class;

    public function definition(): array
    {
        $formats = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'historic'];
        $format = fake()->randomElement($formats);
        
        return [
            'user_id' => \App\Models\User::factory(),
            'name' => fake()->words(3, true),
            'format' => $format,
            'description' => fake()->optional()->paragraph(),
            'is_public' => fake()->boolean(30),
        ];
    }

    public function standard(): static
    {
        return $this->state(fn (array $attributes) => [
            'format' => 'standard',
        ]);
    }

    public function commander(): static
    {
        return $this->state(fn (array $attributes) => [
            'format' => 'commander',
        ]);
    }
}
