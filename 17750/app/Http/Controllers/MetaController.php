<?php

namespace App\Http\Controllers;

use App\Http\Requests\MetaSnapshotRequest;
use App\Models\MetaArchetype;
use App\Models\MetaSnapshot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MetaController extends Controller
{
    /**
     * @OA\Get(
     *     path="/meta",
     *     summary="List meta snapshots",
     *     tags={"Meta"},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = MetaSnapshot::withCount('archetypes');

        if ($request->has('format')) {
            $query->byFormat($request->input('format'));
        }

        $perPage = $request->input('per_page', 20);
        $results = $query->orderBy('snapshot_date', 'desc')->cursorPaginate($perPage);

        return response()->json([
            'data' => $results->items(),
            'next_cursor' => $results->nextCursor()?->encode(),
            'prev_cursor' => $results->previousCursor()?->encode(),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/meta",
     *     summary="Create meta snapshot",
     *     tags={"Meta"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/MetaSnapshot")
     *     ),
     *     @OA\Response(response=201, description="Snapshot created successfully")
     * )
     */
    public function store(MetaSnapshotRequest $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $snapshot = MetaSnapshot::create($request->validated());

            if ($request->has('archetypes')) {
                foreach ($request->input('archetypes', []) as $archetype) {
                    MetaArchetype::create([
                        'meta_snapshot_id' => $snapshot->id,
                        'name' => $archetype['name'],
                        'percentage' => $archetype['percentage'],
                        'win_rate' => $archetype['win_rate'] ?? null,
                        'sample_size' => $archetype['sample_size'] ?? null,
                        'color_identity' => $archetype['color_identity'] ?? null,
                    ]);
                }
            }

            $snapshot->load('archetypes');

            return response()->json([
                'message' => 'Meta snapshot created',
                'data' => $snapshot,
            ], 201);
        });
    }

    /**
     * @OA\Get(
     *     path="/meta/{id}",
     *     summary="Get meta snapshot details",
     *     tags={"Meta"},
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function show(int $id): JsonResponse
    {
        $snapshot = MetaSnapshot::with('archetypes')->findOrFail($id);

        return response()->json([
            'data' => $snapshot,
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/meta/{id}",
     *     summary="Delete meta snapshot",
     *     tags={"Meta"},
     *     security={{"sanctum": {}}},
     *     @OA\Response(response=204, description="Snapshot deleted")
     * )
     */
    public function destroy(int $id): JsonResponse
    {
        $snapshot = MetaSnapshot::findOrFail($id);
        $snapshot->delete();

        return response()->json(null, 204);
    }

    /**
     * @OA\Get(
     *     path="/meta/latest",
     *     summary="Get latest meta snapshot",
     *     tags={"Meta"},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string", default="standard")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function latest(Request $request): JsonResponse
    {
        $format = $request->input('format', 'standard');

        $snapshot = MetaSnapshot::byFormat($format)
            ->latest()
            ->with('archetypes')
            ->first();

        if (! $snapshot) {
            return response()->json([
                'message' => 'No meta snapshot found for this format',
                'format' => $format,
            ], 404);
        }

        return response()->json([
            'format' => $format,
            'snapshot_date' => $snapshot->snapshot_date,
            'total_decks' => $snapshot->total_decks,
            'source' => $snapshot->source,
            'top_archetypes' => $snapshot->archetypes->take(10),
            'data' => $snapshot,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/meta/trend",
     *     summary="Get meta trend analysis",
     *     tags={"Meta"},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string", required=true)),
     *     @OA\Parameter(name="start_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="end_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Response(response=200, description="Analysis complete")
     * )
     */
    public function trend(Request $request): JsonResponse
    {
        $request->validate([
            'format' => ['required', 'string', 'in:standard,pioneer,modern,legacy,vintage,commander,pauper,casual'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $query = MetaSnapshot::byFormat($request->input('format'))
            ->with('archetypes');

        if ($request->has('start_date')) {
            $query->where('snapshot_date', '>=', $request->input('start_date'));
        }
        if ($request->has('end_date')) {
            $query->where('snapshot_date', '<=', $request->input('end_date'));
        }

        $snapshots = $query->orderBy('snapshot_date', 'asc')->get();

        if ($snapshots->isEmpty()) {
            return response()->json([
                'message' => 'No meta snapshots found for the specified period',
                'trend_data' => [],
            ]);
        }

        $trendData = $this->analyzeTrend($snapshots);

        return response()->json([
            'format' => $request->input('format'),
            'period' => [
                'start' => $snapshots->first()->snapshot_date,
                'end' => $snapshots->last()->snapshot_date,
                'snapshot_count' => $snapshots->count(),
            ],
            'trend_data' => $trendData,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/meta/import",
     *     summary="Import meta snapshot from CSV",
     *     tags={"Meta"},
     *     security={{"sanctum": {}}},
     *     @OA\RequestBody(
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *             @OA\Schema(
     *                 @OA\Property(property="file", type="file"),
     *                 @OA\Property(property="format", type="string"),
     *                 @OA\Property(property="snapshot_date", type="string", format="date"),
     *                 @OA\Property(property="source", type="string")
     *             )
     *         )
     *     ),
     *     @OA\Response(response=201, description="Import completed")
     * )
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv', 'max:10240'],
            'format' => ['required', 'string', 'in:standard,pioneer,modern,legacy,vintage,commander,pauper,casual'],
            'snapshot_date' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('file');
        $content = file_get_contents($file->getRealPath());
        $lines = explode("\n", $content);
        $headers = str_getcsv(array_shift($lines));

        $archetypes = [];
        $totalDecks = 0;

        foreach ($lines as $line) {
            if (empty(trim($line))) continue;

            $data = array_combine($headers, str_getcsv($line));

            $archetypes[] = [
                'name' => $data['Archetype'] ?? $data['Name'] ?? 'Unknown',
                'percentage' => (float) ($data['Percentage'] ?? $data['%'] ?? 0),
                'win_rate' => isset($data['Win Rate']) ? (float) $data['Win Rate'] : null,
                'sample_size' => isset($data['Sample Size']) ? (int) $data['Sample Size'] : null,
                'color_identity' => isset($data['Colors']) ? str_split($data['Colors']) : null,
            ];

            $totalDecks += (int) ($data['Count'] ?? 0);
        }

        return DB::transaction(function () use ($request, $archetypes, $totalDecks) {
            $snapshot = MetaSnapshot::create([
                'format' => $request->input('format'),
                'source' => $request->input('source'),
                'snapshot_date' => $request->input('snapshot_date'),
                'total_decks' => $totalDecks,
                'meta_data' => ['imported_from' => $request->file('file')->getClientOriginalName()],
            ]);

            foreach ($archetypes as $archetype) {
                MetaArchetype::create([
                    'meta_snapshot_id' => $snapshot->id,
                    ...$archetype,
                ]);
            }

            $snapshot->load('archetypes');

            return response()->json([
                'message' => 'Meta snapshot imported successfully',
                'data' => $snapshot,
                'stats' => [
                    'archetypes_imported' => count($archetypes),
                    'total_decks' => $totalDecks,
                ],
            ], 201);
        });
    }

    /**
     * @OA\Get(
     *     path="/meta/compare",
     *     summary="Compare two meta snapshots",
     *     tags={"Meta"},
     *     @OA\Parameter(name="snapshot1_id", in="query", @OA\Schema(type="integer", required=true)),
     *     @OA\Parameter(name="snapshot2_id", in="query", @OA\Schema(type="integer", required=true)),
     *     @OA\Response(response=200, description="Comparison complete")
     * )
     */
    public function compare(Request $request): JsonResponse
    {
        $request->validate([
            'snapshot1_id' => ['required', 'integer', 'exists:meta_snapshots,id'],
            'snapshot2_id' => ['required', 'integer', 'exists:meta_snapshots,id'],
        ]);

        $snapshot1 = MetaSnapshot::with('archetypes')->findOrFail($request->input('snapshot1_id'));
        $snapshot2 = MetaSnapshot::with('archetypes')->findOrFail($request->input('snapshot2_id'));

        $comparison = $this->compareSnapshots($snapshot1, $snapshot2);

        return response()->json([
            'snapshot1' => [
                'id' => $snapshot1->id,
                'date' => $snapshot1->snapshot_date,
                'format' => $snapshot1->format,
            ],
            'snapshot2' => [
                'id' => $snapshot2->id,
                'date' => $snapshot2->snapshot_date,
                'format' => $snapshot2->format,
            ],
            'comparison' => $comparison,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/meta/archetypes/{name}/history",
     *     summary="Get archetype history",
     *     tags={"Meta"},
     *     @OA\Parameter(name="format", in="query", @OA\Schema(type="string")),
     *     @OA\Response(response=200, description="Successful operation")
     * )
     */
    public function archetypeHistory(string $name, Request $request): JsonResponse
    {
        $query = MetaArchetype::where('name', 'LIKE', "%{$name}%")
            ->with('metaSnapshot');

        if ($request->has('format')) {
            $query->whereHas('metaSnapshot', function ($q) use ($request) {
                $q->byFormat($request->input('format'));
            });
        }

        $history = $query->orderBy('snapshot_date', 'asc')
            ->get()
            ->map(function ($archetype) {
                return [
                    'date' => $archetype->metaSnapshot?->snapshot_date,
                    'format' => $archetype->metaSnapshot?->format,
                    'percentage' => (float) $archetype->percentage,
                    'win_rate' => $archetype->win_rate ? (float) $archetype->win_rate : null,
                    'sample_size' => $archetype->sample_size,
                ];
            });

        return response()->json([
            'archetype_name' => $name,
            'history' => $history,
        ]);
    }

    private function analyzeTrend($snapshots): array
    {
        $trendData = [];
        $allArchetypes = [];

        foreach ($snapshots as $snapshot) {
            foreach ($snapshot->archetypes as $archetype) {
                $name = $archetype->name;
                if (! isset($allArchetypes[$name])) {
                    $allArchetypes[$name] = [
                        'name' => $name,
                        'history' => [],
                        'trend' => null,
                    ];
                }

                $allArchetypes[$name]['history'][] = [
                    'date' => $snapshot->snapshot_date,
                    'percentage' => (float) $archetype->percentage,
                    'win_rate' => $archetype->win_rate ? (float) $archetype->win_rate : null,
                ];
            }
        }

        foreach ($allArchetypes as &$archetype) {
            $history = $archetype['history'];
            if (count($history) >= 2) {
                $first = reset($history)['percentage'];
                $last = end($history)['percentage'];
                $archetype['trend'] = [
                    'change' => round($last - $first, 2),
                    'change_percent' => $first > 0 ? round((($last - $first) / $first) * 100, 2) : null,
                    'direction' => $last > $first ? 'rising' : ($last < $first ? 'falling' : 'stable'),
                ];
            }
        }

        usort($allArchetypes, function ($a, $b) {
            $aLatest = end($a['history'])['percentage'] ?? 0;
            $bLatest = end($b['history'])['percentage'] ?? 0;
            return $bLatest <=> $aLatest;
        });

        return array_values($allArchetypes);
    }

    private function compareSnapshots(MetaSnapshot $s1, MetaSnapshot $s2): array
    {
        $archetypes1 = $s1->archetypes->keyBy('name');
        $archetypes2 = $s2->archetypes->keyBy('name');

        $allNames = $archetypes1->keys()->merge($archetypes2->keys())->unique();

        $comparison = [];
        foreach ($allNames as $name) {
            $a1 = $archetypes1->get($name);
            $a2 = $archetypes2->get($name);

            $p1 = $a1 ? (float) $a1->percentage : 0;
            $p2 = $a2 ? (float) $a2->percentage : 0;

            $comparison[] = [
                'name' => $name,
                'snapshot1' => [
                    'percentage' => $p1,
                    'win_rate' => $a1?->win_rate,
                ],
                'snapshot2' => [
                    'percentage' => $p2,
                    'win_rate' => $a2?->win_rate,
                ],
                'change' => round($p2 - $p1, 2),
                'status' => $a1 && $a2 ? 'unchanged' : ($a1 ? 'removed' : 'new'),
            ];
        }

        usort($comparison, function ($a, $b) {
            return abs($b['change']) <=> abs($a['change']);
        });

        return [
            'format_match' => $s1->format === $s2->format,
            'days_between' => $s1->snapshot_date->diff($s2->snapshot_date)->days,
            'archetypes' => $comparison,
            'new_archetypes' => count(array_filter($comparison, fn($c) => $c['status'] === 'new')),
            'removed_archetypes' => count(array_filter($comparison, fn($c) => $c['status'] === 'removed')),
        ];
    }
}
