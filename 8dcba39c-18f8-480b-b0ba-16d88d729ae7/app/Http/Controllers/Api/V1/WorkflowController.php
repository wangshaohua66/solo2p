<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Workflow;
use App\Models\WorkflowState;
use App\Models\WorkflowTransition;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Workflows",
 *     description="工作流引擎管理"
 * )
 */
class WorkflowController extends Controller
{
    /**
     * @OA\Get(path="/workflows", tags={"Workflows"}, @OA\Response(response=200))
     */
    public function index()
    {
        $workflows = Workflow::with(['states', 'transitions'])
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get();
        return response()->json(['success' => true, 'data' => $workflows]);
    }

    /**
     * @OA\Post(path="/workflows", tags={"Workflows"}, @OA\Response(response=201))
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'is_default' => 'boolean',
        ]);

        $workflow = Workflow::create($validated);
        $states = [
            ['key' => 'open', 'name' => '待处理', 'color' => '#ef4444', 'is_initial' => true],
            ['key' => 'in_progress', 'name' => '处理中', 'color' => '#f59e0b'],
            ['key' => 'pending_customer', 'name' => '待客户回复', 'color' => '#3b82f6'],
            ['key' => 'pending_third_party', 'name' => '待第三方', 'color' => '#8b5cf6'],
            ['key' => 'pending_approval', 'name' => '待审批', 'color' => '#06b6d4'],
            ['key' => 'resolved', 'name' => '已解决', 'color' => '#10b981'],
            ['key' => 'closed', 'name' => '已关闭', 'color' => '#6b7280', 'is_final' => true],
        ];

        foreach ($states as $idx => $state) {
            $workflow->states()->create([
                ...$state,
                'sort_order' => $idx,
            ]);
        }

        return response()->json([
            'success' => true, 'code' => 201,
            'message' => 'Workflow created', 'data' => $workflow->load('states'),
        ], 201);
    }

    /**
     * @OA\Get(path="/workflows/{workflow}", tags={"Workflows"},
     */
    public function show(Workflow $workflow)
    {
        $workflow->load(['states.transitionsFrom', 'states.transitionsTo', 'transitions']);
        return response()->json(['success' => true, 'data' => $workflow]);
    }

    /**
     * @OA\Put(path="/workflows/{workflow}", tags={"Workflows"})
     */
    public function update(Request $request, Workflow $workflow)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'description' => 'nullable|string|max:500',
            'is_default' => 'boolean',
        ]);

        if (!empty($validated['is_default'])) {
            Workflow::where('id', '!=', $workflow->id)
                ->update(['is_default' => false]);
        }
        $workflow->update($validated);
        return response()->json(['success' => true, 'data' => $workflow->fresh()]);
    }

    /**
     * @OA\Delete(path="/workflows/{workflow}", tags={"Workflows"})
     */
    public function destroy(Workflow $workflow)
    {
        if ($workflow->is_default) {
            return response()->json(['success' => false, 'code' => 422,
                'message' => 'Cannot delete default workflow'], 422);
        }
        $workflow->delete();
        return response()->json(['success' => true, 'message' => 'Workflow deleted']);
    }

    /**
     * @OA\Get(path="/workflows/{workflow}/states", tags={"Workflows"},
     * summary="工作流所有状态节点", @OA\Response(response=200))
     */
    public function states(Workflow $workflow)
    {
        $states = $workflow->states()->orderBy('sort_order')->get();
        return response()->json(['success' => true, 'data' => $states]);
    }

    /**
     * @OA\Get(path="/workflows/{workflow}/transitions", tags={"Workflows"},
     * summary="工作流状态转换规则", @OA\Response(response=200))
     */
    public function transitions(Workflow $workflow, Request $request)
    {
        $fromState = $request->from_state;
        $query = $workflow->transitions();

        if ($fromState) {
            $query->where('from_state', $fromState);
        }

        $transitions = $query->with('fromStateObj', 'toStateObj')
            ->orderBy('sort_order')
            ->get();
        return response()->json(['success' => true, 'data' => $transitions]);
    }
}
