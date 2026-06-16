<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Settlement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class SettlementService
{
    const SERVICE_FEE_RATE = 0.005;

    protected AuditLogService $auditLogService;

    public function __construct(AuditLogService $auditLogService)
    {
        $this->auditLogService = $auditLogService;
    }

    public function generateSettlement(Contract $contract): array
    {
        return DB::transaction(function () use ($contract) {
            $quantity = $contract->quantity;
            $unitPrice = $contract->unit_price;
            $tradeAmount = $contract->total_amount;
            $serviceFee = round($tradeAmount * self::SERVICE_FEE_RATE, 2);

            $settlementDate = today();
            $settlementMonth = $settlementDate->format('Y-m');

            $sellerSettlement = $this->createSettlement(
                $contract,
                $contract->seller_id,
                Settlement::TYPE_INCOME,
                $quantity,
                $unitPrice,
                $tradeAmount,
                $serviceFee,
                $settlementDate,
                $settlementMonth
            );

            $buyerSettlement = $this->createSettlement(
                $contract,
                $contract->buyer_id,
                Settlement::TYPE_EXPENDITURE,
                $quantity,
                $unitPrice,
                $tradeAmount,
                $serviceFee,
                $settlementDate,
                $settlementMonth
            );

            $this->auditLogService->log(
                AuditLogService::BUSINESS_SETTLEMENT,
                AuditLogService::ACTION_SETTLE,
                $contract->id,
                null,
                [
                    'seller_settlement_id' => $sellerSettlement->id,
                    'buyer_settlement_id' => $buyerSettlement->id,
                    'trade_amount' => $tradeAmount,
                    'service_fee' => $serviceFee,
                ],
                '生成结算单'
            );

            return [
                'seller_settlement' => $sellerSettlement,
                'buyer_settlement' => $buyerSettlement,
            ];
        });
    }

    protected function createSettlement(
        Contract $contract,
        int $userId,
        string $type,
        int $quantity,
        float $unitPrice,
        float $tradeAmount,
        float $serviceFee,
        $settlementDate,
        string $settlementMonth
    ): Settlement {
        $netAmount = match ($type) {
            Settlement::TYPE_INCOME => $tradeAmount - $serviceFee,
            Settlement::TYPE_EXPENDITURE => -($tradeAmount + $serviceFee),
            default => throw new \Exception('无效的结算类型'),
        };

        $settlementNo = 'SET' . date('YmdHis') . rand(1000, 9999);

        return Settlement::create([
            'settlement_no' => $settlementNo,
            'contract_id' => $contract->id,
            'user_id' => $userId,
            'settlement_type' => $type,
            'energy_type' => $contract->energy_type,
            'certificate_quantity' => $quantity,
            'unit_price' => $unitPrice,
            'trade_amount' => $tradeAmount,
            'service_fee' => $serviceFee,
            'net_amount' => $netAmount,
            'status' => Settlement::STATUS_PENDING,
            'settlement_date' => $settlementDate,
            'settlement_month' => $settlementMonth,
        ]);
    }

    public function confirmSettlement(int $settlementId, User $operator): Settlement
    {
        if (!$operator->isExchange()) {
            throw new \Exception('无结算确认权限');
        }

        $settlement = Settlement::findOrFail($settlementId);

        if ($settlement->status !== Settlement::STATUS_PENDING) {
            throw new \Exception('当前状态不可确认');
        }

        return DB::transaction(function () use ($settlement) {
            $beforeData = $settlement->toArray();

            $settlement->update(['status' => Settlement::STATUS_SETTLED]);

            $this->auditLogService->logUpdate(
                AuditLogService::BUSINESS_SETTLEMENT,
                $settlement->id,
                ['status' => $beforeData['status']],
                ['status' => Settlement::STATUS_SETTLED],
                '结算确认'
            );

            return $settlement;
        });
    }

    public function getSettlements(
        ?int $userId = null,
        ?string $status = null,
        ?string $type = null,
        ?string $month = null,
        ?string $energyType = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = Settlement::with(['contract', 'user']);

        if ($userId) {
            $query->ofUser($userId);
        }

        if ($status) {
            $query->ofStatus($status);
        }

        if ($type) {
            $query->ofType($type);
        }

        if ($month) {
            $query->ofMonth($month);
        }

        if ($energyType) {
            $query->where('energy_type', $energyType);
        }

        return $query->orderBy('settlement_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function getMonthlySummary(int $userId, string $month): array
    {
        $cacheKey = "settlement_summary:{$userId}:{$month}";

        return Cache::remember($cacheKey, 3600, function () use ($userId, $month) {
            $settlements = Settlement::ofUser($userId)->ofMonth($month)->get();

            $incomeTotal = 0;
            $expenditureTotal = 0;
            $incomeFee = 0;
            $expenditureFee = 0;
            $incomeCount = 0;
            $expenditureCount = 0;

            foreach ($settlements as $s) {
                if ($s->settlement_type === Settlement::TYPE_INCOME) {
                    $incomeTotal += $s->trade_amount;
                    $incomeFee += $s->service_fee;
                    $incomeCount++;
                } else {
                    $expenditureTotal += $s->trade_amount;
                    $expenditureFee += $s->service_fee;
                    $expenditureCount++;
                }
            }

            return [
                'month' => $month,
                'user_id' => $userId,
                'income' => [
                    'count' => $incomeCount,
                    'trade_amount' => round($incomeTotal, 2),
                    'service_fee' => round($incomeFee, 2),
                    'net_amount' => round($incomeTotal - $incomeFee, 2),
                ],
                'expenditure' => [
                    'count' => $expenditureCount,
                    'trade_amount' => round($expenditureTotal, 2),
                    'service_fee' => round($expenditureFee, 2),
                    'net_amount' => round(-($expenditureTotal + $expenditureFee), 2),
                ],
                'net_total' => round(
                    ($incomeTotal - $incomeFee) - ($expenditureTotal + $expenditureFee),
                    2
                ),
            ];
        });
    }

    public function getPlatformDailySummary(string $date): array
    {
        $settlements = Settlement::where('settlement_date', $date)->get();

        $totalTradeAmount = 0;
        $totalServiceFee = 0;
        $settlementCount = 0;

        foreach ($settlements as $s) {
            $totalServiceFee += $s->service_fee;
            if ($s->settlement_type === Settlement::TYPE_INCOME) {
                $totalTradeAmount += $s->trade_amount;
                $settlementCount++;
            }
        }

        return [
            'date' => $date,
            'settlement_count' => $settlementCount,
            'total_trade_amount' => round($totalTradeAmount, 2),
            'total_service_fee' => round($totalServiceFee / 2, 2),
        ];
    }

    public function exportMonthlyReport(int $userId, string $month): array
    {
        $summary = $this->getMonthlySummary($userId, $month);
        $settlements = $this->getSettlements($userId, null, null, $month, null, 1000, 1);

        return [
            'summary' => $summary,
            'details' => $settlements->items(),
        ];
    }
}
