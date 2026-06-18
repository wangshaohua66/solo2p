<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MeterReadingSubmitRequest;
use App\Models\MeterReading;
use App\Services\MeterDataService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MeterReadingController extends Controller
{
    protected MeterDataService $meterDataService;

    public function __construct(MeterDataService $meterDataService)
    {
        $this->meterDataService = $meterDataService;
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'station_id' => 'nullable|integer',
            'report_month' => 'nullable|string|size:7',
            'status' => 'nullable|string',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        $ownerId = null;

        if ($user->isGenerator()) {
            $ownerId = $user->id;
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->meterDataService->getReadings(
            $validated['station_id'] ?? null,
            $validated['report_month'] ?? null,
            $validated['status'] ?? null,
            $ownerId,
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
        $user = Auth::user();

        $reading = MeterReading::with('station')->find($id);

        if (!$reading) {
            return response()->json([
                'code' => 404,
                'message' => '记录不存在',
                'errors' => [],
            ], 404);
        }

        if ($user->isGenerator() && $reading->station->owner_id !== $user->id) {
            return response()->json([
                'code' => 403,
                'message' => '无权访问该记录',
                'errors' => [],
            ], 403);
        }

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $reading,
        ]);
    }

    public function submit(MeterReadingSubmitRequest $request)
    {
        $user = Auth::user();
        $readingsData = $request->validated()['readings'];

        $results = $this->meterDataService->batchSubmit($readingsData, $user);

        return response()->json([
            'code' => 0,
            'message' => '数据提交完成',
            'data' => $results,
        ]);
    }

    public function review(Request $request, int $id)
    {
        $validated = $request->validate([
            'result' => 'required|in:approve,reject',
            'remark' => 'nullable|string|max:500',
        ]);

        $user = Auth::user();

        $reading = $this->meterDataService->review(
            $id,
            $validated['result'],
            $validated['remark'] ?? '',
            $user
        );

        return response()->json([
            'code' => 0,
            'message' => '审核完成',
            'data' => $reading,
        ]);
    }

    public function pendingCount()
    {
        $count = $this->meterDataService->getPendingCount();

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => ['count' => $count],
        ]);
    }
}
