<?php

namespace Tests\Unit;

use App\Services\SlaMonitor;
use Tests\TestCase;

class SlaMonitorTest extends TestCase
{
    protected SlaMonitor $slaMonitor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->slaMonitor = app('sla.monitor');
    }

    public function test_sla_monitor_is_bound(): void
    {
        $this->assertInstanceOf(SlaMonitor::class, $this->slaMonitor);
    }

    public function test_default_sla_policies_are_configured(): void
    {
        $policies = SlaMonitor::DEFAULT_POLICIES;
        $this->assertIsArray($policies);
        $this->assertCount(5, $policies);

        $priorities = array_column($policies, 'priority');
        $this->assertContains('urgent', $priorities);
        $this->assertContains('high', $priorities);
        $this->assertContains('medium', $priorities);
        $this->assertContains('low', $priorities);
        $this->assertContains('lowest', $priorities);
    }

    public function test_breach_severity_calculation(): void
    {
        $reflect = new \ReflectionClass($this->slaMonitor);
        $method = $reflect->getMethod('getSeverity');
        $method->setAccessible(true);

        $this->assertEquals('minor', $method->invoke($this->slaMonitor, 25));
        $this->assertEquals('minor', $method->invoke($this->slaMonitor, 49));
        $this->assertEquals('major', $method->invoke($this->slaMonitor, 50));
        $this->assertEquals('major', $method->invoke($this->slaMonitor, 99));
        $this->assertEquals('critical', $method->invoke($this->slaMonitor, 100));
        $this->assertEquals('critical', $method->invoke($this->slaMonitor, 200));
    }
}
