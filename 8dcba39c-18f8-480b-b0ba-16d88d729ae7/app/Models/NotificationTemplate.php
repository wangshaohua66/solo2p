<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NotificationTemplate extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    public const CHANNEL_EMAIL = 'email';
    public const CHANNEL_SMS = 'sms';
    public const CHANNEL_WEBHOOK = 'webhook';
    public const CHANNEL_IN_APP = 'in_app';

    protected $fillable = [
        'tenant_id', 'key', 'name', 'channel', 'subject', 'body',
        'variables', 'is_system', 'is_enabled', 'status', 'language',
    ];

    protected $casts = [
        'variables' => 'array',
        'is_system' => 'boolean',
        'is_enabled' => 'boolean',
    ];

    public function isEmail(): bool
    {
        return $this->channel === self::CHANNEL_EMAIL;
    }

    public function isSms(): bool
    {
        return $this->channel === self::CHANNEL_SMS;
    }

    public function isWebhook(): bool
    {
        return $this->channel === self::CHANNEL_WEBHOOK;
    }

    public function isInApp(): bool
    {
        return $this->channel === self::CHANNEL_IN_APP;
    }

    public function render(array $data): array
    {
        $result = ['body' => $this->replaceVariables($this->body, $data)];
        if ($this->subject) {
            $result['subject'] = $this->replaceVariables($this->subject, $data);
        }
        return $result;
    }

    protected function replaceVariables(string $template, array $data): string
    {
        return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/', function ($matches) use ($data) {
            $key = $matches[1];
            return (string) data_get($data, $key, $matches[0]);
        }, $template);
    }

    public static function findTemplate(int $tenantId, string $key, string $channel, string $language = 'zh-CN'): ?self
    {
        return self::forTenant($tenantId)
            ->where('key', $key)
            ->where('channel', $channel)
            ->where('language', $language)
            ->where('is_enabled', true)
            ->first();
    }
}
