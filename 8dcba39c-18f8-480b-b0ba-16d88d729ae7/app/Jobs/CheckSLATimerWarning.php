<?php

namespace App\Jobs;

use App\Models\SLATimer;
use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckSLATimerWarning implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 60;

    public function __construct(
        public int $timerId,
        public int $tenantId
    ) {}

    public function handle(): void
    {
        try {
            app()->instance('currentTenantId', $this->tenantId);

            $timer = SLATimer::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->with(['ticket', 'policy'])
                ->find($this->timerId);

            if (!$timer) {
                return;
            }

            if ($timer->status !== SLATimer::STATUS_RUNNING) {
                return;
            }

            $slaMonitor = app('sla.monitor');
            $result = $slaMonitor->checkWarning($timer);

            if ($result['warning_triggered']) {
                $ticket = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $this->tenantId)
                    ->find($timer->ticket_id);

                if ($ticket && app()->bound('notification.service')) {
                    app('notification.service')->notifySLAWarning(
                        $ticket,
                        $timer,
                        $result['percent_used']
                    );
                }

                Log::info('[SLA] Warning triggered for timer', [
                    'timer_id' => $timer->id,
                    'ticket_id' => $timer->ticket_id,
                    'percent_used' => $result['percent_used'],
                    'tenant_id' => $this->tenantId,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('[SLA Warning Check] Error: ' . $e->getMessage(), [
                'timer_id' => $this->timerId,
                'tenant_id' => $this->tenantId,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    public function backoff(): array
    {
        return [60, 180, 360];
    }
}
