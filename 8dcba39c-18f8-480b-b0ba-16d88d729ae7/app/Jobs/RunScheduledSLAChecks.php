<?php

namespace App\Jobs;

use App\Models\SLATimer;
use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunScheduledSLAChecks implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    public $timeout = 600;

    public function __construct(
        public ?int $targetTenantId = null
    ) {}

    public function handle(): void
    {
        try {
            $start = microtime(true);
            $batchSize = (int)config('saas.automation.batch_size', 1000);

            $tenantsQuery = Tenant::withoutGlobalScopes()->where('is_active', true);
            if ($this->targetTenantId) {
                $tenantsQuery->where('id', $this->targetTenantId);
            }

            $tenants = $tenantsQuery->get(['id']);
            $timersChecked = 0;
            $warningsDispatched = 0;
            $breachesDispatched = 0;

            foreach ($tenants as $tenant) {
                $tenantId = $tenant->id;
                app()->instance('currentTenantId', $tenantId);

                if (app()->bound('sla.monitor')) {
                    $result = app('sla.monitor')->runScheduledChecks($tenantId);
                    $timersChecked += $result['timers_checked'] ?? 0;
                    $warningsDispatched += $result['warnings_triggered'] ?? 0;
                    $breachesDispatched += $result['breaches_triggered'] ?? 0;
                }

                $lastId = 0;
                do {
                    $timers = SLATimer::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->where('id', '>', $lastId)
                        ->whereIn('status', [SLATimer::STATUS_RUNNING])
                        ->orderBy('id')
                        ->limit($batchSize)
                        ->get(['id']);

                    foreach ($timers as $timer) {
                        $warningJob = CheckSLATimerWarning::dispatch(
                            $timer->id,
                            $tenantId
                        );
                        if ($warningJob) {
                            $warningJob->onQueue('sla');
                        }

                        $breachJob = CheckSLATimerBreach::dispatch(
                            $timer->id,
                            $tenantId
                        );
                        if ($breachJob) {
                            $breachJob->onQueue('sla');
                        }
                    }

                    $lastId = $timers->last()?->id ?? 0;
                } while ($timers->count() > 0);
            }

            $executionMs = (int)((microtime(true) - $start) * 1000);

            Log::info('[SLA Scheduled Checks] Completed', [
                'tenants_total' => $tenants->count(),
                'timers_checked' => $timersChecked,
                'warnings_dispatched' => $warningsDispatched,
                'breaches_dispatched' => $breachesDispatched,
                'duration_ms' => $executionMs,
            ]);
        } catch (\Throwable $e) {
            Log::error('[SLA Scheduled Checks] Fatal error: ' . $e->getMessage(), [
                'tenant_id' => $this->targetTenantId,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }
}
