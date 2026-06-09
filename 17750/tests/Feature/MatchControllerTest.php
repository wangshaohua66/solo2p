<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Deck;
use App\Models\MatchRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;

class MatchControllerTest extends TestCase
{
    use RefreshDatabase;

    protected $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auth = $this->createAuthenticatedUser();
    }

    public function test_list_matches()
    {
        $deck = Deck::factory()->create(['user_id' => $this->auth['user']->id]);
        MatchRecord::factory()->count(5)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
        ]);

        $response = $this->get('/api/v1/matches', $this->auth['headers']);

        $response->assertStatus(200);
        $this->assertCursorPagination($response);
    }

    public function test_create_match()
    {
        $deck = Deck::factory()->create(['user_id' => $this->auth['user']->id]);

        $data = [
            'deck_id' => $deck->id,
            'opponent_archetype' => 'UW Control',
            'on_play' => true,
            'is_winner' => true,
            'game_count' => 3,
            'notes' => 'Opponent flooded out in game 3',
            'played_at' => now()->toISOString(),
        ];

        $response = $this->post('/api/v1/matches', $data, $this->auth['headers']);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'opponent_archetype' => 'UW Control',
                'is_winner' => true,
            ]);
        
        $this->assertDatabaseHas('match_records', [
            'deck_id' => $deck->id,
            'opponent_archetype' => 'UW Control',
            'is_winner' => true,
        ]);
    }

    public function test_show_match()
    {
        $match = MatchRecord::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->get("/api/v1/matches/{$match->id}", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['id' => $match->id]);
    }

    public function test_update_match()
    {
        $match = MatchRecord::factory()->create([
            'user_id' => $this->auth['user']->id,
            'is_winner' => false,
            'notes' => 'Lost',
        ]);

        $response = $this->put("/api/v1/matches/{$match->id}", [
            'is_winner' => true,
            'notes' => 'Actually won, corrected record',
        ], $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['is_winner' => true]);
    }

    public function test_delete_match()
    {
        $match = MatchRecord::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->delete("/api/v1/matches/{$match->id}", [], $this->auth['headers']);

        $response->assertStatus(204);
        
        $this->assertDatabaseMissing('match_records', ['id' => $match->id]);
    }

    public function test_match_stats()
    {
        $deck = Deck::factory()->create(['user_id' => $this->auth['user']->id]);
        
        MatchRecord::factory()->count(7)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'is_winner' => true,
        ]);
        
        MatchRecord::factory()->count(3)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'is_winner' => false,
        ]);

        $response = $this->get('/api/v1/matches/stats', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'total_matches',
                    'total_wins',
                    'total_losses',
                    'win_rate',
                    'by_archetype',
                    'by_format',
                    'by_deck',
                ],
            ]);
    }

    public function test_match_analysis()
    {
        $deck = Deck::factory()->create(['user_id' => $this->auth['user']->id]);
        
        MatchRecord::factory()->count(10)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'RG Aggro',
            'is_winner' => true,
            'on_play' => true,
        ]);
        
        MatchRecord::factory()->count(5)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'UW Control',
            'is_winner' => false,
            'on_play' => false,
        ]);

        $response = $this->get('/api/v1/matches/analysis?days=30', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'overview',
                    'opponent_distribution',
                    'play_draw_stats',
                    'trend_data',
                    'card_contributions',
                ],
            ])
            ->assertJsonFragment([
                'opponent_archetype' => 'RG Aggro',
            ]);
    }

    public function test_match_stats_by_date_range()
    {
        $deck = Deck::factory()->create(['user_id' => $this->auth['user']->id]);
        
        MatchRecord::factory()->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'is_winner' => true,
            'played_at' => now()->subDays(10),
        ]);
        
        MatchRecord::factory()->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'is_winner' => false,
            'played_at' => now()->subDays(40),
        ]);

        $response = $this->get('/api/v1/matches/stats?start_date=' . now()->subDays(30)->toDateString(), $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['total_matches' => 1]);
    }

    public function test_export_matches_json()
    {
        $deck = Deck::factory()->create(['user_id' => $this->auth['user']->id]);
        MatchRecord::factory()->count(5)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
        ]);

        $response = $this->get('/api/v1/matches/export/json', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/json');
    }

    public function test_match_creation_validation()
    {
        $response = $this->post('/api/v1/matches', [
            'opponent_archetype' => '',
            'is_winner' => 'not_boolean',
        ], $this->auth['headers']);

        $this->assertRfc7807Error($response, 422);
    }

    public function test_first_play_win_rate_analysis()
    {
        $deck = Deck::factory()->create(['user_id' => $this->auth['user']->id]);
        
        MatchRecord::factory()->count(8)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'on_play' => true,
            'is_winner' => true,
        ]);
        
        MatchRecord::factory()->count(2)->create([
            'user_id' => $this->auth['user']->id,
            'deck_id' => $deck->id,
            'on_play' => true,
            'is_winner' => false,
        ]);

        $response = $this->get('/api/v1/matches/analysis', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['play_draw_stats']]);
    }
}
