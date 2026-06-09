<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\CardSearchService;
use App\Models\Card;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CardSearchServiceTest extends TestCase
{
    use RefreshDatabase;

    protected CardSearchService $searchService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->searchService = app(CardSearchService::class);
    }

    public function test_exact_name_match()
    {
        Card::factory()->create(['name' => 'Lightning Bolt', 'name_normalized' => 'lightning bolt']);
        Card::factory()->create(['name' => 'Lightning Helix', 'name_normalized' => 'lightning helix']);

        $results = $this->searchService->search(['name' => 'Lightning Bolt']);

        $this->assertCount(1, $results);
        $this->assertEquals('Lightning Bolt', $results[0]->name);
    }

    public function test_partial_name_match()
    {
        Card::factory()->create(['name' => 'Lightning Bolt', 'name_normalized' => 'lightning bolt']);
        Card::factory()->create(['name' => 'Lightning Helix', 'name_normalized' => 'lightning helix']);
        Card::factory()->create(['name' => 'Shock', 'name_normalized' => 'shock']);

        $results = $this->searchService->search(['name' => 'Lightning']);

        $this->assertCount(2, $results);
    }

    public function test_fuzzy_search_with_levenshtein_distance()
    {
        Card::factory()->create(['name' => 'Lightning Bolt', 'name_normalized' => 'lightning bolt']);
        Card::factory()->create(['name' => 'Shock', 'name_normalized' => 'shock']);

        $results = $this->searchService->search(['name' => 'Ligtning Bolt']);

        $this->assertCount(1, $results);
        $this->assertEquals('Lightning Bolt', $results[0]->name);
    }

    public function test_search_by_colors()
    {
        Card::factory()->create(['name' => 'Red Card', 'colors' => ['R'], 'name_normalized' => 'red card']);
        Card::factory()->create(['name' => 'Blue Card', 'colors' => ['U'], 'name_normalized' => 'blue card']);
        Card::factory()->create(['name' => 'Multicolor', 'colors' => ['R', 'U'], 'name_normalized' => 'multicolor']);

        $results = $this->searchService->search(['colors' => ['R']]);

        $this->assertCount(2, $results);
    }

    public function test_search_by_cmc()
    {
        Card::factory()->create(['name' => 'One Drop', 'cmc' => 1, 'name_normalized' => 'one drop']);
        Card::factory()->create(['name' => 'Three Drop', 'cmc' => 3, 'name_normalized' => 'three drop']);
        Card::factory()->create(['name' => 'Five Drop', 'cmc' => 5, 'name_normalized' => 'five drop']);

        $results = $this->searchService->search(['cmc_min' => 2, 'cmc_max' => 4]);

        $this->assertCount(1, $results);
        $this->assertEquals('Three Drop', $results[0]->name);
    }

    public function test_search_by_type()
    {
        Card::factory()->create(['name' => 'Grizzly Bears', 'type_line' => 'Creature — Bear', 'name_normalized' => 'grizzly bears']);
        Card::factory()->create(['name' => 'Counterspell', 'type_line' => 'Instant', 'name_normalized' => 'counterspell']);
        Card::factory()->create(['name' => 'Swords to Plowshares', 'type_line' => 'Instant', 'name_normalized' => 'swords to plowshares']);

        $results = $this->searchService->search(['type' => 'Instant']);

        $this->assertCount(2, $results);
    }

    public function test_search_by_rarity()
    {
        Card::factory()->rare()->create(['name' => 'Rare Card', 'name_normalized' => 'rare card']);
        Card::factory()->mythic()->create(['name' => 'Mythic Card', 'name_normalized' => 'mythic card']);
        Card::factory()->create(['name' => 'Common Card', 'rarity' => 'common', 'name_normalized' => 'common card']);

        $results = $this->searchService->search(['rarity' => ['rare', 'mythic']]);

        $this->assertCount(2, $results);
    }

    public function test_search_by_oracle_text()
    {
        Card::factory()->create([
            'name' => 'Counterspell',
            'oracle_text' => 'Counter target spell.',
            'name_normalized' => 'counterspell',
        ]);
        Card::factory()->create([
            'name' => 'Mana Leak',
            'oracle_text' => 'Counter target spell unless its controller pays {2}.',
            'name_normalized' => 'mana leak',
        ]);
        Card::factory()->create([
            'name' => 'Shock',
            'oracle_text' => 'Shock deals 2 damage to any target.',
            'name_normalized' => 'shock',
        ]);

        $results = $this->searchService->search(['oracle_text' => 'counter target spell']);

        $this->assertCount(2, $results);
    }

    public function test_search_by_set()
    {
        Card::factory()->create(['name' => 'Alpha Card', 'set_code' => 'LEA', 'name_normalized' => 'alpha card']);
        Card::factory()->create(['name' => 'Beta Card', 'set_code' => 'LEB', 'name_normalized' => 'beta card']);

        $results = $this->searchService->search(['set_code' => 'LEA']);

        $this->assertCount(1, $results);
        $this->assertEquals('Alpha Card', $results[0]->name);
    }

    public function test_multiple_filters_combined()
    {
        Card::factory()->create([
            'name' => 'Red Creature',
            'colors' => ['R'],
            'cmc' => 2,
            'type_line' => 'Creature — Goblin',
            'rarity' => 'uncommon',
            'name_normalized' => 'red creature',
        ]);
        Card::factory()->create([
            'name' => 'Blue Instant',
            'colors' => ['U'],
            'cmc' => 2,
            'type_line' => 'Instant',
            'rarity' => 'common',
            'name_normalized' => 'blue instant',
        ]);

        $results = $this->searchService->search([
            'colors' => ['R'],
            'cmc_min' => 2,
            'cmc_max' => 2,
            'type' => 'Creature',
        ]);

        $this->assertCount(1, $results);
        $this->assertEquals('Red Creature', $results[0]->name);
    }

    public function test_pagination()
    {
        Card::factory()->count(25)->create();

        $page1 = $this->searchService->search([], 1, 10);
        $page2 = $this->searchService->search([], 2, 10);

        $this->assertCount(10, $page1);
        $this->assertCount(10, $page2);
        $this->assertNotEquals($page1[0]->id, $page2[0]->id);
    }

    public function test_sort_by_name()
    {
        Card::factory()->create(['name' => 'Z Card', 'name_normalized' => 'z card']);
        Card::factory()->create(['name' => 'A Card', 'name_normalized' => 'a card']);
        Card::factory()->create(['name' => 'M Card', 'name_normalized' => 'm card']);

        $results = $this->searchService->search([], 1, 10, 'name', 'asc');

        $this->assertEquals('A Card', $results[0]->name);
        $this->assertEquals('Z Card', $results[2]->name);
    }

    public function test_sort_by_price()
    {
        Card::factory()->create(['name' => 'Cheap Card', 'price_usd' => 0.50, 'name_normalized' => 'cheap card']);
        Card::factory()->create(['name' => 'Expensive Card', 'price_usd' => 50.00, 'name_normalized' => 'expensive card']);
        Card::factory()->create(['name' => 'Mid Card', 'price_usd' => 10.00, 'name_normalized' => 'mid card']);

        $results = $this->searchService->search([], 1, 10, 'price_usd', 'desc');

        $this->assertEquals('Expensive Card', $results[0]->name);
        $this->assertEquals('Cheap Card', $results[2]->name);
    }

    public function test_autocomplete_suggestions()
    {
        Card::factory()->create(['name' => 'Lightning Bolt', 'name_normalized' => 'lightning bolt']);
        Card::factory()->create(['name' => 'Lightning Helix', 'name_normalized' => 'lightning helix']);
        Card::factory()->create(['name' => 'Lightning Greaves', 'name_normalized' => 'lightning greaves']);

        $suggestions = $this->searchService->autocomplete('Light');

        $this->assertCount(3, $suggestions);
        $this->assertStringStartsWith('Light', $suggestions[0]->name);
    }

    public function test_random_card()
    {
        Card::factory()->count(10)->create();

        $random = $this->searchService->random();

        $this->assertNotNull($random);
        $this->assertInstanceOf(Card::class, $random);
    }

    public function test_utf8_fuzzy_search()
    {
        Card::factory()->create(['name' => 'Jötun Grunt', 'name_normalized' => 'jotun grunt']);

        $results = $this->searchService->search(['name' => 'Jotun Grunt']);

        $this->assertCount(1, $results);
    }
}
