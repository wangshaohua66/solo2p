<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketComment;
use App\Models\TicketHistory;
use App\Models\TicketAttachment;
use App\Models\User;
use App\Models\TenantQuota;
use App\Services\WorkflowEngine;
use App\Services\SlaMonitor;
use App\Services\NotificationService;
use App\Services\AutomationEngine;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\AllowedInclude;

class TicketController extends Controller
{
    protected $workflowEngine;
    protected $slaMonitor;
    protected $notificationService;
    protected $automationEngine;
    protected $reportService;

    public function __construct(
        WorkflowEngine $workflowEngine,
        SlaMonitor $slaMonitor,
        NotificationService $notificationService,
        AutomationEngine $automationEngine,
        ReportService $reportService
    ) {
        $this->workflowEngine = $workflowEngine;
        $this->slaMonitor = $slaMonitor;
        $this->notificationService = $notificationService;
        $this->automationEngine = $automationEngine;
        $this->reportService = $reportService;
    }

    public function index(Request $request)
    {
        $tenantId = app('currentTenantId');
        $perPage = (int) $request->input('per_page', 50);
        $page = (int) $request->input('page', 1);
        $cacheKey = "tickets:list:{$tenantId}:{$page}:{$perPage}:" . md5(json_encode($request->all()));

        $cached = Cache::get($cacheKey);
        if ($cached) {
            return response()->json([
                'success' => true,
                'code' => 200,
                'data' => $cached,
                'cached' => true,
            ]);
        }

        $query = QueryBuilder::for(Ticket::class)
            ->allowedFilters([
                AllowedFilter::exact('id'),
                AllowedFilter::exact('uuid'),
                AllowedFilter::exact('ticket_number'),
                AllowedFilter::partial('subject'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('priority'),
                AllowedFilter::exact('source'),
                AllowedFilter::exact('category_id'),
                AllowedFilter::exact('group_id'),
                AllowedFilter::exact('assignee_id'),
                AllowedFilter::exact('requester_id'),
                AllowedFilter::scope('open'),
                AllowedFilter::scope('overdue'),
                AllowedFilter::scope('byPriority'),
                AllowedFilter::scope('createdBetween', 'created_between'),
                AllowedFilter::scope('resolvedBetween', 'resolved_between'),
                AllowedFilter::callback('tags', function ($query, $value) {
                    $query->whereJsonContains('tags', $value);
                }),
            ])
            ->allowedSorts([
                AllowedSort::field('created_at'),
                AllowedSort::field('updated_at'),
                AllowedSort::field('priority'),
                AllowedSort::field('status'),
                AllowedSort::field('due_at'),
                AllowedSort::field('ticket_number'),
            ])
            ->allowedIncludes([
                AllowedInclude::relationship('requester:id,name,email'),
                AllowedInclude::relationship('assignee:id,name,email,avatar'),
                AllowedInclude::relationship('group:id,name'),
                AllowedInclude::relationship('category:id,name'),
                AllowedInclude::relationship('workflowState:id,name,color,category'),
                AllowedInclude::relationship('slaTimers'),
            ])
            ->defaultSort('-created_at');

        $tickets = $query->paginate($perPage)->appends($request->query());

        $transformed = $tickets->getCollection()->map(fn ($t) => $this->transformTicket($t, false));
        $result = [
            'items' => $transformed,
            'pagination' => [
                'total' => $tickets->total(),
                'per_page' => $tickets->perPage(),
                'current_page' => $tickets->currentPage(),
                'last_page' => $tickets->lastPage(),
                'from' => $tickets->firstItem(),
                'to' => $tickets->lastItem(),
            ],
            'meta' => [
                'open_count' => Cache::remember("tickets:open_count:{$tenantId}", 60, fn () => Ticket::forTenant($tenantId)->open()->count()),
                'overdue_count' => Cache::remember("tickets:overdue_count:{$tenantId}", 60, fn () => Ticket::forTenant($tenantId)->overdue()->count()),
            ],
        ];

        Cache::put($cacheKey, $result, 60);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $result,
            'cached' => false,
        ]);
    }

    public function store(Request $request)
    {
        $tenantId = app('currentTenantId');
        $user = auth()->user();
        $userId = $user?->id;

        $validated = $request->validate([
            'subject' => 'required|string|max:500',
            'description' => 'required|string',
            'priority' => 'sometimes|integer|between:1,5',
            'source' => 'sometimes|integer',
            'category_id' => 'sometimes|nullable|exists:ticket_categories,id',
            'group_id' => 'sometimes|nullable|exists:ticket_groups,id',
            'assignee_id' => 'sometimes|nullable|exists:users,id',
            'requester_id' => 'sometimes|nullable|exists:users,id',
            'requester_name' => 'sometimes|nullable|string|max:100',
            'requester_email' => 'sometimes|nullable|email|max:150',
            'requester_phone' => 'sometimes|nullable|string|max:20',
            'tags' => 'sometimes|array',
            'custom_fields' => 'sometimes|array',
            'attachments' => 'sometimes|array',
            'attachments.*.file_name' => 'required_with:attachments|string',
            'attachments.*.file_path' => 'required_with:attachments|string',
            'attachments.*.file_size' => 'required_with:attachments|integer',
            'attachments.*.mime_type' => 'sometimes|string',
        ]);

        if (!TenantQuota::checkAndRecord($tenantId, TenantQuota::RESOURCE_TICKETS, 1)) {
            return response()->json([
                'success' => false,
                'code' => 429,
                'message' => '工单存储配额已用尽，请升级套餐',
            ], 429);
        }

        return DB::transaction(function () use ($validated, $tenantId, $userId, $request) {
            $tenant = app('currentTenant');
            $settings = $tenant?->settings ?? [];
            $autoAssign = $settings['ticket']['auto_assign'] ?? true;

            $requesterId = $validated['requester_id'] ?? ($userId && $user->isCustomer() ? $userId : null);

            if (!$requesterId && !empty($validated['requester_email'])) {
                $existing = User::where('tenant_id', $tenantId)
                    ->where('email', $validated['requester_email'])
                    ->first();
                if ($existing) {
                    $requesterId = $existing->id;
                    if (!empty($validated['requester_name']) && empty($existing->name)) {
                        $existing->update(['name' => $validated['requester_name']]);
                    }
                } else {
                    $customer = User::create([
                        'tenant_id' => $tenantId,
                        'uuid' => (string) Str::uuid(),
                        'name' => $validated['requester_name'] ?? explode('@', $validated['requester_email'])[0],
                        'email' => $validated['requester_email'],
                        'phone' => $validated['requester_phone'] ?? null,
                        'type' => User::TYPE_CUSTOMER,
                        'status' => User::STATUS_ACTIVE,
                    ]);
                    $requesterId = $customer->id;
                }
            }

            $ticket = Ticket::create([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'subject' => $validated['subject'],
                'description' => $validated['description'],
                'priority' => $validated['priority'] ?? ($settings['ticket']['default_priority'] ?? Ticket::PRIORITY_MEDIUM),
                'source' => $validated['source'] ?? Ticket::SOURCE_WEB,
                'category_id' => $validated['category_id'] ?? null,
                'group_id' => $validated['group_id'] ?? null,
                'assignee_id' => $validated['assignee_id'] ?? null,
                'requester_id' => $requesterId,
                'tags' => $validated['tags'] ?? [],
                'custom_fields' => $validated['custom_fields'] ?? [],
                'watchers' => [],
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $this->workflowEngine->initializeTicket($ticket);
            $this->slaMonitor->startTimersForTicket($ticket);

            if (empty($ticket->assignee_id) && empty($ticket->group_id) && $autoAssign) {
                $this->workflowEngine->applyAutoAssignment($ticket);
                $ticket = $ticket->fresh();
            }

            if (!empty($validated['attachments'])) {
                foreach ($validated['attachments'] as $idx => $att) {
                    TicketAttachment::create([
                        'tenant_id' => $tenantId,
                        'ticket_id' => $ticket->id,
                        'uploaded_by' => $userId,
                        'file_name' => $att['file_name'],
                        'file_path' => $att['file_path'],
                        'file_size' => $att['file_size'],
                        'mime_type' => $att['mime_type'] ?? null,
                        'sort_order' => $idx,
                    ]);
                }
            }

            $ticket->addHistory(
                TicketHistory::ACTION_CREATE,
                null,
                null,
                ['user_id' => $userId, 'source' => $validated['source'] ?? Ticket::SOURCE_WEB]
            );

            Cache::forget("tickets:list:{$tenantId}*");
            Cache::forget("tickets:open_count:{$tenantId}");
            Cache::forget("tickets:overdue_count:{$tenantId}");
            Cache::forget("report:overview:{$tenantId}*");

            \App\Jobs\PostProcessCreatedTicket::dispatch($ticket->id)->onQueue('high');

            $this->notificationService->notifyTicketCreated($ticket);
            if ($ticket->assignee_id) {
                $this->notificationService->notifyTicketAssigned($ticket);
            }
            $this->notificationService->dispatchWebhook($tenantId, 'ticket.created', ['ticket' => $ticket->toArray()]);
            $this->automationEngine->triggerEvent('ticket.created', $ticket);

            return response()->json([
                'success' => true,
                'code' => 201,
                'message' => '工单创建成功',
                'data' => $this->transformTicket($ticket, true),
            ], 201);
        });
    }

    public function show(Request $request, string $uuid)
    {
        $tenantId = app('currentTenantId');
        $with = array_filter(explode(',', $request->input('include', 'requester,assignee,group,category,comments,histories,attachments,slaTimers,workflowState,approvals')));
        $cacheKey = "ticket:detail:{$tenantId}:{$uuid}:" . md5(implode(',', $with));

        $cached = Cache::get($cacheKey);
        if ($cached) {
            return response()->json([
                'success' => true,
                'code' => 200,
                'data' => $cached,
                'cached' => true,
            ]);
        }

        $query = Ticket::where('uuid', $uuid);
        foreach ($with as $rel) {
            if (method_exists(Ticket::class, lcfirst($rel))) {
                $query->with(lcfirst($rel));
            }
        }
        $ticket = $query->firstOrFail();

        $data = $this->transformTicket($ticket, true);
        if (in_array('comments', $with)) {
            $data['comments'] = $ticket->comments->map(fn ($c) => [
                'id' => $c->id,
                'uuid' => $c->uuid,
                'type' => $c->type,
                'content' => $c->content,
                'author' => $c->author ? [
                    'id' => $c->author->id,
                    'name' => $c->author->name,
                    'avatar' => $c->author->avatar,
                    'type' => $c->author->type,
                ] : null,
                'attachments' => $c->attachments?->map(fn ($a) => [
                    'id' => $a->id,
                    'file_name' => $a->file_name,
                    'file_size' => $a->file_size,
                    'url' => Storage::url($a->file_path),
                ]) ?? [],
                'is_private' => (bool) $c->is_private,
                'created_at' => $c->created_at->toIso8601String(),
            ])->values();
        }
        if (in_array('histories', $with)) {
            $data['histories'] = $ticket->histories->map(fn ($h) => [
                'id' => $h->id,
                'action' => $h->action,
                'action_name' => TicketHistory::getActionName($h->action),
                'old_value' => $h->old_value,
                'new_value' => $h->new_value,
                'user' => $h->user ? [
                    'id' => $h->user->id,
                    'name' => $h->user->name,
                ] : null,
                'metadata' => $h->metadata,
                'created_at' => $h->created_at->toIso8601String(),
            ])->values();
        }
        if (in_array('attachments', $with)) {
            $data['attachments'] = $ticket->attachments->map(fn ($a) => [
                'id' => $a->id,
                'file_name' => $a->file_name,
                'file_size' => $a->file_size,
                'mime_type' => $a->mime_type,
                'url' => Storage::url($a->file_path),
                'uploaded_by' => $a->uploader?->name,
                'created_at' => $a->created_at->toIso8601String(),
            ])->values();
        }
        if (in_array('approvals', $with)) {
            $data['approvals'] = $ticket->approvals?->map(fn ($a) => [
                'id' => $a->id,
                'status' => $a->status,
                'status_name' => \App\Models\WorkflowApproval::getStatusName($a->status),
                'transition' => $a->transition ? [
                    'id' => $a->transition->id,
                    'name' => $a->transition->name,
                    'to_state' => $a->transition->toState ? [
                        'id' => $a->transition->toState->id,
                        'name' => $a->transition->toState->name,
                    ] : null,
                ] : null,
                'requester' => $a->requester ? ['id' => $a->requester->id, 'name' => $a->requester->name] : null,
                'approver' => $a->approver ? ['id' => $a->approver->id, 'name' => $a->approver->name] : null,
                'expires_at' => optional($a->expires_at)->toIso8601String(),
                'rejection_reason' => $a->rejection_reason,
                'created_at' => $a->created_at->toIso8601String(),
            ])->values() ?? [];
        }
        if (in_array('sla_timers', $with) || in_array('slaTimers', $with)) {
            $data['sla'] = [
                'policy_name' => $ticket->slaPolicy?->name,
                'timers' => $ticket->slaTimers->map(fn ($t) => [
                    'id' => $t->id,
                    'type' => $t->timer_type,
                    'type_name' => $t->timer_type === 1 ? '首次响应' : '解决',
                    'status' => $t->status,
                    'status_name' => \App\Models\SLATimer::getStatusName($t->status),
                    'started_at' => $t->started_at->toIso8601String(),
                    'target_at' => optional($t->target_at)->toIso8601String(),
                    'warning_at' => optional($t->warning_at)->toIso8601String(),
                    'remaining_minutes' => $t->target_at ? max(0, $t->target_at->diffInMinutes(now(), false)) : null,
                    'actual_minutes' => $t->actual_minutes,
                    'target_minutes' => $t->target_minutes,
                    'paused_seconds' => $t->paused_total_seconds ?? 0,
                ])->values(),
            ];
        }
        if (in_array('workflow_state', $with) || in_array('workflowState', $with)) {
            $data['workflow'] = [
                'workflow_id' => $ticket->workflow_id,
                'current_state' => $ticket->workflowState ? [
                    'id' => $ticket->workflowState->id,
                    'key' => $ticket->workflowState->key,
                    'name' => $ticket->workflowState->name,
                    'color' => $ticket->workflowState->color,
                    'category' => $ticket->workflowState->category,
                ] : null,
                'available_transitions' => $this->workflowEngine->getAvailableTransitions($ticket)->map(fn ($t) => [
                    'id' => $t->id,
                    'to_state_id' => $t->to_state_id,
                    'name' => $t->name,
                    'to_state' => $t->toState ? [
                        'id' => $t->toState->id,
                        'key' => $t->toState->key,
                        'name' => $t->toState->name,
                        'color' => $t->toState->color,
                    ] : null,
                    'requires_approval' => (bool) $t->requires_approval,
                ])->values(),
            ];
        }

        Cache::put($cacheKey, $data, 300);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
            'cached' => false,
        ]);
    }

    public function update(Request $request, string $uuid)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $user = auth()->user();
        $userId = $user?->id;

        $validated = $request->validate([
            'subject' => 'sometimes|string|max:500',
            'description' => 'sometimes|string',
            'priority' => 'sometimes|integer|between:1,5',
            'category_id' => 'sometimes|nullable|exists:ticket_categories,id',
            'group_id' => 'sometimes|nullable|exists:ticket_groups,id',
            'assignee_id' => 'sometimes|nullable|exists:users,id',
            'due_at' => 'sometimes|nullable|date',
            'tags' => 'sometimes|array',
            'custom_fields' => 'sometimes|array',
            'watchers' => 'sometimes|array',
        ]);

        return DB::transaction(function () use ($ticket, $validated, $userId, $request, $uuid) {
            $changes = [];
            $oldPriority = $ticket->priority;
            $oldAssignee = $ticket->assignee_id;
            $oldGroup = $ticket->group_id;

            $ticket->fill($validated);
            $ticket->updated_by = $userId;
            $ticket->save();

            if ($ticket->wasChanged('subject')) {
                $changes[] = ['field' => 'subject', 'old' => $ticket->getOriginal('subject'), 'new' => $ticket->subject];
                $ticket->addHistory(TicketHistory::ACTION_EDIT, $ticket->getOriginal('subject'), $ticket->subject, ['field' => 'subject', 'user_id' => $userId]);
            }
            if ($ticket->wasChanged('description')) {
                $ticket->addHistory(TicketHistory::ACTION_EDIT, null, null, ['field' => 'description', 'user_id' => $userId]);
            }
            if ($ticket->wasChanged('priority')) {
                $changes[] = ['field' => 'priority', 'old' => $oldPriority, 'new' => $ticket->priority];
                $ticket->addHistory(TicketHistory::ACTION_PRIORITY_CHANGE, $oldPriority, $ticket->priority, ['user_id' => $userId]);
                $this->slaMonitor->applyPolicy($ticket, $ticket->sla_policy_id);
            }
            if ($ticket->wasChanged('category_id')) {
                $changes[] = ['field' => 'category_id', 'old' => $ticket->getOriginal('category_id'), 'new' => $ticket->category_id];
                $ticket->addHistory(TicketHistory::ACTION_CATEGORY_CHANGE, $ticket->getOriginal('category_id'), $ticket->category_id, ['user_id' => $userId]);
            }
            if ($ticket->wasChanged('assignee_id') || $ticket->wasChanged('group_id')) {
                $changes[] = ['field' => 'assignment', 'old_assignee' => $oldAssignee, 'new_assignee' => $ticket->assignee_id, 'old_group' => $oldGroup, 'new_group' => $ticket->group_id];
                $ticket->addHistory(
                    TicketHistory::ACTION_ASSIGN,
                    json_encode(['user' => $oldAssignee, 'group' => $oldGroup]),
                    json_encode(['user' => $ticket->assignee_id, 'group' => $ticket->group_id]),
                    ['user_id' => $userId]
                );
                if ($ticket->assignee_id !== null && $ticket->assignee_id !== $oldAssignee) {
                    $this->notificationService->notifyTicketAssigned($ticket);
                }
            }
            if ($ticket->wasChanged('due_at')) {
                $ticket->addHistory(TicketHistory::ACTION_DUE_DATE_CHANGE, $ticket->getOriginal('due_at'), $ticket->due_at, ['user_id' => $userId]);
            }

            $tenantId = app('currentTenantId');
            Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");
            Cache::forget("tickets:list:{$tenantId}*");
            Cache::forget("report:overview:{$tenantId}*");

            if (!empty($changes)) {
                $this->automationEngine->triggerEvent('ticket.updated', $ticket, ['changes' => $changes]);
                $this->notificationService->dispatchWebhook($tenantId, 'ticket.updated', [
                    'ticket' => $ticket->toArray(),
                    'changes' => $changes,
                ]);
            }

            return response()->json([
                'success' => true,
                'code' => 200,
                'message' => '工单更新成功',
                'data' => $this->transformTicket($ticket, false),
                'changes' => $changes,
            ]);
        });
    }

    public function destroy(string $uuid)
    {
        $tenantId = app('currentTenantId');
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $ticket->delete();

        Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");
        Cache::forget("tickets:list:{$tenantId}*");

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => '工单已删除',
        ]);
    }

    public function assign(Request $request, string $uuid)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $user = auth()->user();
        $userId = $user?->id;

        $validated = $request->validate([
            'user_id' => 'sometimes|nullable|exists:users,id',
            'group_id' => 'sometimes|nullable|exists:ticket_groups,id',
            'reason' => 'sometimes|nullable|string|max:500',
        ]);

        if (empty($validated['user_id']) && empty($validated['group_id'])) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => '必须指定分配给的用户或组',
            ], 422);
        }

        return DB::transaction(function () use ($ticket, $validated, $userId, $uuid) {
            $oldAssignee = $ticket->assignee_id;
            $oldGroup = $ticket->group_id;

            $ticket->assignTo(
                $validated['user_id'] ?? null,
                $validated['group_id'] ?? null
            );

            $ticket->addHistory(
                TicketHistory::ACTION_ASSIGN,
                json_encode(['user' => $oldAssignee, 'group' => $oldGroup]),
                json_encode(['user' => $ticket->assignee_id, 'group' => $ticket->group_id]),
                ['user_id' => $userId, 'reason' => $validated['reason'] ?? null]
            );

            $tenantId = app('currentTenantId');
            Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");
            Cache::forget("tickets:list:{$tenantId}*");

            if ($ticket->assignee_id) {
                $this->notificationService->notifyTicketAssigned($ticket);
            }
            $this->automationEngine->triggerEvent('ticket.assigned', $ticket, [
                'from_user' => $oldAssignee,
                'from_group' => $oldGroup,
                'to_user' => $ticket->assignee_id,
                'to_group' => $ticket->group_id,
            ]);
            $this->notificationService->dispatchWebhook($tenantId, 'ticket.assigned', [
                'ticket' => $ticket->toArray(),
                'assignment' => [
                    'from' => ['user_id' => $oldAssignee, 'group_id' => $oldGroup],
                    'to' => ['user_id' => $ticket->assignee_id, 'group_id' => $ticket->group_id],
                ],
            ]);

            return response()->json([
                'success' => true,
                'code' => 200,
                'message' => '工单分配成功',
                'data' => $this->transformTicket($ticket, false),
            ]);
        });
    }

    public function autoAssign(string $uuid)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $applied = $this->workflowEngine->applyAutoAssignment($ticket);
        $tenantId = app('currentTenantId');

        Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");
        Cache::forget("tickets:list:{$tenantId}*");

        if ($ticket->assignee_id) {
            $this->notificationService->notifyTicketAssigned($ticket);
        }

        return response()->json([
            'success' => $applied,
            'code' => 200,
            'message' => $applied ? '已自动分配' : '未找到匹配的分配规则',
            'data' => $this->transformTicket($ticket->fresh(), false),
        ]);
    }

    public function transition(Request $request, string $uuid)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $user = auth()->user();

        $validated = $request->validate([
            'to_state_id' => 'required|integer',
            'comment' => 'sometimes|nullable|string',
            'context' => 'sometimes|array',
        ]);

        $oldStatus = $ticket->status;
        $result = $this->workflowEngine->transition(
            $ticket,
            (int) $validated['to_state_id'],
            $user,
            $validated['context'] ?? []
        );

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => $result['message'],
                'needs_approval' => $result['needs_approval'] ?? false,
                'approval' => $result['approval'] ?? null,
            ], 422);
        }

        if (!empty($validated['comment'])) {
            $type = $user && $user->isCustomer() ? TicketComment::TYPE_PUBLIC : TicketComment::TYPE_INTERNAL;
            $ticket->addComment($validated['comment'], $user?->id, $type);
        }

        $ticket = $ticket->fresh();
        $tenantId = app('currentTenantId');
        Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");
        Cache::forget("tickets:list:{$tenantId}*");
        Cache::forget("tickets:open_count:{$tenantId}");
        Cache::forget("tickets:overdue_count:{$tenantId}");

        $this->notificationService->notifyTicketStatusChanged($ticket, $oldStatus, $ticket->status, $user);
        $this->notificationService->dispatchWebhook($tenantId, 'ticket.status_changed', [
            'ticket' => $ticket->toArray(),
            'old_status' => $oldStatus,
            'new_status' => $ticket->status,
        ]);

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => $result['message'],
            'needs_approval' => $result['needs_approval'] ?? false,
            'approval' => $result['approval'] ?? null,
            'data' => $this->transformTicket($ticket, false),
        ]);
    }

    public function addComment(Request $request, string $uuid)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $user = auth()->user();
        $userId = $user?->id;
        $tenantId = app('currentTenantId');

        $validated = $request->validate([
            'content' => 'required|string',
            'type' => 'sometimes|integer|in:1,2',
            'is_private' => 'sometimes|boolean',
            'attachments' => 'sometimes|array',
        ]);

        $isCustomer = $user?->isCustomer() ?? false;
        $type = $validated['type'] ?? ($isCustomer ? TicketComment::TYPE_PUBLIC : TicketComment::TYPE_INTERNAL);
        $isPrivate = $validated['is_private'] ?? ($type === TicketComment::TYPE_INTERNAL);

        $comment = $ticket->addComment($validated['content'], $userId, $type, $isPrivate);

        if ($comment && !$isCustomer && $ticket->first_response_at === null) {
            $this->slaMonitor->onFirstResponse($ticket);
        }

        if (!empty($validated['attachments'])) {
            foreach ($validated['attachments'] as $idx => $att) {
                TicketAttachment::create([
                    'tenant_id' => $tenantId,
                    'ticket_id' => $ticket->id,
                    'comment_id' => $comment->id,
                    'uploaded_by' => $userId,
                    'file_name' => $att['file_name'],
                    'file_path' => $att['file_path'],
                    'file_size' => $att['file_size'],
                    'mime_type' => $att['mime_type'] ?? null,
                    'sort_order' => $idx,
                ]);
            }
        }

        Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");

        $this->notificationService->notifyTicketComment($ticket, $comment);
        $this->automationEngine->triggerEvent('ticket.comment', $ticket, ['comment_id' => $comment?->id]);
        $this->notificationService->dispatchWebhook($tenantId, 'ticket.comment_added', [
            'ticket' => $ticket->toArray(),
            'comment' => [
                'id' => $comment?->id,
                'type' => $type,
                'content' => mb_substr($validated['content'], 0, 500),
                'author_id' => $userId,
            ],
        ]);

        return response()->json([
            'success' => true,
            'code' => 201,
            'message' => '评论添加成功',
            'data' => [
                'id' => $comment?->id,
                'uuid' => $comment?->uuid,
                'type' => $comment?->type,
                'content' => $comment?->content,
                'author' => $comment?->author ? [
                    'id' => $comment->author->id,
                    'name' => $comment->author->name,
                ] : null,
                'created_at' => optional($comment?->created_at)->toIso8601String(),
            ],
        ], 201);
    }

    public function rateSatisfaction(Request $request, string $uuid)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();

        if (!in_array($ticket->status, [Ticket::STATUS_RESOLVED, Ticket::STATUS_CLOSED], true)) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => '只有已解决或已关闭的工单才能评价',
            ], 422);
        }
        if ($ticket->satisfaction_score !== null) {
            return response()->json([
                'success' => false,
                'code' => 409,
                'message' => '该工单已评价过，无法重复评价',
            ], 409);
        }

        $validated = $request->validate([
            'score' => 'required|integer|between:1,5',
            'comment' => 'sometimes|nullable|string|max:1000',
        ]);

        $ticket->update([
            'satisfaction_score' => $validated['score'],
            'satisfaction_comment' => $validated['comment'] ?? null,
            'satisfaction_rated_at' => now(),
        ]);

        $tenantId = app('currentTenantId');
        Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");
        Cache::forget("report:csat:{$tenantId}*");

        $this->automationEngine->triggerEvent('ticket.rated', $ticket, [
            'score' => $validated['score'],
            'comment' => $validated['comment'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => '感谢您的评价',
            'data' => [
                'score' => $ticket->satisfaction_score,
                'comment' => $ticket->satisfaction_comment,
            ],
        ]);
    }

    public function batchOperation(Request $request)
    {
        $tenantId = app('currentTenantId');
        $user = auth()->user();
        $userId = $user?->id;

        $validated = $request->validate([
            'ticket_uuids' => 'required|array|min:1',
            'ticket_uuids.*' => 'string',
            'operation' => 'required|string|in:assign,change_priority,change_status,add_tag,remove_tag,add_watcher,change_category,export,delete',
            'params' => 'sometimes|array',
        ]);

        $tickets = Ticket::whereIn('uuid', $validated['ticket_uuids'])->get();

        $processed = 0;
        $failed = [];
        $operation = $validated['operation'];
        $params = $validated['params'] ?? [];

        DB::beginTransaction();
        try {
            foreach ($tickets as $ticket) {
                try {
                    $result = $this->applyBatchOperation($ticket, $operation, $params, $userId);
                    if ($result['success']) {
                        $processed++;
                    } else {
                        $failed[] = ['uuid' => $ticket->uuid, 'reason' => $result['reason']];
                    }
                } catch (\Exception $e) {
                    $failed[] = ['uuid' => $ticket->uuid, 'reason' => $e->getMessage()];
                }
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'code' => 500,
                'message' => '批量操作失败：' . $e->getMessage(),
            ], 500);
        }

        Cache::forget("tickets:list:{$tenantId}*");
        Cache::forget("tickets:open_count:{$tenantId}");
        Cache::forget("report:overview:{$tenantId}*");

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => "批量操作完成：成功{$processed}条，失败" . count($failed) . "条",
            'data' => [
                'processed' => $processed,
                'total' => $tickets->count(),
                'failed' => $failed,
            ],
        ]);
    }

    protected function applyBatchOperation(Ticket $ticket, string $operation, array $params, ?int $userId): array
    {
        switch ($operation) {
            case 'assign':
                if (empty($params['user_id']) && empty($params['group_id'])) {
                    return ['success' => false, 'reason' => '缺少分配目标'];
                }
                $ticket->assignTo($params['user_id'] ?? null, $params['group_id'] ?? null);
                $ticket->addHistory(TicketHistory::ACTION_ASSIGN, null, null, ['user_id' => $userId, 'batch' => true]);
                break;
            case 'change_priority':
                if (empty($params['priority'])) {
                    return ['success' => false, 'reason' => '缺少优先级'];
                }
                $old = $ticket->priority;
                $ticket->update(['priority' => (int) $params['priority']]);
                $ticket->addHistory(TicketHistory::ACTION_PRIORITY_CHANGE, $old, (int) $params['priority'], ['user_id' => $userId, 'batch' => true]);
                break;
            case 'change_status':
                if (empty($params['to_state_id'])) {
                    return ['success' => false, 'reason' => '缺少目标状态ID'];
                }
                $this->workflowEngine->transition($ticket, (int) $params['to_state_id']);
                break;
            case 'add_tag':
                if (empty($params['tags'])) {
                    return ['success' => false, 'reason' => '缺少标签'];
                }
                $tags = array_unique(array_merge($ticket->tags ?? [], (array) $params['tags']));
                $ticket->update(['tags' => $tags]);
                break;
            case 'remove_tag':
                if (empty($params['tags'])) {
                    return ['success' => false, 'reason' => '缺少标签'];
                }
                $tags = array_values(array_diff($ticket->tags ?? [], (array) $params['tags']));
                $ticket->update(['tags' => $tags]);
                break;
            case 'add_watcher':
                if (empty($params['user_ids'])) {
                    return ['success' => false, 'reason' => '缺少用户ID'];
                }
                $watchers = array_unique(array_merge($ticket->watchers ?? [], (array) $params['user_ids']));
                $ticket->update(['watchers' => $watchers]);
                break;
            case 'change_category':
                if (empty($params['category_id'])) {
                    return ['success' => false, 'reason' => '缺少分类ID'];
                }
                $old = $ticket->category_id;
                $ticket->update(['category_id' => (int) $params['category_id']]);
                $ticket->addHistory(TicketHistory::ACTION_CATEGORY_CHANGE, $old, (int) $params['category_id'], ['user_id' => $userId, 'batch' => true]);
                break;
            case 'delete':
                $ticket->delete();
                break;
            case 'export':
                return ['success' => true];
            default:
                return ['success' => false, 'reason' => '不支持的操作'];
        }

        return ['success' => true];
    }

    public function uploadAttachment(Request $request, string $uuid)
    {
        $tenantId = app('currentTenantId');
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $user = auth()->user();
        $userId = $user?->id;

        if (!$request->hasFile('file')) {
            return response()->json([
                'success' => false,
                'code' => 422,
                'message' => '未找到上传文件',
            ], 422);
        }
        if (!TenantQuota::checkAndRecord($tenantId, TenantQuota::RESOURCE_STORAGE, (int) ceil($request->file('file')->getSize() / 1024 / 1024))) {
            return response()->json([
                'success' => false,
                'code' => 429,
                'message' => '存储配额已用尽',
            ], 429);
        }

        $file = $request->file('file');
        $path = $file->store("tickets/{$uuid}/attachments", 's3');
        $attachment = TicketAttachment::create([
            'tenant_id' => $tenantId,
            'ticket_id' => $ticket->id,
            'uploaded_by' => $userId,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
        ]);

        Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");

        return response()->json([
            'success' => true,
            'code' => 201,
            'message' => '附件上传成功',
            'data' => [
                'id' => $attachment->id,
                'file_name' => $attachment->file_name,
                'file_size' => $attachment->file_size,
                'mime_type' => $attachment->mime_type,
                'url' => Storage::url($path),
            ],
        ], 201);
    }

    protected function transformTicket(Ticket $ticket, bool $detailed): array
    {
        $base = [
            'id' => $ticket->id,
            'uuid' => $ticket->uuid,
            'ticket_number' => $ticket->ticket_number,
            'subject' => $ticket->subject,
            'status' => $ticket->status,
            'status_name' => Ticket::getStatusName($ticket->status),
            'priority' => $ticket->priority,
            'priority_name' => Ticket::getPriorityName($ticket->priority),
            'source' => $ticket->source,
            'source_name' => Ticket::getSourceName($ticket->source),
            'category' => $ticket->category ? [
                'id' => $ticket->category->id,
                'name' => $ticket->category->name,
            ] : null,
            'group' => $ticket->group ? [
                'id' => $ticket->group->id,
                'name' => $ticket->group->name,
            ] : null,
            'assignee' => $ticket->assignee ? [
                'id' => $ticket->assignee->id,
                'name' => $ticket->assignee->name,
                'email' => $ticket->assignee->email,
                'avatar' => $ticket->assignee->avatar,
            ] : null,
            'requester' => $ticket->requester ? [
                'id' => $ticket->requester->id,
                'name' => $ticket->requester->name,
                'email' => $ticket->requester->email,
                'phone' => $ticket->requester->phone,
            ] : null,
            'tags' => $ticket->tags ?? [],
            'due_at' => optional($ticket->due_at)->toIso8601String(),
            'created_at' => $ticket->created_at->toIso8601String(),
            'updated_at' => $ticket->updated_at->toIso8601String(),
            'is_overdue' => $ticket->isOverdue(),
            'escalation_count' => $ticket->escalation_count,
            'reopen_count' => $ticket->reopen_count,
        ];

        if ($detailed) {
            $base['description'] = $ticket->description;
            $base['custom_fields'] = $ticket->custom_fields ?? [];
            $base['watchers'] = $ticket->watchers ?? [];
            $base['workflow_id'] = $ticket->workflow_id;
            $base['current_state_id'] = $ticket->current_state_id;
            $base['first_response_at'] = optional($ticket->first_response_at)->toIso8601String();
            $base['resolved_at'] = optional($ticket->resolved_at)->toIso8601String();
            $base['closed_at'] = optional($ticket->closed_at)->toIso8601String();
            $base['satisfaction_score'] = $ticket->satisfaction_score;
            $base['satisfaction_comment'] = $ticket->satisfaction_comment;
            $base['satisfaction_rated_at'] = optional($ticket->satisfaction_rated_at)->toIso8601String();
        }

        return $base;
    }

    public function export(Request $request)
    {
        $tenantId = app('currentTenantId');
        $validated = $request->validate([
            'filters' => 'sometimes|array',
            'columns' => 'sometimes|array',
            'format' => 'sometimes|string|in:csv,xlsx,json',
        ]);
        $filters = $validated['filters'] ?? [];
        $columns = $validated['columns'] ?? ['ticket_number', 'subject', 'status', 'priority', 'requester', 'assignee', 'created_at', 'resolved_at'];
        $format = $validated['format'] ?? 'csv';

        $fileName = "tickets_export_" . now()->format('YmdHis') . ".{$format}";
        $filePath = "exports/{$tenantId}/{$fileName}";

        \App\Jobs\ExportTickets::dispatch($tenantId, $filters, $columns, $format, $filePath, auth()->user()?->id)->onQueue('default');

        return response()->json([
            'success' => true,
            'code' => 202,
            'message' => '导出任务已提交，处理完成后将通过邮件通知',
            'data' => [
                'job_id' => (string) Str::uuid(),
                'expected_format' => $format,
            ],
        ], 202);
    }

    public function availableTransitions(string $uuid)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $transitions = $this->workflowEngine->getAvailableTransitions($ticket);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $transitions->map(fn ($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'from_state_id' => $t->from_state_id,
                'to_state_id' => $t->to_state_id,
                'to_state' => $t->toState ? [
                    'id' => $t->toState->id,
                    'key' => $t->toState->key,
                    'name' => $t->toState->name,
                    'color' => $t->toState->color,
                    'category' => $t->toState->category,
                ] : null,
                'requires_approval' => (bool) $t->requires_approval,
                'conditions' => $t->conditions,
            ])->values(),
        ]);
    }

    public function approveApproval(Request $request, string $uuid, int $approvalId)
    {
        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $approval = \App\Models\WorkflowApproval::where('id', $approvalId)->where('ticket_id', $ticket->id)->firstOrFail();
        $user = auth()->user();

        $validated = $request->validate([
            'approve' => 'required|boolean',
            'reason' => 'sometimes|nullable|string|max:500',
        ]);

        $result = $this->workflowEngine->approveTransition($approval, $user, (bool) $validated['approve'], $validated['reason'] ?? '');

        $tenantId = app('currentTenantId');
        Cache::forget("ticket:detail:{$tenantId}:{$uuid}*");
        Cache::forget("tickets:list:{$tenantId}*");

        return response()->json([
            'success' => $result['success'],
            'code' => 200,
            'message' => $result['message'],
            'data' => [
                'approval_status' => $result['approval_status'] ?? null,
                'ticket_status' => $ticket->fresh()->status,
            ],
        ]);
    }
}
