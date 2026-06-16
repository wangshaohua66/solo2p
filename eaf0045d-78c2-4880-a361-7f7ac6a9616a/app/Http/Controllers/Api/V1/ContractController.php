<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ContractService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ContractController extends Controller
{
    protected ContractService $contractService;

    public function __construct(ContractService $contractService)
    {
        $this->contractService = $contractService;
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => 'nullable|string',
            'energy_type' => 'nullable|in:solar,wind',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        $userId = null;

        if (!$user->isExchange() && !$user->isRegulator()) {
            $userId = $user->id;
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->contractService->getContracts(
            $userId,
            $validated['status'] ?? null,
            $validated['energy_type'] ?? null,
            $validated['start_date'] ?? null,
            $validated['end_date'] ?? null,
            $perPage,
            $page
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'total' => $result->total(),
                'per_page' => $result->perPage(),
                'current_page' => $result->currentPage(),
                'data' => $result->items(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $contract = $this->contractService->getContract($id);

        $user = Auth::user();
        if (!$user->isExchange() && !$user->isRegulator()) {
            if ($contract->seller_id !== $user->id && $contract->buyer_id !== $user->id) {
                return response()->json([
                    'code' => 403,
                    'message' => '无权限查看',
                    'errors' => [],
                ], 403);
            }
        }

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $contract,
        ]);
    }

    public function deliver(int $id)
    {
        $user = Auth::user();

        $contract = $this->contractService->confirmDelivery($id, $user);

        return response()->json([
            'code' => 0,
            'message' => '交割确认成功',
            'data' => $contract,
        ]);
    }

    public function confirmReceipt(int $id)
    {
        $user = Auth::user();

        $contract = $this->contractService->confirmReceipt($id, $user);

        return response()->json([
            'code' => 0,
            'message' => '确认收货成功',
            'data' => $contract,
        ]);
    }

    public function notifications(Request $request)
    {
        $validated = $request->validate([
            'only_unread' => 'nullable|boolean',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        $onlyUnread = $validated['only_unread'] ?? false;
        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->contractService->getUserNotifications(
            $user->id,
            $onlyUnread,
            $perPage,
            $page
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'total' => $result->total(),
                'per_page' => $result->perPage(),
                'current_page' => $result->currentPage(),
                'data' => $result->items(),
            ],
        ]);
    }

    public function unreadCount()
    {
        $user = Auth::user();

        $count = $this->contractService->getUnreadCount($user->id);

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => ['count' => $count],
        ]);
    }

    public function markNotificationRead(int $id)
    {
        $user = Auth::user();

        $this->contractService->markNotificationAsRead($id, $user->id);

        return response()->json([
            'code' => 0,
            'message' => '已标记为已读',
            'data' => null,
        ]);
    }

    public function markAllNotificationsRead()
    {
        $user = Auth::user();

        $count = $this->contractService->markAllNotificationsAsRead($user->id);

        return response()->json([
            'code' => 0,
            'message' => "已标记 {$count} 条通知为已读",
            'data' => ['count' => $count],
        ]);
    }
}
