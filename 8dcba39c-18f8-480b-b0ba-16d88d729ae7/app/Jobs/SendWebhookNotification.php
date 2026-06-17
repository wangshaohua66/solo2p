<?php

namespace App\Jobs;

use App\Models\WebhookEndpoint;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendWebhookNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    public $timeout = 30;

    public function __construct(
        public int $tenantId,
        public string $eventType,
        public array $payload
    ) {}

    public function handle(): void
    {
        try {
            app()->instance('currentTenantId', $this->tenantId);

            $eventMapping = [
                'ticket.created' => ['ticket.created'],
                'ticket.updated' => ['ticket.updated', '*'],
                'ticket.assigned' => ['ticket.assigned', 'ticket.updated', '*'],
                'ticket.status_changed' => ['ticket.status_changed', 'ticket.updated', '*'],
                'ticket.commented' => ['ticket.commented', '*'],
                'ticket.resolved' => ['ticket.resolved', 'ticket.status_changed', 'ticket.updated', '*'],
                'ticket.closed' => ['ticket.closed', 'ticket.status_changed', 'ticket.updated', '*'],
                'ticket.sla_warning' => ['ticket.sla_warning', '*'],
                'ticket.sla_breach' => ['ticket.sla_breach', '*'],
                'ticket.escalated' => ['ticket.escalated', '*'],
                'ticket.rated' => ['ticket.rated', '*'],
                'approval.requested' => ['approval.requested', '*'],
                'approval.resolved' => ['approval.resolved', '*'],
            ];

            $subscribeEvents = $eventMapping[$this->eventType] ?? [$this->eventType, '*'];

            $endpoints = WebhookEndpoint::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->where('is_active', true)
                ->get();

            $dispatched = 0;

            foreach ($endpoints as $endpoint) {
                $configuredEvents = $endpoint->events ?? ['*'];
                $hasMatch = count(array_intersect($subscribeEvents, $configuredEvents)) > 0;

                if (!$hasMatch) {
                    continue;
                }

                $eventId = 'wh_' . $this->tenantId . '_' . time() . '_' . bin2hex(random_bytes(8));

                DeliverWebhook::dispatch(
                    $this->tenantId,
                    $endpoint->id,
                    $this->eventType,
                    $this->payload,
                    $eventId
                )->onQueue('webhook');

                $dispatched++;
            }

            Log::info('[Webhook Notify] Dispatched', [
                'event' => $this->eventType,
                'tenant_id' => $this->tenantId,
                'endpoints_matched' => $dispatched,
                'endpoints_total' => $endpoints->count(),
            ]);
        } catch (\Throwable $e) {
            Log::error('[Webhook Notify] Error: ' . $e->getMessage(), [
                'event' => $this->eventType,
                'tenant_id' => $this->tenantId,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }
}
