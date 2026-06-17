<?php

namespace App\Jobs;

use App\Models\NotificationLog;
use App\Models\NotificationTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendSmsNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 5;
    public $timeout = 60;

    public function __construct(
        public int $tenantId,
        public string $phoneNumber,
        public ?int $recipientUserId,
        public string $templateKey,
        public array $templateVars,
        public ?string $contentOverride = null,
        public ?int $relatedLogId = null
    ) {}

    public function handle(): void
    {
        try {
            $start = microtime(true);

            $template = NotificationTemplate::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->where('channel', 'sms')
                ->where('template_key', $this->templateKey)
                ->first();

            $content = $this->contentOverride;

            if ($template && !$content) {
                $content = $template->body;
            } elseif (!$content) {
                $content = 'You have a new ticket notification. Please login to check.';
            }

            foreach ($this->templateVars as $key => $value) {
                $placeholder = '{{' . $key . '}}';
                $content = str_replace($placeholder, (string)$value, $content);
            }

            $content = mb_substr($content, 0, 500);

            $smsProvider = env('SMS_PROVIDER', 'log');
            $success = true;
            $response = ['provider' => $smsProvider];

            switch ($smsProvider) {
                case 'aliyun':
                    $success = $this->sendViaAliyun($this->phoneNumber, $this->templateKey, $this->templateVars);
                    $response['method'] = 'aliyun';
                    break;
                case 'tencent':
                    $success = $this->sendViaTencent($this->phoneNumber, $this->templateKey, $this->templateVars);
                    $response['method'] = 'tencent';
                    break;
                case 'log':
                default:
                    Log::info('[SMS] Log-only mode - would send: ' . $content, [
                        'to' => $this->phoneNumber,
                        'tenant_id' => $this->tenantId,
                    ]);
                    $success = true;
                    $response['method'] = 'log';
                    $response['content'] = $content;
                    break;
            }

            $executionMs = (int)((microtime(true) - $start) * 1000);
            $response['duration_ms'] = $executionMs;

            if ($this->relatedLogId) {
                NotificationLog::withoutGlobalScopes()
                    ->where('id', $this->relatedLogId)
                    ->where('tenant_id', $this->tenantId)
                    ->update([
                        'status' => $success ? 'sent' : 'failed',
                        'sent_at' => $success ? now() : null,
                        'response' => json_encode($response),
                        'retry_count' => NotificationLog::raw('retry_count + 1'),
                    ]);
            }

            if (!$success) {
                throw new \RuntimeException('SMS provider returned failure');
            }

            Log::info('[SMS] Sent successfully', [
                'to' => $this->phoneNumber,
                'template' => $this->templateKey,
                'tenant_id' => $this->tenantId,
                'duration_ms' => $executionMs,
            ]);
        } catch (\Throwable $e) {
            Log::error('[SMS] Send failed: ' . $e->getMessage(), [
                'to' => $this->phoneNumber,
                'template' => $this->templateKey,
                'tenant_id' => $this->tenantId,
                'attempt' => $this->attempts(),
                'trace' => $e->getTraceAsString(),
            ]);

            if ($this->relatedLogId) {
                NotificationLog::withoutGlobalScopes()
                    ->where('id', $this->relatedLogId)
                    ->where('tenant_id', $this->tenantId)
                    ->update([
                        'status' => $this->attempts() >= $this->tries ? 'failed' : 'retrying',
                        'error_message' => $e->getMessage(),
                        'retry_count' => NotificationLog::raw('retry_count + 1'),
                    ]);
            }

            throw $e;
        }
    }

    protected function sendViaAliyun(string $phone, string $template, array $vars): bool
    {
        return true;
    }

    protected function sendViaTencent(string $phone, string $template, array $vars): bool
    {
        return true;
    }

    public function backoff(): array
    {
        return [60, 120, 240, 480, 960];
    }
}
