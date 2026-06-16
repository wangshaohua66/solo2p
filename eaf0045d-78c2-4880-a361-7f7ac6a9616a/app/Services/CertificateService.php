<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\CertificateBalance;
use App\Models\CertificateTransfer;
use App\Models\MeterReading;
use App\Models\PowerStation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;

class CertificateService
{
    const CACHE_TTL = 3600;

    protected AuditLogService $auditLogService;

    public function __construct(AuditLogService $auditLogService)
    {
        $this->auditLogService = $auditLogService;
    }

    public function issueCertificates(string $reportMonth, User $issuer): array
    {
        if (!$issuer->isExchange()) {
            throw new \Exception('无核发权限');
        }

        $approvedReadings = MeterReading::where('report_month', $reportMonth)
            ->where('status', MeterReading::STATUS_APPROVED)
            ->whereDoesntHave('station.certificates', function ($q) use ($reportMonth) {
                $q->where('issue_month', $reportMonth);
            })
            ->with('station')
            ->get();

        $results = [
            'total_stations' => $approvedReadings->count(),
            'total_certificates' => 0,
            'total_generation_kwh' => 0,
            'issued' => [],
        ];

        foreach ($approvedReadings as $reading) {
            try {
                $certificate = $this->issueForStation($reading, $issuer);
                $results['issued'][] = [
                    'station_code' => $reading->station->station_code,
                    'quantity' => $certificate->quantity,
                    'generation_kwh' => $certificate->generation_kwh,
                ];
                $results['total_certificates'] += $certificate->quantity;
                $results['total_generation_kwh'] += $certificate->generation_kwh;
            } catch (\Exception $e) {
                $results['issued'][] = [
                    'station_code' => $reading->station->station_code,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    public function issueForStation(MeterReading $reading, User $issuer): Certificate
    {
        $station = $reading->station;

        $existing = Certificate::where('station_id', $station->id)
            ->where('issue_month', $reading->report_month)
            ->exists();

        if ($existing) {
            throw new \Exception('该月份已核发绿证');
        }

        $generationKwh = $reading->generation_kwh;
        $quantity = floor($generationKwh / 1000);

        if ($quantity <= 0) {
            throw new \Exception('发电量不足1MWh，无法核发绿证');
        }

        $certificateNo = $this->generateCertificateNo($station, $reading->report_month);

        return DB::transaction(function () use (
            $station,
            $reading,
            $quantity,
            $generationKwh,
            $certificateNo,
            $issuer
        ) {
            $certificate = Certificate::create([
                'certificate_no' => $certificateNo,
                'station_id' => $station->id,
                'owner_id' => $station->owner_id,
                'issue_month' => $reading->report_month,
                'quantity' => $quantity,
                'generation_kwh' => $generationKwh,
                'energy_type' => $station->energy_type,
                'province' => $station->province,
                'issuer_id' => $issuer->id,
                'issued_at' => now(),
            ]);

            $this->updateBalance($station->owner_id, $station->energy_type, $quantity, 0);

            $this->recordTransfer(
                null,
                $station->owner_id,
                $station->energy_type,
                $quantity,
                CertificateTransfer::TYPE_ISSUE,
                $certificate->id,
                Certificate::class,
                '绿证核发'
            );

            $this->auditLogService->log(
                AuditLogService::BUSINESS_CERTIFICATE,
                AuditLogService::ACTION_ISSUE,
                $certificate->id,
                null,
                $certificate->toArray(),
                '绿证核发'
            );

            $this->clearBalanceCache($station->owner_id, $station->energy_type);

            return $certificate;
        });
    }

    public function getBalance(int $userId, string $energyType): ?CertificateBalance
    {
        $cacheKey = $this->getBalanceCacheKey($userId, $energyType);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($userId, $energyType) {
            return CertificateBalance::firstOrCreate(
                ['user_id' => $userId, 'energy_type' => $energyType],
                [
                    'available_balance' => 0,
                    'frozen_balance' => 0,
                    'total_issued' => 0,
                    'total_traded' => 0,
                ]
            );
        });
    }

    public function getAvailableBalance(int $userId, string $energyType): int
    {
        $balance = $this->getBalance($userId, $energyType);
        return $balance?->available_balance ?? 0;
    }

    public function updateBalance(
        int $userId,
        string $energyType,
        int $availableChange = 0,
        int $frozenChange = 0,
        int $issuedChange = 0,
        int $tradedChange = 0
    ): CertificateBalance {
        return DB::transaction(function () use (
            $userId,
            $energyType,
            $availableChange,
            $frozenChange,
            $issuedChange,
            $tradedChange
        ) {
            $balance = CertificateBalance::lockForUpdate()
                ->firstOrCreate(
                    ['user_id' => $userId, 'energy_type' => $energyType],
                    [
                        'available_balance' => 0,
                        'frozen_balance' => 0,
                        'total_issued' => 0,
                        'total_traded' => 0,
                    ]
                );

            $newAvailable = $balance->available_balance + $availableChange;
            $newFrozen = $balance->frozen_balance + $frozenChange;

            if ($newAvailable < 0) {
                throw new \Exception('可用余额不足');
            }

            if ($newFrozen < 0) {
                throw new \Exception('冻结余额不足');
            }

            $balance->update([
                'available_balance' => $newAvailable,
                'frozen_balance' => $newFrozen,
                'total_issued' => $balance->total_issued + $issuedChange,
                'total_traded' => $balance->total_traded + $tradedChange,
            ]);

            $this->clearBalanceCache($userId, $energyType);

            return $balance;
        });
    }

    public function freezeBalance(int $userId, string $energyType, int $quantity): CertificateBalance
    {
        return DB::transaction(function () use ($userId, $energyType, $quantity) {
            $balance = CertificateBalance::lockForUpdate()
                ->where('user_id', $userId)
                ->where('energy_type', $energyType)
                ->firstOrFail();

            if ($balance->available_balance < $quantity) {
                throw new \Exception('可用余额不足，无法冻结');
            }

            $balance->decrement('available_balance', $quantity);
            $balance->increment('frozen_balance', $quantity);

            $this->clearBalanceCache($userId, $energyType);

            $this->recordTransfer(
                $userId,
                $userId,
                $energyType,
                $quantity,
                CertificateTransfer::TYPE_FREEZE,
                null,
                null,
                '冻结绿证'
            );

            return $balance->fresh();
        });
    }

    public function unfreezeBalance(int $userId, string $energyType, int $quantity): CertificateBalance
    {
        return DB::transaction(function () use ($userId, $energyType, $quantity) {
            $balance = CertificateBalance::lockForUpdate()
                ->where('user_id', $userId)
                ->where('energy_type', $energyType)
                ->firstOrFail();

            if ($balance->frozen_balance < $quantity) {
                throw new \Exception('冻结余额不足，无法解冻');
            }

            $balance->increment('available_balance', $quantity);
            $balance->decrement('frozen_balance', $quantity);

            $this->clearBalanceCache($userId, $energyType);

            $this->recordTransfer(
                $userId,
                $userId,
                $energyType,
                $quantity,
                CertificateTransfer::TYPE_UNFREEZE,
                null,
                null,
                '解冻绿证'
            );

            return $balance->fresh();
        });
    }

    public function transferCertificates(
        int $fromUserId,
        int $toUserId,
        string $energyType,
        int $quantity,
        string $transferType,
        $relatedId = null,
        $relatedType = null,
        ?string $remark = null
    ): void {
        DB::transaction(function () use (
            $fromUserId,
            $toUserId,
            $energyType,
            $quantity,
            $transferType,
            $relatedId,
            $relatedType,
            $remark
        ) {
            $fromBalance = CertificateBalance::lockForUpdate()
                ->where('user_id', $fromUserId)
                ->where('energy_type', $energyType)
                ->firstOrFail();

            if ($fromBalance->frozen_balance < $quantity) {
                throw new \Exception('冻结余额不足');
            }

            $fromBalance->decrement('frozen_balance', $quantity);
            $fromBalance->increment('total_traded', $quantity);

            $toBalance = CertificateBalance::firstOrCreate(
                ['user_id' => $toUserId, 'energy_type' => $energyType],
                [
                    'available_balance' => 0,
                    'frozen_balance' => 0,
                    'total_issued' => 0,
                    'total_traded' => 0,
                ]
            );

            $toBalance->increment('available_balance', $quantity);
            $toBalance->increment('total_traded', $quantity);

            $this->recordTransfer(
                $fromUserId,
                $toUserId,
                $energyType,
                $quantity,
                $transferType,
                $relatedId,
                $relatedType,
                $remark
            );

            $this->clearBalanceCache($fromUserId, $energyType);
            $this->clearBalanceCache($toUserId, $energyType);
        });
    }

    protected function recordTransfer(
        ?int $fromUserId,
        ?int $toUserId,
        string $energyType,
        int $quantity,
        string $transferType,
        $relatedId = null,
        $relatedType = null,
        ?string $remark = null
    ): CertificateTransfer {
        return CertificateTransfer::create([
            'transfer_no' => 'TRF' . date('YmdHis') . rand(1000, 9999),
            'from_user_id' => $fromUserId,
            'to_user_id' => $toUserId,
            'energy_type' => $energyType,
            'quantity' => $quantity,
            'transfer_type' => $transferType,
            'related_id' => $relatedId,
            'related_type' => $relatedType,
            'remark' => $remark,
        ]);
    }

    protected function generateCertificateNo(PowerStation $station, string $month): string
    {
        $prefix = match($station->energy_type) {
            PowerStation::ENERGY_SOLAR => 'SOL',
            PowerStation::ENERGY_WIND => 'WIN',
            default => 'GRE',
        };

        $monthStr = str_replace('-', '', $month);
        $random = str_pad($station->id, 6, '0', STR_PAD_LEFT);

        return "{$prefix}{$monthStr}{$random}";
    }

    protected function getBalanceCacheKey(int $userId, string $energyType): string
    {
        return "cert_balance:{$userId}:{$energyType}";
    }

    protected function clearBalanceCache(int $userId, string $energyType): void
    {
        Cache::forget($this->getBalanceCacheKey($userId, $energyType));
    }

    public function getUserBalances(int $userId)
    {
        return CertificateBalance::ofUser($userId)->get();
    }

    public function getTransferHistory(
        ?int $userId = null,
        ?string $type = null,
        ?string $energyType = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = CertificateTransfer::with(['fromUser', 'toUser']);

        if ($userId) {
            $query->ofUser($userId);
        }

        if ($type) {
            $query->ofType($type);
        }

        if ($energyType) {
            $query->ofEnergyType($energyType);
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    public function getCertificates(
        ?int $ownerId = null,
        ?string $energyType = null,
        ?string $issueMonth = null,
        ?string $province = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = Certificate::with(['station', 'owner', 'issuer']);

        if ($ownerId) {
            $query->ofOwner($ownerId);
        }

        if ($energyType) {
            $query->ofEnergyType($energyType);
        }

        if ($issueMonth) {
            $query->ofIssueMonth($issueMonth);
        }

        if ($province) {
            $query->ofProvince($province);
        }

        return $query->orderBy('issued_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }
}
