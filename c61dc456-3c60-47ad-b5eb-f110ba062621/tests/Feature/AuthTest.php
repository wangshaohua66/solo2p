<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register()
    {
        $response = $this->postJson('/api/auth/register', [
            'phone' => '13800138000',
            'password' => '123456',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'message',
                'data' => [
                    'user' => ['id', 'phone', 'is_verified', 'credit_score'],
                    'access_token',
                    'token_type',
                ],
            ])
            ->assertJson(['code' => 0]);

        $this->assertDatabaseHas('users', [
            'phone' => '13800138000',
            'credit_score' => 100,
            'is_verified' => false,
        ]);
    }

    public function test_user_cannot_register_with_invalid_phone()
    {
        $response = $this->postJson('/api/auth/register', [
            'phone' => '12345',
            'password' => '123456',
        ]);

        $response->assertStatus(422);
    }

    public function test_user_cannot_register_with_duplicate_phone()
    {
        User::factory()->create(['phone' => '13800138000']);

        $response = $this->postJson('/api/auth/register', [
            'phone' => '13800138000',
            'password' => '123456',
        ]);

        $response->assertStatus(422);
    }

    public function test_user_can_login()
    {
        $user = User::factory()->create([
            'phone' => '13800138000',
            'password' => bcrypt('123456'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'phone' => '13800138000',
            'password' => '123456',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'message',
                'data' => [
                    'user' => ['id', 'phone'],
                    'access_token',
                ],
            ])
            ->assertJson(['code' => 0]);
    }

    public function test_user_cannot_login_with_wrong_password()
    {
        $user = User::factory()->create([
            'phone' => '13800138000',
            'password' => bcrypt('123456'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'phone' => '13800138000',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
            ->assertJson(['code' => 1]);
    }

    public function test_user_can_get_profile()
    {
        $user = User::factory()->create();
        Passport::actingAs($user);

        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'data' => ['id', 'phone', 'credit_score'],
            ])
            ->assertJson(['code' => 0]);
    }

    public function test_user_can_verify_identity()
    {
        $user = User::factory()->create([
            'is_verified' => false,
            'id_card' => null,
        ]);
        Passport::actingAs($user);

        $response = $this->postJson('/api/auth/verify', [
            'real_name' => '张三',
            'id_card' => '110101199003078888',
        ]);

        $response->assertStatus(200)
            ->assertJson(['code' => 0]);

        $user->refresh();
        $this->assertTrue($user->is_verified);
        $this->assertEquals('张三', $user->real_name);
    }

    public function test_user_cannot_verify_with_invalid_id_card()
    {
        $user = User::factory()->create(['is_verified' => false]);
        Passport::actingAs($user);

        $response = $this->postJson('/api/auth/verify', [
            'real_name' => '张三',
            'id_card' => '12345',
        ]);

        $response->assertStatus(422);
    }
}
