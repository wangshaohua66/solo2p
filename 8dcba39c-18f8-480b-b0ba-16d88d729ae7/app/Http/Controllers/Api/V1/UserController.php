<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * @OA\Tag(
 *     name="Users",
 *     description="用户管理 - 成员CRUD、角色分配、当前用户信息"
 * )
 */
class UserController extends Controller
{
    /**
     * @OA\Get(
     *     path="/users",
     *     tags={"Users"},
     *     summary="用户列表",
     *     description="支持多字段过滤和分页",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Parameter(name="filter[name]", in="query", @OA\Schema(type="string")),
     *     @OA\Parameter(name="filter[email]", in="query", @OA\Schema(type="string")),
     *     @OA\Parameter(name="filter[role]", in="query", description="角色名过滤(owner/admin/agent/...)"),
     *     @OA\Parameter(name="filter[is_active]", in="query", @OA\Schema(type="boolean")),
     *     @OA\Parameter(name="page", in="query", @OA\Schema(type="integer", example=1)),
     *     @OA\Parameter(name="per_page", in="query", @OA\Schema(type="integer", example=20)),
     *     @OA\Response(response=200, description="用户列表")
     * )
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 20);

        $query = QueryBuilder::for(User::class)
            ->allowedFilters([
                AllowedFilter::partial('name'),
                AllowedFilter::partial('email'),
                AllowedFilter::exact('is_active'),
                AllowedFilter::scope('role'),
            ])
            ->allowedIncludes(['roles', 'group'])
            ->allowedSorts(['name', 'email', 'created_at', 'last_login_at'])
            ->defaultSort('-created_at');

        $users = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => [
                'items' => $users->items(),
                'pagination' => [
                    'current_page' => $users->currentPage(),
                    'per_page' => $users->perPage(),
                    'total' => $users->total(),
                    'last_page' => $users->lastPage(),
                ],
            ],
        ]);
    }

    /**
     * @OA\Get(
     *     path="/users/me",
     *     tags={"Users"},
     *     summary="获取当前登录用户信息",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="用户信息+角色权限", ref="#/components/schemas/User")
     * )
     */
    public function me(Request $request)
    {
        $user = $request->user()->load(['roles.permissions', 'group']);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
                'phone' => $user->phone,
                'is_active' => $user->is_active,
                'timezone' => $user->timezone,
                'language' => $user->language,
                'last_login_at' => $user->last_login_at,
                'created_at' => $user->created_at,
                'roles' => $user->roles->map(fn($r) => [
                    'id' => $r->id,
                    'name' => $r->name,
                    'display_name' => $r->display_name,
                    'permissions' => $r->permissions->pluck('name'),
                ]),
                'group' => $user->group ? ['id' => $user->group->id, 'name' => $user->group->name] : null,
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    /**
     * @OA\Post(
     *     path="/users",
     *     tags={"Users"},
     *     summary="创建新用户(添加成员)",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=201, description="创建成功")
     * )
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:50',
            'email' => 'required|email',
            'password' => 'required|string|min:8',
            'role' => 'required|string|in:owner,admin,supervisor,agent,customer',
            'phone' => 'nullable|string|max:20',
            'avatar_url' => 'nullable|url',
            'timezone' => 'nullable|timezone',
            'language' => 'nullable|string|max:10',
            'group_id' => 'nullable|integer|exists:ticket_groups,id',
        ]);

        $tenantId = app('currentTenantId');

        $exists = User::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('email', $validated['email'])
            ->exists();
        if ($exists) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => 'Email already exists in this tenant',
            ], 422);
        }

        if (!app('tenant.service')->checkQuota($tenantId, 'users')) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => 'User quota exceeded for this tenant',
            ], 422);
        }

        $role = Role::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('name', $validated['role'])
            ->first();

        $user = User::create([
            'tenant_id' => $tenantId,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
            'avatar_url' => $validated['avatar_url'] ?? null,
            'timezone' => $validated['timezone'] ?? null,
            'language' => $validated['language'] ?? 'zh_CN',
            'group_id' => $validated['group_id'] ?? null,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        if ($role) {
            $user->roles()->attach($role->id);
        }

        return response()->json([
            'success' => true,
            'code' => 201,
            'message' => 'User created',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $validated['role'],
            ],
        ], 201);
    }

    /**
     * @OA\Get(
     *     path="/users/{user}",
     *     tags={"Users"},
     *     summary="用户详情",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="用户详情")
     * )
     */
    public function show(User $user)
    {
        $user->load(['roles', 'group', 'assignedTickets']);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $user->toArray(),
        ]);
    }

    /**
     * @OA\Put(
     *     path="/users/{user}",
     *     tags={"Users"},
     *     summary="更新用户信息",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="更新成功")
     * )
     */
    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'string|max:50',
            'email' => 'email',
            'phone' => 'nullable|string|max:20',
            'avatar_url' => 'nullable|url',
            'timezone' => 'nullable|timezone',
            'language' => 'nullable|string|max:10',
            'is_active' => 'boolean',
            'group_id' => 'nullable|integer|exists:ticket_groups,id',
            'password' => 'nullable|string|min:8',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'User updated',
            'data' => $user->fresh(),
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/users/{user}",
     *     tags={"Users"},
     *     summary="删除用户(软删除)",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="已删除")
     * )
     */
    public function destroy(User $user)
    {
        $currentUser = auth()->user();
        if ($currentUser && $currentUser->id === $user->id) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => 'Cannot delete yourself',
            ], 422);
        }

        if ($user->hasRole('owner')) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => 'Cannot delete the owner account',
            ], 422);
        }

        $user->is_active = false;
        $user->save();
        $user->delete();

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'User deactivated and soft-deleted',
        ]);
    }

    /**
     * @OA\Post(
     *     path="/users/{user}/roles",
     *     tags={"Users"},
     *     summary="分配/更新用户角色",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\RequestBody(@OA\JsonContent(
     *         @OA\Property(property="roles", type="array", @OA\Items(type="string"), example={"agent", "supervisor"})
     *     )),
     *     @OA\Response(response=200, description="角色已分配")
     * )
     */
    public function assignRoles(Request $request, User $user)
    {
        $validated = $request->validate([
            'roles' => 'required|array',
            'roles.*' => 'string',
        ]);

        $tenantId = app('currentTenantId');
        $roleIds = Role::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->whereIn('name', $validated['roles'])
            ->pluck('id')
            ->toArray();

        if (empty($roleIds)) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => 'No valid roles found',
            ], 422);
        }

        $user->roles()->sync($roleIds);

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'Roles assigned',
            'data' => ['assigned_roles' => $user->roles->pluck('name')],
        ]);
    }
}
