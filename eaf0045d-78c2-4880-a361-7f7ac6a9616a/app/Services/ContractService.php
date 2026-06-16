<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\CreditScoreLog;
use App\Models\Notification;
use App\Models\Trade;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ContractService
{
    const BREACH_CREDIT_DEDUCTION = 10;

    protected CertificateService $certificateService;
    protected AuditLogService $auditLogService;
    protected SettlementService $settlementService;

    public function __construct(
        CertificateService $certificateService,
        AuditLogService $auditLogService,
        SettlementService $settlementService
    ) {
        $this->certificateService = $certificateService;
        $this->auditLogService = $auditLogService;
        $this->settlementService = $settlementService;
    }

    public function getContract(int $id): Contract
    {
        return Contract::with(['seller', 'buyer', 'trade', 'settlements'])
            ->findOrFail($id);
    }

    public function getContracts(
        ?int $userId = null,
        ?string $status = null,
        ?string $energyType = null,
        ?string $startDate = null,
        ?string $endDate = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = Contract::with(['seller', 'buyer', 'trade']);

        if ($userId) {
            $query->ofUser($userId);
        }

        if ($status) {
            $query->ofStatus($status);
        }

        if ($energyType) {
            $query->where('energy_type', $energyType);
        }

        if ($startDate) {
            $query->where('signed_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('signed_at', '<=', $endDate);
        }

        return $query->orderBy('signed_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function confirmDelivery(int $contractId, User $operator): Contract
    {
        $contract = Contract::findOrFail($contractId);

        if ($contract->seller_id !== $operator->id && !$operator->isExchange()) {
            throw new \Exception('无交割确认权限');
        }

        if (!$contract->canDeliver()) {
            throw new \Exception('当前状态不可交割');
        }

        return DB::transaction(function () use ($contract) {
            $beforeData = $contract->toArray();

            $this->certificateService->transferCertificates(
                $contract->seller_id,
                $contract->buyer_id,
                $contract->energy_type,
                $contract->quantity,
                CertificateTransfer::TYPE_TRADE,
                $contract->id,
                Contract::class,
                '合同交割'
            );

            $contract->update([
                'status' => Contract::STATUS_DELIVERED,
                'delivery_at' => now(),
            ]);

            $this->settlementService->generateSettlement($contract);

            $this->auditLogService->logUpdate(
                AuditLogService::BUSINESS_CONTRACT,
                $contract->id,
                ['status' => $beforeData['status']],
                ['status' => Contract::STATUS_DELIVERED],
                '合同交割确认'
            );

            $this->sendNotification(
                $contract->buyer_id,
                'contract_delivery',
                '合同已交割',
                "合同 {$contract->contract_no} 已完成交割，请查收绿证。"
            );

            return $contract;
        });
    }

    public function confirmReceipt(int $contractId, User $operator): Contract
    {
        $contract = Contract::findOrFail($contractId);

        if ($contract->buyer_id !== $operator->id && !$operator->isExchange()) {
            throw new \Exception('无确认收货权限');
        }

        if ($contract->status !== Contract::STATUS_DELIVERED) {
            throw new \Exception('当前状态不可确认收货');
        }

        return DB::transaction(function () use ($contract) {
            $beforeData = $contract->toArray();

            $contract->update([
                'status' => Contract::STATUS_COMPLETED,
                'completed_at' => now(),
            ]);

            $this->auditLogService->logUpdate(
                AuditLogService::BUSINESS_CONTRACT,
                $contract->id,
                ['status' => $beforeData['status']],
                ['status' => Contract::STATUS_COMPLETED],
                '合同完成确认'
            );

            $this->sendNotification(
                $contract->seller_id,
                'contract_completed',
                '合同已完成',
                "合同 {$contract->contract_no} 已完成，请注意查收款项。"
            );

            return $contract;
        });
    }

    public function processExpiringContracts(): array
    {
        $results = [
            'reminded_3d' => 0,
            'reminded_1d' => 0,
            'breached' => 0,
        ];

        $remind3d = Contract::pendingDelivery()
            ->expiringInDays(3)
            ->where('reminder_3d_sent', false)
            ->get();

        foreach ($remind3d as $contract) {
            $contract->update(['reminder_3d_sent' => true]);
            $this->sendDeliveryReminder($contract, 3);
            $results['reminded_3d']++;
        }

        $remind1d = Contract::pendingDelivery()
            ->expiringInDays(1)
            ->where('reminder_1d_sent', false)
            ->get();

        foreach ($remind1d as $contract) {
            $contract->update(['reminder_1d_sent' => true]);
            $this->sendDeliveryReminder($contract, 1);
            $results['reminded_1d']++;
        }

        $overdueContracts = Contract::overdue()->get();

        foreach ($overdueContracts as $contract) {
            $this->markAsBreached($contract, '未按期交割');
            $results['breached']++;
        }

        return $results;
    }

    protected function sendDeliveryReminder(Contract $contract, int $daysBefore): void
    {
        $this->sendNotification(
            $contract->seller_id,
            'contract_delivery_reminder',
            "合同即将到期（{$daysBefore}天后）",
            "合同 {$contract->contract_no} 将在 {$daysBefore} 天后到期，请及时完成交割。"
        );
    }

    public function markAsBreached(Contract $contract, string $reason): Contract
    {
        if ($contract->status === Contract::STATUS_BREACHED) {
            return $contract;
        }

        return DB::transaction(function () use ($contract, $reason) {
            $beforeData = $contract->toArray();

            $contract->update([
                'status' => Contract::STATUS_BREACHED,
                'breach_reason' => $reason,
            ]);

            $trade = Trade::find($contract->trade_id);
            if ($trade && $trade->status !== Trade::STATUS_BREACHED) {
                $trade->update(['status' => Trade::STATUS_BREACHED]);
            }

            $this->deductCreditScore(
                $contract->seller_id,
                self::BREACH_CREDIT_DEDUCTION,
                "合同违约：{$reason}",
                $contract->id,
                Contract::class
            );

            $this->auditLogService->logUpdate(
                AuditLogService::BUSINESS_CONTRACT,
                $contract->id,
                ['status' => $beforeData['status']],
                ['status' => Contract::STATUS_BREACHED, 'breach_reason' => $reason],
                "标记违约：{$reason}"
            );

            $this->sendNotification(
                $contract->seller_id,
                'contract_breach',
                '合同违约通知',
                "合同 {$contract->contract_no} 已违约，原因：{$reason}。扣除信用分 " . self::BREACH_CREDIT_DEDUCTION . " 分。"
            );

            $this->sendNotification(
                $contract->buyer_id,
                'contract_breach_buyer',
                '卖方违约通知',
                "合同 {$contract->contract_no} 卖方违约，原因：{$reason}。"
            );

            return $contract;
        });
    }

    public function deductCreditScore(
        int $userId,
        int $points,
        string $reason,
        ?int $relatedId = null,
        ?string $relatedType = null,
        ?int $operatorId = null
    ): User {
        return DB::transaction(function () use (
            $userId,
            $points,
            $reason,
            $relatedId,
            $relatedType,
            $operatorId
        ) {
            $user = User::lockForUpdate()->findOrFail($userId);
            $scoreBefore = $user->credit_score;
            $scoreAfter = max(0, $scoreBefore - $points);

            $user->update(['credit_score' => $scoreAfter]);

            CreditScoreLog::create([
                'user_id' => $userId,
                'score_before' => $scoreBefore,
                'score_change' => -$points,
                'score_after' => $scoreAfter,
                'reason' => $reason,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'operator_id' => $operatorId,
            ]);

            return $user;
        });
    }

    public function addCreditScore(
        int $userId,
        int $points,
        string $reason,
        ?int $relatedId = null,
        ?string $relatedType = null,
        ?int $operatorId = null
    ): User {
        return DB::transaction(function () use (
            $userId,
            $points,
            $reason,
            $relatedId,
            $relatedType,
            $operatorId
        ) {
            $user = User::lockForUpdate()->findOrFail($userId);
            $scoreBefore = $user->credit_score;
            $scoreAfter = min(100, $scoreBefore + $points);

            $user->update(['credit_score' => $scoreAfter]);

            CreditScoreLog::create([
                'user_id' => $userId,
                'score_before' => $scoreBefore,
                'score_change' => $points,
                'score_after' => $scoreAfter,
                'reason' => $reason,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'operator_id' => $operatorId,
            ]);

            return $user;
        });
    }

    protected function sendNotification(int $userId, string $type, string $title, string $content): Notification
    {
        return Notification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'content' => $content,
        ]);
    }

    public function getUserNotifications(int $userId, bool $onlyUnread = false, int $perPage = 20, int $page = 1)
    {
        $query = Notification::ofUser($userId);

        if ($onlyUnread) {
            $query->unread();
        }

        return $query->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function markNotificationAsRead(int $notificationId, int $userId): bool
    {
        $notification = Notification::where('id', $notificationId)
            ->where('user_id', $userId)
            ->firstOrFail();

        return $notification->markAsRead();
    }

    public function markAllNotificationsAsRead(int $userId): int
    {
        return Notification::ofUser($userId)
            ->unread()
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
    }

    public function getUnreadCount(int $userId): int
    {
        return Notification::ofUser($userId)->unread()->count();
    }
}
