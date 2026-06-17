<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TicketCategory;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Categories",
 *     description="工单分类管理"
 * )
 */
class CategoryController extends Controller
{
    /**
     * @OA\Get(path="/categories", tags={"Categories"},
     * summary="工单分类列表", @OA\Response(response=200))
     */
    public function index(Request $request)
    {
        $query = TicketCategory::query();
        if ($request->filled('include_inactive', true)) {
            $query->where(function ($q) {
                $q->where('is_active', true);
            });
        }
        $categories = $query->withCount('tickets')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['success' => true, 'data' => $categories]);
    }

    /**
     * @OA\Post(path="/categories", tags={"Categories"},
     * @OA\Response(response=201))
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'parent_id' => 'nullable|integer|exists:ticket_categories,id',
            'sort_order' => 'integer',
            'default_assignee_id' => 'nullable|integer|exists:users,id',
            'default_group_id' => 'nullable|integer|exists:ticket_groups,id',
            'default_sla_policy_id' => 'nullable|integer|exists:sla_policies,id',
            'is_active' => 'boolean',
        ]);

        $category = TicketCategory::create($validated);

        return response()->json([
            'success' => true, 'code' => 201,
            'message' => 'Category created',
            'data' => $category,
        ], 201);
    }

    /**
     * @OA\Get(path="/categories/{category}", tags={"Categories"})
     */
    public function show(TicketCategory $category)
    {
        return response()->json([
            'success' => true, 'data' => $category->loadCount('tickets')]);
    }

    /**
     * @OA\Put(path="/categories/{category}", tags={"Categories"})
     */
    public function update(Request $request, TicketCategory $category)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'description' => 'nullable|string|max:500',
            'parent_id' => 'nullable|integer|exists:ticket_categories,id',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ]);

        $category->update($validated);
        return response()->json([
            'success' => true,
            'message' => 'Category updated', 'data' => $category]);
    }

    /**
     * @OA\Delete(path="/categories/{category}", tags={"Categories"})
     */
    public function destroy(TicketCategory $category)
    {
        if ($category->tickets()->count() > 0) {
            return response()->json([
                'success' => false, 'code' => 422,
                'message' => 'Cannot delete category with existing tickets'], 422);
        }
        $category->delete();
        return response()->json([
            'success' => true, 'message' => 'Category deleted']);
    }
}
