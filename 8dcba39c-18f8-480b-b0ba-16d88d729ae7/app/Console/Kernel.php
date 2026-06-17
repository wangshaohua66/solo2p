<?php

namespace App\Console;

use App\Jobs\AggregateDailyStats;
use App\Jobs\GenerateMonthlyBilling;
use App\Jobs\RunAutomationSchedule;
use App\Jobs\RunScheduledSLAChecks;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\Log;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        $schedule->call(function () {
            RunScheduledSLAChecks::dispatch()
                ->onQueue('sla')
                ->delay(0);
        })
        ->everyMinute()
        ->withoutOverlapping(5)
        ->onOneServer()
        ->name('sla-minute-checks');

        $schedule->call(function () {
            RunAutomationSchedule::dispatch('every_minute')
                ->onQueue('workflow');
        })
        ->everyMinute()
        ->withoutOverlapping(5)
        ->onOneServer()
        ->name('automation-every-minute');

        $schedule->call(function () {
            RunAutomationSchedule::dispatch('hourly')
                ->onQueue('workflow');
        })
        ->hourly()
        ->withoutOverlapping(30)
        ->onOneServer()
        ->name('automation-hourly');

        $schedule->call(function () {
            RunAutomationSchedule::dispatch('daily')
                ->onQueue('workflow');
        })
        ->dailyAt('02:00')
        ->withoutOverlapping(120)
        ->onOneServer()
        ->name('automation-daily');

        $schedule->call(function () {
            AggregateDailyStats::dispatch()
                ->onQueue('stats');
        })
        ->dailyAt('01:00')
        ->withoutOverlapping(240)
        ->onOneServer()
        ->name('daily-stats-aggregation');

        $schedule->call(function () {
            $yesterday = now()->subDay()->format('Y-m-d');
            AggregateDailyStats::dispatch($yesterday)
                ->onQueue('stats');
        })
        ->dailyAt('03:00')
        ->withoutOverlapping(120)
        ->onOneServer()
        ->name('daily-stats-retry');

        $schedule->call(function () {
            RunAutomationSchedule::dispatch('weekly')
                ->onQueue('workflow');
        })
        ->weeklyOn(1, '04:00')
        ->withoutOverlapping(240)
        ->onOneServer()
        ->name('automation-weekly');

        $schedule->call(function () {
            GenerateMonthlyBilling::dispatch()
                ->onQueue('default');
        })
        ->monthlyOn(1, '06:00')
        ->withoutOverlapping(480)
        ->onOneServer()
        ->name('monthly-billing');

        $schedule->call(function () {
            RunAutomationSchedule::dispatch('monthly')
                ->onQueue('workflow');
        })
        ->monthlyOn(1, '05:00')
        ->withoutOverlapping(240)
        ->onOneServer()
        ->name('automation-monthly');

        $schedule->command('cache:clear')
            ->weeklyOn(0, '05:30')
            ->onOneServer()
            ->name('weekly-cache-clear');

        $schedule->command('queue:prune-batches --hours=48')
            ->dailyAt('07:00')
            ->onOneServer()
            ->name('prune-queue-batches');

        $schedule->command('telescope:prune --hours=72')
            ->dailyAt('07:30')
            ->onOneServer()
            ->name('prune-telescope');

        $schedule->call(function () {
            Log::info('[Schedule Heartbeat] Scheduler running at ' . now()->toIso8601String());
        })->everyFiveMinutes();
    }

    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
