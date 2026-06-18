<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Venue;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function getVenueStats(int $venueId, string $startDate, string $endDate): array
    {
        $venue = Venue::findOrFail($venueId);

        $stats = Booking::where('venue_id', $venueId)
            ->whereBetween('booking_date', [$startDate, $endDate])
            ->select(
                DB::raw('COUNT(*) as total_bookings'),
                DB::raw("SUM(CASE WHEN status = 'paid' OR status = 'checked_in' OR status = 'completed' THEN 1 ELSE 0 END) as paid_bookings"),
                DB::raw("SUM(CASE WHEN is_checked_in = 1 THEN 1 ELSE 0 END) as checked_in_count"),
                DB::raw("SUM(CASE WHEN is_violation = 1 THEN 1 ELSE 0 END) as violation_count"),
                DB::raw("SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count"),
                DB::raw('SUM(paid_amount) as total_revenue')
            )
            ->first();

        $totalBookings = (int)$stats->total_bookings;
        $checkedInCount = (int)$stats->checked_in_count;
        $paidBookings = (int)$stats->paid_bookings;

        $attendanceRate = $paidBookings > 0 ? round($checkedInCount / $paidBookings * 100, 2) : 0;
        $cancellationRate = $totalBookings > 0 ? round($stats->cancelled_count / $totalBookings * 100, 2) : 0;

        $totalSlots = $this->calculateTotalSlots($venueId, $startDate, $endDate);
        $utilizationRate = $totalSlots > 0 ? round($paidBookings / $totalSlots * 100, 2) : 0;

        return [
            'venue_id' => $venueId,
            'venue_name' => $venue->name,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_bookings' => $totalBookings,
            'paid_bookings' => $paidBookings,
            'checked_in_count' => $checkedInCount,
            'violation_count' => (int)$stats->violation_count,
            'cancelled_count' => (int)$stats->cancelled_count,
            'total_revenue' => (float)$stats->total_revenue,
            'attendance_rate' => $attendanceRate,
            'cancellation_rate' => $cancellationRate,
            'utilization_rate' => $utilizationRate,
            'total_slots' => $totalSlots,
        ];
    }

    public function getDailyStats(int $venueId, string $startDate, string $endDate): array
    {
        $stats = Booking::where('venue_id', $venueId)
            ->whereBetween('booking_date', [$startDate, $endDate])
            ->select(
                'booking_date',
                DB::raw('COUNT(*) as total_bookings'),
                DB::raw("SUM(CASE WHEN status IN ('paid','checked_in','completed') THEN 1 ELSE 0 END) as paid_bookings"),
                DB::raw("SUM(CASE WHEN is_checked_in = 1 THEN 1 ELSE 0 END) as checked_in_count"),
                DB::raw("SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count"),
                DB::raw('SUM(paid_amount) as total_revenue')
            )
            ->groupBy('booking_date')
            ->orderBy('booking_date')
            ->get()
            ->keyBy('booking_date');

        $result = [];
        $start = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);

        for ($date = clone $start; $date->lte($end); $date->addDay()) {
            $dateStr = $date->format('Y-m-d');
            $dayStats = $stats->get($dateStr);

            $result[] = [
                'date' => $dateStr,
                'total_bookings' => $dayStats ? (int)$dayStats->total_bookings : 0,
                'paid_bookings' => $dayStats ? (int)$dayStats->paid_bookings : 0,
                'checked_in_count' => $dayStats ? (int)$dayStats->checked_in_count : 0,
                'cancelled_count' => $dayStats ? (int)$dayStats->cancelled_count : 0,
                'total_revenue' => $dayStats ? (float)$dayStats->total_revenue : 0,
            ];
        }

        return $result;
    }

    public function getTimeSlotStats(int $venueId, string $date): array
    {
        $stats = Booking::where('venue_id', $venueId)
            ->where('booking_date', $date)
            ->select(
                'start_time',
                DB::raw('COUNT(*) as booking_count'),
                DB::raw("SUM(CASE WHEN status IN ('paid','checked_in','completed') THEN 1 ELSE 0 END) as paid_count"),
                DB::raw('SUM(paid_amount) as revenue')
            )
            ->groupBy('start_time')
            ->orderBy('start_time')
            ->get()
            ->keyBy('start_time');

        $venue = Venue::findOrFail($venueId);
        $result = [];

        $openTime = Carbon::parse($venue->open_time);
        $closeTime = Carbon::parse($venue->close_time);
        $duration = $venue->slot_duration;

        $current = clone $openTime;
        while ($current->lt($closeTime)) {
            $timeStr = $current->format('H:i');
            $slotStats = $stats->get($timeStr);

            $result[] = [
                'start_time' => $timeStr,
                'booking_count' => $slotStats ? (int)$slotStats->booking_count : 0,
                'paid_count' => $slotStats ? (int)$slotStats->paid_count : 0,
                'revenue' => $slotStats ? (float)$slotStats->revenue : 0,
            ];

            $current->addMinutes($duration);
        }

        return $result;
    }

    public function getOverallStats(string $startDate, string $endDate): array
    {
        $venues = Venue::where('is_active', true)->get();

        $stats = Booking::whereBetween('booking_date', [$startDate, $endDate])
            ->select(
                DB::raw('COUNT(*) as total_bookings'),
                DB::raw("SUM(CASE WHEN status IN ('paid','checked_in','completed') THEN 1 ELSE 0 END) as paid_bookings"),
                DB::raw("SUM(CASE WHEN is_checked_in = 1 THEN 1 ELSE 0 END) as checked_in_count"),
                DB::raw("SUM(CASE WHEN is_violation = 1 THEN 1 ELSE 0 END) as violation_count"),
                DB::raw('SUM(paid_amount) as total_revenue')
            )
            ->first();

        $venueStats = [];
        foreach ($venues as $venue) {
            $venueStats[] = $this->getVenueStats($venue->id, $startDate, $endDate);
        }

        return [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_venues' => $venues->count(),
            'total_bookings' => (int)$stats->total_bookings,
            'paid_bookings' => (int)$stats->paid_bookings,
            'checked_in_count' => (int)$stats->checked_in_count,
            'violation_count' => (int)$stats->violation_count,
            'total_revenue' => (float)$stats->total_revenue,
            'venue_stats' => $venueStats,
        ];
    }

    public function exportCsv(string $type, array $params): string
    {
        $filename = "report_{$type}_" . date('YmdHis') . '.csv';
        $filepath = storage_path('app/' . $filename);

        $handle = fopen($filepath, 'w');

        switch ($type) {
            case 'venue_daily':
                $this->exportVenueDailyCsv($handle, $params);
                break;
            case 'bookings':
                $this->exportBookingsCsv($handle, $params);
                break;
            case 'revenue':
                $this->exportRevenueCsv($handle, $params);
                break;
            default:
                $this->exportVenueDailyCsv($handle, $params);
        }

        fclose($handle);

        return $filepath;
    }

    protected function exportVenueDailyCsv($handle, array $params): void
    {
        $venueId = $params['venue_id'] ?? null;
        $startDate = $params['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $params['end_date'] ?? date('Y-m-d');

        fputcsv($handle, ['日期', '预约总数', '已支付', '已签到', '已取消', '收入(元)']);

        $dailyStats = $this->getDailyStats($venueId, $startDate, $endDate);

        foreach ($dailyStats as $day) {
            fputcsv($handle, [
                $day['date'],
                $day['total_bookings'],
                $day['paid_bookings'],
                $day['checked_in_count'],
                $day['cancelled_count'],
                number_format($day['total_revenue'], 2),
            ]);
        }
    }

    protected function exportBookingsCsv($handle, array $params): void
    {
        $venueId = $params['venue_id'] ?? null;
        $startDate = $params['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $params['end_date'] ?? date('Y-m-d');

        $query = Booking::with(['user:id,phone,real_name', 'venue:id,name'])
            ->whereBetween('booking_date', [$startDate, $endDate]);

        if ($venueId) {
            $query->where('venue_id', $venueId);
        }

        $bookings = $query->orderBy('booking_date', 'desc')->get();

        fputcsv($handle, ['预约号', '用户手机', '用户姓名', '场馆', '日期', '开始时间', '结束时间', '金额', '状态', '是否签到']);

        $statusMap = [
            'pending' => '待支付',
            'paid' => '已支付',
            'checked_in' => '已签到',
            'completed' => '已完成',
            'cancelled' => '已取消',
            'expired' => '已过期',
            'violation' => '违约',
        ];

        foreach ($bookings as $booking) {
            fputcsv($handle, [
                $booking->booking_no,
                $booking->user->phone ?? '',
                $booking->user->real_name ?? '',
                $booking->venue->name ?? '',
                $booking->booking_date,
                $booking->start_time,
                $booking->end_time,
                $booking->paid_amount,
                $statusMap[$booking->status] ?? $booking->status,
                $booking->is_checked_in ? '是' : '否',
            ]);
        }
    }

    protected function exportRevenueCsv($handle, array $params): void
    {
        $startDate = $params['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $params['end_date'] ?? date('Y-m-d');

        $venues = Venue::where('is_active', true)->get();

        fputcsv($handle, ['场馆', '预约数', '已支付数', '已签到数', '收入(元)', '到场率(%)']);

        foreach ($venues as $venue) {
            $stats = $this->getVenueStats($venue->id, $startDate, $endDate);
            fputcsv($handle, [
                $stats['venue_name'],
                $stats['total_bookings'],
                $stats['paid_bookings'],
                $stats['checked_in_count'],
                number_format($stats['total_revenue'], 2),
                $stats['attendance_rate'],
            ]);
        }
    }

    protected function calculateTotalSlots(int $venueId, string $startDate, string $endDate): int
    {
        $venue = Venue::findOrFail($venueId);

        $openTime = Carbon::parse($venue->open_time);
        $closeTime = Carbon::parse($venue->close_time);
        $duration = $venue->slot_duration;

        $slotsPerDay = 0;
        $current = clone $openTime;
        while ($current->lt($closeTime)) {
            $slotsPerDay++;
            $current->addMinutes($duration);
        }

        $courtCount = $venue->activeCourts()->count();
        $days = Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1;

        return $slotsPerDay * $courtCount * $days;
    }
}
