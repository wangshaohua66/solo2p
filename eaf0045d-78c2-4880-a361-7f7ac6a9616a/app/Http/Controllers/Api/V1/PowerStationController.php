<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PowerStation;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PowerStationController extends Controller
{
    protected AuditLogService $auditLogService;

    public function __construct(AuditLogService $auditLogService)
    {
        $this->auditLogService = $auditLogService;
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'energy_type' => 'nullable|in:solar,wind',
            'province' => 'nullable|string',
            'status' => 'nullable|string',
            'owner_id' => 'nullable|integer',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $query = PowerStation::with('owner');

        $user = Auth::user();
        if ($user->isGenerator()) {
            $query->where('owner_id', $user->id);
        } elseif (!empty($validated['owner_id'])) {
            $query->where('owner_id', $validated['owner_id']);
        }

        if (!empty($validated['energy_type'])) {
            $query->ofEnergyType($validated['energy_type']);
        }

        if (!empty($validated['province'])) {
            $query->ofProvince($validated['province']);
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $query->orderBy('id', 'desc')->paginate($perPage, ['*'], 'page', $page);

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
        $station = PowerStation::with('owner')->findOrFail($id);

        $user = Auth::user();
        if ($user->isGenerator() && $station->owner_id !== $user->id) {
            return response()->json([
                'code' => 403,
                'message' => '无权限查看',
                'errors' => [],
            ], 403);
        }

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $station,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'station_code' => 'required|string|max:50|unique:power_stations',
            'station_name' => 'required|string|max:200',
            'energy_type' => 'required|in:solar,wind',
            'installed_capacity' => 'required|numeric|min:0',
            'province' => 'required|string|max:50',
            'city' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
            'owner_id' => 'nullable|integer|exists:users,id',
            'grid_connection_date' => 'nullable|date',
            'remark' => 'nullable|string',
        ]);

        $user = Auth::user();

        if ($user->isGenerator()) {
            $validated['owner_id'] = $user->id;
        }

        $station = PowerStation::create($validated);

        $this->auditLogService->logCreate(
            AuditLogService::BUSINESS_STATION,
            $station->id,
            $station->toArray(),
            '创建电站'
        );

        return response()->json([
            'code' => 0,
            'message' => '创建成功',
            'data' => $station,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $station = PowerStation::findOrFail($id);

        $user = Auth::user();
        if ($user->isGenerator() && $station->owner_id !== $user->id) {
            return response()->json([
                'code' => 403,
                'message' => '无权限修改',
                'errors' => [],
            ], 403);
        }

        $validated = $request->validate([
            'station_name' => 'sometimes|string|max:200',
            'installed_capacity' => 'sometimes|numeric|min:0',
            'province' => 'sometimes|string|max:50',
            'city' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
            'status' => 'sometimes|in:active,suspended',
            'grid_connection_date' => 'nullable|date',
            'remark' => 'nullable|string',
        ]);

        $beforeData = $station->toArray();
        $station->update($validated);

        $this->auditLogService->logUpdate(
            AuditLogService::BUSINESS_STATION,
            $station->id,
            $beforeData,
            $station->toArray(),
            '更新电站信息'
        );

        return response()->json([
            'code' => 0,
            'message' => '更新成功',
            'data' => $station,
        ]);
    }
}
