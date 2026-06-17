<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AutomationLog;
use App\Models\AutomationRule;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Automation",
 *     description="自动化规则引擎 - 触发器/动作/执行日志"
 * )
 */
class AutomationController extends Controller
{
    /**
     * @OA\Get(path="/automations/rules", tags={"Automation"},
     * @OA\Response(response=200, description="自动化规则列表"))
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 50);
        $query = AutomationRule::query();

        if ($triggerType = $request->trigger_type) {
            $query->where('trigger_type', $triggerType);
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $rules = $query->orderBy('sort_order')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $rules->items(),
            'pagination' => ['total' => $rules->total()],
        ]);
    }

    /**
     * @OA\Post(path="/automations/rules", tags={"Automation"},
     * summary="创建自动化规则",
     * description="触发器类型:event/schedule/condition",
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'trigger_type' => 'required|in:event,schedule,condition',
            'trigger_event' => 'required_if:trigger_type,event|nullable|string',
            'trigger_frequency' => 'required_if:trigger_type,schedule|in:every_minute,hourly,daily,weekly,monthly',
            'trigger_conditions' => 'nullable|array',
            'actions' => 'required|array|min:1',
            'is_active' => 'boolean',
            'stop_on_error' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        $rule = AutomationRule::create($validated);

        return response()->json([
            'success' => true, 'code' => 201,
            'message' => 'Rule created',
            'data' => $rule,
        ], 201);
    }

    /**
     * @OA\Get(path="/automations/rules/{rule}", tags={"Automation"}))
     */
    public function show(AutomationRule $rule)
    {
        return response()->json(['success' => true, 'data' => $rule]);
    }

    /**
     * @OA\Put(path="/automations/rules/{rule}", tags={"Automation"}))
     */
    public function update(Request $request, AutomationRule $rule)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'trigger_conditions' => 'nullable|array',
            'actions' => 'array|min:1',
            'is_active' => 'boolean',
            'stop_on_error' => 'boolean',
        ]);

        $rule->update($validated);
        return response()->json([
            'success' => true,
            'message' => 'Rule updated', 'data' => $rule,
        ]);
    }

    /**
     * @OA\Delete(path="/automations/rules/{rule}", tags={"Automation"}))
     */
    public function destroy(AutomationRule $rule)
    {
        $rule->delete();
        return response()->json(['success' => true, 'message' => 'Rule deleted']);
    }

    /**
     * @OA\Post(path="/automations/rules/{rule}/execute", tags={"Automation"},
     * summary="手动触发规则", description="立即执行指定规则",
     * @OA\Response(response=200, description="执行结果"))
     */
    public function execute(Request $request, AutomationRule $rule)
    {
        try {
            $result = app('automation.engine')->executeRule(
                $rule, null, $request->input('context', []));

            return response()->json([
                    'success' => true,
                    'message' => 'Rule executed',
                    'data' => $result,
                ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'code' => 500,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @OA\Get(path="/automations/logs", tags={"Automation"},
     * summary="规则执行历史日志",
     */
    public function logs(Request $request)
    {
        $perPage = $request->input('per_page', 50);
        $query = AutomationLog::with('rule');

        if ($ruleId = $request->rule_id) {
            $query->where('automation_rule_id', $ruleId);
        }
        if ($success = $request->success) {
            $query->where('success', $success === '1');
        }

        $logs = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'pagination' => ['total' => $logs->total()],
        ]);
    }
}
