<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Card;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CardControllerTest extends TestCase
{
    use RefreshDatabase;

    protected $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auth = $this->createAuthenticatedUser();
    }

    public function test_search_cards()
    {
        Card::factory()->count(10)->create();

        $response = $this->get('/api/v1/cards?name=test&per_page=5', $this->auth['headers']);

        $response->assertStatus(200);
        $this->assertCursorPagination($response);
    }

    public function test_search_cards_with_multiple_filters()
    {
        Card::factory()->create([
            'name' => 'Lightning Bolt',
            'name_normalized' => 'lightning bolt',
            'colors' => ['R'],
            'cmc' => 1,
            'type_line' => 'Instant',
            'rarity' => 'common',
        ]);

        $response = $this->get('/api/v1/cards?colors=R&cmc=1&type=Instant&rarity=common', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['name' => 'Lightning Bolt']);
    }

    public function test_autocomplete()
    {
        Card::factory()->create(['name' => 'Lightning Bolt', 'name_normalized' => 'lightning bolt']);
        Card::factory()->create(['name' => 'Lightning Helix', 'name_normalized' => 'lightning helix']);

        $response = $this->get('/api/v1/cards/autocomplete?query=Light', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_get_random_card()
    {
        Card::factory()->count(5)->create();

        $response = $this->get('/api/v1/cards/random', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['id', 'name', 'type_line', 'oracle_text']]);
    }

    public function test_show_card()
    {
        $card = Card::factory()->create();

        $response = $this->get("/api/v1/cards/{$card->id}", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['id' => $card->id, 'name' => $card->name]);
    }

    public function test_show_nonexistent_card()
    {
        $response = $this->get('/api/v1/cards/999999', $this->auth['headers']);

        $this->assertRfc7807Error($response, 404);
    }

    public function test_card_price_history()
    {
        $card = Card::factory()->create();

        $response = $this->get("/api/v1/cards/{$card->id}/price-history", $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['*' => ['date', 'price_usd', 'price_eur', 'change_percent']]]);
    }

    public function test_fuzzy_search_with_typo()
    {
        Card::factory()->create(['name' => 'Lightning Bolt', 'name_normalized' => 'lightning bolt']);

        $response = $this->get('/api/v1/cards?name=Ligtning Bolt', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['name' => 'Lightning Bolt']);
    }

    public function test_search_by_oracle_text()
    {
        Card::factory()->create([
            'name' => 'Counterspell',
            'oracle_text' => 'Counter target spell.',
        ]);

        $response = $this->get('/api/v1/cards?oracle_text=counter target', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['name' => 'Counterspell']);
    }

    public function test_search_by_set()
    {
        Card::factory()->create(['set_code' => 'LEA', 'set_name' => 'Limited Edition Alpha']);

        $response = $this->get('/api/v1/cards?set_code=LEA', $this->auth['headers']);

        $response->assertStatus(200)
            ->assertJsonFragment(['set_code' => 'LEA']);
    }

    public function test_unauthenticated_access()
    {
        $response = $this->get('/api/v1/cards', ['Accept' => 'application/json']);

        $this->assertRfc7807Error($response, 401);
    }

    public function test_validation_error_on_search()
    {
        $response = $this->get('/api/v1/cards?cmc=invalid', $this->auth['headers']);

        $this->assertRfc7807Error($response, 422);
    }
}
