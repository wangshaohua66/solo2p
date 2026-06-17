<?php

namespace App\Jobs;

use App\Models\WebhookEndpoint;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DeliverWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 10;
    public $timeout = 30;

    public function __construct(
        public int $tenantId,
        public int $endpointId,
        public string $eventType,
        public array $payload,
        public string $eventId
    ) {}

    public function handle(): void
    {
        try {
            $start = microtime(true);

            $endpoint = WebhookEndpoint::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->where('id', $this->endpointId)
                ->where('is_active', true)
                ->first();

            if (!$endpoint) {
                Log::warning('[Webhook] Endpoint not found or inactive', [
                    'endpoint_id' => $this->endpointId,
                    'tenant_id' => $this->tenantId,
                ]);
                return;
            }

            $timestamp = time();
            $signature = $this->generateSignature(
                $endpoint->signing_secret,
                $this->eventId,
                $timestamp,
                $this->payload
            );

            $headers = [
                'Content-Type: application/json',
                'X-Webhook-Event: ' . $this->eventType,
                'X-Webhook-Id: ' . $this->eventId,
                'X-Webhook-Timestamp: ' . $timestamp,
                'X-Webhook-Signature: ' . $signature,
                'User-Agent: SaaS-Ticket-Webhook/1.0',
            ];

            $authHeaders = $this->buildAuthHeaders($endpoint);
            $headers = array_merge($headers, $authHeaders);

            $body = json_encode($this->payload, JSON_UNESCAPED_UNICODE);

            $ch = curl_init($endpoint->url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => (int)config('saas.notifications.webhook_timeout_seconds', 10),
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_SSL_VERIFYPEER => (bool)env('WEBHOOK_SSL_VERIFY', true),
                CURLOPT_SSL_VERIFYHOST => (bool)env('WEBHOOK_SSL_VERIFY', true) ? 2 : 0,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 3,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            $executionMs = (int)((microtime(true) - $start) * 1000);

            $endpoint->last_delivery_at = now();
            $endpoint->last_delivery_status = ($httpCode >= 200 && $httpCode < 300) ? 'success' : 'failed';
            $endpoint->total_deliveries++;

            if (!($httpCode >= 200 && $httpCode < 300)) {
                $endpoint->consecutive_failures++;
                $endpoint->last_error_message = substr("HTTP $httpCode: $curlError | " . substr($response, 0, 200), 0, 500);

                $maxFailures = (int)config('saas.notifications.webhook_max_failures', 10);
                if ($endpoint->consecutive_failures >= $maxFailures) {
                    $endpoint->is_active = false;
                    Log::warning('[Webhook] Endpoint disabled due to consecutive failures', [
                        'endpoint_id' => $endpoint->id,
                        'url' => $endpoint->url,
                        'failures' => $endpoint->consecutive_failures,
                        'tenant_id' => $this->tenantId,
                    ]);
                }
            } else {
                $endpoint->consecutive_failures = 0;
                $endpoint->last_error_message = null;
                $endpoint->success_deliveries++;
            }

            $endpoint->save();

            Log::info('[Webhook] Delivery attempt', [
                'event' => $this->eventType,
                'endpoint_id' => $endpoint->id,
                'url' => $endpoint->url,
                'http_code' => $httpCode,
                'duration_ms' => $executionMs,
                'attempt' => $this->attempts(),
                'tenant_id' => $this->tenantId,
            ]);

            if (!($httpCode >= 200 && $httpCode < 300)) {
                throw new \RuntimeException("Webhook returned HTTP $httpCode: $curlError");
            }
        } catch (\Throwable $e) {
            Log::error('[Webhook] Delivery failed: ' . $e->getMessage(), [
                'event' => $this->eventType,
                'endpoint_id' => $this->endpointId,
                'tenant_id' => $this->tenantId,
                'attempt' => $this->attempts(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    protected function generateSignature(string $secret, string $eventId, int $timestamp, array $payload): string
    {
        $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $signatureData = "{$eventId}.{$timestamp}.{$payloadJson}";
        return 'v0=' . hash_hmac('sha256', $signatureData, $secret);
    }

    protected function buildAuthHeaders(WebhookEndpoint $endpoint): array
    {
        $headers = [];

        switch ($endpoint->auth_type) {
            case 'api_key':
                $headers[] = 'X-API-Key: ' . ($endpoint->auth_credentials['api_key'] ?? '');
                break;
            case 'bearer':
                $headers[] = 'Authorization: Bearer ' . ($endpoint->auth_credentials['token'] ?? '');
                break;
            case 'basic':
                $username = $endpoint->auth_credentials['username'] ?? '';
                $password = $endpoint->auth_credentials['password'] ?? '';
                $headers[] = 'Authorization: Basic ' . base64_encode("{$username}:{$password}");
                break;
            case 'none':
            default:
                break;
        }

        return $headers;
    }

    public function backoff(): array
    {
        $config = config('saas.notifications.retry_backoff_minutes', [1, 2, 4, 8, 16]);
        return array_map(fn($m) => $m * 60, $config);
    }
}
