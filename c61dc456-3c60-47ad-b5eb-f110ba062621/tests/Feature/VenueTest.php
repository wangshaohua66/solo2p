<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Venue;
use App\Models\Court;
use App\Models\TimeSlot;
use Illuminate\Foundation\Testing\RefreshDatabase;

class VenueTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_venues()
    {
        Venue::factory()->count(5)->create();

        $response = $this->getJson('/api/venues');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'data' => [
                    'total',
                    'page',
                    'per_page',
                    'list' => [
                        '*' => ['id', 'name', 'type', 'is_active'],
                    ],
                ],
            ])
            ->assertJson(['code' => 0]);

        $this->assertEquals(5, $response['data']['total']);
    }

    public function test_can_view_venue_detail()
    {
        $venue = Venue::factory()->create();

        $response = $this->getJson("/api/venues/{$venue->id}");

        $response->assertStatus(200)
            ->assertJson(['code' => 0])
            ->assertJsonFragment(['name' => $venue->name]);
    }

    public function test_can_create_venue()
    {
        $data = [
            'name' => '测试游泳馆',
            'type' => 'swimming',
            'open_time' => '09:00',
            'close_time' => '22:00',
            'slot_duration' => 60,
            'base_price' => 50.00,
            'peak_price' => 75.00,
        ];

        $response = $this->postJson('/api/venues', $data);

        $response->assertStatus(200)
            ->assertJson(['code' => 0]);

        $this->assertDatabaseHas('venues', [
            'name' => '测试游泳馆',
            'type' => 'swimming',
        ]);
    }

    public function test_can_update_venue()
    {
        $venue = Venue::factory()->create();

        $response = $this->putJson("/api/venues/{$venue->id}", [
            'name' => '更新后的场馆',
        ]);

        $response->assertStatus(200)
            ->assertJson(['code' => 0]);

        $venue->refresh();
        $this->assertEquals('更新后的场馆', $venue->name);
    }

    public function test_can_get_availability()
    {
        $venue = Venue::factory()->create([
            'open_time' => '09:00',
            'close_time' => '12:00',
            'slot_duration' => 60,
            'base_price' => 50,
        ]);

        Court::factory()->count(5)->create(['venue_id' => $venue->id]);

        $date = date('Y-m-d');
        $response = $this->getJson("/api/venues/{$venue->id}/availability?date={$date}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'data' => [
                    'venue_id',
                    'date',
                    'slots' => [
                        '*' => ['start_time', 'end_time', 'available_courts', 'price'],
                    ],
                ],
            ])
            ->assertJson(['code' => 0]);
    }

    public function test_can_get_courts()
    {
        $venue = Venue::factory()->create();
        Court::factory()->count(3)->create(['venue_id' => $venue->id]);

        $response = $this->getJson("/api/venues/{$venue->id}/courts");

        $response->assertStatus(200)
            ->assertJson(['code' => 0]);

        $this->assertCount(3, $response['data']);
    }
}
