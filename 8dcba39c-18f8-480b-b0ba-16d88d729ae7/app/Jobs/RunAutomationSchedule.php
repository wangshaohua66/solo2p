<?php

namespace App\Jobs;

use App\Models\AutomationRule;
use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunAutomationSchedule implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    public $timeout = 600;

    public function __construct(
        public string $frequency,
        public ?int $targetTenantId = null
    ) {}

    public function handle(): void
    {
        try {
            $start = microtime(true);

            $validFreqs = ['every_minute', 'hourly', 'daily', 'weekly', 'monthly'];
            if (!in_array($this->frequency, $validFreqs)) {
                Log::warning('[Automation Schedule] Invalid frequency', ['freq' => $this->frequency]);
                return;
            }

            $tenantsQuery = Tenant::withoutGlobalScopes()->where('is_active', true);
            if ($this->targetTenantId) {
                $tenantsQuery->where('id', $this->targetTenantId);
            }

            $tenants = $tenantsQuery->get(['id']);
            $totalRulesExecuted = 0;

            foreach ($tenants as $tenant) {
                $tenantId = $tenant->id;
                app()->instance('currentTenantId', $tenantId);

                $rules = AutomationRule::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->where('is_active', true)
                    ->where('trigger_type', 'schedule')
                    ->where('trigger_frequency', $this->frequency)
                    ->get();

                if ($rules->count() === 0) {
                    continue;
                }

                foreach ($rules as $rule) {
                    try {
                        if (app()->bound('automation.engine')) {
                            $result = app('automation.engine')->runScheduledRules(
                                $tenantId,
                                $rule
                            );
                            if ($result) {
                                $totalRulesExecuted++;
                            }
                        }
                    } catch (\Throwable $e) {
                        Log::error('[Automation Schedule] Rule error: ' . $e->getMessage(), [
                            'rule_id' => $rule->id,
                            'tenant_id' => $tenantId,
                            'frequency' => $this->frequency,
                            'trace' => $e->getTraceAsString(),
                        ]);
                    }
                }
            }

            $executionMs = (int)((microtime(true) - $start) * 1000);

            Log::info('[Automation Schedule] Completed', [
                'frequency' => $this->frequency,
                'tenants_total' => $tenants->count(),
                'rules_executed' => $totalRulesExecuted,
                'duration_ms' => $executionMs,
            ]);
        } catch (\Throwable $e) {
            Log::error('[Automation Schedule] Fatal error: ' . $e->getMessage(), [
                'frequency' => $this->frequency,
                'tenant_id' => $this->targetTenantId,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }
}
