<?php

namespace Tests\Feature;

use Tests\TestCase;

class TicketApiTest extends TestCase
{
    public function test_tickets_endpoint_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/tickets');
        $response->assertStatus(401);
    }

    public function test_root_endpoint_returns_app_info(): void
    {
        $response = $this->get('/');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'name',
                'version',
                'api_version',
                'status',
            ]);
    }

    public function test_health_endpoint_returns_service_status(): void
    {
        $response = $this->get('/health');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'timestamp',
                'services' => [
                    'database',
                    'redis',
                ],
            ]);
    }

    public function test_invalid_api_route_returns_404(): void
    {
        $response = $this->getJson('/api/v1/non-existent-endpoint');
        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'code' => 404,
            ]);
    }
}
