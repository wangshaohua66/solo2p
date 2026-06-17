<?php

namespace App\Services;

use App\Models\NotificationTemplate;
use App\Models\NotificationSubscription;
use App\Models\NotificationLog;
use App\Models\WebhookEndpoint;
use App\Models\WorkflowApproval;
use App\Models\SLATimer;
use App\Models\SLAViolation;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Mail\Message;

class NotificationService
{
    public function createDefaultTemplates(int $tenantId): void
    {
        $templates = [
            [
                'key' => 'ticket_created',
                'name' => '工单创建通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【新工单】#{ticket_number} {subject}',
                'body' => '您有一张新的工单需要处理：<br/>工单号：#{ticket_number}<br/>主题：{subject}<br/>优先级：{priority_name}<br/>提交人：{requester_name}<br/>链接：{ticket_link}',
            ],
            [
                'key' => 'ticket_created',
                'name' => '工单创建通知',
                'channel' => NotificationTemplate::CHANNEL_SMS,
                'subject' => '',
                'body' => '您有新工单待处理：#{ticket_number} {subject}【{tenant_name}】',
            ],
            [
                'key' => 'ticket_assigned',
                'name' => '工单分配通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【工单分配】#{ticket_number} 已分配给您',
                'body' => '工单 #{ticket_number} 已分配给您处理：<br/>主题：{subject}<br/>优先级：{priority_name}<br/>分配时间：{assigned_at}',
            ],
            [
                'key' => 'ticket_comment',
                'name' => '工单回复通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【工单回复】#{ticket_number} 有新回复',
                'body' => '工单 #{ticket_number} 有新回复：<br/>回复人：{comment_author}<br/>回复内容：{comment_content}<br/>查看详情：{ticket_link}',
            ],
            [
                'key' => 'ticket_status_changed',
                'name' => '工单状态变更通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【状态变更】#{ticket_number} {old_status} → {new_status}',
                'body' => '工单 #{ticket_number} 状态已变更：<br/>原状态：{old_status}<br/>新状态：{new_status}<br/>操作人：{operator_name}',
            ],
            [
                'key' => 'ticket_resolved',
                'name' => '工单解决通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【工单已解决】#{ticket_number} {subject}',
                'body' => '您的工单 #{ticket_number} 已解决：<br/>解决说明：{resolution_note}<br/>请评价本次服务：{satisfaction_link}',
            ],
            [
                'key' => 'ticket_closed',
                'name' => '工单关闭通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【工单已关闭】#{ticket_number} {subject}',
                'body' => '工单 #{ticket_number} 已关闭。<br/>如您还有疑问，可在30天内重新打开。',
            ],
            [
                'key' => 'ticket_reopened',
                'name' => '工单重新打开通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【工单重开】#{ticket_number} 已被重新打开',
                'body' => '工单 #{ticket_number} 已被重新打开，请及时处理。',
            ],
            [
                'key' => 'sla_warning',
                'name' => 'SLA预警通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【SLA预警】#{ticket_number} 即将超时',
                'body' => '警告：工单 #{ticket_number} 即将超过 {sla_type} SLA时限。<br/>剩余时间：{remaining_time}',
            ],
            [
                'key' => 'sla_warning',
                'name' => 'SLA预警短信',
                'channel' => NotificationTemplate::CHANNEL_SMS,
                'subject' => '',
                'body' => 'SLA预警：工单#{ticket_number}{sla_type}即将超时，剩余{remaining_time}分钟',
            ],
            [
                'key' => 'sla_breach',
                'name' => 'SLA超时通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【SLA超时】#{ticket_number} 已违反SLA',
                'body' => '警告：工单 #{ticket_number} 已超过 {sla_type} SLA时限。<br/>超出时长：{overrun_time}',
            ],
            [
                'key' => 'sla_breach',
                'name' => 'SLA超时短信',
                'channel' => NotificationTemplate::CHANNEL_SMS,
                'subject' => '',
                'body' => 'SLA超时：工单#{ticket_number}{sla_type}已超时{overrun_time}，请立即处理！',
            ],
            [
                'key' => 'approval_requested',
                'name' => '审批请求通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【待审批】工单 #{ticket_number} 需要您的审批',
                'body' => '您有一条待审批请求：<br/>工单：#{ticket_number}<br/>申请人：{requested_by}<br/>请尽快处理：{approval_link}',
            ],
            [
                'key' => 'approval_result',
                'name' => '审批结果通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【审批结果】工单 #{ticket_number} 已{approval_result}',
                'body' => '您的审批请求已处理：<br/>工单：#{ticket_number}<br/>结果：{approval_result}<br/>审批人：{approver_name}',
            ],
            [
                'key' => 'escalation',
                'name' => '工单升级通知',
                'channel' => NotificationTemplate::CHANNEL_EMAIL,
                'subject' => '【工单升级】#{ticket_number} 已升级至第{escalation_level}级',
                'body' => '工单 #{ticket_number} 已升级：<br/>升级原因：{escalation_reason}<br/>处理人：{assignee_name}',
            ],
        ];

        foreach ($templates as $tpl) {
            NotificationTemplate::create([
                'tenant_id' => $tenantId,
                'key' => $tpl['key'],
                'name' => $tpl['name'],
                'channel' => $tpl['channel'],
                'subject' => $tpl['subject'],
                'body' => $tpl['body'],
                'is_system' => true,
                'status' => 1,
            ]);
        }

        $defaultSubs = [
            'ticket_created' => ['channels' => ['email', 'in_app'], 'roles' => ['agent', 'admin', 'owner']],
            'ticket_assigned' => ['channels' => ['email', 'in_app', 'sms'], 'roles' => ['agent', 'admin', 'owner']],
            'ticket_comment' => ['channels' => ['email', 'in_app'], 'roles' => ['agent', 'admin', 'owner', 'customer']],
            'ticket_status_changed' => ['channels' => ['email', 'in_app'], 'roles' => ['agent', 'admin', 'owner']],
            'ticket_resolved' => ['channels' => ['email', 'in_app'], 'roles' => ['customer', 'agent']],
            'ticket_closed' => ['channels' => ['email'], 'roles' => ['customer']],
            'sla_warning' => ['channels' => ['email', 'in_app', 'sms'], 'roles' => ['agent', 'supervisor', 'admin']],
            'sla_breach' => ['channels' => ['email', 'in_app', 'sms'], 'roles' => ['agent', 'supervisor', 'admin', 'owner']],
            'approval_requested' => ['channels' => ['email', 'in_app'], 'roles' => ['supervisor', 'admin', 'owner']],
            'approval_result' => ['channels' => ['email', 'in_app'], 'roles' => ['agent', 'admin']],
            'escalation' => ['channels' => ['email', 'in_app', 'sms'], 'roles' => ['supervisor', 'admin', 'owner']],
        ];

        foreach ($defaultSubs as $eventKey => $config) {
            NotificationSubscription::create([
                'tenant_id' => $tenantId,
                'event_key' => $eventKey,
                'channels' => $config['channels'],
                'target_roles' => $config['roles'],
                'is_system' => true,
                'enabled' => true,
            ]);
        }
    }

    public function notify(Ticket $ticket, string $templateKey, array $channels, $recipients = null): void
    {
        $tenantId = $ticket->tenant_id;
        $context = $this->buildTicketContext($ticket);

        $subscriptions = NotificationSubscription::forTenant($tenantId)
            ->where('event_key', $templateKey)
            ->where('enabled', true)
            ->get();

        $resolvedRecipients = $this->resolveRecipients($ticket, $recipients, $subscriptions);

        foreach ($channels as $channel) {
            $template = NotificationTemplate::forTenant($tenantId)
                ->where('key', $templateKey)
                ->where('channel', $this->mapChannelToTemplate($channel))
                ->where('status', 1)
                ->first();

            if (!$template) {
                continue;
            }

            foreach ($resolvedRecipients as $recipient) {
                $this->dispatchNotification(
                    $tenantId,
                    $ticket->id,
                    $template,
                    $context + $this->buildRecipientContext($recipient),
                    $recipient,
                    $channel
                );
            }
        }
    }

    protected function mapChannelToTemplate(string $channel): int
    {
        return match ($channel) {
            'email' => NotificationTemplate::CHANNEL_EMAIL,
            'sms' => NotificationTemplate::CHANNEL_SMS,
            'webhook' => NotificationTemplate::CHANNEL_WEBHOOK,
            'in_app' => NotificationTemplate::CHANNEL_IN_APP,
            default => NotificationTemplate::CHANNEL_EMAIL,
        };
    }

    protected function resolveRecipients(Ticket $ticket, $specified, $subscriptions): array
    {
        $recipients = [];
        $tenantId = $ticket->tenant_id;

        if ($specified) {
            foreach ((array) $specified as $spec) {
                if (is_numeric($spec)) {
                    $user = User::find((int) $spec);
                    if ($user && $user->tenant_id === $tenantId) {
                        $recipients[$user->id] = $user;
                    }
                } elseif (filter_var($spec, FILTER_VALIDATE_EMAIL)) {
                    $user = User::where('tenant_id', $tenantId)->where('email', $spec)->first();
                    if ($user) {
                        $recipients[$user->id] = $user;
                    } else {
                        $recipients["email:{$spec}"] = (object) ['email' => $spec, 'name' => '', 'phone' => null];
                    }
                }
            }
        }

        $rolesToResolve = [];
        foreach ($subscriptions as $sub) {
            foreach (($sub->target_roles ?? []) as $role) {
                $rolesToResolve[$role] = true;
            }
        }

        $roleRecipientMap = [
            'agent' => array_filter([$ticket->assignee_id]),
            'requester' => array_filter([$ticket->requester_id]),
            'customer' => array_filter([$ticket->requester_id]),
            'group_members' => $ticket->group?->members?->pluck('id')->toArray() ?? [],
            'watchers' => $ticket->watchers ?? [],
        ];

        foreach (['admin', 'owner', 'supervisor'] as $role) {
            if (isset($rolesToResolve[$role])) {
                $userIds = User::where('tenant_id', $tenantId)
                    ->whereHas('roles', fn ($q) => $q->where('slug', $role))
                    ->pluck('id')
                    ->toArray();
                $roleRecipientMap[$role] = $userIds;
            }
        }

        foreach ($subscriptions as $sub) {
            foreach (($sub->target_roles ?? []) as $role) {
                if (isset($roleRecipientMap[$role])) {
                    foreach ($roleRecipientMap[$role] as $userId) {
                        $user = User::find($userId);
                        if ($user) {
                            $recipients[$user->id] = $user;
                        }
                    }
                }
            }
        }

        return array_values($recipients);
    }

    protected function buildTicketContext(Ticket $ticket): array
    {
        $tenant = app('currentTenant');
        return [
            'ticket_id' => $ticket->id,
            'ticket_uuid' => $ticket->uuid,
            'ticket_number' => $ticket->ticket_number,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'priority' => $ticket->priority,
            'priority_name' => Ticket::getPriorityName($ticket->priority),
            'status' => $ticket->status,
            'status_name' => Ticket::getStatusName($ticket->status),
            'source' => $ticket->source,
            'source_name' => Ticket::getSourceName($ticket->source),
            'requester_name' => $ticket->requester?->name ?? '未知',
            'requester_email' => $ticket->requester?->email ?? '',
            'assignee_name' => $ticket->assignee?->name ?? '未分配',
            'assignee_email' => $ticket->assignee?->email ?? '',
            'group_name' => $ticket->group?->name ?? '未分组',
            'category_name' => $ticket->category?->name ?? '未分类',
            'tags' => implode(', ', $ticket->tags ?? []),
            'tenant_name' => $tenant?->name ?? '',
            'created_at' => optional($ticket->created_at)->format('Y-m-d H:i:s'),
            'updated_at' => optional($ticket->updated_at)->format('Y-m-d H:i:s'),
            'due_at' => optional($ticket->due_at)->format('Y-m-d H:i:s'),
            'resolved_at' => optional($ticket->resolved_at)->format('Y-m-d H:i:s'),
            'closed_at' => optional($ticket->closed_at)->format('Y-m-d H:i:s'),
            'escalation_count' => $ticket->escalation_count,
            'ticket_link' => $this->buildTicketLink($ticket),
            'satisfaction_link' => $this->buildSatisfactionLink($ticket),
        ];
    }

    protected function buildRecipientContext($recipient): array
    {
        return [
            'recipient_name' => $recipient->name ?? ($recipient->email ?? ''),
            'recipient_email' => $recipient->email ?? '',
            'recipient_phone' => $recipient->phone ?? null,
        ];
    }

    protected function buildTicketLink(Ticket $ticket): string
    {
        $tenant = app('currentTenant');
        $base = config('app.url', 'https://app.ticketsaas.com');
        if ($tenant && $tenant->subdomain) {
            $parsed = parse_url($base);
            $host = $parsed['host'] ?? 'app.ticketsaas.com';
            $scheme = $parsed['scheme'] ?? 'https';
            $base = "{$scheme}://{$tenant->subdomain}.{$host}";
        }
        return "{$base}/tickets/{$ticket->uuid}";
    }

    protected function buildSatisfactionLink(Ticket $ticket): string
    {
        return $this->buildTicketLink($ticket) . '/satisfaction';
    }

    protected function dispatchNotification(int $tenantId, ?int $ticketId, NotificationTemplate $template, array $context, $recipient, string $channel): void
    {
        $rendered = $template->render($context);
        $log = NotificationLog::create([
            'tenant_id' => $tenantId,
            'ticket_id' => $ticketId,
            'template_id' => $template->id,
            'channel' => $this->mapChannelToTemplate($channel),
            'recipient' => $this->getRecipientAddress($recipient, $channel),
            'recipient_user_id' => is_numeric($recipient->id ?? null) ? (int) $recipient->id : null,
            'subject' => $rendered['subject'],
            'body' => $rendered['body'],
            'variables' => $context,
            'status' => NotificationLog::STATUS_PENDING,
            'retry_count' => 0,
            'scheduled_at' => now(),
        ]);

        switch ($channel) {
            case 'email':
                \App\Jobs\SendEmailNotification::dispatch($log->id)->onQueue('email');
                break;
            case 'sms':
                \App\Jobs\SendSmsNotification::dispatch($log->id)->onQueue('sms');
                break;
            case 'webhook':
                \App\Jobs\SendWebhookNotification::dispatch($log->id)->onQueue('webhook');
                break;
            case 'in_app':
                $this->deliverInApp($log, $recipient);
                break;
        }
    }

    protected function getRecipientAddress($recipient, string $channel): string
    {
        return match ($channel) {
            'email' => $recipient->email ?? '',
            'sms' => $recipient->phone ?? '',
            'webhook' => is_string($recipient) ? $recipient : ($recipient->webhook_url ?? ''),
            default => is_numeric($recipient->id ?? null) ? (string) $recipient->id : '',
        };
    }

    protected function deliverInApp(NotificationLog $log, $recipient): void
    {
        $userId = $recipient->id ?? null;
        if (!$userId) {
            $log->update(['status' => NotificationLog::STATUS_FAILED, 'error_message' => '无有效用户ID']);
            return;
        }
        try {
            DB::table('in_app_notifications')->insertOrIgnore([
                'tenant_id' => $log->tenant_id,
                'user_id' => (int) $userId,
                'title' => $log->subject,
                'body' => strip_tags($log->body),
                'ticket_id' => $log->ticket_id,
                'notification_log_id' => $log->id,
                'read_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $log->update([
                'status' => NotificationLog::STATUS_DELIVERED,
                'sent_at' => now(),
            ]);
        } catch (\Exception $e) {
            $log->update(['status' => NotificationLog::STATUS_FAILED, 'error_message' => $e->getMessage()]);
        }
    }

    public function notifyTicketCreated(Ticket $ticket): void
    {
        $this->notify($ticket, 'ticket_created', ['email', 'in_app']);
    }

    public function notifyTicketAssigned(Ticket $ticket): void
    {
        $this->notify($ticket, 'ticket_assigned', ['email', 'in_app', 'sms'], array_filter([$ticket->assignee_id]));
    }

    public function notifyTicketComment(Ticket $ticket, $comment): void
    {
        $context = [
            'comment_author' => $comment->author?->name ?? '系统',
            'comment_content' => mb_substr(strip_tags($comment->content ?? ''), 0, 200),
            'comment_time' => optional($comment->created_at)->format('Y-m-d H:i:s'),
        ];
        $this->notify($ticket, 'ticket_comment', ['email', 'in_app']);
    }

    public function notifyTicketStatusChanged(Ticket $ticket, int $oldStatus, int $newStatus, ?User $operator = null): void
    {
        if ($newStatus === Ticket::STATUS_RESOLVED) {
            $this->notify($ticket, 'ticket_resolved', ['email', 'in_app'], array_filter([$ticket->requester_id]));
            return;
        }
        if ($newStatus === Ticket::STATUS_CLOSED) {
            $this->notify($ticket, 'ticket_closed', ['email'], array_filter([$ticket->requester_id]));
            return;
        }
        if ($oldStatus === Ticket::STATUS_RESOLVED || $oldStatus === Ticket::STATUS_CLOSED) {
            $this->notify($ticket, 'ticket_reopened', ['email', 'in_app']);
            return;
        }
        $context = [
            'old_status' => Ticket::getStatusName($oldStatus),
            'new_status' => Ticket::getStatusName($newStatus),
            'operator_name' => $operator?->name ?? '系统',
        ];
        $this->notify($ticket, 'ticket_status_changed', ['email', 'in_app']);
    }

    public function notifySLAWarning(SLATimer $timer): void
    {
        $ticket = $timer->ticket;
        $remaining = $timer->target_at?->diffInMinutes(now()) ?? 0;
        $slaType = $timer->timer_type === SLATimer::TYPE_FIRST_RESPONSE ? '首次响应' : '解决';
        $context = [
            'sla_type' => $slaType,
            'remaining_time' => max(0, $remaining) . '分钟',
            'remaining_minutes' => max(0, $remaining),
            'policy_name' => $timer->policy?->name ?? '',
        ];
        $this->notify($ticket, 'sla_warning', ['email', 'in_app', 'sms']);
    }

    public function notifySLABreach(SLATimer $timer, int $level): void
    {
        $ticket = $timer->ticket;
        $overrun = max(0, now()->diffInMinutes($timer->target_at));
        $slaType = $timer->timer_type === SLATimer::TYPE_FIRST_RESPONSE ? '首次响应' : '解决';
        $levelName = match ($level) {
            SLAViolation::LEVEL_MILD => '轻微',
            SLAViolation::LEVEL_SEVERE => '严重',
            SLAViolation::LEVEL_CRITICAL => '危急',
            default => '轻微',
        };
        $context = [
            'sla_type' => $slaType,
            'overrun_time' => $overrun . '分钟',
            'overrun_minutes' => $overrun,
            'level' => $levelName,
            'policy_name' => $timer->policy?->name ?? '',
        ];
        $this->notify($ticket, 'sla_breach', ['email', 'in_app', 'sms']);
    }

    public function notifySLAPaused(SLATimer $timer): void
    {
        Log::info('SLA paused', ['timer_id' => $timer->id]);
    }

    public function notifySLAResumed(SLATimer $timer): void
    {
        Log::info('SLA resumed', ['timer_id' => $timer->id]);
    }

    public function notifyApprovalRequested(WorkflowApproval $approval): void
    {
        $ticket = $approval->ticket;
        $approvers = $this->resolveApprovalRecipients($approval);
        $context = [
            'requested_by' => $approval->requester?->name ?? '系统',
            'approval_link' => $this->buildTicketLink($ticket) . '/approvals/' . $approval->id,
        ];
        $this->notify($ticket, 'approval_requested', ['email', 'in_app'], $approvers);
    }

    public function notifyApprovalResult(WorkflowApproval $approval, bool $approved, string $reason = ''): void
    {
        $ticket = $approval->ticket;
        $recipients = array_filter([$approval->requested_by]);
        $context = [
            'approval_result' => $approved ? '通过' : '驳回',
            'approver_name' => $approval->approver?->name ?? '系统',
            'rejection_reason' => $reason,
        ];
        $this->notify($ticket, 'approval_result', ['email', 'in_app'], $recipients);
    }

    public function notifyEscalation(Ticket $ticket, SLATimer $timer, array $escalation, array $recipients): void
    {
        $context = [
            'escalation_level' => $escalation['level'] ?? 1,
            'escalation_reason' => $escalation['message'] ?? 'SLA超时升级',
            'assignee_name' => $ticket->assignee?->name ?? '未分配',
        ];
        $this->notify($ticket, 'escalation', ['email', 'in_app', 'sms'], $recipients);
    }

    protected function resolveApprovalRecipients(WorkflowApproval $approval): array
    {
        $recipients = [];
        $config = $approval->transition?->approval_config ?? [];

        if (!empty($config['approver_roles'])) {
            $users = User::where('tenant_id', $approval->tenant_id)
                ->whereHas('roles', fn ($q) => $q->whereIn('slug', (array) $config['approver_roles']))
                ->pluck('id')
                ->toArray();
            $recipients = array_merge($recipients, $users);
        }
        if (!empty($config['approver_user_ids'])) {
            $recipients = array_merge($recipients, (array) $config['approver_user_ids']);
        }
        if (!empty($config['approver_group_ids'])) {
            $groupMembers = User::where('tenant_id', $approval->tenant_id)
                ->whereHas('groups', fn ($q) => $q->whereIn('id', (array) $config['approver_group_ids']))
                ->pluck('id')
                ->toArray();
            $recipients = array_merge($recipients, $groupMembers);
        }
        if (empty($recipients)) {
            $admins = User::where('tenant_id', $approval->tenant_id)
                ->whereIn('type', [User::TYPE_OWNER, User::TYPE_AGENT])
                ->limit(5)
                ->pluck('id')
                ->toArray();
            $recipients = $admins;
        }
        return array_values(array_unique(array_filter($recipients)));
    }

    public function sendWorkflowNotifications(Ticket $ticket, \App\Models\WorkflowTransition $transition): void
    {
        $notifications = $transition->notifications ?? [];
        foreach ($notifications as $notif) {
            $channels = (array) ($notif['channels'] ?? ['email']);
            $recipients = $notif['recipients'] ?? null;
            $templateKey = $notif['template_key'] ?? 'ticket_status_changed';
            $this->notify($ticket, $templateKey, $channels, $recipients);
        }
    }

    public function dispatchWebhook(int $tenantId, string $event, array $payload): void
    {
        $endpoints = WebhookEndpoint::forTenant($tenantId)
            ->where('status', 1)
            ->whereRaw("JSON_CONTAINS(listens_to, ?)", [json_encode($event)])
            ->orWhere(function ($q) use ($tenantId) {
                $q->forTenant($tenantId)
                    ->where('status', 1)
                    ->whereRaw("JSON_CONTAINS(listens_to, ?)", [json_encode('*')]);
            })
            ->get();

        foreach ($endpoints as $endpoint) {
            \App\Jobs\DeliverWebhook::dispatch($endpoint->id, $event, $payload)->onQueue('webhook');
        }
    }

    public function deliverWebhook(WebhookEndpoint $endpoint, string $event, array $payload): array
    {
        $url = $endpoint->url;
        $headers = ['Content-Type: application/json'];
        $body = json_encode([
            'event' => $event,
            'timestamp' => now()->toIso8601String(),
            'tenant_id' => $endpoint->tenant_id,
            'endpoint_id' => $endpoint->id,
            'data' => $payload,
        ], JSON_UNESCAPED_UNICODE);

        switch ($endpoint->auth_type) {
            case WebhookEndpoint::AUTH_API_KEY:
                $headers[] = "X-API-Key: {$endpoint->auth_credentials['api_key']}";
                break;
            case WebhookEndpoint::AUTH_BEARER:
                $headers[] = "Authorization: Bearer {$endpoint->auth_credentials['token']}";
                break;
            case WebhookEndpoint::AUTH_BASIC:
                $creds = base64_encode("{$endpoint->auth_credentials['username']}:{$endpoint->auth_credentials['password']}");
                $headers[] = "Authorization: Basic {$creds}";
                break;
        }

        if ($endpoint->signing_secret) {
            $signature = hash_hmac('sha256', $body, $endpoint->signing_secret);
            $headers[] = "X-Webhook-Signature: sha256={$signature}";
            $headers[] = "X-Webhook-Timestamp: " . time();
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => $endpoint->verify_ssl ?? true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $success = $httpCode >= 200 && $httpCode < 300;

        DB::table('webhook_logs')->insert([
            'tenant_id' => $endpoint->tenant_id,
            'endpoint_id' => $endpoint->id,
            'event' => $event,
            'url' => $url,
            'request_headers' => $headers,
            'request_body' => $body,
            'response_status' => $httpCode,
            'response_body' => is_string($response) ? substr($response, 0, 10000) : null,
            'response_time_ms' => (int) (curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000) ?? 0,
            'success' => $success,
            'error_message' => $error ?: null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($success) {
            $endpoint->recordSuccess();
        } else {
            $endpoint->recordFailure($error ?: "HTTP {$httpCode}");
        }

        return [
            'success' => $success,
            'http_code' => $httpCode,
            'response' => $response,
            'error' => $error,
        ];
    }

    public function retryNotification(int $logId): ?NotificationLog
    {
        $log = NotificationLog::find($logId);
        if (!$log) {
            return null;
        }
        if ($log->retry_count >= 5) {
            return $log;
        }

        $channelMap = [
            NotificationTemplate::CHANNEL_EMAIL => 'email',
            NotificationTemplate::CHANNEL_SMS => 'sms',
            NotificationTemplate::CHANNEL_WEBHOOK => 'webhook',
        ];
        $channel = $channelMap[$log->channel] ?? 'email';

        $log->update([
            'status' => NotificationLog::STATUS_PENDING,
            'retry_count' => $log->retry_count + 1,
            'scheduled_at' => now()->addMinutes(pow(2, $log->retry_count)),
            'error_message' => null,
        ]);

        switch ($channel) {
            case 'email':
                \App\Jobs\SendEmailNotification::dispatch($log->id)->onQueue('email')->delay($log->scheduled_at);
                break;
            case 'sms':
                \App\Jobs\SendSmsNotification::dispatch($log->id)->onQueue('sms')->delay($log->scheduled_at);
                break;
            case 'webhook':
                \App\Jobs\SendWebhookNotification::dispatch($log->id)->onQueue('webhook')->delay($log->scheduled_at);
                break;
        }

        return $log;
    }
}
