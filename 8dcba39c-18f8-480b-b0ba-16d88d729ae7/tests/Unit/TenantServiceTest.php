<?php

namespace Tests\Unit;

use App\Services\TenantService;
use Tests\TestCase;

class TenantServiceTest extends TestCase
{
    protected TenantService $tenantService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantService = app('tenant.service');
    }

    public function test_tenant_service_is_bound(): void
    {
        $this->assertInstanceOf(TenantService::class, $this->tenantService);
    }

    public function test_generate_subdomain_sanitizes_name(): void
    {
        $reflect = new \ReflectionClass($this->tenantService);
        $method = $reflect->getMethod('generateSubdomain');
        $method->setAccessible(true);

        $result = $method->invoke($this->tenantService, 'Test Company Name! @#');
        $this->assertMatchesRegularExpression('/^test-company-name(-\d+)?$/', $result);
    }

    public function test_condition_evaluator_basic_equals(): void
    {
        $evaluator = app('condition.evaluator');
        $result = $evaluator->evaluate([
            'field' => 'priority',
            'operator' => 'equals',
            'value' => 'high',
        ], ['priority' => 'high']);
        $this->assertTrue($result);
    }

    public function test_condition_evaluator_contains(): void
    {
        $evaluator = app('condition.evaluator');
        $result = $evaluator->evaluate([
            'field' => 'subject',
            'operator' => 'contains',
            'value' => 'urgent',
        ], ['subject' => 'This is an urgent ticket']);
        $this->assertTrue($result);
    }
}
