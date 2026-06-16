<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\Contract;
use App\Models\PowerStation;
use App\Models\Trade;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportService
{
    const CACHE_TTL = 3600;

    public function getQuarterlyReport(int $year, int $quarter, ?string $province = null, ?string $energyType = null): array
    {
        $cacheKey = "quarterly_report:{$year}:{$quarter}:{$province}:{$energyType}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($year, $quarter, $province, $energyType) {
            $startMonth = $this->getQuarterStartMonth($year, $quarter);
            $endMonth = $this->getQuarterEndMonth($year, $quarter);

            $certificatesIssued = $this->getCertificateStats($startMonth, $endMonth, $province, $energyType);
            $tradeStats = $this->getTradeStats($startMonth, $endMonth, $province, $energyType);
            $contractStats = $this->getContractStats($startMonth, $endMonth, $province, $energyType);
            $stationStats = $this->getStationStats($province, $energyType);

            return [
                'year' => $year,
                'quarter' => $quarter,
                'period' => "{$startMonth} 至 {$endMonth}",
                'province' => $province,
                'energy_type' => $energyType,
                'certificates' => $certificatesIssued,
                'trading' => $tradeStats,
                'contracts' => $contractStats,
                'stations' => $stationStats,
                'generated_at' => now()->toDateTimeString(),
            ];
        });
    }

    protected function getCertificateStats(string $startMonth, string $endMonth, ?string $province, ?string $energyType): array
    {
        $query = Certificate::whereBetween('issue_month', [$startMonth, $endMonth]);

        if ($province) {
            $query->ofProvince($province);
        }

        if ($energyType) {
            $query->ofEnergyType($energyType);
        }

        $total = (clone $query)->sum('quantity');
        $generationKwh = (clone $query)->sum('generation_kwh');

        $byEnergyType = (clone $query)
            ->selectRaw('energy_type, SUM(quantity) as total_quantity, SUM(generation_kwh) as total_generation')
            ->groupBy('energy_type')
            ->get()
            ->keyBy('energy_type');

        $byProvince = (clone $query)
            ->selectRaw('province, SUM(quantity) as total_quantity, SUM(generation_kwh) as total_generation')
            ->groupBy('province')
            ->orderBy('total_quantity', 'desc')
            ->get()
            ->keyBy('province');

        return [
            'total_certificates' => (int)$total,
            'total_generation_mwh' => round($generationKwh / 1000, 2),
            'by_energy_type' => $byEnergyType,
            'by_province' => $byProvince,
        ];
    }

    protected function getTradeStats(string $startMonth, string $endMonth, ?string $province, ?string $energyType): array
    {
        $startDate = $startMonth . '-01 00:00:00';
        $endDate = date('Y-m-t 23:59:59', strtotime($endMonth . '-01'));

        $query = Trade::whereBetween('matched_at', [$startDate, $endDate]);

        if ($energyType) {
            $query->ofEnergyType($energyType);
        }

        if ($province) {
            $query->whereHas('seller.powerStations', function ($q) use ($province) {
                $q->where('province', $province);
            });
        }

        $totalTrades = (clone $query)->count();
        $totalQuantity = (clone $query)->sum('quantity');
        $totalAmount = (clone $query)->sum('total_amount');

        $avgPrice = $totalQuantity > 0 ? $totalAmount / $totalQuantity : 0;

        $priceTrend = (clone $query)
            ->selectRaw('DATE(matched_at) as trade_date, AVG(unit_price) as avg_price, SUM(quantity) as total_quantity')
            ->groupBy('trade_date')
            ->orderBy('trade_date')
            ->get();

        $byEnergyType = (clone $query)
            ->selectRaw('energy_type, COUNT(*) as trade_count, SUM(quantity) as total_quantity, SUM(total_amount) as total_amount, AVG(unit_price) as avg_price')
            ->groupBy('energy_type')
            ->get()
            ->keyBy('energy_type');

        return [
            'total_trades' => (int)$totalTrades,
            'total_quantity' => (int)$totalQuantity,
            'total_amount' => round($totalAmount, 2),
            'average_price' => round($avgPrice, 2),
            'price_trend' => $priceTrend,
            'by_energy_type' => $byEnergyType,
        ];
    }

    protected function getContractStats(string $startMonth, string $endMonth, ?string $province, ?string $energyType): array
    {
        $startDate = $startMonth . '-01 00:00:00';
        $endDate = date('Y-m-t 23:59:59', strtotime($endMonth . '-01'));

        $query = Contract::whereBetween('signed_at', [$startDate, $endDate]);

        if ($energyType) {
            $query->where('energy_type', $energyType);
        }

        $totalContracts = (clone $query)->count();
        $completedCount = (clone $query)->where('status', Contract::STATUS_COMPLETED)->count();
        $breachedCount = (clone $query)->where('status', Contract::STATUS_BREACHED)->count();

        $fulfillmentRate = $totalContracts > 0
            ? round(($completedCount / $totalContracts) * 100, 2)
            : 0;

        $breachRate = $totalContracts > 0
            ? round(($breachedCount / $totalContracts) * 100, 2)
            : 0;

        return [
            'total_contracts' => $totalContracts,
            'completed_count' => $completedCount,
            'breached_count' => $breachedCount,
            'fulfillment_rate' => $fulfillmentRate,
            'breach_rate' => $breachRate,
        ];
    }

    protected function getStationStats(?string $province, ?string $energyType): array
    {
        $query = PowerStation::query();

        if ($province) {
            $query->ofProvince($province);
        }

        if ($energyType) {
            $query->ofEnergyType($energyType);
        }

        $totalStations = (clone $query)->count();
        $totalCapacity = (clone $query)->sum('installed_capacity');

        $byEnergyType = (clone $query)
            ->selectRaw('energy_type, COUNT(*) as station_count, SUM(installed_capacity) as total_capacity')
            ->groupBy('energy_type')
            ->get()
            ->keyBy('energy_type');

        $byProvince = (clone $query)
            ->selectRaw('province, COUNT(*) as station_count, SUM(installed_capacity) as total_capacity')
            ->groupBy('province')
            ->orderBy('total_capacity', 'desc')
            ->get()
            ->keyBy('province');

        return [
            'total_stations' => $totalStations,
            'total_installed_capacity_kw' => round($totalCapacity, 2),
            'by_energy_type' => $byEnergyType,
            'by_province' => $byProvince,
        ];
    }

    public function getRealtimeDashboard(): array
    {
        $cacheKey = 'realtime_dashboard';

        return Cache::remember($cacheKey, 300, function () {
            $today = today();

            $todayTrades = Trade::whereDate('matched_at', $today)->count();
            $todayAmount = Trade::whereDate('matched_at', $today)->sum('total_amount');

            $activeListings = \App\Models\Listing::active()->count();
            $totalCertificates = Certificate::sum('quantity');

            $solarPrice = $this->getLatestPrice(PowerStation::ENERGY_SOLAR);
            $windPrice = $this->getLatestPrice(PowerStation::ENERGY_WIND);

            $pendingReviews = \App\Models\MeterReading::whereIn('status', [
                \App\Models\MeterReading::STATUS_PENDING,
                \App\Models\MeterReading::STATUS_ABNORMAL,
            ])->count();

            return [
                'today_trades' => $todayTrades,
                'today_trade_amount' => round($todayAmount, 2),
                'active_listings' => $activeListings,
                'total_certificates_issued' => (int)$totalCertificates,
                'latest_prices' => [
                    'solar' => $solarPrice,
                    'wind' => $windPrice,
                ],
                'pending_reviews' => $pendingReviews,
                'updated_at' => now()->toDateTimeString(),
            ];
        });
    }

    protected function getLatestPrice(string $energyType): ?float
    {
        $latestTrade = Trade::ofEnergyType($energyType)
            ->orderBy('matched_at', 'desc')
            ->first();

        return $latestTrade?->unit_price;
    }

    protected function getQuarterStartMonth(int $year, int $quarter): string
    {
        $startMonth = ($quarter - 1) * 3 + 1;
        return sprintf('%d-%02d', $year, $startMonth);
    }

    protected function getQuarterEndMonth(int $year, int $quarter): string
    {
        $endMonth = $quarter * 3;
        return sprintf('%d-%02d', $year, $endMonth);
    }

    public function clearReportCache(): void
    {
        Cache::forget('realtime_dashboard');
    }
}
