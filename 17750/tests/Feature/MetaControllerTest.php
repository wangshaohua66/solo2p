<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\MetaSnapshot;
use App\Models\MetaArchetype;
use Illuminate\Foundation\Testing\RefreshDatabase;

class MetaControllerTest extends TestCase
{
    use RefreshDatabase;

    protected $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auth = $this->createAuthenticatedUser();
    }

    public function test_list_snapshots()
    {
        MetaSnapshot::factory()->count(3)->create();

        $response = $this->get('/api/v1/meta', $this->auth['headers']);

        $response->assertStatus(200);
        $this->assertCursorPagination($response);
    }

    public function test_create_snapshot()
    {
        $data = [
            'format' => 'standard',
            'source' => 'mtgtop8',
            'title' => 'Weekly Meta Report',
            'snapshot_date' => now()->toDateString(),
            'archetypes' => [
                [
                    'name' => 'Rakdos Midrange',
                    'percentage' => 15.5,
                    'win_rate' => 52.3,
                    'sample_size' => 450,
                ],
                [
                    'name' => 'Azorius Control',
                    'percentage' => 12.8,
                    'win_rate' => 49.7,
                    'sample_size' => 380,
                ],
            ],
        ];

        $response = $this->post('/api/v1/meta', $data, $this->auth['headers']);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'format' => 'standard',
                'title' => 'Weekly Meta Report',
            ]);
        
        $this->assertDatabaseHas('meta_snapshots', ['format' => 'standard']);
        $this->assertDatabaseHas('meta_archetypes', ['name' => 'Rakdos Midrange']);
    }

    public function test_show_snapshot()
    {
        $snapshot = MetaSnapshot::factory()->create();
        MetaArchetype::factory()->count(5)->create(['meta_snapshot_id' => $snapshot->id]);

        $response = $this->get("/api/v1/meta/{$snapshot->id}", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'format',
                    'title',
                    'archetypes' => [
                        '*' => ['name', 'percentage', 'win_rate'],
                    ],
                ],
            ]);
    }

    public function test_delete_snapshot()
    {
        $snapshot = MetaSnapshot::factory()->create();

        $response = $this->delete("/api/v1/meta/{$snapshot->id}", [], $this->auth['headers']);

        $response->assertStatus(204);
        
        $this->assertDatabaseMissing('meta_snapshots', ['id' => $snapshot->id]);
    }

    public function test_get_latest_snapshot()
    {
        MetaSnapshot::factory()->create(['format' => 'standard', 'snapshot_date' => now()->subWeek()]);
        $latest = MetaSnapshot::factory()->create(['format' => 'standard', 'snapshot_date' => now()]);

        $response = $this->get('/api/v1/meta/latest?format=standard', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['id' => $latest->id]);
    }

    public function test_meta_trend_analysis()
    {
        $snapshot1 = MetaSnapshot::factory()->create([
            'format' => 'standard',
            'snapshot_date' => now()->subWeeks(2),
        ]);
        $snapshot2 = MetaSnapshot::factory()->create([
            'format' => 'standard',
            'snapshot_date' => now()->subWeek(),
        ]);
        $snapshot3 = MetaSnapshot::factory()->create([
            'format' => 'standard',
            'snapshot_date' => now(),
        ]);

        foreach ([$snapshot1, $snapshot2, $snapshot3] as $snapshot) {
            MetaArchetype::factory()->create([
                'meta_snapshot_id' => $snapshot->id,
                'name' => 'Rakdos Midrange',
            ]);
        }

        $response = $this->get('/api/v1/meta/trend?format=standard&days=30', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'archetype_trends',
                    'format',
                    'date_range',
                    'snapshots',
                ],
            ]);
    }

    public function test_import_meta_csv()
    {
        $csvContent = "name,percentage,win_rate,sample_size\nRakdos Midrange,15.5,52.3,450\nAzorius Control,12.8,49.7,380\n";

        $response = $this->post('/api/v1/meta/import', [
            'format' => 'standard',
            'source' => 'local_tournament',
            'snapshot_date' => now()->toDateString(),
            'file' => $csvContent,
        ], $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'snapshot_id',
                    'imported',
                    'failed',
                ],
            ]);
    }

    public function test_compare_snapshots()
    {
        $snapshot1 = MetaSnapshot::factory()->create(['format' => 'standard', 'snapshot_date' => now()->subWeek()]);
        $snapshot2 = MetaSnapshot::factory()->create(['format' => 'standard', 'snapshot_date' => now()]);

        MetaArchetype::factory()->create([
            'meta_snapshot_id' => $snapshot1->id,
            'name' => 'Rakdos Midrange',
            'percentage' => 12.0,
            'win_rate' => 50.0,
        ]);

        MetaArchetype::factory()->create([
            'meta_snapshot_id' => $snapshot2->id,
            'name' => 'Rakdos Midrange',
            'percentage' => 15.5,
            'win_rate' => 52.3,
        ]);

        $response = $this->get("/api/v1/meta/compare?from_id={$snapshot1->id}&to_id={$snapshot2->id}", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'from_snapshot',
                    'to_snapshot',
                    'changes' => [
                        '*' => ['name', 'percentage_change', 'win_rate_change'],
                    ],
                    'new_archetypes',
                    'dropped_archetypes',
                ],
            ]);
    }

    public function test_archetype_history()
    {
        $archetypeName = 'Rakdos Midrange';
        
        for ($i = 0; $i < 5; $i++) {
            $snapshot = MetaSnapshot::factory()->create([
                'format' => 'standard',
                'snapshot_date' => now()->subWeeks($i),
            ]);
            MetaArchetype::factory()->create([
                'meta_snapshot_id' => $snapshot->id,
                'name' => $archetypeName,
                'percentage' => 10 + $i,
                'win_rate' => 50 + $i,
            ]);
        }

        $response = $this->get("/api/v1/meta/archetype/{$archetypeName}/history?format=standard", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'archetype_name',
                    'history' => [
                        '*' => ['snapshot_date', 'percentage', 'win_rate'],
                    ],
                    'trend',
                ],
            ]);
    }

    public function test_snapshot_validation()
    {
        $response = $this->post('/api/v1/meta', [
            'format' => 'invalid_format',
            'archetypes' => 'not_an_array',
        ], $this->auth['headers']);

        $this->assertRfc7807Error($response, 422);
    }

    public function test_snapshot_by_format_filter()
    {
        MetaSnapshot::factory()->create(['format' => 'standard']);
        MetaSnapshot::factory()->create(['format' => 'modern']);
        MetaSnapshot::factory()->create(['format' => 'pioneer']);

        $response = $this->get('/api/v1/meta?format=modern', $this->auth['headers']);

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(1, $data);
    }
}
