<?php

use App\Http\Controllers\Api\V1\TicketController;
use Illuminate\Support\Facades\Route;

Route::prefix('tickets')->group(function () {
    Route::middleware('throttle:tickets.create')->post('/', [TicketController::class, 'store']);
    Route::middleware('permission:tickets.view')->get('/', [TicketController::class, 'index']);
    Route::middleware('throttle:tickets.batch')->post('batch', [TicketController::class, 'batchOperation']);
    Route::post('export', [TicketController::class, 'export']);
    Route::middleware('permission:tickets.upload')->post('{ticket}/attachments', [TicketController::class, 'uploadAttachment']);

    Route::prefix('{ticket}')->where(['ticket' => '[0-9a-f-]+'])->group(function () {
        Route::middleware('permission:tickets.view')->get('/', [TicketController::class, 'show']);
        Route::middleware('permission:tickets.edit')->put('/', [TicketController::class, 'update']);
        Route::middleware('permission:tickets.delete')->delete('/', [TicketController::class, 'destroy']);
        Route::middleware('permission:tickets.assign')->post('assign', [TicketController::class, 'assign']);
        Route::middleware('permission:tickets.assign')->post('auto-assign', [TicketController::class, 'autoAssign']);
        Route::middleware('permission:tickets.status')->post('transition', [TicketController::class, 'transition']);
        Route::middleware('permission:tickets.comment')->post('comments', [TicketController::class, 'addComment']);
        Route::middleware('permission:tickets.approve')->post('approvals/{approval}/approve', [TicketController::class, 'approveApproval']);
        Route::post('satisfaction', [TicketController::class, 'rateSatisfaction']);
        Route::middleware('permission:tickets.view')->get('transitions', [TicketController::class, 'availableTransitions']);
    });
});

Route::prefix('tenants')->group(function () {
    Route::post('/', [\App\Http\Controllers\Api\V1\TenantController::class, 'store']);
    Route::middleware('auth')->group(function () {
        Route::get('{tenant}', [\App\Http\Controllers\Api\V1\TenantController::class, 'show']);
        Route::put('{tenant}', [\App\Http\Controllers\Api\V1\TenantController::class, 'update']);
        Route::get('{tenant}/stats', [\App\Http\Controllers\Api\V1\TenantController::class, 'stats']);
        Route::get('{tenant}/usage', [\App\Http\Controllers\Api\V1\TenantController::class, 'usage']);
        Route::post('{tenant}/suspend', [\App\Http\Controllers\Api\V1\TenantController::class, 'suspend']);
        Route::post('{tenant}/activate', [\App\Http\Controllers\Api\V1\TenantController::class, 'activate']);
    });
});

Route::prefix('users')->group(function () {
    Route::middleware('auth')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\V1\UserController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Api\V1\UserController::class, 'store']);
        Route::get('{user}', [\App\Http\Controllers\Api\V1\UserController::class, 'show']);
        Route::put('{user}', [\App\Http\Controllers\Api\V1\UserController::class, 'update']);
        Route::delete('{user}', [\App\Http\Controllers\Api\V1\UserController::class, 'destroy']);
        Route::get('me', [\App\Http\Controllers\Api\V1\UserController::class, 'me']);
        Route::post('{user}/roles', [\App\Http\Controllers\Api\V1\UserController::class, 'assignRoles']);
    });
});

Route::prefix('reports')->middleware(['auth', 'throttle:reports.heavy'])->group(function () {
    Route::get('overview', [\App\Http\Controllers\Api\V1\ReportController::class, 'overview']);
    Route::get('agents', [\App\Http\Controllers\Api\V1\ReportController::class, 'agentPerformance']);
    Route::get('sla', [\App\Http\Controllers\Api\V1\ReportController::class, 'slaPerformance']);
    Route::get('satisfaction', [\App\Http\Controllers\Api\V1\ReportController::class, 'satisfaction']);
    Route::get('categories', [\App\Http\Controllers\Api\V1\ReportController::class, 'categories']);
    Route::get('trends', [\App\Http\Controllers\Api\V1\ReportController::class, 'trends']);
    Route::get('insights', [\App\Http\Controllers\Api\V1\ReportController::class, 'insights']);
    Route::get('billing', [\App\Http\Controllers\Api\V1\ReportController::class, 'billing']);
});

Route::prefix('sla')->middleware('auth')->group(function () {
    Route::get('policies', [\App\Http\Controllers\Api\V1\SLAController::class, 'index']);
    Route::post('policies', [\App\Http\Controllers\Api\V1\SLAController::class, 'store']);
    Route::get('policies/{policy}', [\App\Http\Controllers\Api\V1\SLAController::class, 'show']);
    Route::put('policies/{policy}', [\App\Http\Controllers\Api\V1\SLAController::class, 'update']);
    Route::delete('policies/{policy}', [\App\Http\Controllers\Api\V1\SLAController::class, 'destroy']);
    Route::get('timers', [\App\Http\Controllers\Api\V1\SLAController::class, 'timers']);
    Route::get('violations', [\App\Http\Controllers\Api\V1\SLAController::class, 'violations']);
    Route::post('violations/{violation}/acknowledge', [\App\Http\Controllers\Api\V1\SLAController::class, 'acknowledge']);
});

Route::prefix('workflows')->middleware('auth')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\V1\WorkflowController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\Api\V1\WorkflowController::class, 'store']);
    Route::get('{workflow}', [\App\Http\Controllers\Api\V1\WorkflowController::class, 'show']);
    Route::put('{workflow}', [\App\Http\Controllers\Api\V1\WorkflowController::class, 'update']);
    Route::delete('{workflow}', [\App\Http\Controllers\Api\V1\WorkflowController::class, 'destroy']);
    Route::get('{workflow}/states', [\App\Http\Controllers\Api\V1\WorkflowController::class, 'states']);
    Route::get('{workflow}/transitions', [\App\Http\Controllers\Api\V1\WorkflowController::class, 'transitions']);
});

Route::prefix('automations')->middleware('auth')->group(function () {
    Route::get('rules', [\App\Http\Controllers\Api\V1\AutomationController::class, 'index']);
    Route::post('rules', [\App\Http\Controllers\Api\V1\AutomationController::class, 'store']);
    Route::get('rules/{rule}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'show']);
    Route::put('rules/{rule}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'update']);
    Route::delete('rules/{rule}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'destroy']);
    Route::post('rules/{rule}/execute', [\App\Http\Controllers\Api\V1\AutomationController::class, 'execute']);
    Route::get('logs', [\App\Http\Controllers\Api\V1\AutomationController::class, 'logs']);
});

Route::prefix('notifications')->middleware('auth')->group(function () {
    Route::get('logs', [\App\Http\Controllers\Api\V1\NotificationController::class, 'logs']);
    Route::get('templates', [\App\Http\Controllers\Api\V1\NotificationController::class, 'templates']);
    Route::post('templates', [\App\Http\Controllers\Api\V1\NotificationController::class, 'storeTemplate']);
    Route::put('templates/{template}', [\App\Http\Controllers\Api\V1\NotificationController::class, 'updateTemplate']);
    Route::get('subscriptions', [\App\Http\Controllers\Api\V1\NotificationController::class, 'subscriptions']);
    Route::put('subscriptions', [\App\Http\Controllers\Api\V1\NotificationController::class, 'updateSubscriptions']);
});

Route::prefix('webhooks')->middleware(['auth', 'throttle:webhooks'])->group(function () {
    Route::get('endpoints', [\App\Http\Controllers\Api\V1\WebhookController::class, 'index']);
    Route::post('endpoints', [\App\Http\Controllers\Api\V1\WebhookController::class, 'store']);
    Route::get('endpoints/{endpoint}', [\App\Http\Controllers\Api\V1\WebhookController::class, 'show']);
    Route::put('endpoints/{endpoint}', [\App\Http\Controllers\Api\V1\WebhookController::class, 'update']);
    Route::delete('endpoints/{endpoint}', [\App\Http\Controllers\Api\V1\WebhookController::class, 'destroy']);
    Route::post('endpoints/{endpoint}/test', [\App\Http\Controllers\Api\V1\WebhookController::class, 'test']);
});

Route::prefix('auth')->group(function () {
    Route::middleware('throttle:auth')->group(function () {
        Route::post('login', [\App\Http\Controllers\Api\V1\AuthController::class, 'login']);
        Route::post('logout', [\App\Http\Controllers\Api\V1\AuthController::class, 'logout']);
        Route::post('refresh', [\App\Http\Controllers\Api\V1\AuthController::class, 'refresh']);
        Route::post('forgot-password', [\App\Http\Controllers\Api\V1\AuthController::class, 'forgotPassword']);
        Route::post('reset-password', [\App\Http\Controllers\Api\V1\AuthController::class, 'resetPassword']);
    });
});

Route::prefix('categories')->middleware('auth')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\V1\CategoryController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\Api\V1\CategoryController::class, 'store']);
    Route::get('{category}', [\App\Http\Controllers\Api\V1\CategoryController::class, 'show']);
    Route::put('{category}', [\App\Http\Controllers\Api\V1\CategoryController::class, 'update']);
    Route::delete('{category}', [\App\Http\Controllers\Api\V1\CategoryController::class, 'destroy']);
});

Route::prefix('groups')->middleware('auth')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\V1\GroupController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\Api\V1\GroupController::class, 'store']);
    Route::get('{group}', [\App\Http\Controllers\Api\V1\GroupController::class, 'show']);
    Route::put('{group}', [\App\Http\Controllers\Api\V1\GroupController::class, 'update']);
    Route::delete('{group}', [\App\Http\Controllers\Api\V1\GroupController::class, 'destroy']);
});
