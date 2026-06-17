<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WebhookEndpoint;
use App\Jobs\DeliverWebhook;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * @OA\Tag(
 *     name="Webhooks",
 *     description="Webhook端点管理与测试推送"
 * )
 */
class WebhookController extends Controller
{
    /**
     * @OA\Get(path="/webhooks/endpoints", tags={"Webhooks"}, summary="Webhook端点列表", @OA\Response(response=200))
     */
    public function index()
    {
        $endpoints = WebhookEndpoint::all();
        return response()->json(['success' => true, 'data' => $endpoints]);
    }

    /**
     * @OA\Post(path="/webhooks/endpoints", tags={"Webhooks"},
     * summary="创建Webhook端点",
     * description="4种认证方式: none/api_key/bearer/basic，自动生成signing_secret用于HMAC签名",
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'url' => 'required|url',
            'events' => 'required|array|min:1',
            'events.*' => 'string',
            'auth_type' => 'in:none,api_key,bearer,basic',
            'auth_credentials' => 'nullable|array',
            'is_active' => 'boolean',
            'description' => 'nullable|string|max:500',
        ]);

        $endpoint = WebhookEndpoint::create([
            ...$validated,
            'signing_secret' => 'whsec_' . bin2hex(random_bytes(32)),
        ]);

        return response()->json([
            'success' => true, 'code' => 201,
            'message' => 'Webhook endpoint created',
            'data' => $endpoint,
        ], 201);
    }

    /**
     * @OA\Get(path="/webhooks/endpoints/{endpoint}", tags={"Webhooks"}))
     */
    public function show(WebhookEndpoint $endpoint)
    {
        return response()->json(['success' => true, 'data' => $endpoint]);
    }

    /**
     * @OA\Put(path="/webhooks/endpoints/{endpoint}", tags={"Webhooks"})
     */
    public function update(Request $request, WebhookEndpoint $endpoint)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'url' => 'url',
            'events' => 'array|min:1',
            'auth_type' => 'in:none,api_key,bearer,basic',
            'auth_credentials' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $endpoint->update($validated);
        return response()->json([
            'success' => true,
            'message' => 'Webhook updated',
            'data' => $endpoint->fresh()]);
    }

    /**
     * @OA\Delete(path="/webhooks/endpoints/{endpoint}", tags={"Webhooks"}))
     */
    public function destroy(WebhookEndpoint $endpoint)
    {
        $endpoint->delete();
        return response()->json(['success' => true, 'message' => 'Webhook endpoint deleted']);
    }

    /**
     * @OA\Post(path="/webhooks/endpoints/{endpoint}/test", tags={"Webhooks"},
     * summary="发送测试推送事件",
     * @OA\Response(response=200, description="测试任务已投递队列")
     */
    public function test(Request $request, WebhookEndpoint $endpoint)
    {
        $eventType = $request->input('event', 'test.event');
        $payload = [
            'event' => $eventType,
            'test' => true,
            'timestamp' => now()->toIso8601String(),
            'endpoint_id' => $endpoint->id,
            'tenant_id' => app('currentTenantId'),
            'data' => [
                'message' => 'This is a test webhook event'],
        ];

        $eventId = 'test_' . Str::uuid();
        $tenantId = app('currentTenantId');

        DeliverWebhook::dispatch(
            $tenantId,
            $endpoint->id,
            $eventType,
            $payload,
            $eventId,
        )->onQueue('webhook');

        return response()->json([
            'success' => true,
            'message' => 'Test webhook dispatched.',
        ]);
    }
}
