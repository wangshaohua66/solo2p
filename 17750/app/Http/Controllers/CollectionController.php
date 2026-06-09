<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkImportRequest;
use App\Http\Requests\CollectionItemRequest;
use App\Models\CollectionItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CollectionController extends Controller
{
    /**
     * @OA\Get(
     *     path="/collection",
     *     summary="List collection items",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(
     *         name="condition",
     *         in="query",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="is_foil",
     *         in="query",
     *         @OA\Schema(type="boolean")
     *     ),
     *     @OA\Parameter(
     *         name="language",
     *         in="query",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="cursor",
     *         in="query",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = CollectionItem::where('user_id', Auth::id())
            ->with('card');

        if ($request->has('condition')) {
            $query->byCondition($request->input('condition'));
        }
        if ($request->has('is_foil')) {
            $query->foil($request->input('is_foil'));
        }
        if ($request->has('language')) {
            $query->byLanguage($request->input('language'));
        }

        $perPage = $request->input('per_page', 20);
        $results = $query->orderBy('id', 'desc')->cursorPaginate($perPage);

        return response()->json([
            'data' => $results->items(),
            'next_cursor' => $results->nextCursor()?->encode(),
            'prev_cursor' => $results->previousCursor()?->encode(),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/collection",
     *     summary="Add card to collection",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/CollectionItem")
     *     ),
     *     @OA\Response(response=201, description="Item added successfully")
     * )
     */
    public function store(CollectionItemRequest $request): JsonResponse
    {
        $existing = CollectionItem::where('user_id', Auth::id())
            ->where('card_id', $request->input('card_id'))
            ->where('condition', $request->input('condition', 'NM'))
            ->where('is_foil', $request->input('is_foil', false))
            ->where('language', $request->input('language', 'en'))
            ->first();

        if ($existing) {
            $existing->increment('quantity', $request->input('quantity', 1));
            $existing->update($request->validated());
            $item = $existing;
        } else {
            $item = new CollectionItem($request->validated());
            $item->user_id = Auth::id();
            $item->save();
        }

        $item->load('card');

        return response()->json([
            'message' => 'Card added to collection',
            'data' => $item,
        ], 201);
    }

    /**
     * @OA\Get(
     *     path="/collection/{id}",
     *     summary="Get collection item",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function show(int $id): JsonResponse
    {
        $item = CollectionItem::where('user_id', Auth::id())
            ->with('card')
            ->findOrFail($id);

        return response()->json([
            'data' => $item,
        ]);
    }

    /**
     * @OA\Put(
     *     path="/collection/{id}",
     *     summary="Update collection item",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/CollectionItem")
     *     ),
     *     @OA\Response(response=200, description="Item updated successfully")
     * )
     */
    public function update(CollectionItemRequest $request, int $id): JsonResponse
    {
        $item = CollectionItem::where('user_id', Auth::id())->findOrFail($id);
        $item->update($request->validated());
        $item->load('card');

        return response()->json([
            'message' => 'Collection item updated',
            'data' => $item,
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/collection/{id}",
     *     summary="Remove item from collection",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=204, description="Item removed successfully")
     * )
     */
    public function destroy(int $id): JsonResponse
    {
        $item = CollectionItem::where('user_id', Auth::id())->findOrFail($id);
        $item->delete();

        return response()->json(null, 204);
    }

    /**
     * @OA\Get(
     *     path="/collection/stats",
     *     summary="Get collection statistics",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function stats(): JsonResponse
    {
        $userId = Auth::id();

        $totalCards = CollectionItem::where('user_id', $userId)->sum('quantity');
        $totalValue = DB::table('collection_items as ci')
            ->join('cards as c', 'ci.card_id', '=', 'c.id')
            ->where('ci.user_id', $userId)
            ->select(DB::raw('SUM(ci.quantity * COALESCE(c.price_usd, 0)) as total_value'))
            ->value('total_value');

        $rarityDistribution = DB::table('collection_items as ci')
            ->join('cards as c', 'ci.card_id', '=', 'c.id')
            ->where('ci.user_id', $userId)
            ->select('c.rarity', DB::raw('SUM(ci.quantity) as count'))
            ->groupBy('c.rarity')
            ->get()
            ->mapWithKeys(fn($r) => [$r->rarity => (int) $r->count]);

        $colorDistribution = DB::table('collection_items as ci')
            ->join('cards as c', 'ci.card_id', '=', 'c.id')
            ->where('ci.user_id', $userId)
            ->get()
            ->flatMap(function ($item) {
                $colors = json_decode($item->color_identity ?? '[]', true);
                return array_fill_keys($colors ?: ['C'], $item->quantity);
            })
            ->groupBy(fn($k) => $k)
            ->map(fn($g) => $g->sum());

        $conditionDistribution = CollectionItem::where('user_id', $userId)
            ->select('condition', DB::raw('SUM(quantity) as count'))
            ->groupBy('condition')
            ->get()
            ->mapWithKeys(fn($r) => [$r->condition => (int) $r->count]);

        $foilCount = CollectionItem::where('user_id', $userId)->foil()->sum('quantity');

        return response()->json([
            'data' => [
                'total_cards' => (int) $totalCards,
                'total_value_usd' => (float) $totalValue,
                'unique_cards' => CollectionItem::where('user_id', $userId)->count(),
                'rarity_distribution' => $rarityDistribution,
                'color_distribution' => $colorDistribution,
                'condition_distribution' => $conditionDistribution,
                'foil_count' => (int) $foilCount,
                'non_foil_count' => (int) ($totalCards - $foilCount),
            ],
        ]);
    }

    /**
     * @OA\Get(
     *     path="/collection/export",
     *     summary="Export collection",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(
     *         name="format",
     *         in="query",
     *         @OA\Schema(type="string", enum={"json", "csv", "mtgo"})
     *     ),
     *     @OA\Response(response=200, description="Export successful")
     * )
     */
    public function export(Request $request): JsonResponse
    {
        $format = $request->input('format', 'json');
        $items = CollectionItem::where('user_id', Auth::id())
            ->with('card')
            ->get();

        $data = match ($format) {
            'csv' => $this->exportCsv($items),
            'mtgo' => $this->exportMtgo($items),
            default => $items->toArray(),
        };

        return response()->json([
            'format' => $format,
            'data' => $data,
            'total_items' => $items->count(),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/collection/import",
     *     summary="Bulk import collection",
     *     tags={"Collection"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *             @OA\Schema(
     *                 type="object",
     *                 @OA\Property(property="file", type="file"),
     *                 @OA\Property(property="format", type="string"),
     *                 @OA\Property(property="type", type="string")
     *             )
     *         )
     *     ),
     *     @OA\Response(response=200, description="Import completed")
     * )
     */
    public function import(BulkImportRequest $request): JsonResponse
    {
        $file = $request->file('file');
        $format = $request->input('format');
        $type = $request->input('type');

        $stats = [
            'imported' => 0,
            'updated' => 0,
            'skipped' => 0,
            'errors' => [],
        ];

        $content = file_get_contents($file->getRealPath());

        if ($format === 'csv') {
            $this->importCsv($content, $stats);
        } elseif ($format === 'json') {
            $this->importJson($content, $stats);
        }

        return response()->json([
            'message' => 'Import completed',
            'stats' => $stats,
        ]);
    }

    private function exportCsv($items): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, ['Quantity', 'Name', 'Set', 'Condition', 'Foil', 'Language', 'Price']);

        foreach ($items as $item) {
            fputcsv($handle, [
                $item->quantity,
                $item->card?->name,
                $item->card?->set_code,
                $item->condition,
                $item->is_foil ? 'Yes' : 'No',
                $item->language,
                $item->card?->price_usd,
            ]);
        }

        rewind($handle);
        return stream_get_contents($handle);
    }

    private function exportMtgo($items): string
    {
        $output = '';
        foreach ($items as $item) {
            $output .= sprintf(
                "%d %s [%s]\n",
                $item->quantity,
                $item->card?->name,
                $item->card?->set_code
            );
        }
        return $output;
    }

    private function importCsv(string $content, array &$stats): void
    {
        $lines = explode("\n", $content);
        $headers = str_getcsv(array_shift($lines));

        foreach ($lines as $line) {
            if (empty($line)) continue;
            $data = array_combine($headers, str_getcsv($line));

            try {
                $card = \App\Models\Card::where('name_normalized', strtolower(trim($data['Name'] ?? '')))
                    ->orWhere('scryfall_id', $data['Scryfall ID'] ?? '')
                    ->first();

                if (! $card) {
                    $stats['errors'][] = "Card not found: {$data['Name']}";
                    $stats['skipped']++;
                    continue;
                }

                CollectionItem::updateOrCreate(
                    [
                        'user_id' => Auth::id(),
                        'card_id' => $card->id,
                        'condition' => $data['Condition'] ?? 'NM',
                        'is_foil' => (bool) ($data['Foil'] ?? false),
                        'language' => $data['Language'] ?? 'en',
                    ],
                    [
                        'quantity' => (int) ($data['Quantity'] ?? 1),
                        'purchase_price' => (float) ($data['Purchase Price'] ?? null),
                    ]
                );

                $stats['imported']++;
            } catch (\Exception $e) {
                $stats['errors'][] = $e->getMessage();
                $stats['skipped']++;
            }
        }
    }

    private function importJson(string $content, array &$stats): void
    {
        $data = json_decode($content, true);

        foreach ($data as $item) {
            try {
                $card = \App\Models\Card::find($item['card_id'] ?? 0)
                    ?? \App\Models\Card::where('name_normalized', strtolower(trim($item['name'] ?? '')))->first();

                if (! $card) {
                    $stats['errors'][] = "Card not found: {$item['name']}";
                    $stats['skipped']++;
                    continue;
                }

                CollectionItem::updateOrCreate(
                    [
                        'user_id' => Auth::id(),
                        'card_id' => $card->id,
                        'condition' => $item['condition'] ?? 'NM',
                        'is_foil' => (bool) ($item['is_foil'] ?? false),
                    ],
                    [
                        'quantity' => (int) ($item['quantity'] ?? 1),
                        'language' => $item['language'] ?? 'en',
                    ]
                );

                $stats['imported']++;
            } catch (\Exception $e) {
                $stats['errors'][] = $e->getMessage();
                $stats['skipped']++;
            }
        }
    }
}
