<?php

namespace App\Console;

use App\Jobs\ProcessContractExpirations;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        $schedule->job(new ProcessContractExpirations)->dailyAt('09:00');
        $schedule->job(new ProcessContractExpirations)->dailyAt('15:00');

        $schedule->command('horizon:snapshot')->everyFiveMinutes();
    }

    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
