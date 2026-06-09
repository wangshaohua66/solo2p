<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    }

    protected function createAuthenticatedUser()
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);
        
        $token = $user->createToken('test-token');
        
        return [
            'user' => $user,
            'token' => $token->plainTextToken,
            'headers' => [
                'Authorization' => 'Bearer ' . $token->plainTextToken,
                'Accept' => 'application/json',
            ],
        ];
    }

    protected function assertJsonStructure($response, array $structure)
    {
        $response->assertJsonStructure($structure);
    }

    protected function assertRfc7807Error($response, $statusCode)
    {
        $response->assertStatus($statusCode)
            ->assertHeader('Content-Type', 'application/problem+json')
            ->assertJsonStructure([
                'type',
                'title',
                'status',
                'detail',
                'instance',
                'trace_id',
            ]);
    }

    protected function assertCursorPagination($response)
    {
        $response->assertJsonStructure([
            'data',
            'next_cursor',
            'prev_cursor',
        ]);
    }
}
