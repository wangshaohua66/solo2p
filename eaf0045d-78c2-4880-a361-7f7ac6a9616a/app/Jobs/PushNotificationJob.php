<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;

    public function __construct(
        protected int $notificationId
    ) {}

    public function handle(): void
    {
        $notification = Notification::find($this->notificationId);

        if (!$notification) {
            Log::warning('推送通知失败：通知不存在', ['notification_id' => $this->notificationId]);
            return;
        }

        $user = User::find($notification->user_id);

        if (!$user) {
            Log::warning('推送通知失败：用户不存在', ['notification_id' => $this->notificationId]);
            return;
        }

        Log::info('推送通知', [
            'notification_id' => $notification->id,
            'user_id' => $user->id,
            'username' => $user->username,
            'type' => $notification->type,
            'title' => $notification->title,
            'pushed_at' => now()->toDateTimeString(),
        ]);
    }
}
