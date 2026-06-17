<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SLAPolicy;
use App\Models\SLATimer;
use App\Models\SLAViolation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * @OA\Tag(
 *     name="SLA Management",
 *     description="SLA管理 - 策略CRUD、计时器、违规记录与确认"
 * )
 */
class SLAController extends Controller
{
    /**
     * @OA\Get(path="/sla/policies", tags={"SLA Management"},
     * @OA\Response(response=200, description="SLA策略列表")
     */
    public function index(Request $request)
    {
        $policies = SLAPolicy::all();
        return response()->json(['success' => true, 'code' => 200, 'data' => $policies]);
    }

    /**
     * @OA\Post(path="/sla/policies", tags={"SLA Management"},
     * @OA\Response(response=201, description="创建SLA策略")
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'priority' => 'required|in:urgent,high,medium,low,lowest',
            'first_response_minutes' => 'required|integer|min:1',
            'resolution_minutes' => 'integer|min:1',
            'warning_threshold_percent' => 'integer|min:1|max:100',
            'is_active' => 'boolean',
            'escalation_rules' => 'nullable|array',
        ]);

        $policy = SLAPolicy::create($validated);

        return response()->json([
            'success' => true, 'code' => 201,
            'message' => 'SLA Policy created',
            'data' => $policy,
        ], 201);
    }

    /**
     * @OA\Get(path="/sla/policies/{policy}", tags={"SLA Management"},
     * @OA\Response(response=200, description="SLA策略详情")
     */
    public function show(SLAPolicy $policy)
    {
        return response()->json(['success' => true, 'code' => 200, 'data' => $policy]);
    }

    /**
     * @OA\Put(path="/sla/policies/{policy}", tags={"SLA Management"},
     * @OA\Response(response=200, description="更新SLA策略")
     */
    public function update(Request $request, SLAPolicy $policy)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'description' => 'nullable|string|max:500',
            'first_response_minutes' => 'integer|min:1',
            'resolution_minutes' => 'integer|min:1',
            'warning_threshold_percent' => 'integer|min:1|max:100',
            'is_active' => 'boolean',
            'escalation_rules' => 'nullable|array',
        ]);

        $policy->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'SLA Policy updated',
            'data' => $policy,
        ]);
    }

    /**
     * @OA\Delete(path="/sla/policies/{policy}", tags={"SLA Management"},
     * @OA\Response(response=200, description="删除SLA策略")
     */
    public function destroy(SLAPolicy $policy)
    {
        $policy->delete();
        return response()->json([
            'success' => true, 'message' => 'SLA Policy deleted',
        ]);
    }

    /**
     * @OA\Get(path="/sla/timers", tags={"SLA Management"},
     * summary="活跃SLA计时器列表",
     * description="支持按状态(timer_type过滤，50条/页",
     * @OA\Response(response=200, description="计时器列表")
     */
    public function timers(Request $request)
    {
        $query = SLATimer::query()
            ->with(['ticket.assignee', 'policy']);

        if ($status = $request->status) {
            $query->where('status', $status);
        }
        if ($timerType = $request->timer_type) {
            $query->where('timer_type', $timerType);
        }

        $timers = $query->orderBy('created_at', 'desc')->paginate(50);

        return response()->json([
            'success' => true,
            'data' => $timers->items(),
            'pagination' => ['total' => $timers->total()],
        ]);
    }

    /**
     * @OA\Get(path="/sla/violations", tags={"SLA Management"},
     * summary="SLA违规记录",
     * @OA\Response(response=200, description="违规列表")
     */
    public function violations(Request $request)
    {
        $perPage = $request->input('per_page', 50);

        $query = SLAViolation::query()
            ->with(['ticket.assignee', 'policy']);

        if ($severity = $request->severity) {
            $query->where('severity', $severity);
        }
        if ($acknowledged = $request->acknowledged) {
            if ($acknowledged === '1') {
                $query->whereNotNull('acknowledged_at');
            } else {
                $query->whereNull('acknowledged_at');
            }
        }

        $violations = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $violations->items(),
            'pagination' => ['total' => $violations->total()],
        ]);
    }

    /**
     * @OA\Post(path="/sla/violations/{violation}/acknowledge", tags={"SLA Management"},
     * summary="人工确认SLA违规",
     * description="记录确认人ID+确认时间+处理原因备注",
     * @OA\Response(response=200, description="已确认")
     */
    public function acknowledge(Request $request, SLAViolation $violation)
    {
        if ($violation->acknowledged_at) {
            return response()->json([
                'success' => false,
                'message' => 'Violation already acknowledged',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $violation->acknowledged_at = now();
            $violation->acknowledged_by = $request->user()?->id;
            $violation->resolution_note = $request->input('note');
            $violation->save();
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Violation acknowledged',
                'data' => $violation,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
