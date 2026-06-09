<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\MatchAnalyzer;
use App\Models\Deck;
use App\Models\MatchRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;

class MatchAnalyzerTest extends TestCase
{
    use RefreshDatabase;

    protected MatchAnalyzer $analyzer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->analyzer = app(MatchAnalyzer::class);
    }

    public function test_calculate_overall_win_rate()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        MatchRecord::factory()->count(7)->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'is_winner' => true,
        ]);
        
        MatchRecord::factory()->count(3)->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'is_winner' => false,
        ]);

        $stats = $this->analyzer->getOverview(1);

        $this->assertEquals(10, $stats['total_matches']);
        $this->assertEquals(7, $stats['total_wins']);
        $this->assertEquals(3, $stats['total_losses']);
        $this->assertEquals(70.0, $stats['win_rate']);
    }

    public function test_win_rate_by_deck()
    {
        $deck1 = Deck::factory()->create(['user_id' => 1, 'name' => 'Deck A']);
        $deck2 = Deck::factory()->create(['user_id' => 1, 'name' => 'Deck B']);
        
        MatchRecord::factory()->count(8)->create([
            'user_id' => 1,
            'deck_id' => $deck1->id,
            'is_winner' => true,
        ]);
        MatchRecord::factory()->count(2)->create([
            'user_id' => 1,
            'deck_id' => $deck1->id,
            'is_winner' => false,
        ]);
        
        MatchRecord::factory()->count(4)->create([
            'user_id' => 1,
            'deck_id' => $deck2->id,
            'is_winner' => true,
        ]);
        MatchRecord::factory()->count(6)->create([
            'user_id' => 1,
            'deck_id' => $deck2->id,
            'is_winner' => false,
        ]);

        $stats = $this->analyzer->getByDeck(1);

        $this->assertCount(2, $stats);
        $this->assertEquals('Deck A', $stats[0]['name']);
        $this->assertEquals(80.0, $stats[0]['win_rate']);
        $this->assertEquals('Deck B', $stats[1]['name']);
        $this->assertEquals(40.0, $stats[1]['win_rate']);
    }

    public function test_win_rate_by_archetype()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        MatchRecord::factory()->count(5)->win()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'Rakdos Midrange',
        ]);
        MatchRecord::factory()->count(5)->loss()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'Rakdos Midrange',
        ]);
        
        MatchRecord::factory()->count(7)->win()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'Azorius Control',
        ]);
        MatchRecord::factory()->count(3)->loss()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'Azorius Control',
        ]);

        $stats = $this->analyzer->getByArchetype(1);

        $this->assertCount(2, $stats);
        $this->assertEquals('Azorius Control', $stats[0]['opponent_archetype']);
        $this->assertEquals(70.0, $stats[0]['win_rate']);
        $this->assertEquals('Rakdos Midrange', $stats[1]['opponent_archetype']);
        $this->assertEquals(50.0, $stats[1]['win_rate']);
    }

    public function test_play_vs_draw_stats()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        MatchRecord::factory()->count(7)->win()->onPlay()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
        ]);
        MatchRecord::factory()->count(3)->loss()->onPlay()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
        ]);
        
        MatchRecord::factory()->count(5)->win()->onDraw()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
        ]);
        MatchRecord::factory()->count(5)->loss()->onDraw()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
        ]);

        $stats = $this->analyzer->getPlayDrawStats(1);

        $this->assertEquals(70.0, $stats['on_play']['win_rate']);
        $this->assertEquals(50.0, $stats['on_draw']['win_rate']);
        $this->assertEquals(10, $stats['on_play']['total']);
        $this->assertEquals(10, $stats['on_draw']['total']);
    }

    public function test_trend_analysis_by_date()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        $now = now();
        for ($i = 0; $i < 10; $i++) {
            MatchRecord::factory()->win()->create([
                'user_id' => 1,
                'deck_id' => $deck->id,
                'played_at' => $now->copy()->subDays($i),
            ]);
        }
        for ($i = 10; $i < 20; $i++) {
            MatchRecord::factory()->loss()->create([
                'user_id' => 1,
                'deck_id' => $deck->id,
                'played_at' => $now->copy()->subDays($i),
            ]);
        }

        $stats = $this->analyzer->getTrendData(1, 30);

        $this->assertCount(30, $stats);
    }

    public function test_card_contribution_calculation()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        $card1 = \App\Models\Card::factory()->create(['name' => 'Key Card 1']);
        $card2 = \App\Models\Card::factory()->create(['name' => 'Key Card 2']);
        
        $deck->mainboard()->create(['card_id' => $card1->id, 'quantity' => 4]);
        $deck->mainboard()->create(['card_id' => $card2->id, 'quantity' => 4]);
        
        MatchRecord::factory()->count(8)->win()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'notes' => 'Key Card 1 won me the game',
        ]);
        
        MatchRecord::factory()->count(4)->win()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'notes' => 'Key Card 2 was great',
        ]);
        
        MatchRecord::factory()->count(4)->loss()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'notes' => 'Never drew Key Card 1',
        ]);

        $stats = $this->analyzer->getCardContributions(1, $deck->id);

        $this->assertCount(2, $stats);
    }

    public function test_win_rate_with_date_range_filter()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        $now = now();
        MatchRecord::factory()->count(5)->win()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'played_at' => $now->copy()->subDays(5),
        ]);
        
        MatchRecord::factory()->count(3)->loss()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'played_at' => $now->copy()->subDays(45),
        ]);

        $filters = [
            'start_date' => $now->copy()->subDays(30)->toDateString(),
            'end_date' => $now->toDateString(),
        ];

        $stats = $this->analyzer->getOverview(1, $filters);

        $this->assertEquals(5, $stats['total_matches']);
        $this->assertEquals(100.0, $stats['win_rate']);
    }

    public function test_game_count_analysis()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        MatchRecord::factory()->count(5)->win()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'game_count' => 2,
        ]);
        
        MatchRecord::factory()->count(3)->win()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'game_count' => 3,
        ]);
        
        MatchRecord::factory()->count(2)->loss()->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'game_count' => 2,
        ]);

        $stats = $this->analyzer->getOverview(1);

        $this->assertEquals(2.3, round($stats['avg_games_per_match'], 1));
    }

    public function test_opponent_distribution()
    {
        $deck = Deck::factory()->create(['user_id' => 1]);
        
        MatchRecord::factory()->count(5)->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'Rakdos Midrange',
        ]);
        MatchRecord::factory()->count(3)->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'Azorius Control',
        ]);
        MatchRecord::factory()->count(2)->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'opponent_archetype' => 'Gruul Aggro',
        ]);

        $distribution = $this->analyzer->getOpponentDistribution(1);

        $this->assertCount(3, $distribution);
        $this->assertEquals('Rakdos Midrange', $distribution[0]['name']);
        $this->assertEquals(50.0, $distribution[0]['percentage']);
    }

    public function test_empty_match_history()
    {
        $stats = $this->analyzer->getOverview(999);

        $this->assertEquals(0, $stats['total_matches']);
        $this->assertEquals(0, $stats['win_rate']);
        $this->assertEquals(0, $stats['total_wins']);
        $this->assertEquals(0, $stats['total_losses']);
    }

    public function test_full_analysis()
    {
        $deck = Deck::factory()->create(['user_id' => 1, 'name' => 'Test Deck']);
        
        MatchRecord::factory()->count(15)->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'is_winner' => true,
            'on_play' => true,
            'opponent_archetype' => 'Rakdos Midrange',
            'played_at' => now()->subDays(5),
        ]);
        
        MatchRecord::factory()->count(5)->create([
            'user_id' => 1,
            'deck_id' => $deck->id,
            'is_winner' => false,
            'on_play' => false,
            'opponent_archetype' => 'Azorius Control',
            'played_at' => now()->subDays(10),
        ]);

        $analysis = $this->analyzer->getFullAnalysis(1);

        $this->assertArrayHasKey('overview', $analysis);
        $this->assertArrayHasKey('by_archetype', $analysis);
        $this->assertArrayHasKey('by_deck', $analysis);
        $this->assertArrayHasKey('play_draw_stats', $analysis);
        $this->assertArrayHasKey('trend_data', $analysis);
        $this->assertEquals(75.0, $analysis['overview']['win_rate']);
    }
}
