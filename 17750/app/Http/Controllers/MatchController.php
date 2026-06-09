<?php

namespace App\Http\Controllers;

use App\Http\Requests\MatchAnalysisRequest;
use App\Http\Requests\MatchRecordRequest;
use App\Models\MatchRecord;
use App\Services\MatchAnalyzer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MatchController extends Controller
{
    public function __construct(
        protected MatchAnalyzer $analyzer
    ) {}

    /**
     * @OA\Get(
     *     path="/matches",
     *     summary="List match records",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="deck_id", in="query", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string")),
     *     @OA\Parameter(name="is_winner", in="query", @OA\Schema(type="boolean")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = MatchRecord::where('user_id', Auth::id())->with('deck');

        if ($request->has('deck_id')) {
            $query->byDeck($request->input('deck_id'));
        }
        if ($request->has('format')) {
            $query->byFormat($request->input('format'));
        }
        if ($request->has('is_winner')) {
            if ($request->input('is_winner')) {
                $query->wins();
            } else {
                $query->losses();
            }
        }
        if ($request->has('opponent_archetype')) {
            $query->byOpponent($request->input('opponent_archetype'));
        }

        $perPage = $request->input('per_page', 20);
        $results = $query->orderBy('played_at', 'desc')->cursorPaginate($perPage);

        return response()->json([
            'data' => $results->items(),
            'next_cursor' => $results->nextCursor()?->encode(),
            'prev_cursor' => $results->previousCursor()?->encode(),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/matches",
     *     summary="Create match record",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/MatchRecord")
     *     ),
     *     @OA\Response(response=201, description="Match record created")
     * )
     */
    public function store(MatchRecordRequest $request): JsonResponse
    {
        $match = new MatchRecord($request->validated());
        $match->user_id = Auth::id();
        $match->played_at = $match->played_at ?? now();
        $match->save();

        $match->load('deck');

        return response()->json([
            'message' => 'Match record created',
            'data' => $match,
        ], 201);
    }

    /**
     * @OA\Get(
     *     path="/matches/{id}",
     *     summary="Get match record",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function show(int $id): JsonResponse
    {
        $match = MatchRecord::where('user_id', Auth::id())
            ->with('deck')
            ->findOrFail($id);

        return response()->json([
            'data' => $match,
        ]);
    }

    /**
     * @OA\Put(
     *     path="/matches/{id}",
     *     summary="Update match record",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Match record updated")
     * )
     */
    public function update(MatchRecordRequest $request, int $id): JsonResponse
    {
        $match = MatchRecord::where('user_id', Auth::id())->findOrFail($id);
        $match->update($request->validated());
        $match->load('deck');

        return response()->json([
            'message' => 'Match record updated',
            'data' => $match,
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/matches/{id}",
     *     summary="Delete match record",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=204, description="Match record deleted")
     * )
     */
    public function destroy(int $id): JsonResponse
    {
        $match = MatchRecord::where('user_id', Auth::id())->findOrFail($id);
        $match->delete();

        return response()->json(null, 204);
    }

    /**
     * @OA\Get(
     *     path="/matches/analysis",
     *     summary="Get match analysis",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="deck_id", in="query", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string")),
     *     @OA\Parameter(name="start_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="end_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Response(response=200, description="Analysis complete")
     * )
     */
    public function analysis(MatchAnalysisRequest $request): JsonResponse
    {
        $filters = $request->validated();

        $analysis = $this->analyzer->getFullAnalysis(Auth::id(), $filters);

        return response()->json([
            'filters' => $filters,
            'analysis' => $analysis,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/matches/win-rate",
     *     summary="Get win rate statistics",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="deck_id", in="query", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function winRate(Request $request): JsonResponse
    {
        $query = MatchRecord::where('user_id', Auth::id());

        if ($request->has('deck_id')) {
            $query->byDeck($request->input('deck_id'));
        }
        if ($request->has('format')) {
            $query->byFormat($request->input('format'));
        }
        if ($request->has('start_date')) {
            $query->where('played_at', '>=', $request->input('start_date'));
        }
        if ($request->has('end_date')) {
            $query->where('played_at', '<=', $request->input('end_date'));
        }

        $matches = $query->get();

        $stats = $this->analyzer->getWinRate($matches);
        $byPlayOrder = $this->analyzer->getWinRateByPlayOrder($matches);

        return response()->json([
            'overall' => $stats,
            'by_play_order' => $byPlayOrder,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/matches/opponents",
     *     summary="Get opponent archetype distribution",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="limit", in="query", @OA\Schema(type="integer", default=10)),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function opponents(Request $request): JsonResponse
    {
        $query = MatchRecord::where('user_id', Auth::id());

        if ($request->has('deck_id')) {
            $query->byDeck($request->input('deck_id'));
        }
        if ($request->has('format')) {
            $query->byFormat($request->input('format'));
        }

        $matches = $query->get();
        $distribution = $this->analyzer->getOpponentDistribution(
            $matches,
            $request->input('limit', 10)
        );

        return response()->json([
            'opponents' => $distribution,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/matches/trend",
     *     summary="Get win rate trend",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="interval", in="query", @OA\Schema(type="string", enum={"day","week","month","year"})),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function trend(Request $request): JsonResponse
    {
        $interval = $request->input('interval', 'week');

        $query = MatchRecord::where('user_id', Auth::id())
            ->whereNotNull('played_at');

        if ($request->has('deck_id')) {
            $query->byDeck($request->input('deck_id'));
        }
        if ($request->has('format')) {
            $query->byFormat($request->input('format'));
        }

        $matches = $query->orderBy('played_at', 'asc')->get();
        $trendData = $this->analyzer->getTrendData($matches, $interval);

        return response()->json([
            'interval' => $interval,
            'trend' => $trendData,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/matches/decks/{deckId}/card-contribution",
     *     summary="Get card contribution analysis for a deck",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="start_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="end_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function cardContribution(int $deckId, Request $request): JsonResponse
    {
        $filters = $request->only(['start_date', 'end_date']);

        $contribution = $this->analyzer->getCardContribution(Auth::id(), $deckId, $filters);

        return response()->json([
            'deck_id' => $deckId,
            'card_contribution' => $contribution,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/matches/export",
     *     summary="Export match history",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string", enum={"json","csv"})),
     *     @OA\Response(response=200, description="Export successful")
     * )
     */
    public function export(Request $request): JsonResponse
    {
        $format = $request->input('format', 'json');

        $matches = MatchRecord::where('user_id', Auth::id())
            ->with('deck')
            ->orderBy('played_at', 'desc')
            ->get();

        if ($format === 'csv') {
            $handle = fopen('php://temp', 'r+');
            fputcsv($handle, [
                'Date', 'Deck', 'Format', 'Opponent', 'On Play',
                'Result', 'Game Wins', 'Game Losses', 'Turns', 'Notes'
            ]);

            foreach ($matches as $match) {
                fputcsv($handle, [
                    $match->played_at?->toDateString(),
                    $match->deck?->name ?? 'N/A',
                    $match->format,
                    $match->opponent_archetype ?? 'Unknown',
                    $match->on_play ? 'Yes' : 'No',
                    $match->is_winner ? 'Win' : 'Loss',
                    $match->game_wins,
                    $match->game_losses,
                    $match->turn_count ?? '',
                    $match->notes,
                ]);
            }

            rewind($handle);
            $data = stream_get_contents($handle);
        } else {
            $data = $matches->toArray();
        }

        return response()->json([
            'format' => $format,
            'total_matches' => $matches->count(),
            'data' => $data,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/matches/stats",
     *     summary="Get comprehensive match statistics",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Parameter(name="deck_id", in="query", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function stats(Request $request): JsonResponse
    {
        $query = MatchRecord::where('user_id', Auth::id());

        if ($request->has('deck_id')) {
            $query->byDeck($request->input('deck_id'));
        }
        if ($request->has('format')) {
            $query->byFormat($request->input('format'));
        }

        $matches = $query->get();

        return response()->json([
            'overview' => $this->analyzer->getOverview(Auth::id()),
            'by_deck' => $this->analyzer->getByDeck(Auth::id()),
            'by_opponent' => $this->analyzer->getByOpponentArchetype($matches),
            'by_play_order' => $this->analyzer->getWinRateByPlayOrder($matches),
            'by_format' => $this->analyzer->getByFormat($matches),
            'by_turn_count' => $this->analyzer->getByTurnCount($matches),
        ]);
    }

    /**
     * @OA\Get(
     *     path="/matches/export/json",
     *     summary="Export match history as JSON",
     *     tags={"Matches"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=200, description="Export successful")
     * )
     */
    public function exportJson(Request $request): JsonResponse
    {
        $matches = MatchRecord::where('user_id', Auth::id())
            ->with('deck')
            ->orderBy('played_at', 'desc')
            ->get();

        return response()->json([
            'format' => 'json',
            'total_matches' => $matches->count(),
            'exported_at' => now()->toISOString(),
            'data' => $matches->toArray(),
        ]);
    }
}
