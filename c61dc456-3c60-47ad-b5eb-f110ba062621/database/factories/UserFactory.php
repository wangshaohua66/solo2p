<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'phone' => '1' . $this->faker->randomNumber(9, true),
            'password' => Hash::make('password'),
            'real_name' => $this->faker->name,
            'id_card' => '110101' . $this->faker->date('Ymd') . $this->faker->randomNumber(4, true),
            'is_verified' => true,
            'credit_score' => 100,
            'is_blacklisted' => false,
            'violation_count' => 0,
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_verified' => false,
            'id_card' => null,
            'real_name' => null,
        ]);
    }

    public function blacklisted(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_blacklisted' => true,
            'blacklist_until' => now()->addDays(7),
            'credit_score' => 50,
        ]);
    }

    public function lowCredit(): static
    {
        return $this->state(fn (array $attributes) => [
            'credit_score' => 55,
            'violation_count' => 3,
        ]);
    }

    public function excellentCredit(): static
    {
        return $this->state(fn (array $attributes) => [
            'credit_score' => 120,
        ]);
    }
}
