<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuditLogController extends Controller
{
    protected AuditLogService $auditLogService;

    public function __construct(AuditLogService $auditLogService)
    {
        $this->auditLogService = $auditLogService;
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'business_type' => 'nullable|string',
            'action' => 'nullable|string',
            'business_id' => 'nullable|string',
            'user_id' => 'nullable|integer',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        if (!$user->isExchange() && !$user->isRegulator()) {
            return response()->json([
                'code' => 403,
                'message' => '无权限查看审计日志',
                'errors' => [],
            ], 403);
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->auditLogService->search(
            $validated['business_type'] ?? null,
            $validated['action'] ?? null,
            $validated['business_id'] ?? null,
            $validated['user_id'] ?? null,
            $validated['start_date'] ?? null,
            $validated['end_date'] ?? null,
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

    public function byBusiness(Request $request, string $businessType, string $businessId)
    {
        $user = Auth::user();
        if (!$user->isExchange() && !$user->isRegulator()) {
            return response()->json([
                'code' => 403,
                'message' => '无权限查看审计日志',
                'errors' => [],
            ], 403);
        }

        $logs = $this->auditLogService->getByBusiness($businessType, $businessId);

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $logs,
        ]);
    }
}
