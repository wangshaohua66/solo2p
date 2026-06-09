<?php

namespace App\Http\Controllers;

use App\Http\Requests\DeckRequest;
use App\Models\Deck;
use App\Services\DeckRecommendationService;
use App\Services\DeckValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DeckController extends Controller
{
    public function __construct(
        protected DeckValidator $validator,
        protected DeckRecommendationService $recommendationService
    ) {}

    /**
     * @OA\Get(
     *     path="/decks",
     *     summary="List user decks",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string")),
     *     @OA\Parameter(name="is_legal", in="query", @OA\Schema(type="boolean")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = Deck::where('user_id', Auth::id())->withCount('deckCards');

        if ($request->has('format')) {
            $query->byFormat($request->input('format'));
        }
        if ($request->has('is_legal')) {
            $query->legal($request->input('is_legal'));
        }

        $perPage = $request->input('per_page', 20);
        $results = $query->orderBy('updated_at', 'desc')->cursorPaginate($perPage);

        return response()->json([
            'data' => $results->items(),
            'next_cursor' => $results->nextCursor()?->encode(),
            'prev_cursor' => $results->previousCursor()?->encode(),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/decks",
     *     summary="Create new deck",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/Deck")
     *     ),
     *     @OA\Response(response=201, description="Deck created successfully")
     * )
     */
    public function store(DeckRequest $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $deck = new Deck($request->validated());
            $deck->user_id = Auth::id();
            $deck->save();

            if ($request->has('cards')) {
                foreach ($request->input('cards', []) as $card) {
                    $deck->deckCards()->create([
                        'card_id' => $card['card_id'],
                        'quantity' => $card['quantity'],
                        'is_sideboard' => $card['is_sideboard'] ?? false,
                    ]);
                }
            }

            $validationErrors = $this->validator->validate($deck);
            $deck->update([
                'is_legal' => empty($validationErrors),
                'validation_errors' => $validationErrors ? json_encode($validationErrors) : null,
            ]);

            $deck->load(['mainboard.card', 'sideboard.card']);

            return response()->json([
                'message' => 'Deck created successfully',
                'data' => $deck,
                'validation' => [
                    'is_legal' => $deck->is_legal,
                    'errors' => $validationErrors,
                ],
            ], 201);
        });
    }

    /**
     * @OA\Get(
     *     path="/decks/{id}",
     *     summary="Get deck details",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function show(int $id): JsonResponse
    {
        $deck = Deck::where('user_id', Auth::id())
            ->with(['mainboard.card', 'sideboard.card'])
            ->findOrFail($id);

        $analysis = [
            'mainboard_count' => $deck->mainboard_count,
            'sideboard_count' => $deck->sideboard_count,
            'mana_curve' => $this->validator->calculateManaCurve($deck->mainboard),
            'color_distribution' => $this->validator->calculateColorDistribution($deck->mainboard),
            'type_distribution' => $this->validator->calculateTypeDistribution($deck->mainboard),
            'color_identity' => $deck->color_identity,
        ];

        return response()->json([
            'data' => $deck,
            'analysis' => $analysis,
        ]);
    }

    /**
     * @OA\Put(
     *     path="/decks/{id}",
     *     summary="Update deck",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Deck updated successfully")
     * )
     */
    public function update(DeckRequest $request, int $id): JsonResponse
    {
        return DB::transaction(function () use ($request, $id) {
            $deck = Deck::where('user_id', Auth::id())->findOrFail($id);
            $deck->update($request->validated());

            if ($request->has('cards')) {
                $deck->deckCards()->delete();
                foreach ($request->input('cards', []) as $card) {
                    $deck->deckCards()->create([
                        'card_id' => $card['card_id'],
                        'quantity' => $card['quantity'],
                        'is_sideboard' => $card['is_sideboard'] ?? false,
                    ]);
                }
            }

            $validationErrors = $this->validator->validate($deck);
            $deck->update([
                'is_legal' => empty($validationErrors),
                'validation_errors' => $validationErrors ? json_encode($validationErrors) : null,
            ]);

            $deck->load(['mainboard.card', 'sideboard.card']);

            return response()->json([
                'message' => 'Deck updated successfully',
                'data' => $deck,
                'validation' => [
                    'is_legal' => $deck->is_legal,
                    'errors' => $validationErrors,
                ],
            ]);
        });
    }

    /**
     * @OA\Delete(
     *     path="/decks/{id}",
     *     summary="Delete deck",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=204, description="Deck deleted successfully")
     * )
     */
    public function destroy(int $id): JsonResponse
    {
        $deck = Deck::where('user_id', Auth::id())->findOrFail($id);
        $deck->delete();

        return response()->json(null, 204);
    }

    /**
     * @OA\Post(
     *     path="/decks/{id}/validate",
     *     summary="Validate deck",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Validation complete")
     * )
     */
    public function validate(int $id): JsonResponse
    {
        $deck = Deck::where('user_id', Auth::id())
            ->with(['mainboard.card', 'sideboard.card'])
            ->findOrFail($id);

        $errors = $this->validator->validate($deck);

        $deck->update([
            'is_legal' => empty($errors),
            'validation_errors' => $errors ? json_encode($errors) : null,
        ]);

        return response()->json([
            'is_legal' => empty($errors),
            'errors' => $errors,
            'analysis' => [
                'mana_curve' => $this->validator->calculateManaCurve($deck->mainboard),
                'color_distribution' => $this->validator->calculateColorDistribution($deck->mainboard),
                'type_distribution' => $this->validator->calculateTypeDistribution($deck->mainboard),
            ],
        ]);
    }

    /**
     * @OA\Get(
     *     path="/decks/{id}/export",
     *     summary="Export deck",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string", enum={"json","mtgo","mws","txt"})),
     *     @OA\Response(response=200, description="Export successful")
     * )
     */
    public function export(int $id, Request $request): JsonResponse
    {
        $format = $request->input('format', 'json');
        $deck = Deck::where('user_id', Auth::id())
            ->with(['mainboard.card', 'sideboard.card'])
            ->findOrFail($id);

        $data = match ($format) {
            'mtgo' => $this->exportMtgo($deck),
            'mws' => $this->exportMws($deck),
            'txt' => $this->exportTxt($deck),
            default => $deck->toArray(),
        };

        return response()->json([
            'format' => $format,
            'deck_name' => $deck->name,
            'data' => $data,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/decks/recommendations",
     *     summary="Get deck recommendations",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string", default="standard")),
     *     @OA\Parameter(name="limit", in="query", @OA\Schema(type="integer", default=5)),
     *     @OA\Response(response=200, description="Recommendations generated")
     * )
     */
    public function recommendations(Request $request): JsonResponse
    {
        $format = $request->input('format', 'standard');
        $limit = $request->input('limit', 5);

        $recommendations = $this->recommendationService->getRecommendations(
            Auth::id(),
            $format,
            $limit
        );

        return response()->json([
            'format' => $format,
            'recommendations' => $recommendations,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/decks/{id}/cards",
     *     summary="Add card to deck",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         @OA\JsonContent(
     *             type="object",
     *             @OA\Property(property="card_id", type="integer"),
     *             @OA\Property(property="quantity", type="integer"),
     *             @OA\Property(property="is_sideboard", type="boolean")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Card added to deck")
     * )
     */
    public function addCard(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'card_id' => ['required', 'integer', 'exists:cards,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'is_sideboard' => ['nullable', 'boolean'],
        ]);

        $deck = Deck::where('user_id', Auth::id())->findOrFail($id);

        $deckCard = $deck->deckCards()->updateOrCreate(
            [
                'card_id' => $request->input('card_id'),
                'is_sideboard' => $request->input('is_sideboard', false),
            ],
            [
                'quantity' => DB::raw("quantity + {$request->input('quantity')}"),
            ]
        );

        $errors = $this->validator->validate($deck);
        $deck->update([
            'is_legal' => empty($errors),
            'validation_errors' => $errors ? json_encode($errors) : null,
        ]);

        return response()->json([
            'message' => 'Card added to deck',
            'data' => $deckCard->load('card'),
            'validation' => [
                'is_legal' => $deck->is_legal,
                'errors' => $errors,
            ],
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/decks/{id}/cards/{cardId}",
     *     summary="Remove card from deck",
     *     tags={"Decks"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="is_sideboard", in="query", @OA\Schema(type="boolean")),
     *     @OA\Response(response=204, description="Card removed from deck")
     * )
     */
    public function removeCard(int $id, int $cardId, Request $request): JsonResponse
    {
        $deck = Deck::where('user_id', Auth::id())->findOrFail($id);

        $deck->deckCards()
            ->where('card_id', $cardId)
            ->where('is_sideboard', $request->input('is_sideboard', false))
            ->delete();

        return response()->json(null, 204);
    }

    private function exportMtgo(Deck $deck): string
    {
        $output = "// {$deck->name}\n";
        $output .= "// Format: {$deck->format}\n\n";

        foreach ($deck->mainboard as $card) {
            $output .= sprintf("%d %s [%s]\n", $card->quantity, $card->card?->name, $card->card?->set_code);
        }

        if ($deck->sideboard->isNotEmpty()) {
            $output .= "\nSideboard:\n";
            foreach ($deck->sideboard as $card) {
                $output .= sprintf("%d %s [%s]\n", $card->quantity, $card->card?->name, $card->card?->set_code);
            }
        }

        return $output;
    }

    private function exportMws(Deck $deck): string
    {
        $output = "[Deck]\n";
        $output .= "Name={$deck->name}\n";
        $output .= "Format={$deck->format}\n\n";

        foreach ($deck->mainboard as $card) {
            $output .= sprintf("    %d [%s:%s] %s\n",
                $card->quantity,
                $card->card?->set_code,
                $card->card?->collector_number,
                $card->card?->name
            );
        }

        if ($deck->sideboard->isNotEmpty()) {
            $output .= "\n[Sideboard]\n";
            foreach ($deck->sideboard as $card) {
                $output .= sprintf("    %d [%s:%s] %s\n",
                    $card->quantity,
                    $card->card?->set_code,
                    $card->card?->collector_number,
                    $card->card?->name
                );
            }
        }

        return $output;
    }

    private function exportTxt(Deck $deck): string
    {
        $output = "{$deck->name}\n";
        $output .= str_repeat('=', strlen($deck->name)) . "\n\n";

        foreach ($deck->mainboard as $card) {
            $output .= sprintf("%d %s\n", $card->quantity, $card->card?->name);
        }

        if ($deck->sideboard->isNotEmpty()) {
            $output .= "\nSideboard\n";
            foreach ($deck->sideboard as $card) {
                $output .= sprintf("%d %s\n", $card->quantity, $card->card?->name);
            }
        }

        return $output;
    }
}
