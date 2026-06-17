<?php

namespace Tests\Unit;

use App\Services\ReportService;
use Tests\TestCase;

class ReportServiceTest extends TestCase
{
    protected ReportService $reportService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->reportService = app('report.service');
    }

    public function test_report_service_is_bound(): void
    {
        $this->assertInstanceOf(ReportService::class, $this->reportService);
    }

    public function test_trend_prediction_returns_valid_structure(): void
    {
        $reflect = new \ReflectionClass($this->reportService);
        $method = $reflect->getMethod('calculateLinearTrend');
        $method->setAccessible(true);

        $historyData = [10, 12, 14, 16, 18, 20, 22];
        $days = 7;

        $result = $method->invoke($this->reportService, $historyData, $days);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('predictions', $result);
        $this->assertArrayHasKey('slope', $result);
        $this->assertArrayHasKey('intercept', $result);
        $this->assertArrayHasKey('confidence', $result);
        $this->assertCount($days, $result['predictions']);

        foreach ($result['predictions'] as $pred) {
            $this->assertIsNumeric($pred);
            $this->assertGreaterThanOrEqual(0, $pred);
        }

        $this->assertIsNumeric($result['confidence']);
        $this->assertGreaterThanOrEqual(0, $result['confidence']);
        $this->assertLessThanOrEqual(1, $result['confidence']);
    }

    public function test_calculate_agent_efficiency_score(): void
    {
        $reflect = new \ReflectionClass($this->reportService);
        $method = $reflect->getMethod('calculateAgentEfficiencyScore');
        $method->setAccessible(true);

        $metrics = [
            'resolved_count' => 100,
            'avg_resolution_minutes' => 120,
            'sla_compliance_rate' => 0.95,
            'avg_csat' => 4.5,
        ];

        $score = $method->invoke($this->reportService, $metrics);

        $this->assertIsNumeric($score);
        $this->assertGreaterThan(0, $score);
        $this->assertLessThanOrEqual(100, $score);
    }
}
