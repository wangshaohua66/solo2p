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
use Illuminate\Support\Facades\Mail;

class SendEmailNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 5;
    public $timeout = 120;

    public function __construct(
        public int $tenantId,
        public string $recipientEmail,
        public ?int $recipientUserId,
        public string $templateKey,
        public array $templateVars,
        public ?string $subjectOverride = null,
        public ?string $cc = null,
        public ?string $bcc = null,
        public array $attachments = [],
        public ?int $relatedLogId = null
    ) {}

    public function handle(): void
    {
        try {
            $start = microtime(true);

            $template = NotificationTemplate::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->where('channel', 'email')
                ->where('template_key', $this->templateKey)
                ->first();

            $subject = $this->subjectOverride;
            $body = '';

            if ($template) {
                $subject = $subject ?: $template->subject;
                $body = $template->body;
            } else {
                $subject = $subject ?: 'Notification from SaaS Ticket System';
                $body = "You have a new notification. Please login to check details.";
            }

            foreach ($this->templateVars as $key => $value) {
                $placeholder = '{{' . $key . '}}';
                $escapedValue = is_scalar($value) ? htmlspecialchars((string)$value, ENT_QUOTES) : '';
                $subject = str_replace($placeholder, $escapedValue, $subject);
                $body = str_replace($placeholder, $escapedValue, $body);
            }

            $emailData = [
                'subject' => $subject,
                'recipient' => $this->recipientEmail,
                'tenant_id' => $this->tenantId,
            ];

            Mail::html($body, function ($message) use ($emailData) {
                $message->to($emailData['recipient'])
                    ->subject($emailData['subject']);

                if ($this->cc) {
                    $message->cc($this->cc);
                }
                if ($this->bcc) {
                    $message->bcc($this->bcc);
                }

                foreach ($this->attachments as $attachment) {
                    if (file_exists($attachment['path'] ?? '')) {
                        $message->attach($attachment['path'], [
                            'as' => $attachment['name'] ?? null,
                            'mime' => $attachment['mime'] ?? null,
                        ]);
                    }
                }
            });

            $executionMs = (int)((microtime(true) - $start) * 1000);

            if ($this->relatedLogId) {
                NotificationLog::withoutGlobalScopes()
                    ->where('id', $this->relatedLogId)
                    ->where('tenant_id', $this->tenantId)
                    ->update([
                        'status' => 'sent',
                        'sent_at' => now(),
                        'response' => json_encode(['success' => true, 'duration_ms' => $executionMs]),
                        'retry_count' => NotificationLog::raw('retry_count + 1'),
                    ]);
            }

            Log::info('[Email] Sent successfully', [
                'to' => $this->recipientEmail,
                'template' => $this->templateKey,
                'tenant_id' => $this->tenantId,
                'duration_ms' => $executionMs,
            ]);
        } catch (\Throwable $e) {
            Log::error('[Email] Send failed: ' . $e->getMessage(), [
                'to' => $this->recipientEmail,
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

    public function backoff(): array
    {
        return [60, 120, 240, 480, 960];
    }
}
