<?php

namespace App\Services;

use App\Models\Card;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

class CardSearchService
{
    private const MAX_LEVENSHTEIN_DISTANCE = 3;
    private const SEARCH_LIMIT = 50;

    public function search(array $filters, int $perPage = 20): CursorPaginator
    {
        $query = Card::query();

        if (! empty($filters['name'])) {
            $query = $this->applyNameSearch($query, $filters['name']);
        }

        if (! empty($filters['oracle_text'])) {
            $query->byOracleText($filters['oracle_text']);
        }

        if (! empty($filters['colors'])) {
            $query->byColors((array) $filters['colors']);
        }

        if (! empty($filters['color_identity'])) {
            foreach ((array) $filters['color_identity'] as $color) {
                $query->whereJsonContains('color_identity', $color);
            }
        }

        if (! empty($filters['type'])) {
            $query->byType($filters['type']);
        }

        if (! empty($filters['cmc'])) {
            $operator = $filters['cmc_operator'] ?? '=';
            $query->byCmc((int) $filters['cmc'], $operator);
        }

        if (! empty($filters['rarity'])) {
            $query->byRarity($filters['rarity']);
        }

        if (! empty($filters['set'])) {
            $query->bySet($filters['set']);
        }

        if (! empty($filters['format'])) {
            $query->legalIn($filters['format']);
        }

        if (! empty($filters['keyword'])) {
            $query->whereJsonContains('keywords', $filters['keyword']);
        }

        if (! empty($filters['artist'])) {
            $query->where('artist', 'LIKE', "%{$filters['artist']}%");
        }

        if (! empty($filters['sort_by'])) {
            $direction = $filters['sort_dir'] ?? 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->orderBy('name_normalized', 'asc');
        }

        return $query->cursorPaginate($perPage);
    }

    private function applyNameSearch(Builder $query, string $name): Builder
    {
        $normalized = strtolower(trim($name));

        $exactMatches = Card::where('name_normalized', $normalized)->pluck('id');

        if ($exactMatches->isNotEmpty()) {
            return $query->whereIn('id', $exactMatches);
        }

        $query->where(function ($q) use ($normalized, $name) {
            $q->where('name_normalized', 'LIKE', "%{$normalized}%")
                ->orWhere(DB::raw('name COLLATE NOCASE'), 'LIKE', "%{$name}%");
        });

        $fuzzyMatches = $this->fuzzySearch($name);
        if (! empty($fuzzyMatches)) {
            $query->orWhereIn('id', $fuzzyMatches);
        }

        return $query;
    }

    private function fuzzySearch(string $searchTerm): array
    {
        $normalized = strtolower(trim($searchTerm));

        if (strlen($normalized) < 3) {
            return [];
        }

        $cards = Card::select('id', 'name_normalized')
            ->where(DB::raw('LENGTH(name_normalized)'), '>=', strlen($normalized) - 2)
            ->where(DB::raw('LENGTH(name_normalized)'), '<=', strlen($normalized) + 2)
            ->limit(self::SEARCH_LIMIT)
            ->get();

        $matches = [];
        foreach ($cards as $card) {
            $distance = $this->levenshteinUtf8($normalized, $card->name_normalized);
            if ($distance <= self::MAX_LEVENSHTEIN_DISTANCE) {
                $matches[$card->id] = $distance;
            }
        }

        asort($matches);
        return array_keys($matches);
    }

    private function levenshteinUtf8(string $s1, string $s2): int
    {
        $s1 = $this->utf8ToExtendedAscii($s1);
        $s2 = $this->utf8ToExtendedAscii($s2);

        return levenshtein($s1, $s2);
    }

    private function utf8ToExtendedAscii(string $string): string
    {
        $map = [
            'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a', 'å' => 'a', 'æ' => 'ae',
            'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
            'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i',
            'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o', 'ø' => 'o',
            'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
            'ý' => 'y', 'ÿ' => 'y',
            'ñ' => 'n', 'ç' => 'c', 'þ' => 'th', 'ð' => 'dh',
            'ß' => 'ss',
            'ā' => 'a', 'ē' => 'e', 'ī' => 'i', 'ō' => 'o', 'ū' => 'u',
        ];

        return strtr(mb_strtolower($string, 'UTF-8'), $map);
    }

    public function autocomplete(string $query, int $limit = 10): array
    {
        $normalized = strtolower(trim($query));

        if (strlen($normalized) < 2) {
            return [];
        }

        $results = Card::select('id', 'name', 'set_code', 'mana_cost', 'type_line')
            ->where('name_normalized', 'LIKE', "{$normalized}%")
            ->orderBy('edhrec_rank', 'asc')
            ->orderBy('name_normalized', 'asc')
            ->limit($limit)
            ->get();

        if ($results->count() < $limit) {
            $additional = Card::select('id', 'name', 'set_code', 'mana_cost', 'type_line')
                ->where('name_normalized', 'LIKE', "%{$normalized}%")
                ->whereNotIn('id', $results->pluck('id'))
                ->orderBy('edhrec_rank', 'asc')
                ->orderBy('name_normalized', 'asc')
                ->limit($limit - $results->count())
                ->get();

            $results = $results->merge($additional);
        }

        return $results->toArray();
    }

    public function getRandomCard(?array $filters = null): ?Card
    {
        $query = Card::query();

        if ($filters) {
            if (! empty($filters['rarity'])) {
                $query->byRarity($filters['rarity']);
            }
            if (! empty($filters['colors'])) {
                $query->byColors((array) $filters['colors']);
            }
            if (! empty($filters['type'])) {
                $query->byType($filters['type']);
            }
            if (! empty($filters['format'])) {
                $query->legalIn($filters['format']);
            }
        }

        return $query->inRandomOrder()->first();
    }
}
