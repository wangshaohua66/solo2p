<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Card;
use App\Models\CollectionItem;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CollectionControllerTest extends TestCase
{
    use RefreshDatabase;

    protected $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auth = $this->createAuthenticatedUser();
    }

    public function test_list_collection_items()
    {
        $card = Card::factory()->create();
        CollectionItem::factory()->count(5)->create([
            'user_id' => $this->auth['user']->id,
            'card_id' => $card->id,
        ]);

        $response = $this->get('/api/v1/collection', $this->auth['headers']);

        $response->assertStatus(200);
        $this->assertCursorPagination($response);
    }

    public function test_add_collection_item()
    {
        $card = Card::factory()->create();

        $data = [
            'card_id' => $card->id,
            'quantity' => 4,
            'condition' => 'NM',
            'language' => 'en',
            'is_foil' => false,
            'purchase_price' => 2.50,
            'purchase_date' => '2024-01-15',
            'notes' => 'From booster box',
        ];

        $response = $this->post('/api/v1/collection', $data, $this->auth['headers']);

        $response->assertStatus(201)
            ->assertJsonFragment(['quantity' => 4, 'condition' => 'NM']);
        
        $this->assertDatabaseHas('collection_items', [
            'card_id' => $card->id,
            'user_id' => $this->auth['user']->id,
            'quantity' => 4,
        ]);
    }

    public function test_show_collection_item()
    {
        $item = CollectionItem::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->get("/api/v1/collection/{$item->id}", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['id' => $item->id]);
    }

    public function test_update_collection_item()
    {
        $item = CollectionItem::factory()->create([
            'user_id' => $this->auth['user']->id,
            'quantity' => 2,
            'condition' => 'SP',
        ]);

        $response = $this->put("/api/v1/collection/{$item->id}", [
            'quantity' => 4,
            'condition' => 'NM',
            'is_foil' => true,
        ], $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['quantity' => 4, 'condition' => 'NM', 'is_foil' => true]);
    }

    public function test_delete_collection_item()
    {
        $item = CollectionItem::factory()->create([
            'user_id' => $this->auth['user']->id,
        ]);

        $response = $this->delete("/api/v1/collection/{$item->id}", [], $this->auth['headers']);

        $response->assertStatus(204);
        
        $this->assertDatabaseMissing('collection_items', ['id' => $item->id]);
    }

    public function test_collection_statistics()
    {
        $card1 = Card::factory()->create(['rarity' => 'rare', 'colors' => ['W'], 'price_usd' => 5.00]);
        $card2 = Card::factory()->create(['rarity' => 'uncommon', 'colors' => ['U'], 'price_usd' => 1.00]);
        
        CollectionItem::factory()->create([
            'user_id' => $this->auth['user']->id,
            'card_id' => $card1->id,
            'quantity' => 4,
        ]);
        
        CollectionItem::factory()->create([
            'user_id' => $this->auth['user']->id,
            'card_id' => $card2->id,
            'quantity' => 2,
        ]);

        $response = $this->get('/api/v1/collection/stats', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'total_cards',
                    'total_value',
                    'rarity_distribution',
                    'color_distribution',
                    'top_cards',
                ],
            ]);
    }

    public function test_collection_csv_import()
    {
        $csvContent = "card_id,quantity,condition,language,is_foil\n1,4,NM,en,false\n2,2,SP,en,true\n";

        $response = $this->post('/api/v1/collection/import/csv', [
            'file' => $csvContent,
        ], $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['imported', 'failed', 'errors']]);
    }

    public function test_collection_csv_export()
    {
        $card = Card::factory()->create();
        CollectionItem::factory()->count(3)->create([
            'user_id' => $this->auth['user']->id,
            'card_id' => $card->id,
        ]);

        $response = $this->get('/api/v1/collection/export/csv', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_collection_json_export()
    {
        $card = Card::factory()->create();
        CollectionItem::factory()->count(3)->create([
            'user_id' => $this->auth['user']->id,
            'card_id' => $card->id,
        ]);

        $response = $this->get('/api/v1/collection/export/json', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/json');
    }

    public function test_validation_on_create()
    {
        $response = $this->post('/api/v1/collection', [
            'quantity' => 'invalid',
            'condition' => 'INVALID',
        ], $this->auth['headers']);

        $this->assertRfc7807Error($response, 422);
    }

    public function test_cannot_access_other_user_collection()
    {
        $otherUser = \App\Models\User::factory()->create();
        $item = CollectionItem::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->get("/api/v1/collection/{$item->id}", $this->auth['headers']);

        $this->assertRfc7807Error($response, 404);
    }
}
