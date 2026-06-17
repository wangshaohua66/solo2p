<?php

namespace App\Jobs;

use App\Models\SLATimer;
use App\Models\SLAViolation;
use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CheckSLATimerBreach implements ShouldQueue
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

            if (!in_array($timer->status, [SLATimer::STATUS_RUNNING, SLATimer::STATUS_PAUSED])) {
                return;
            }

            $slaMonitor = app('sla.monitor');
            $result = $slaMonitor->checkBreach($timer);

            if ($result['breached']) {
                DB::beginTransaction();
                try {
                    $timer->status = SLATimer::STATUS_BREACHED;
                    $timer->breached_at = now();
                    $timer->actual_elapsed_minutes = $result['actual_minutes'];
                    $timer->save();

                    $violation = SLAViolation::create([
                        'tenant_id' => $this->tenantId,
                        'ticket_id' => $timer->ticket_id,
                        'sla_policy_id' => $timer->sla_policy_id,
                        'sla_timer_id' => $timer->id,
                        'timer_type' => $timer->timer_type,
                        'severity' => $result['severity'],
                        'target_minutes' => $timer->target_minutes,
                        'actual_minutes' => $result['actual_minutes'],
                        'breach_percentage' => $result['breach_percent'],
                        'escalation_level' => 0,
                        'acknowledged_at' => null,
                        'resolution_note' => null,
                    ]);

                    DB::commit();

                    $ticket = Ticket::withoutGlobalScopes()
                        ->where('tenant_id', $this->tenantId)
                        ->find($timer->ticket_id);

                    if ($ticket && app()->bound('notification.service')) {
                        app('notification.service')->notifySLABreach(
                            $ticket,
                            $timer,
                            $result['severity'],
                            $result['breach_percent']
                        );
                    }

                    if ($ticket && $ticket->assignee_id) {
                        $slaMonitor->triggerEscalation($ticket, $timer, $result['severity']);
                    }

                    Log::warning('[SLA] Breach detected', [
                        'timer_id' => $timer->id,
                        'ticket_id' => $timer->ticket_id,
                        'violation_id' => $violation->id,
                        'severity' => $result['severity'],
                        'breach_percent' => $result['breach_percent'],
                        'tenant_id' => $this->tenantId,
                    ]);
                } catch (\Throwable $e) {
                    DB::rollBack();
                    throw $e;
                }
            }
        } catch (\Throwable $e) {
            Log::error('[SLA Breach Check] Error: ' . $e->getMessage(), [
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
