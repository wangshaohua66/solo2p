<?php

namespace App\Jobs;

use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PostProcessCreatedTicket implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $maxExceptions = 2;
    public $timeout = 120;

    public function __construct(
        public int $ticketId,
        public int $tenantId
    ) {}

    public function handle(): void
    {
        try {
            app()->instance('currentTenantId', $this->tenantId);

            $ticket = Ticket::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->find($this->ticketId);

            if (!$ticket) {
                Log::warning('[PostProcess] Ticket not found', [
                    'ticket_id' => $this->ticketId,
                    'tenant_id' => $this->tenantId,
                ]);
                return;
            }

            Cache::forget("tenant:{$this->tenantId}:tickets:count");
            Cache::forget("tenant:{$this->tenantId}:tickets:count:open");
            Cache::forget("tenant:{$this->tenantId}:stats:overview");

            Cache::forget("ticket:{$ticket->id}:detail");
            Cache::forget("tenant:{$this->tenantId}:tickets:list:*");

            if (app()->bound('automation.engine')) {
                try {
                    app('automation.engine')->triggerEvent('ticket.created', [
                        'ticket_id' => $ticket->id,
                        'tenant_id' => $this->tenantId,
                    ]);
                } catch (\Throwable $e) {
                    Log::error('[PostProcess] Automation engine error: ' . $e->getMessage());
                }
            }

            Log::info('[PostProcess] Ticket created post-process completed', [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'tenant_id' => $this->tenantId,
            ]);
        } catch (\Throwable $e) {
            Log::error('[PostProcess] Fatal error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    public function backoff(): array
    {
        return [30, 60, 180];
    }
}
