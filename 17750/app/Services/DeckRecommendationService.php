<?php

namespace App\Services;

use App\Models\Card;
use App\Models\CollectionItem;
use App\Models\MetaSnapshot;
use App\Models\MetaArchetype;
use Illuminate\Database\Eloquent\Collection;

class DeckRecommendationService
{
    private const MATCH_THRESHOLD = 0.6;

    public function getRecommendations(int $userId, ?string $format = 'standard', int $limit = 5): array
    {
        $collection = CollectionItem::where('user_id', $userId)
            ->with('card')
            ->get()
            ->keyBy(function ($item) {
                return $item->card?->oracle_id ?? $item->card_id;
            });

        $collectionCounts = $this->getCollectionCounts($collection);

        $latestMeta = MetaSnapshot::byFormat($format)
            ->latest()
            ->with('archetypes')
            ->first();

        if (! $latestMeta) {
            return $this->generateRecommendationsFromCollection($collectionCounts, $format, $limit);
        }

        $recommendations = [];

        foreach ($latestMeta->archetypes as $archetype) {
            $archetypeCards = $this->getArchetypeCardList($archetype, $format);
            $matchScore = $this->calculateMatchScore($collectionCounts, $archetypeCards);

            if ($matchScore >= self::MATCH_THRESHOLD) {
                $missingCards = $this->calculateMissingCards($collectionCounts, $archetypeCards);
                $costEstimate = $this->estimateAcquisitionCost($missingCards);

                $recommendations[] = [
                    'archetype_name' => $archetype->name,
                    'meta_percentage' => (float) $archetype->percentage,
                    'meta_win_rate' => (float) $archetype->win_rate,
                    'match_score' => $matchScore,
                    'owned_cards' => $this->countOwnedCards($collectionCounts, $archetypeCards),
                    'total_cards' => array_sum(array_column($archetypeCards, 'quantity')),
                    'missing_cards' => $missingCards,
                    'acquisition_cost' => $costEstimate,
                    'color_identity' => $archetype->color_identity,
                    'format' => $format,
                ];
            }
        }

        usort($recommendations, function ($a, $b) {
            return $b['match_score'] <=> $a['match_score'];
        });

        return array_slice($recommendations, 0, $limit);
    }

    private function getCollectionCounts(Collection $collection): array
    {
        $counts = [];

        foreach ($collection as $item) {
            $oracleId = $item->card?->oracle_id;
            if (! $oracleId) {
                continue;
            }

            if (! isset($counts[$oracleId])) {
                $counts[$oracleId] = [
                    'name' => $item->card->name,
                    'quantity' => 0,
                    'card' => $item->card,
                ];
            }
            $counts[$oracleId]['quantity'] += $item->quantity;
        }

        return $counts;
    }

    private function getArchetypeCardList(MetaArchetype $archetype, string $format): array
    {
        $metaData = $archetype->metaSnapshot?->meta_data ?? [];
        $archetypeData = $metaData['archetypes'][$archetype->name] ?? [];

        if (! empty($archetypeData['mainboard'])) {
            $cards = [];
            foreach ($archetypeData['mainboard'] as $cardName => $quantity) {
                $card = Card::where('name_normalized', strtolower($cardName))
                    ->legalIn($format)
                    ->orderBy('released_at', 'desc')
                    ->first();

                if ($card) {
                    $cards[] = [
                        'oracle_id' => $card->oracle_id,
                        'name' => $card->name,
                        'quantity' => $quantity,
                        'card' => $card,
                    ];
                }
            }
            return $cards;
        }

        return $this->generateSampleDecklist($archetype, $format);
    }

    private function generateSampleDecklist(MetaArchetype $archetype, string $format): array
    {
        $colorIdentity = $archetype->color_identity ?? [];
        $cardTypes = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land'];
        $cards = [];

        foreach ($cardTypes as $type) {
            $query = Card::byType($type)->legalIn($format);

            if (! empty($colorIdentity)) {
                foreach ($colorIdentity as $color) {
                    $query->whereJsonContains('color_identity', $color);
                }
            }

            $typeCards = $query->orderBy('edhrec_rank', 'asc')->limit(20)->get();

            foreach ($typeCards as $card) {
                $quantity = $type === 'Land' ? 4 : ($this->isBasicLand($card->name) ? 999 : 4);
                $cards[] = [
                    'oracle_id' => $card->oracle_id,
                    'name' => $card->name,
                    'quantity' => min($quantity, 4),
                    'card' => $card,
                ];
            }
        }

        return $cards;
    }

    private function isBasicLand(string $name): bool
    {
        $basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];
        foreach ($basics as $basic) {
            if (stripos($name, $basic) !== false) {
                return true;
            }
        }
        return false;
    }

    private function calculateMatchScore(array $collection, array $required): float
    {
        $totalRequired = 0;
        $totalOwned = 0;

        foreach ($required as $req) {
            $oracleId = $req['oracle_id'];
            $needed = $req['quantity'];
            $have = $collection[$oracleId]['quantity'] ?? 0;

            $totalRequired += $needed;
            $totalOwned += min($have, $needed);
        }

        return $totalRequired > 0 ? $totalOwned / $totalRequired : 0;
    }

    private function countOwnedCards(array $collection, array $required): int
    {
        $owned = 0;

        foreach ($required as $req) {
            $oracleId = $req['oracle_id'];
            $needed = $req['quantity'];
            $have = $collection[$oracleId]['quantity'] ?? 0;
            $owned += min($have, $needed);
        }

        return $owned;
    }

    private function calculateMissingCards(array $collection, array $required): array
    {
        $missing = [];

        foreach ($required as $req) {
            $oracleId = $req['oracle_id'];
            $needed = $req['quantity'];
            $have = $collection[$oracleId]['quantity'] ?? 0;

            if ($have < $needed) {
                $missing[] = [
                    'oracle_id' => $oracleId,
                    'name' => $req['name'],
                    'quantity_needed' => $needed - $have,
                    'quantity_have' => $have,
                    'quantity_required' => $needed,
                    'price_usd' => $req['card']?->price_usd,
                    'price_eur' => $req['card']?->price_eur,
                ];
            }
        }

        usort($missing, function ($a, $b) {
            return ($b['price_usd'] * $b['quantity_needed']) <=> ($a['price_usd'] * $a['quantity_needed']);
        });

        return $missing;
    }

    private function estimateAcquisitionCost(array $missingCards): array
    {
        $totalUsd = 0;
        $totalEur = 0;

        foreach ($missingCards as $card) {
            $priceUsd = (float) ($card['price_usd'] ?? 0);
            $priceEur = (float) ($card['price_eur'] ?? 0);
            $qty = $card['quantity_needed'];

            $totalUsd += $priceUsd * $qty;
            $totalEur += $priceEur * $qty;
        }

        return [
            'usd' => round($totalUsd, 2),
            'eur' => round($totalEur, 2),
            'missing_count' => count($missingCards),
            'budget_tier' => $this->getBudgetTier($totalUsd),
        ];
    }

    private function getBudgetTier(float $totalUsd): string
    {
        return match (true) {
            $totalUsd < 25 => 'Budget (< $25)',
            $totalUsd < 100 => 'Low ($25-$100)',
            $totalUsd < 500 => 'Mid ($100-$500)',
            $totalUsd < 1000 => 'High ($500-$1000)',
            default => 'Premium (> $1000)',
        };
    }

    private function generateRecommendationsFromCollection(array $collection, string $format, int $limit): array
    {
        $colorCounts = [
            'W' => 0, 'U' => 0, 'B' => 0, 'R' => 0, 'G' => 0,
        ];

        foreach ($collection as $item) {
            $colors = $item['card']?->color_identity ?? [];
            foreach ($colors as $color) {
                if (isset($colorCounts[$color])) {
                    $colorCounts[$color] += $item['quantity'];
                }
            }
        }

        arsort($colorCounts);
        $topColors = array_keys(array_filter($colorCounts, fn($c) => $c > 0));
        $deckColors = array_slice($topColors, 0, min(3, count($topColors)));

        $recommendations = [];
        $archetypes = ['Aggro', 'Midrange', 'Control', 'Combo'];

        foreach ($archetypes as $archetype) {
            $sampleDeck = $this->buildDeckFromCollection($collection, $deckColors, $format);
            $matchScore = $this->calculateMatchScore($collection, $sampleDeck);

            $recommendations[] = [
                'archetype_name' => implode('', $deckColors) . ' ' . $archetype,
                'meta_percentage' => null,
                'meta_win_rate' => null,
                'match_score' => $matchScore,
                'owned_cards' => $this->countOwnedCards($collection, $sampleDeck),
                'total_cards' => 60,
                'missing_cards' => $this->calculateMissingCards($collection, $sampleDeck),
                'acquisition_cost' => $this->estimateAcquisitionCost(
                    $this->calculateMissingCards($collection, $sampleDeck)
                ),
                'color_identity' => $deckColors,
                'format' => $format,
            ];
        }

        usort($recommendations, function ($a, $b) {
            return $b['match_score'] <=> $a['match_score'];
        });

        return array_slice($recommendations, 0, $limit);
    }

    private function buildDeckFromCollection(array $collection, array $colors, string $format): array
    {
        $deck = [];

        $basicLands = [
            'W' => 'Plains', 'U' => 'Island', 'B' => 'Swamp', 'R' => 'Mountain', 'G' => 'Forest',
        ];

        foreach ($colors as $color) {
            if (isset($basicLands[$color])) {
                $land = Card::where('name', $basicLands[$color])->first();
                if ($land) {
                    $deck[] = [
                        'oracle_id' => $land->oracle_id,
                        'name' => $land->name,
                        'quantity' => 12,
                        'card' => $land,
                    ];
                }
            }
        }

        foreach ($collection as $oracleId => $item) {
            $cardColors = $item['card']?->color_identity ?? [];
            $intersection = array_intersect($colors, $cardColors);

            if (! empty($intersection) || empty($cardColors)) {
                $deck[] = [
                    'oracle_id' => $oracleId,
                    'name' => $item['name'],
                    'quantity' => min($item['quantity'], 4),
                    'card' => $item['card'],
                ];
            }
        }

        return $deck;
    }
}
