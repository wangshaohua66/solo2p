<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Tenants",
 *     description="租户管理 - 企业入驻、信息、统计、配额、启停"
 * )
 */
class TenantController extends Controller
{
    /**
     * @OA\Post(
     *     path="/tenants",
     *     tags={"Tenants"},
     *     summary="创建新租户(企业入驻)",
     *     description="一站式租户初始化：创建租户主数据 + 自动初始化5角色42权限 + 默认Workflow + 5条SLA策略 + 6分类 + 3客服组 + 15邮件模板 + 11订阅配置",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name","email","subdomain","plan"},
     *             @OA\Property(property="name", type="string", example="ABC科技有限公司"),
     *             @OA\Property(property="subdomain", type="string", pattern="^[a-z0-9-]+$", example="abctech"),
     *             @OA\Property(property="email", type="string", format="email", example="admin@abctech.com"),
     *             @OA\Property(property="owner_name", type="string", example="张先生"),
     *             @OA\Property(property="owner_password", type="string", example="Password@123"),
     *             @OA\Property(property="plan", type="string", enum={"trial","starter","standard","enterprise"}, example="standard"),
     *             @OA\Property(property="timezone", type="string", example="Asia/Shanghai"),
     *             @OA\Property(property="industry", type="string", example="e-commerce"),
     *             @OA\Property(property="employee_count", type="integer", example=50),
     *             @OA\Property(property="billing_email", type="string", format="email", example="finance@abctech.com")
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="租户创建成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="tenant", ref="#/components/schemas/Tenant"),
     *                 @OA\Property(property="owner_user", type="object", ref="#/components/schemas/User"),
     *                 @OA\Property(property="initialized_resources", type="object")
     *             )
     *         )
     *     ),
     *     @OA\Response(response=422, description="子域名冲突或参数错误")
     * )
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'subdomain' => 'nullable|string|max:63|regex:/^[a-z0-9-]+$/',
            'email' => 'required|email',
            'owner_name' => 'required|string|max:50',
            'owner_password' => 'required|string|min:8',
            'plan' => 'required|in:trial,starter,standard,enterprise',
            'timezone' => 'nullable|timezone',
            'industry' => 'nullable|string|max:50',
            'employee_count' => 'nullable|integer|min:1',
            'billing_email' => 'nullable|email',
        ]);

        try {
            $result = app('tenant.service')->createTenant($validated);

            return response()->json([
                'success' => true,
                'code' => 201,
                'message' => 'Tenant created successfully',
                'data' => $result,
                'timestamp' => now()->toISOString(),
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * @OA\Get(
     *     path="/tenants/{tenant}",
     *     tags={"Tenants"},
     *     summary="获取租户详情",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Parameter(name="tenant", in="path", required=true, @OA\Schema(type="integer")),
     *     @OA\Response(response=200, description="租户信息"),
     *     @OA\Response(response=404, description="租户不存在")
     * )
     */
    public function show(Tenant $tenant)
    {
        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => [
                'id' => $tenant->id,
                'uuid' => $tenant->uuid,
                'name' => $tenant->name,
                'subdomain' => $tenant->subdomain,
                'email' => $tenant->email,
                'plan' => $tenant->plan,
                'status' => $tenant->status,
                'is_active' => $tenant->is_active,
                'timezone' => $tenant->timezone,
                'language' => $tenant->language,
                'industry' => $tenant->industry,
                'employee_count' => $tenant->employee_count,
                'billing_email' => $tenant->billing_email,
                'trial_ends_at' => $tenant->trial_ends_at,
                'subscription_ends_at' => $tenant->subscription_ends_at,
                'created_at' => $tenant->created_at,
            ],
        ]);
    }

    /**
     * @OA\Put(
     *     path="/tenants/{tenant}",
     *     tags={"Tenants"},
     *     summary="更新租户信息",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="更新成功")
     * )
     */
    public function update(Request $request, Tenant $tenant)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'subdomain' => 'nullable|string|max:63|regex:/^[a-z0-9-]+$/',
            'email' => 'email',
            'timezone' => 'nullable|timezone',
            'language' => 'nullable|string|max:10',
            'industry' => 'nullable|string|max:50',
            'employee_count' => 'nullable|integer|min:1',
            'billing_email' => 'nullable|email',
            'settings' => 'nullable|array',
        ]);

        if (!empty($validated['subdomain']) && $validated['subdomain'] !== $tenant->subdomain) {
            $exists = Tenant::withoutGlobalScopes()
                ->where('subdomain', $validated['subdomain'])
                ->where('id', '!=', $tenant->id)
                ->exists();
            if ($exists) {
                return response()->json([
                    'success' => false,
                    'code' => 422,
                    'message' => 'Subdomain is already taken',
                ], 422);
            }
        }

        $tenant->update($validated);

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'Tenant updated',
            'data' => $tenant->fresh(),
        ]);
    }

    /**
     * @OA\Get(
     *     path="/tenants/{tenant}/stats",
     *     tags={"Tenants"},
     *     summary="获取租户核心统计数据",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="统计数据包含工单量/用户数/存储用量等")
     * )
     */
    public function stats(Tenant $tenant)
    {
        app()->instance('currentTenantId', $tenant->id);

        try {
            $stats = app('tenant.service')->getTenantStats($tenant);
            return response()->json([
                'success' => true,
                'code' => 200,
                'data' => $stats,
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
     * @OA\Get(
     *     path="/tenants/{tenant}/usage",
     *     tags={"Tenants"},
     *     summary="获取租户配额使用报告",
     *     description="8类资源配额使用情况，80%黄色预警100%红色拦截",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="配额报告")
     * )
     */
    public function usage(Tenant $tenant)
    {
        app()->instance('currentTenantId', $tenant->id);

        $usage = app('tenant.service')->getUsageReport($tenant);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $usage,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/tenants/{tenant}/suspend",
     *     tags={"Tenants"},
     *     summary="暂停租户服务",
     *     description="自动停用所有关联用户账号，API返回403",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="已暂停")
     * )
     */
    public function suspend(Request $request, Tenant $tenant)
    {
        $reason = $request->input('reason', 'Administrative action');

        app('tenant.service')->suspendTenant($tenant, $reason, $request->user()?->id);

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'Tenant suspended',
            'data' => ['status' => 'suspended', 'suspended_at' => now()->toISOString()],
        ]);
    }

    /**
     * @OA\Post(
     *     path="/tenants/{tenant}/activate",
     *     tags={"Tenants"},
     *     summary="重新激活租户",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="已激活")
     * )
     */
    public function activate(Tenant $tenant)
    {
        app('tenant.service')->activateTenant($tenant);

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'Tenant activated',
            'data' => ['status' => 'active', 'activated_at' => now()->toISOString()],
        ]);
    }
}
