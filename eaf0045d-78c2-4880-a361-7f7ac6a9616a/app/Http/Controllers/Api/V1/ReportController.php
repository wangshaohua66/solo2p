<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ReportController extends Controller
{
    protected ReportService $reportService;

    public function __construct(ReportService $reportService)
    {
        $this->reportService = $reportService;
    }

    public function quarterly(Request $request)
    {
        $validated = $request->validate([
            'year' => 'required|integer|min:2020|max:2030',
            'quarter' => 'required|integer|min:1|max:4',
            'province' => 'nullable|string',
            'energy_type' => 'nullable|in:solar,wind',
        ]);

        $user = Auth::user();
        if (!$user->isExchange() && !$user->isRegulator()) {
            return response()->json([
                'code' => 403,
                'message' => '无权限查看报表',
                'errors' => [],
            ], 403);
        }

        $report = $this->reportService->getQuarterlyReport(
            $validated['year'],
            $validated['quarter'],
            $validated['province'] ?? null,
            $validated['energy_type'] ?? null
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $report,
        ]);
    }

    public function dashboard()
    {
        $user = Auth::user();
        if (!$user->isExchange() && !$user->isRegulator()) {
            return response()->json([
                'code' => 403,
                'message' => '无权限查看仪表盘',
                'errors' => [],
            ], 403);
        }

        $data = $this->reportService->getRealtimeDashboard();

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $data,
        ]);
    }
}
