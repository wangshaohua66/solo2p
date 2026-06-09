<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Card;
use App\Models\CollectionItem;
use App\Models\Deck;
use App\Models\MatchRecord;
use App\Models\MetaSnapshot;
use App\Models\MetaArchetype;
use App\Models\PriceHistory;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::factory()->create([
            'name' => 'MTG Player',
            'email' => 'player@example.com',
            'password' => Hash::make('password123'),
        ]);

        $this->command->info('Creating sample cards...');
        $cards = Card::factory()->count(100)->create();

        $this->command->info('Creating sample collection...');
        $collectionCards = $cards->random(30);
        foreach ($collectionCards as $card) {
            CollectionItem::factory()->create([
                'user_id' => $user->id,
                'card_id' => $card->id,
                'quantity' => rand(1, 4),
            ]);
        }

        $this->command->info('Creating sample decks...');
        $deck1 = Deck::factory()->create([
            'user_id' => $user->id,
            'name' => 'Rakdos Midrange',
            'format' => 'standard',
            'description' => 'A powerful midrange deck featuring black and red removal and threats.',
        ]);

        $deck2 = Deck::factory()->create([
            'user_id' => $user->id,
            'name' => 'Azorius Control',
            'format' => 'standard',
            'description' => 'A controlling deck with counterspells and removal.',
        ]);

        $deckCards = $cards->random(25);
        foreach ($deckCards as $card) {
            $deck1->mainboard()->create([
                'card_id' => $card->id,
                'quantity' => rand(2, 4),
                'is_sideboard' => false,
            ]);
        }

        $sideCards = $cards->random(10);
        foreach ($sideCards as $card) {
            $deck1->sideboard()->create([
                'card_id' => $card->id,
                'quantity' => 1,
                'is_sideboard' => true,
            ]);
        }

        $this->command->info('Creating match records...');
        $archetypes = [
            'Rakdos Midrange', 'Azorius Control', 'Gruul Aggro',
            'Blue-White Control', 'Green-White Tokens', 'Izzet Phoenix',
        ];

        for ($i = 0; $i < 50; $i++) {
            MatchRecord::factory()->create([
                'user_id' => $user->id,
                'deck_id' => rand(0, 1) ? $deck1->id : $deck2->id,
                'opponent_archetype' => $archetypes[array_rand($archetypes)],
                'is_win' => (bool) rand(0, 1),
                'is_first' => (bool) rand(0, 1),
            ]);
        }

        $this->command->info('Creating meta snapshots...');
        $formats = ['standard', 'modern', 'pioneer'];
        $sources = ['mtgtop8', 'mtggoldfish', 'local_tournament'];

        for ($i = 0; $i < 3; $i++) {
            $snapshot = MetaSnapshot::factory()->create([
                'format' => $formats[$i],
                'source' => $sources[$i],
                'snapshot_date' => now()->subDays($i * 7),
            ]);

            $archetypeNames = [
                'Rakdos Midrange', 'Azorius Control', 'Gruul Aggro',
                'Izzet Phoenix', 'Mono-Red Aggro', 'Selesnya Company',
                'Grixis Shadow', 'Amulet Titan', 'Burn',
            ];

            shuffle($archetypeNames);
            for ($j = 0; $j < 8; $j++) {
                MetaArchetype::factory()->create([
                    'meta_snapshot_id' => $snapshot->id,
                    'name' => $archetypeNames[$j],
                    'rank' => $j + 1,
                    'percentage' => 25 - ($j * 2.5),
                    'win_rate' => 50 + (rand(-15, 15) / 10),
                ]);
            }
        }

        $this->command->info('Creating price history...');
        $pricedCards = $cards->random(20);
        foreach ($pricedCards as $card) {
            for ($i = 0; $i < 12; $i++) {
                PriceHistory::factory()->create([
                    'card_id' => $card->id,
                    'price_date' => now()->subMonths($i),
                    'price_usd' => $card->price_usd * (1 + (rand(-10, 10) / 100)),
                ]);
            }
        }

        $this->command->info('Seeding completed successfully!');
        $this->command->info('Test user: player@example.com / password123');
    }
}
