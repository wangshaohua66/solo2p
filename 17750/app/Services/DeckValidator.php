<?php

namespace App\Services;

use App\Models\Deck;
use Illuminate\Support\Collection;

class DeckValidator
{
    private const MAINBOARD_MIN = 60;
    private const SIDEBOARD_MAX = 15;
    private const MAX_COPIES_REGULAR = 4;
    private const MAX_COPIES_BASIC_LAND = 999;

    private const BASIC_LAND_TYPES = [
        'Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
        'Wastes', 'Snow-Covered Plains', 'Snow-Covered Island',
        'Snow-Covered Swamp', 'Snow-Covered Mountain', 'Snow-Covered Forest',
    ];

    public function validate(Deck $deck): array
    {
        $errors = [];

        $mainboard = $deck->mainboard;
        $sideboard = $deck->sideboard;

        $mainboardCount = $mainboard->sum('quantity');
        $sideboardCount = $sideboard->sum('quantity');

        if ($mainboardCount < self::MAINBOARD_MIN) {
            $errors[] = "Mainboard must contain at least " . self::MAINBOARD_MIN . " cards (currently {$mainboardCount})";
        }

        if ($sideboardCount > self::SIDEBOARD_MAX) {
            $errors[] = "Sideboard cannot contain more than " . self::SIDEBOARD_MAX . " cards (currently {$sideboardCount})";
        }

        $allCards = $mainboard->merge($sideboard);
        $copyErrors = $this->validateCopyLimits($allCards, $deck->format);
        $errors = array_merge($errors, $copyErrors);

        $sideboardErrors = $this->validateSideboardRestrictions($mainboard, $sideboard);
        $errors = array_merge($errors, $sideboardErrors);

        $colorErrors = $this->validateColorIdentity($deck, $mainboard);
        $errors = array_merge($errors, $colorErrors);

        if (! empty($deck->format) && $deck->format !== 'casual') {
            $legalityErrors = $this->validateFormatLegality($deck, $allCards);
            $errors = array_merge($errors, $legalityErrors);
        }

        return $errors;
    }

    private function validateCopyLimits(Collection $cards, string $format): array
    {
        $errors = [];
        $cardCounts = [];

        foreach ($cards as $deckCard) {
            $cardName = $deckCard->card?->name ?? 'Unknown';
            $oracleId = $deckCard->card?->oracle_id ?? $cardName;

            if (! isset($cardCounts[$oracleId])) {
                $cardCounts[$oracleId] = [
                    'name' => $cardName,
                    'quantity' => 0,
                    'is_basic_land' => $this->isBasicLand($cardName),
                ];
            }
            $cardCounts[$oracleId]['quantity'] += $deckCard->quantity;
        }

        foreach ($cardCounts as $card) {
            $maxCopies = $card['is_basic_land'] ? self::MAX_COPIES_BASIC_LAND : self::MAX_COPIES_REGULAR;

            if ($card['quantity'] > $maxCopies && ! $this->isFormatAllowingMultiple($format)) {
                $errors[] = "Too many copies of {$card['name']}: {$card['quantity']} (maximum {$maxCopies})";
            }
        }

        return $errors;
    }

    private function validateSideboardRestrictions(Collection $mainboard, Collection $sideboard): array
    {
        $errors = [];

        $mainboardNames = $mainboard->map(function ($dc) {
            return $dc->card?->name;
        })->filter()->unique();

        $sideboardNames = $sideboard->map(function ($dc) {
            return $dc->card?->name;
        })->filter()->unique();

        $overlap = $mainboardNames->intersect($sideboardNames);
        if ($overlap->isNotEmpty()) {
            foreach ($overlap as $name) {
                $mainQty = $mainboard->where('card.name', $name)->sum('quantity');
                $sideQty = $sideboard->where('card.name', $name)->sum('quantity');

                if (! $this->isBasicLand($name) && ($mainQty + $sideQty) > self::MAX_COPIES_REGULAR) {
                    $errors[] = "Combined copies of {$name} in mainboard and sideboard exceed 4-card limit (main: {$mainQty}, side: {$sideQty})";
                }
            }
        }

        return $errors;
    }

    private function validateColorIdentity(Deck $deck, Collection $mainboard): array
    {
        $errors = [];

        if (empty($deck->colors)) {
            return $errors;
        }

        $allowedColors = $deck->colors;

        foreach ($mainboard as $deckCard) {
            $cardColors = $deckCard->card?->color_identity ?? [];

            foreach ($cardColors as $color) {
                if (! in_array($color, $allowedColors)) {
                    $errors[] = "Card {$deckCard->card?->name} has color identity {$color} which is not allowed in deck colors " . implode('', $allowedColors);
                }
            }
        }

        return $errors;
    }

    private function validateFormatLegality(Deck $deck, Collection $allCards): array
    {
        $errors = [];
        $format = strtolower($deck->format);

        foreach ($allCards as $deckCard) {
            $card = $deckCard->card;
            if (! $card) {
                continue;
            }

            $legalities = $card->legalities ?? [];
            $formatLegality = $legalities[$format] ?? 'not_legal';

            if ($formatLegality !== 'legal' && $formatLegality !== 'restricted') {
                $errors[] = "Card {$card->name} is {$formatLegality} in {$format}";
            }

            if ($formatLegality === 'restricted' && $deckCard->quantity > 1) {
                $errors[] = "Card {$card->name} is restricted in {$format}, only 1 copy allowed (have {$deckCard->quantity})";
            }
        }

        return $errors;
    }

    private function isBasicLand(string $cardName): bool
    {
        foreach (self::BASIC_LAND_TYPES as $basicLand) {
            if (stripos($cardName, $basicLand) !== false) {
                return true;
            }
        }
        return false;
    }

    private function isFormatAllowingMultiple(string $format): bool
    {
        return in_array(strtolower($format), ['commander', 'oathbreaker', 'brawl']);
    }

    public function isValid(Deck $deck): bool
    {
        return empty($this->validate($deck));
    }

    public function calculateManaCurve(Collection $mainboard): array
    {
        $curve = array_fill(0, 8, 0);

        foreach ($mainboard as $deckCard) {
            $cmc = $deckCard->card?->cmc ?? 0;
            $index = min($cmc, 7);
            $curve[$index] += $deckCard->quantity;
        }

        return $curve;
    }

    public function calculateColorDistribution(Collection $mainboard): array
    {
        $distribution = [
            'W' => 0, 'U' => 0, 'B' => 0, 'R' => 0, 'G' => 0, 'C' => 0,
        ];

        foreach ($mainboard as $deckCard) {
            $colors = $deckCard->card?->colors ?? [];
            if (empty($colors)) {
                $distribution['C'] += $deckCard->quantity;
            } else {
                foreach ($colors as $color) {
                    if (isset($distribution[$color])) {
                        $distribution[$color] += $deckCard->quantity;
                    }
                }
            }
        }

        return $distribution;
    }

    public function calculateTypeDistribution(Collection $mainboard): array
    {
        $distribution = [
            'Creature' => 0,
            'Instant' => 0,
            'Sorcery' => 0,
            'Artifact' => 0,
            'Enchantment' => 0,
            'Planeswalker' => 0,
            'Land' => 0,
            'Other' => 0,
        ];

        foreach ($mainboard as $deckCard) {
            $cardTypes = $deckCard->card?->card_types ?? [];
            $counted = false;

            foreach (array_keys($distribution) as $type) {
                if (in_array($type, $cardTypes)) {
                    $distribution[$type] += $deckCard->quantity;
                    $counted = true;
                }
            }

            if (! $counted) {
                $distribution['Other'] += $deckCard->quantity;
            }
        }

        return $distribution;
    }
}
