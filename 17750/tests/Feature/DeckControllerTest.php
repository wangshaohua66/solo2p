<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Card;
use App\Models\Deck;
use App\Models\DeckCard;
use Illuminate\Foundation\Testing\RefreshDatabase;

class DeckControllerTest extends TestCase
{
    use RefreshDatabase;

    protected $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auth = $this->createAuthenticatedUser();
    }

    public function test_list_decks()
    {
        Deck::factory()->count(3)->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->get('/api/v1/decks', $this->auth['headers']);

        $response->assertStatus(200);
        $this->assertCursorPagination($response);
    }

    public function test_create_deck()
    {
        $card1 = Card::factory()->create(['name' => 'Forest', 'type_line' => 'Basic Land — Forest']);
        $card2 = Card::factory()->create(['name' => 'Grizzly Bears', 'type_line' => 'Creature — Bear']);

        $data = [
            'name' => 'Green Aggro',
            'format' => 'standard',
            'description' => 'A fast green aggro deck',
            'mainboard' => [
                ['card_id' => $card1->id, 'quantity' => 20],
                ['card_id' => $card2->id, 'quantity' => 4],
            ],
            'sideboard' => [
                ['card_id' => $card2->id, 'quantity' => 2],
            ],
        ];

        $response = $this->post('/api/v1/decks', $data, $this->auth['headers']);

        $response->assertStatus(201)
            ->assertJsonFragment(['name' => 'Green Aggro', 'format' => 'standard']);
        
        $this->assertDatabaseHas('decks', ['name' => 'Green Aggro']);
        $this->assertDatabaseHas('deck_cards', ['card_id' => $card1->id, 'quantity' => 20]);
    }

    public function test_show_deck()
    {
        $deck = Deck::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->get("/api/v1/decks/{$deck->id}", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'name',
                    'format',
                    'mainboard',
                    'sideboard',
                    'stats' => [
                        'total_cards',
                        'mana_curve',
                        'color_distribution',
                    ],
                ],
            ]);
    }

    public function test_update_deck()
    {
        $deck = Deck::factory()->create([
            'user_id' => $this->auth['user']->id,
            'name' => 'Old Name',
        ]);

        $response = $this->put("/api/v1/decks/{$deck->id}", [
            'name' => 'New Name',
            'description' => 'Updated description',
            'mainboard' => [],
            'sideboard' => [],
        ], $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['name' => 'New Name']);
    }

    public function test_delete_deck()
    {
        $deck = Deck::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->delete("/api/v1/decks/{$deck->id}", [], $this->auth['headers']);

        $response->assertStatus(204);
        
        $this->assertDatabaseMissing('decks', ['id' => $deck->id]);
    }

    public function test_validate_valid_deck()
    {
        $deck = Deck::factory()->create([
            'user_id' => $this->auth['user']->id,
            'format' => 'standard',
        ]);

        $card1 = Card::factory()->create();
        $card2 = Card::factory()->create();

        $mainboard = [];
        for ($i = 0; $i < 15; $i++) {
            $card = Card::factory()->create();
            $mainboard[] = ['card_id' => $card->id, 'quantity' => 4];
        }

        $deck->mainboard()->createMany($mainboard);

        $response = $this->get("/api/v1/decks/{$deck->id}/validate", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'is_valid',
                    'errors',
                    'warnings',
                    'stats',
                ],
            ]);
    }

    public function test_validate_deck_with_too_few_cards()
    {
        $deck = Deck::factory()->create([
            'user_id' => $this->auth['user']->id,
            'format' => 'standard',
        ]);

        $card = Card::factory()->create();
        $deck->mainboard()->create(['card_id' => $card->id, 'quantity' => 10]);

        $response = $this->get("/api/v1/decks/{$deck->id}/validate", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['is_valid' => false]);
    }

    public function test_export_mtgo_format()
    {
        $deck = Deck::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $card = Card::factory()->create(['name' => 'Forest']);
        $deck->mainboard()->create(['card_id' => $card->id, 'quantity' => 4]);

        $response = $this->get("/api/v1/decks/{$deck->id}/export/mtgo", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'text/plain');
    }

    public function test_export_mws_format()
    {
        $deck = Deck::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->get("/api/v1/decks/{$deck->id}/export/mws", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'text/plain');
    }

    public function test_deck_recommendations()
    {
        $card = Card::factory()->create();
        \App\Models\CollectionItem::factory()->create([
            'user_id' => $this->auth['user']->id,
            'card_id' => $card->id,
            'quantity' => 4,
        ]);

        $snapshot = \App\Models\MetaSnapshot::factory()->create(['format' => 'standard']);
        $archetype = \App\Models\MetaArchetype::factory()->create([
            'meta_snapshot_id' => $snapshot->id,
            'name' => 'Green Aggro',
            'percentage' => 15.5,
            'win_rate' => 52.3,
        ]);

        $response = $this->get('/api/v1/decks/recommendations?format=standard&limit=5', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'archetype_name',
                        'match_percentage',
                        'missing_cards',
                        'estimated_cost',
                    ],
                ],
            ]);
    }

    public function test_deck_creation_validation_errors()
    {
        $response = $this->post('/api/v1/decks', [
            'name' => '',
            'format' => 'invalid_format',
        ], $this->auth['headers']);

        $this->assertRfc7807Error($response, 422);
    }

    public function test_cannot_access_other_user_deck()
    {
        $otherUser = \App\Models\User::factory()->create();
        $deck = Deck::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->get("/api/v1/decks/{$deck->id}", $this->auth['headers']);

        $this->assertRfc7807Error($response, 404);
    }
}
