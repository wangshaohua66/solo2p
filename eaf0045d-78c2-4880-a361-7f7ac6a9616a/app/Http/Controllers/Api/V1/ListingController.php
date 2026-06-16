<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListingCreateRequest;
use App\Http\Requests\MatchOrderRequest;
use App\Services\MatchingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ListingController extends Controller
{
    protected MatchingService $matchingService;

    public function __construct(MatchingService $matchingService)
    {
        $this->matchingService = $matchingService;
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'seller_id' => 'nullable|integer',
            'energy_type' => 'nullable|in:solar,wind',
            'status' => 'nullable|string',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        $sellerId = $validated['seller_id'] ?? null;

        if ($user->isGenerator()) {
            $sellerId = $user->id;
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->matchingService->getListings(
            $sellerId,
            $validated['energy_type'] ?? null,
            $validated['status'] ?? null,
            $perPage,
            $page
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'total' => $result->total(),
                'per_page' => $result->perPage(),
                'current_page' => $result->currentPage(),
                'data' => $result->items(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $listings = $this->matchingService->getListings(null, null, null, 1, 1);

        if ($listings->isEmpty()) {
            return response()->json([
                'code' => 404,
                'message' => '挂牌单不存在',
                'errors' => [],
            ], 404);
        }

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $listings->first(),
        ]);
    }

    public function store(ListingCreateRequest $request)
    {
        $user = Auth::user();
        $validated = $request->validated();

        $listing = $this->matchingService->createListing(
            $user,
            $validated['energy_type'],
            (int)$validated['quantity'],
            (float)$validated['unit_price'],
            $validated['expires_at'] ?? null,
            $validated['remark'] ?? null
        );

        return response()->json([
            'code' => 0,
            'message' => '挂牌成功',
            'data' => $listing,
        ], 201);
    }

    public function cancel(int $id)
    {
        $user = Auth::user();

        $listing = $this->matchingService->cancelListing($id, $user);

        return response()->json([
            'code' => 0,
            'message' => '撤销成功',
            'data' => $listing,
        ]);
    }

    public function match(MatchOrderRequest $request)
    {
        $user = Auth::user();
        $validated = $request->validated();

        $result = $this->matchingService->matchOrder(
            $user,
            $validated['energy_type'],
            (int)$validated['quantity'],
            isset($validated['max_price']) ? (float)$validated['max_price'] : null
        );

        return response()->json([
            'code' => 0,
            'message' => '撮合完成',
            'data' => $result,
        ]);
    }

    public function marketDepth(Request $request)
    {
        $validated = $request->validate([
            'energy_type' => 'required|in:solar,wind',
            'levels' => 'nullable|integer|min:1|max:50',
        ]);

        $depth = $this->matchingService->getMarketDepth(
            $validated['energy_type'],
            $validated['levels'] ?? 10
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $depth,
        ]);
    }

    public function trades(Request $request)
    {
        $validated = $request->validate([
            'energy_type' => 'nullable|in:solar,wind',
            'status' => 'nullable|string',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        $userId = null;

        if (!$user->isExchange() && !$user->isRegulator()) {
            $userId = $user->id;
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->matchingService->getTrades(
            $userId,
            $validated['energy_type'] ?? null,
            $validated['status'] ?? null,
            $perPage,
            $page
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'total' => $result->total(),
                'per_page' => $result->perPage(),
                'current_page' => $result->currentPage(),
                'data' => $result->items(),
            ],
        ]);
    }

    public function latestPrice(Request $request)
    {
        $validated = $request->validate([
            'energy_type' => 'required|in:solar,wind',
        ]);

        $price = $this->matchingService->getLatestPrice($validated['energy_type']);

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => ['price' => $price],
        ]);
    }
}
