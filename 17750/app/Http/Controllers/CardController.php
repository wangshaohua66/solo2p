<?php

namespace App\Http\Controllers;

use App\Http\Requests\CardSearchRequest;
use App\Models\Card;
use App\Services\CardSearchService;
use App\Services\ScryfallSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @OA\Info(
 *     title="MTG Collection Manager API",
 *     version="1.0.0",
 *     description="Magic: The Gathering Collection Management API"
 * )
 * @OA\Server(
 *     url="/api/v1",
 *     description="API v1"
 * )
 */
class CardController extends Controller
{
    public function __construct(
        protected CardSearchService $searchService,
        protected ScryfallSyncService $syncService
    ) {}

    /**
     * @OA\Get(
     *     path="/cards",
     *     summary="Search cards with filters",
     *     tags={"Cards"},
     *     @OA\Parameter(ref="#/components/parameters/CardSearchParameters"),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             type="object",
     *             @OA\Property(property="data", type="array", @OA\Items(ref="#/components/schemas/Card")),
     *             @OA\Property(property="next_cursor", type="string", nullable=true),
     *             @OA\Property(property="prev_cursor", type="string", nullable=true)
     *         )
     *     )
     * )
     */
    public function index(CardSearchRequest $request): JsonResponse
    {
        $perPage = $request->input('per_page', 20);
        $filters = $request->validated();

        $results = $this->searchService->search($filters, $perPage);

        return response()->json([
            'data' => $results->items(),
            'next_cursor' => $results->nextCursor()?->encode(),
            'prev_cursor' => $results->previousCursor()?->encode(),
            'per_page' => $perPage,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/cards/{id}",
     *     summary="Get card by ID",
     *     tags={"Cards"},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(ref="#/components/schemas/Card")
     *     ),
     *     @OA\Response(response=404, description="Card not found")
     * )
     */
    public function show(int $id): JsonResponse
    {
        $card = Card::findOrFail($id);

        return response()->json([
            'data' => $card,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/cards/autocomplete",
     *     summary="Autocomplete card names",
     *     tags={"Cards"},
     *     @OA\Parameter(
     *         name="q",
     *         in="query",
     *         required=true,
     *         @OA\Schema(type="string", minLength=2)
     *     ),
     *     @OA\Parameter(
     *         name="limit",
     *         in="query",
     *         @OA\Schema(type="integer", default=10)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation"
     *     )
     * )
     */
    public function autocomplete(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $results = $this->searchService->autocomplete(
            $request->input('q'),
            $request->input('limit', 10)
        );

        return response()->json([
            'data' => $results,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/cards/random",
     *     summary="Get random card",
     *     tags={"Cards"},
     *     @OA\Parameter(
     *         name="rarity",
     *         in="query",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(ref="#/components/schemas/Card")
     *     )
     * )
     */
    public function random(Request $request): JsonResponse
    {
        $card = $this->searchService->getRandomCard($request->all());

        if (! $card) {
            return response()->json([
                'error' => 'No cards found matching criteria',
            ], 404);
        }

        return response()->json([
            'data' => $card,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/cards/{id}/price-history",
     *     summary="Get card price history",
     *     tags={"Cards"},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="days",
     *         in="query",
     *         @OA\Schema(type="integer", default=30)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation"
     *     )
     * )
     */
    public function priceHistory(int $id, Request $request): JsonResponse
    {
        $days = $request->input('days', 30);
        $card = Card::findOrFail($id);

        $history = $card->priceHistories()
            ->latest($days)
            ->orderBy('price_date', 'asc')
            ->get();

        return response()->json([
            'data' => $history,
            'card' => [
                'id' => $card->id,
                'name' => $card->name,
                'current_price_usd' => $card->price_usd,
                'current_price_eur' => $card->price_eur,
            ],
        ]);
    }

    /**
     * @OA\Post(
     *     path="/cards/sync/{scryfallId}",
     *     summary="Sync single card from Scryfall",
     *     tags={"Cards"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(
     *         name="scryfallId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(response=200, description="Card synced successfully")
     * )
     */
    public function sync(string $scryfallId): JsonResponse
    {
        $card = $this->syncService->syncSingleCard($scryfallId);

        if (! $card) {
            return response()->json([
                'error' => 'Failed to sync card from Scryfall',
            ], 502);
        }

        return response()->json([
            'message' => 'Card synced successfully',
            'data' => $card,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/cards/sync-all",
     *     summary="Sync all cards from Scryfall",
     *     tags={"Cards"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(
     *         name="full",
     *         in="query",
     *         @OA\Schema(type="boolean", default=false)
     *     ),
     *     @OA\Response(response=200, description="Sync initiated")
     * )
     */
    public function syncAll(Request $request): JsonResponse
    {
        $fullSync = $request->input('full', false);
        $stats = $this->syncService->syncAllCards($fullSync);

        return response()->json([
            'message' => 'Sync completed',
            'stats' => $stats,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/cards/update-prices",
     *     summary="Update card prices from Scryfall",
     *     tags={"Cards"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Prices updated successfully")
     * )
     */
    public function updatePrices(): JsonResponse
    {
        $stats = $this->syncService->updatePrices();

        return response()->json([
            'message' => 'Price update completed',
            'stats' => $stats,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/cards/sync/full",
     *     summary="Full sync all cards from Scryfall",
     *     tags={"Cards"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Full sync initiated")
     * )
     */
    public function syncFull(Request $request): JsonResponse
    {
        $fullSync = true;
        $stats = $this->syncService->syncAllCards($fullSync);

        return response()->json([
            'message' => 'Full sync completed',
            'stats' => $stats,
        ]);
    }
}
