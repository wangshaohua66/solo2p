<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditLogService
{
    const BUSINESS_METER = 'meter_reading';
    const BUSINESS_CERTIFICATE = 'certificate';
    const BUSINESS_LISTING = 'listing';
    const BUSINESS_TRADE = 'trade';
    const BUSINESS_CONTRACT = 'contract';
    const BUSINESS_SETTLEMENT = 'settlement';
    const BUSINESS_USER = 'user';
    const BUSINESS_STATION = 'power_station';

    const ACTION_CREATE = 'create';
    const ACTION_UPDATE = 'update';
    const ACTION_DELETE = 'delete';
    const ACTION_REVIEW = 'review';
    const ACTION_APPROVE = 'approve';
    const ACTION_REJECT = 'reject';
    const ACTION_ISSUE = 'issue';
    const ACTION_MATCH = 'match';
    const ACTION_DELIVER = 'deliver';
    const ACTION_SETTLE = 'settle';
    const ACTION_CANCEL = 'cancel';
    const ACTION_LOGIN = 'login';

    public function log(
        string $businessType,
        string $action,
        ?string $businessId = null,
        ?array $beforeData = null,
        ?array $afterData = null,
        ?string $remark = null
    ): AuditLog {
        $user = Auth::user();

        return AuditLog::create([
            'user_id' => $user?->id,
            'username' => $user?->username,
            'role' => $user?->role,
            'action' => $action,
            'business_type' => $businessType,
            'business_id' => $businessId,
            'ip_address' => Request::ip(),
            'user_agent' => Request::header('User-Agent'),
            'before_data' => $beforeData,
            'after_data' => $afterData,
            'remark' => $remark,
        ]);
    }

    public function logCreate(string $businessType, string $businessId, array $afterData, ?string $remark = null): AuditLog
    {
        return $this->log($businessType, self::ACTION_CREATE, $businessId, null, $afterData, $remark);
    }

    public function logUpdate(string $businessType, string $businessId, array $beforeData, array $afterData, ?string $remark = null): AuditLog
    {
        return $this->log($businessType, self::ACTION_UPDATE, $businessId, $beforeData, $afterData, $remark);
    }

    public function logDelete(string $businessType, string $businessId, array $beforeData, ?string $remark = null): AuditLog
    {
        return $this->log($businessType, self::ACTION_DELETE, $businessId, $beforeData, null, $remark);
    }

    public function logReview(string $businessType, string $businessId, array $beforeData, array $afterData, ?string $remark = null): AuditLog
    {
        return $this->log($businessType, self::ACTION_REVIEW, $businessId, $beforeData, $afterData, $remark);
    }

    public function search(
        ?string $businessType = null,
        ?string $action = null,
        ?string $businessId = null,
        ?int $userId = null,
        ?string $startDate = null,
        ?string $endDate = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = AuditLog::query();

        if ($businessType) {
            $query->ofBusinessType($businessType);
        }

        if ($action) {
            $query->ofAction($action);
        }

        if ($businessId) {
            $query->where('business_id', $businessId);
        }

        if ($userId) {
            $query->ofUser($userId);
        }

        if ($startDate && $endDate) {
            $query->betweenDates($startDate, $endDate);
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    public function getByBusiness(string $businessType, string $businessId, int $limit = 50)
    {
        return AuditLog::ofBusiness($businessType, $businessId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }
}
