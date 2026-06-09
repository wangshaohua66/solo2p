<?php

namespace App\Services;

use App\Models\Card;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ScryfallSyncService
{
    private string $apiBase;
    private int $rateLimit;
    private int $chunkSize;
    private int $timeout;
    private ?string $apiKey;

    private const CACHE_KEY_REQUEST_COUNT = 'scryfall:request_count';
    private const CACHE_KEY_LAST_REQUEST = 'scryfall:last_request_time';
    private const CACHE_KEY_CHECKPOINT = 'scryfall:sync_checkpoint';
    private const RATE_WINDOW = 1;

    public function __construct()
    {
        $this->apiBase = config('scryfall.api_base');
        $this->rateLimit = config('scryfall.rate_limit', 10);
        $this->chunkSize = config('scryfall.sync_chunk_size', 1000);
        $this->timeout = config('scryfall.timeout', 30);
        $this->apiKey = config('scryfall.api_key');
    }

    public function syncAllCards(bool $fullSync = false): array
    {
        $stats = [
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'errors' => 0,
            'total_processed' => 0,
        ];

        try {
            $bulkData = $this->getBulkData();
            $defaultCardsUrl = $this->findDefaultCardsUrl($bulkData);

            if (! $defaultCardsUrl) {
                throw new \RuntimeException('Could not find default cards bulk data');
            }

            $lastUpdatedAt = $fullSync ? null : Card::max('updated_at');
            $this->streamAndProcessCards($defaultCardsUrl, $lastUpdatedAt, $stats);

        } catch (\Exception $e) {
            Log::error('Scryfall sync failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            $stats['errors']++;
        }

        return $stats;
    }

    private function getBulkData(): array
    {
        $response = $this->makeRequest('GET', config('scryfall.endpoints.bulk_data'));
        return $response['data'] ?? [];
    }

    private function findDefaultCardsUrl(array $bulkData): ?string
    {
        foreach ($bulkData as $item) {
            if (($item['type'] ?? '') === 'default_cards') {
                return $item['download_uri'] ?? null;
            }
        }
        return null;
    }

    private function streamAndProcessCards(string $url, ?\DateTime $lastUpdatedAt, array &$stats): void
    {
        $context = stream_context_create([
            'http' => [
                'timeout' => $this->timeout,
                'header' => $this->apiKey ? "Authorization: Bearer {$this->apiKey}\r\n" : '',
            ],
        ]);

        $handle = fopen($url, 'rb', false, $context);
        if (! $handle) {
            throw new \RuntimeException('Failed to open stream to ' . $url);
        }

        $buffer = '';
        $isFirst = true;
        $cardData = '';
        $depth = 0;
        $inArray = false;

        while (! feof($handle)) {
            $chunk = fread($handle, 8192);
            $buffer .= $chunk;

            for ($i = 0; $i < strlen($buffer); $i++) {
                $char = $buffer[$i];

                if ($char === '[') {
                    $inArray = true;
                    $depth++;
                    continue;
                }

                if ($char === ']') {
                    $depth--;
                    if ($depth === 0) {
                        break;
                    }
                    continue;
                }

                if (! $inArray || $depth < 1) {
                    continue;
                }

                if ($char === '{') {
                    if ($depth === 1) {
                        $isFirst = false;
                        $cardData = '';
                    }
                    $depth++;
                }

                if ($char === '}') {
                    $depth--;
                    if ($depth === 1) {
                        $cardData .= $char;
                        $card = json_decode($cardData, true);
                        if ($card) {
                            $this->processCard($card, $lastUpdatedAt, $stats);
                        }
                        $cardData = '';
                        continue;
                    }
                }

                if ($depth >= 2) {
                    $cardData .= $char;
                }
            }

            $buffer = substr($buffer, $i);
        }

        fclose($handle);
    }

    private function processCard(array $cardData, ?\DateTime $lastUpdatedAt, array &$stats): void
    {
        $stats['total_processed']++;

        if ($lastUpdatedAt) {
            $cardUpdatedAt = new \DateTime($cardData['updated_at'] ?? 'now');
            if ($cardUpdatedAt <= $lastUpdatedAt) {
                $stats['skipped']++;
                return;
            }
        }

        try {
            $normalizedData = $this->normalizeCardData($cardData);

            $card = Card::updateOrCreate(
                ['scryfall_id' => $normalizedData['scryfall_id']],
                $normalizedData
            );

            if ($card->wasRecentlyCreated) {
                $stats['created']++;
            } else {
                $stats['updated']++;
            }

        } catch (\Exception $e) {
            Log::warning('Failed to process card: ' . ($cardData['name'] ?? 'unknown') . ' - ' . $e->getMessage());
            $stats['errors']++;
        }
    }

    private function normalizeCardData(array $cardData): array
    {
        $colors = $cardData['colors'] ?? [];
        $colorIdentity = $cardData['color_identity'] ?? [];

        return [
            'scryfall_id' => $cardData['id'],
            'oracle_id' => $cardData['oracle_id'] ?? null,
            'name' => $cardData['name'],
            'name_normalized' => strtolower(trim($cardData['name'])),
            'oracle_text' => $cardData['oracle_text'] ?? null,
            'mana_cost' => $cardData['mana_cost'] ?? null,
            'cmc' => (int) ($cardData['cmc'] ?? 0),
            'colors' => $colors,
            'color_identity' => $colorIdentity,
            'type_line' => $cardData['type_line'] ?? '',
            'card_types' => $cardData['type_line'] ? $this->extractTypes($cardData['type_line']) : [],
            'subtypes' => $cardData['type_line'] ? $this->extractSubtypes($cardData['type_line']) : [],
            'supertypes' => $cardData['type_line'] ? $this->extractSupertypes($cardData['type_line']) : [],
            'rarity' => strtolower($cardData['rarity'] ?? 'common'),
            'set_code' => strtoupper($cardData['set'] ?? ''),
            'set_name' => $cardData['set_name'] ?? '',
            'collector_number' => $cardData['collector_number'] ?? '',
            'language' => $cardData['lang'] ?? 'en',
            'is_foil' => (bool) ($cardData['foil'] ?? false),
            'is_full_art' => (bool) ($cardData['full_art'] ?? false),
            'is_promo' => (bool) ($cardData['promo'] ?? false),
            'price_usd' => isset($cardData['prices']['usd']) ? (float) $cardData['prices']['usd'] : null,
            'price_eur' => isset($cardData['prices']['eur']) ? (float) $cardData['prices']['eur'] : null,
            'price_tix' => isset($cardData['prices']['tix']) ? (float) $cardData['prices']['tix'] : null,
            'image_small' => $cardData['image_uris']['small'] ?? null,
            'image_normal' => $cardData['image_uris']['normal'] ?? null,
            'image_large' => $cardData['image_uris']['large'] ?? null,
            'artist' => $cardData['artist'] ?? null,
            'power' => $cardData['power'] ?? null,
            'toughness' => $cardData['toughness'] ?? null,
            'loyalty' => $cardData['loyalty'] ?? null,
            'legalities' => $cardData['legalities'] ?? [],
            'keywords' => $cardData['keywords'] ?? [],
            'flavor_text' => $cardData['flavor_text'] ?? null,
            'edhrec_rank' => isset($cardData['edhrec_rank']) ? (int) $cardData['edhrec_rank'] : null,
            'released_at' => $cardData['released_at'] ?? null,
        ];
    }

    private function extractTypes(string $typeLine): array
    {
        $parts = explode('—', $typeLine, 2);
        $typesPart = trim($parts[0] ?? '');
        return array_values(array_filter(explode(' ', $typesPart)));
    }

    private function extractSubtypes(string $typeLine): array
    {
        $parts = explode('—', $typeLine, 2);
        $subtypesPart = trim($parts[1] ?? '');
        return $subtypesPart ? array_values(array_filter(explode(' ', $subtypesPart))) : [];
    }

    private function extractSupertypes(string $typeLine): array
    {
        $superTypes = ['Legendary', 'Basic', 'Snow', 'World', 'Ongoing'];
        $types = $this->extractTypes($typeLine);
        return array_values(array_intersect($types, $superTypes));
    }

    public function syncSingleCard(string $scryfallId): ?Card
    {
        $response = $this->makeRequest('GET', "/cards/{$scryfallId}");
        if (! $response) {
            return null;
        }

        $normalizedData = $this->normalizeCardData($response);
        return Card::updateOrCreate(
            ['scryfall_id' => $normalizedData['scryfall_id']],
            $normalizedData
        );
    }

    public function searchCardsRemote(string $query, array $filters = []): array
    {
        $params = ['q' => $query];

        if (! empty($filters['unique'])) {
            $params['unique'] = $filters['unique'];
        }
        if (! empty($filters['order'])) {
            $params['order'] = $filters['order'];
        }
        if (! empty($filters['dir'])) {
            $params['dir'] = $filters['dir'];
        }
        if (! empty($filters['include_extras'])) {
            $params['include_extras'] = $filters['include_extras'];
        }

        $response = $this->makeRequest('GET', config('scryfall.endpoints.cards_search'), $params);
        return $response['data'] ?? [];
    }

    public function updatePrices(): array
    {
        $stats = [
            'updated' => 0,
            'skipped' => 0,
            'errors' => 0,
        ];

        $cards = Card::whereNotNull('scryfall_id')->cursor();

        foreach ($cards as $card) {
            try {
                $response = $this->makeRequest('GET', "/cards/{$card->scryfall_id}");
                if (! $response) {
                    $stats['errors']++;
                    continue;
                }

                $prices = $response['prices'] ?? [];
                $newPrices = [
                    'price_usd' => isset($prices['usd']) ? (float) $prices['usd'] : null,
                    'price_eur' => isset($prices['eur']) ? (float) $prices['eur'] : null,
                    'price_tix' => isset($prices['tix']) ? (float) $prices['tix'] : null,
                ];

                if ($newPrices['price_usd'] != $card->price_usd ||
                    $newPrices['price_eur'] != $card->price_eur ||
                    $newPrices['price_tix'] != $card->price_tix) {

                    $card->update($newPrices);

                    \App\Models\PriceHistory::create([
                        'card_id' => $card->id,
                        'price_usd' => $newPrices['price_usd'],
                        'price_eur' => $newPrices['price_eur'],
                        'price_tix' => $newPrices['price_tix'],
                        'source' => 'scryfall',
                        'price_date' => now()->toDateString(),
                    ]);

                    $stats['updated']++;
                } else {
                    $stats['skipped']++;
                }

            } catch (\Exception $e) {
                Log::warning("Failed to update prices for card {$card->id}: " . $e->getMessage());
                $stats['errors']++;
            }
        }

        return $stats;
    }

    private function makeRequest(string $method, string $endpoint, array $params = []): ?array
    {
        $this->throttleRequest();

        $url = str_starts_with($endpoint, 'http') ? $endpoint : ($this->apiBase . $endpoint);

        $headers = [
            'Accept' => 'application/json',
            'User-Agent' => 'MTG-Collection-Manager/1.0',
        ];

        if ($this->apiKey) {
            $headers['Authorization'] = "Bearer {$this->apiKey}";
        }

        try {
            $response = Http::withHeaders($headers)
                ->timeout($this->timeout)
                ->{$method}($url, $params);

            $this->incrementRequestCount();

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('Scryfall API request failed: ' . $response->status(), [
                'url' => $url,
                'body' => $response->body(),
            ]);

            return null;

        } catch (\Exception $e) {
            Log::error('Scryfall API request exception: ' . $e->getMessage(), [
                'url' => $url,
            ]);
            return null;
        }
    }

    private function throttleRequest(): void
    {
        $requestCount = Cache::get(self::CACHE_KEY_REQUEST_COUNT, 0);
        $lastRequestTime = Cache::get(self::CACHE_KEY_LAST_REQUEST, 0);

        if ($requestCount >= $this->rateLimit) {
            $elapsed = microtime(true) - $lastRequestTime;
            if ($elapsed < self::RATE_WINDOW) {
                usleep((int) ((self::RATE_WINDOW - $elapsed) * 1000000));
            }
            Cache::put(self::CACHE_KEY_REQUEST_COUNT, 0, self::RATE_WINDOW);
        }
    }

    private function incrementRequestCount(): void
    {
        $count = Cache::increment(self::CACHE_KEY_REQUEST_COUNT);
        if ($count === 1) {
            Cache::put(self::CACHE_KEY_REQUEST_COUNT, 1, self::RATE_WINDOW);
        }
        Cache::put(self::CACHE_KEY_LAST_REQUEST, microtime(true), self::RATE_WINDOW * 2);
    }

    public function setCheckpoint(int $processed, string $cursor = null): void
    {
        Cache::put(self::CACHE_KEY_CHECKPOINT, [
            'processed' => $processed,
            'cursor' => $cursor,
            'timestamp' => now()->toISOString(),
        ], 86400);
    }

    public function getCheckpoint(): ?array
    {
        return Cache::get(self::CACHE_KEY_CHECKPOINT);
    }

    public function clearCheckpoint(): void
    {
        Cache::forget(self::CACHE_KEY_CHECKPOINT);
    }
}
