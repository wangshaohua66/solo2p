<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TicketGroup;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Groups",
 *     description="客服组管理"
 * )
 */
class GroupController extends Controller
{
    /**
     * @OA\Get(path="/groups", tags={"Groups"},
     * @OA\Response(response=200, description="客服组列表"))
     */
    public function index(Request $request)
    {
        $query = TicketGroup::query();
        if ($request->filled('include_inactive', true)) {
            $query->where('is_active', true);
        }
        $groups = $query
            ->withCount('members', 'tickets')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['success' => true, 'data' => $groups]);
    }

    /**
     * @OA\Post(path="/groups", tags={"Groups"}, @OA\Response(response=201, description="创建客服组"))
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'leader_id' => 'nullable|integer|exists:users,id',
            'escalation_email' => 'nullable|email',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $group = TicketGroup::create($validated);

        if ($members = $request->input('member_ids')) {
            $group->members()->sync((array)$members);
        }

        return response()->json([
            'success' => true, 'code' => 201,
            'message' => 'Group created', 'data' => $group->load('members'),
        ], 201);
    }

    /**
     * @OA\Get(path="/groups/{group}", tags={"Groups"})
     */
    public function show(TicketGroup $group)
    {
        $group->load(['members', 'leader', 'openTickets']);
        return response()->json(['success' => true, 'data' => $group]);
    }

    /**
     * @OA\Put(path="/groups/{group}", tags={"Groups"})
     */
    public function update(Request $request, TicketGroup $group)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'description' => 'nullable|string|max:500',
            'leader_id' => 'nullable|integer|exists:users,id',
            'escalation_email' => 'nullable|email',
            'is_active' => 'boolean',
        ]);

        $group->update($validated);

        if ($request->has('member_ids')) {
            $group->members()->sync($request->input('member_ids'));
        }
        return response()->json([
            'success' => true, 'message' => 'Group updated',
            'data' => $group->fresh()->load('members')]);
    }

    /**
     * @OA\Delete(path="/groups/{group}", tags={"Groups"})
     */
    public function destroy(TicketGroup $group)
    {
        TicketGroup::where('leader_id', $group->id)
            ->update(['leader_id' => null]);
        $group->members()->detach();
        $group->delete();
        return response()->json(['success' => true, 'message' => 'Group deleted']);
    }
}
