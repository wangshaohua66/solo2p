<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\DeckValidator;
use App\Models\Card;
use App\Models\Deck;
use Illuminate\Foundation\Testing\RefreshDatabase;

class DeckValidatorTest extends TestCase
{
    use RefreshDatabase;

    protected DeckValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = app(DeckValidator::class);
    }

    public function test_validate_valid_standard_deck()
    {
        $deck = Deck::factory()->create(['format' => 'standard']);
        
        $cards = Card::factory()->count(20)->create();
        $mainboard = [];
        foreach ($cards as $card) {
            $mainboard[] = ['card_id' => $card->id, 'quantity' => 3];
        }
        $deck->mainboard()->createMany($mainboard);

        $sideCards = Card::factory()->count(10)->create();
        $sideboard = [];
        foreach ($sideCards as $card) {
            $sideboard[] = ['card_id' => $card->id, 'quantity' => 1, 'is_sideboard' => true];
        }
        $deck->sideboard()->createMany($sideboard);

        $result = $this->validator->validate($deck);

        $this->assertTrue($result['is_valid']);
        $this->assertEmpty($result['errors']);
        $this->assertEquals(60, $result['stats']['mainboard_count']);
        $this->assertEquals(10, $result['stats']['sideboard_count']);
    }

    public function test_validate_deck_with_too_few_cards()
    {
        $deck = Deck::factory()->create(['format' => 'standard']);
        $card = Card::factory()->create();
        $deck->mainboard()->create(['card_id' => $card->id, 'quantity' => 40]);

        $result = $this->validator->validate($deck);

        $this->assertFalse($result['is_valid']);
        $this->assertContains('Mainboard must have at least 60 cards', $result['errors']);
    }

    public function test_validate_deck_with_too_many_copies()
    {
        $deck = Deck::factory()->create(['format' => 'standard']);
        $card = Card::factory()->create();
        
        $cards = [];
        for ($i = 0; $i < 59; $i++) {
            $c = Card::factory()->create();
            $cards[] = ['card_id' => $c->id, 'quantity' => 1];
        }
        $cards[] = ['card_id' => $card->id, 'quantity' => 5];
        $deck->mainboard()->createMany($cards);

        $result = $this->validator->validate($deck);

        $this->assertFalse($result['is_valid']);
        $this->assertContains("Card {$card->name} has 5 copies, maximum 4 allowed", $result['errors']);
    }

    public function test_basic_land_exception_from_four_copy_rule()
    {
        $deck = Deck::factory()->create(['format' => 'standard']);
        
        $forest = Card::factory()->land()->create([
            'type_line' => 'Basic Land — Forest',
            'name' => 'Forest',
        ]);

        $cards = [];
        for ($i = 0; $i < 20; $i++) {
            $c = Card::factory()->create();
            $cards[] = ['card_id' => $c->id, 'quantity' => 2];
        }
        $cards[] = ['card_id' => $forest->id, 'quantity' => 20];
        $deck->mainboard()->createMany($cards);

        $result = $this->validator->validate($deck);

        $this->assertTrue($result['is_valid']);
        $this->assertNotContains("Card Forest has 20 copies, maximum 4 allowed", $result['errors']);
    }

    public function test_sideboard_size_validation()
    {
        $deck = Deck::factory()->create(['format' => 'standard']);
        
        $mainCards = Card::factory()->count(60)->create();
        foreach ($mainCards as $card) {
            $deck->mainboard()->create(['card_id' => $card->id, 'quantity' => 1]);
        }

        $sideCards = Card::factory()->count(20)->create();
        foreach ($sideCards as $card) {
            $deck->sideboard()->create(['card_id' => $card->id, 'quantity' => 1, 'is_sideboard' => true]);
        }

        $result = $this->validator->validate($deck);

        $this->assertFalse($result['is_valid']);
        $this->assertContains('Sideboard must have at most 15 cards', $result['errors']);
    }

    public function test_commander_deck_validation()
    {
        $deck = Deck::factory()->create(['format' => 'commander']);
        
        $cards = Card::factory()->count(99)->create();
        foreach ($cards as $card) {
            $deck->mainboard()->create(['card_id' => $card->id, 'quantity' => 1]);
        }

        $result = $this->validator->validate($deck);

        $this->assertTrue($result['is_valid']);
        $this->assertEquals(99, $result['stats']['mainboard_count']);
    }

    public function test_color_distribution_calculation()
    {
        $deck = Deck::factory()->create();
        
        $whiteCard = Card::factory()->create(['colors' => ['W']]);
        $blueCard = Card::factory()->create(['colors' => ['U']]);
        $redCard = Card::factory()->create(['colors' => ['R']]);
        $multicolorCard = Card::factory()->create(['colors' => ['W', 'U']]);

        $deck->mainboard()->create(['card_id' => $whiteCard->id, 'quantity' => 4]);
        $deck->mainboard()->create(['card_id' => $blueCard->id, 'quantity' => 4]);
        $deck->mainboard()->create(['card_id' => $redCard->id, 'quantity' => 2]);
        $deck->mainboard()->create(['card_id' => $multicolorCard->id, 'quantity' => 2]);

        $result = $this->validator->validate($deck);

        $this->assertArrayHasKey('color_distribution', $result['stats']);
        $this->assertEquals(6, $result['stats']['color_distribution']['W']);
        $this->assertEquals(6, $result['stats']['color_distribution']['U']);
        $this->assertEquals(2, $result['stats']['color_distribution']['R']);
    }

    public function test_mana_curve_calculation()
    {
        $deck = Deck::factory()->create();
        
        for ($cmc = 0; $cmc <= 7; $cmc++) {
            $card = Card::factory()->create(['cmc' => $cmc, 'type_line' => 'Instant']);
            $deck->mainboard()->create(['card_id' => $card->id, 'quantity' => 4]);
        }

        $result = $this->validator->validate($deck);

        $this->assertArrayHasKey('mana_curve', $result['stats']);
        for ($i = 0; $i <= 7; $i++) {
            $this->assertEquals(4, $result['stats']['mana_curve'][$i]);
        }
    }

    public function test_type_distribution_calculation()
    {
        $deck = Deck::factory()->create();
        
        $creature = Card::factory()->create(['type_line' => 'Creature — Elf']);
        $instant = Card::factory()->create(['type_line' => 'Instant']);
        $sorcery = Card::factory()->create(['type_line' => 'Sorcery']);
        $artifact = Card::factory()->create(['type_line' => 'Artifact']);
        $land = Card::factory()->land()->create();

        $deck->mainboard()->create(['card_id' => $creature->id, 'quantity' => 8]);
        $deck->mainboard()->create(['card_id' => $instant->id, 'quantity' => 4]);
        $deck->mainboard()->create(['card_id' => $sorcery->id, 'quantity' => 4]);
        $deck->mainboard()->create(['card_id' => $artifact->id, 'quantity' => 4]);
        $deck->mainboard()->create(['card_id' => $land->id, 'quantity' => 20]);

        $result = $this->validator->validate($deck);

        $this->assertArrayHasKey('type_distribution', $result['stats']);
        $this->assertEquals(8, $result['stats']['type_distribution']['Creature']);
        $this->assertEquals(4, $result['stats']['type_distribution']['Instant']);
        $this->assertEquals(4, $result['stats']['type_distribution']['Sorcery']);
        $this->assertEquals(4, $result['stats']['type_distribution']['Artifact']);
        $this->assertEquals(20, $result['stats']['type_distribution']['Land']);
    }

    public function test_combined_sideboard_mainboard_copy_limit()
    {
        $deck = Deck::factory()->create(['format' => 'standard']);
        $card = Card::factory()->create();
        
        $mainCards = Card::factory()->count(59)->create();
        foreach ($mainCards as $c) {
            $deck->mainboard()->create(['card_id' => $c->id, 'quantity' => 1]);
        }
        $deck->mainboard()->create(['card_id' => $card->id, 'quantity' => 3]);
        $deck->sideboard()->create(['card_id' => $card->id, 'quantity' => 2, 'is_sideboard' => true]);

        $result = $this->validator->validate($deck);

        $this->assertFalse($result['is_valid']);
        $this->assertContains("Card {$card->name} has 5 total copies (3 main + 2 side), maximum 4 allowed", $result['errors']);
    }

    public function test_format_legality_check()
    {
        $deck = Deck::factory()->create(['format' => 'standard']);
        
        $legalCard = Card::factory()->create([
            'legalities' => ['standard' => 'legal', 'modern' => 'legal'],
        ]);
        $illegalCard = Card::factory()->create([
            'legalities' => ['standard' => 'not_legal', 'modern' => 'legal'],
        ]);

        $cards = Card::factory()->count(58)->create();
        foreach ($cards as $c) {
            $deck->mainboard()->create(['card_id' => $c->id, 'quantity' => 1]);
        }
        $deck->mainboard()->create(['card_id' => $legalCard->id, 'quantity' => 1]);
        $deck->mainboard()->create(['card_id' => $illegalCard->id, 'quantity' => 1]);

        $result = $this->validator->validate($deck);

        $this->assertFalse($result['is_valid']);
        $this->assertContains("Card {$illegalCard->name} is not legal in standard format", $result['errors']);
    }

    public function test_empty_deck_validation()
    {
        $deck = Deck::factory()->create();

        $result = $this->validator->validate($deck);

        $this->assertFalse($result['is_valid']);
        $this->assertContains('Deck is empty', $result['errors']);
    }
}
