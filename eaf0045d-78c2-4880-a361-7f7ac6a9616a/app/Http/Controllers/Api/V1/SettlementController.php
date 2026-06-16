<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SettlementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SettlementController extends Controller
{
    protected SettlementService $settlementService;

    public function __construct(SettlementService $settlementService)
    {
        $this->settlementService = $settlementService;
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => 'nullable|string',
            'type' => 'nullable|in:income,expenditure',
            'month' => 'nullable|string|size:7',
            'energy_type' => 'nullable|in:solar,wind',
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

        $result = $this->settlementService->getSettlements(
            $userId,
            $validated['status'] ?? null,
            $validated['type'] ?? null,
            $validated['month'] ?? null,
            $validated['energy_type'] ?? null,
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

    public function monthlySummary(Request $request)
    {
        $validated = $request->validate([
            'month' => 'required|string|size:7',
            'user_id' => 'nullable|integer',
        ]);

        $user = Auth::user();
        $userId = $user->id;

        if (($user->isExchange() || $user->isRegulator()) && !empty($validated['user_id'])) {
            $userId = $validated['user_id'];
        }

        $summary = $this->settlementService->getMonthlySummary(
            $userId,
            $validated['month']
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $summary,
        ]);
    }

    public function confirm(int $id)
    {
        $user = Auth::user();

        if (!$user->isExchange()) {
            return response()->json([
                'code' => 403,
                'message' => '无权限确认结算',
                'errors' => [],
            ], 403);
        }

        $settlement = $this->settlementService->confirmSettlement($id, $user);

        return response()->json([
            'code' => 0,
            'message' => '结算确认成功',
            'data' => $settlement,
        ]);
    }

    public function exportMonthly(Request $request)
    {
        $validated = $request->validate([
            'month' => 'required|string|size:7',
        ]);

        $user = Auth::user();

        $report = $this->settlementService->exportMonthlyReport(
            $user->id,
            $validated['month']
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $report,
        ]);
    }
}
