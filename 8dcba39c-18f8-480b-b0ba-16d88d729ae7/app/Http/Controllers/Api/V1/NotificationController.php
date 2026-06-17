<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NotificationLog;
use App\Models\NotificationSubscription;
use App\Models\NotificationTemplate;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Notifications",
 *     description="通知系统 - 模板/订阅/发送日志"
 * )
 */
class NotificationController extends Controller
{
    /**
     * @OA\Get(path="/notifications/logs", tags={"Notifications"},
     * summary="通知发送日志", @OA\Response(response=200, description="日志列表"))
     */
    public function logs(Request $request)
    {
        $perPage = $request->input('per_page', 50);

        $query = NotificationLog::query();

        if ($channel = $request->channel) {
            $query->where('channel', $channel);
        }
        if ($status = $request->status) {
            $query->where('status', $status);
        }
        if ($template = $request->template_key) {
            $query->where('template_key', $template);
        }

        $logs = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'pagination' => ['total' => $logs->total()],
        ]);
    }

    /**
     * @OA\Get(path="/notifications/templates", tags={"Notifications"},
     * summary="通知模板列表", @OA\Response(response=200))
     */
    public function templates(Request $request)
    {
        $query = NotificationTemplate::query();

        if ($channel = $request->channel) {
            $query->where('channel', $channel);
        }

        $templates = $query->orderBy('channel')->orderBy('template_key')->get();

        return response()->json(['success' => true, 'data' => $templates]);
    }

    /**
     * @OA\Post(path="/notifications/templates", tags={"Notifications"},
     * summary="创建自定义通知模板",
     */
    public function storeTemplate(Request $request)
    {
        $validated = $request->validate([
            'template_key' => 'required|string|max:100',
            'channel' => 'required|in:email,sms,webhook,in_app',
            'name' => 'required|string|max:100',
            'subject' => 'nullable|string|max:200',
            'body' => 'required|string',
            'is_system' => 'boolean|default:false',
            'is_active' => 'boolean|default:true',
        ]);

        $template = NotificationTemplate::create($validated);

        return response()->json([
            'success' => true, 'code' => 201,
            'message' => 'Template created',
            'data' => $template,
        ], 201);
    }

    /**
     * @OA\Put(path="/notifications/templates/{template}", tags={"Notifications"})
     */
    public function updateTemplate(Request $request, NotificationTemplate $template)
    {
        $validated = $request->validate([
            'name' => 'string|max:100',
            'subject' => 'nullable|string|max:200',
            'body' => 'string',
            'is_active' => 'boolean',
        ]);

        if ($template->is_system) {
            return response()->json([
                'success' => false, 'code' => 422,
                'message' => 'Cannot modify system templates'],
                422);
        }

        $template->update($validated);
        return response()->json([
            'success' => true, 'message' => 'Template updated',
            'data' => $template,
        ]);
    }

    /**
     * @OA\Get(path="/notifications/subscriptions", tags={"Notifications"},
     * summary="当前用户通知订阅配置"),
     */
    public function subscriptions(Request $request)
    {
        $userId = $request->user()?->id;
        $roleIds = $request->user()?->roles->pluck('id') ?? collect();

        $subs = NotificationSubscription::query()
            ->where(function ($q) use ($userId, $roleIds) {
                $q->where('user_id', $userId)
                    ->orWhereIn('role_id', $roleIds);
            })
            ->get();

        return response()->json(['success' => true, 'data' => $subs]);
    }

    /**
     * @OA\Put(path="/notifications/subscriptions", tags={"Notifications"},
     * summary="批量更新订阅",
     */
    public function updateSubscriptions(Request $request)
    {
        $validated = $request->validate([
            'subscriptions' => 'required|array',
            'subscriptions.*.event_key' => 'required|string',
            'subscriptions.*.enabled' => 'required|boolean',
            'subscriptions.*.channels' => 'array',
        ]);

        $userId = $request->user()->id;
        $results = [];

        foreach ($validated['subscriptions'] as $sub) {
            $subscription = NotificationSubscription::updateOrCreate(
                [
                    'user_id' => $userId,
                    'event_key' => $sub['event_key'],
                ],
                [
                    'enabled' => $sub['enabled'],
                    'channels' => $sub['channels'] ?? ['email'],
                ]
            );
            $results[] = $subscription;
        }

        return response()->json([
            'success' => true,
            'message' => 'Subscriptions updated',
            'data' => $results,
        ]);
    }
}
