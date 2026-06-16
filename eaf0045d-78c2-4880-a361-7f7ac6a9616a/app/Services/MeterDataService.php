<?php

namespace App\Services;

use App\Models\MeterReading;
use App\Models\PowerStation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class MeterDataService
{
    const ABNORMAL_THRESHOLD_RATIO = 1.0;

    protected AuditLogService $auditLogService;

    public function __construct(AuditLogService $auditLogService)
    {
        $this->auditLogService = $auditLogService;
    }

    public function batchSubmit(array $readingsData, User $reporter): array
    {
        $results = [
            'success' => [],
            'failed' => [],
        ];

        foreach ($readingsData as $index => $data) {
            try {
                $reading = $this->submitSingle($data, $reporter);
                $results['success'][] = [
                    'index' => $index,
                    'id' => $reading->id,
                    'station_code' => $data['station_code'],
                    'status' => $reading->status,
                ];
            } catch (\Exception $e) {
                $results['failed'][] = [
                    'index' => $index,
                    'station_code' => $data['station_code'] ?? null,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    public function submitSingle(array $data, User $reporter): MeterReading
    {
        $station = PowerStation::where('station_code', $data['station_code'])->firstOrFail();

        if ($station->owner_id !== $reporter->id && !$reporter->isExchange()) {
            throw new \Exception('无权上报该电站数据');
        }

        $reportMonth = $data['report_month'];

        $existing = MeterReading::where('station_id', $station->id)
            ->where('report_month', $reportMonth)
            ->first();

        if ($existing) {
            throw new \Exception("该电站 {$reportMonth} 月数据已上报，不可重复提交");
        }

        $theoreticalMax = $station->getTheoreticalMonthlyMaxKwh();
        $generationKwh = (float)$data['generation_kwh'];

        $status = MeterReading::STATUS_PENDING;
        $abnormalReason = null;

        if ($generationKwh > $theoreticalMax * self::ABNORMAL_THRESHOLD_RATIO) {
            $status = MeterReading::STATUS_ABNORMAL;
            $abnormalReason = "发电量超过理论最大值{$theoreticalMax}kWh";
        }

        if ($generationKwh < 0) {
            $status = MeterReading::STATUS_ABNORMAL;
            $abnormalReason = '发电量不能为负数';
        }

        $reading = DB::transaction(function () use (
            $station,
            $reportMonth,
            $generationKwh,
            $theoreticalMax,
            $status,
            $abnormalReason,
            $reporter,
            $data
        ) {
            $reading = MeterReading::create([
                'station_id' => $station->id,
                'report_month' => $reportMonth,
                'generation_kwh' => $generationKwh,
                'theoretical_max_kwh' => $theoreticalMax,
                'status' => $status,
                'abnormal_reason' => $abnormalReason,
                'reported_by' => $reporter->id,
            ]);

            $this->auditLogService->logCreate(
                AuditLogService::BUSINESS_METER,
                $reading->id,
                $reading->toArray(),
                '计量数据上报'
            );

            return $reading;
        });

        return $reading;
    }

    public function review(int $id, string $result, string $remark, User $reviewer): MeterReading
    {
        if (!$reviewer->isExchange()) {
            throw new \Exception('无审核权限');
        }

        $reading = MeterReading::findOrFail($id);

        if (!in_array($reading->status, [
            MeterReading::STATUS_PENDING,
            MeterReading::STATUS_ABNORMAL,
        ])) {
            throw new \Exception('当前状态不可审核');
        }

        $beforeData = $reading->toArray();

        $reading = DB::transaction(function () use ($reading, $result, $remark, $reviewer) {
            $status = match ($result) {
                'approve' => MeterReading::STATUS_APPROVED,
                'reject' => MeterReading::STATUS_REJECTED,
                default => throw new \Exception('无效的审核结果'),
            };

            $reading->update([
                'status' => $status,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_remark' => $remark,
            ]);

            $this->auditLogService->logReview(
                AuditLogService::BUSINESS_METER,
                $reading->id,
                ['status' => $beforeData['status']],
                ['status' => $status, 'remark' => $remark],
                $remark
            );

            return $reading;
        });

        return $reading;
    }

    public function getReadings(
        ?int $stationId = null,
        ?string $reportMonth = null,
        ?string $status = null,
        ?int $ownerId = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = MeterReading::with(['station', 'reportedBy']);

        if ($stationId) {
            $query->ofStation($stationId);
        }

        if ($reportMonth) {
            $query->ofMonth($reportMonth);
        }

        if ($status) {
            $query->ofStatus($status);
        }

        if ($ownerId) {
            $query->whereHas('station', function ($q) use ($ownerId) {
                $q->where('owner_id', $ownerId);
            });
        }

        return $query->orderBy('report_month', 'desc')
            ->orderBy('station_id')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function getPendingCount(): int
    {
        return Cache::remember('meter_pending_count', 300, function () {
            return MeterReading::whereIn('status', [
                MeterReading::STATUS_PENDING,
                MeterReading::STATUS_ABNORMAL,
            ])->count();
        });
    }

    public function getStationMonthlyTotal(string $stationId, string $month): float
    {
        $reading = MeterReading::where('station_id', $stationId)
            ->where('report_month', $month)
            ->where('status', MeterReading::STATUS_APPROVED)
            ->first();

        return $reading?->generation_kwh ?? 0;
    }
}
