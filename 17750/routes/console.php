<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Schedule::command('scryfall:sync-prices')->dailyAt('02:00')
    ->description('Sync card prices for collection items')
    ->withoutOverlapping();

Schedule::command('scryfall:sync-cards --incremental')->weekly()
    ->description('Sync new cards from Scryfall')
    ->withoutOverlapping();

Schedule::command('meta:generate-report')->weekly()
    ->description('Generate weekly meta report')
    ->withoutOverlapping();

Schedule::command('prices:check-alerts')->dailyAt('03:00')
    ->description('Check price alerts for collection')
    ->withoutOverlapping();
