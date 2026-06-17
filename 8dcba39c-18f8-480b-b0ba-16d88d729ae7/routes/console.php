<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('saas:aggregate-daily {date?} {--tenant=}', function () {
    $date = $this->argument('date');
    $tenantId = $this->option('tenant') ? (int)$this->option('tenant') : null;
    \App\Jobs\AggregateDailyStats::dispatch($date, $tenantId);
    $this->info("Dispatched daily stats aggregation" . ($date ? " for $date" : "") . ($tenantId ? " tenant=$tenantId" : ""));
})->purpose('Aggregate daily ticket statistics');

Artisan::command('saas:sla-check {--tenant=}', function () {
    $tenantId = $this->option('tenant') ? (int)$this->option('tenant') : null;
    \App\Jobs\RunScheduledSLAChecks::dispatch($tenantId);
    $this->info("Dispatched SLA scheduled checks" . ($tenantId ? " tenant=$tenantId" : ""));
})->purpose('Run scheduled SLA violation checks');

Artisan::command('saas:automation {frequency} {--tenant=}', function () {
    $freq = $this->argument('frequency');
    $tenantId = $this->option('tenant') ? (int)$this->option('tenant') : null;
    \App\Jobs\RunAutomationSchedule::dispatch($freq, $tenantId);
    $this->info("Dispatched automation schedule: $freq" . ($tenantId ? " tenant=$tenantId" : ""));
})->purpose('Run automation rules for a schedule frequency');

Artisan::command('saas:billing {month?} {--tenant=}', function () {
    $month = $this->argument('month');
    $tenantId = $this->option('tenant') ? (int)$this->option('tenant') : null;
    \App\Jobs\GenerateMonthlyBilling::dispatch($month, $tenantId);
    $this->info("Dispatched monthly billing" . ($month ? " for $month" : "") . ($tenantId ? " tenant=$tenantId" : ""));
})->purpose('Generate monthly billing records');

Artisan::command('saas:init-tenant {tenant_id}', function () {
    $tenantId = (int)$this->argument('tenant_id');
    $tenant = \App\Models\Tenant::withoutGlobalScopes()->find($tenantId);
    if (!$tenant) {
        $this->error("Tenant not found: $tenantId");
        return 1;
    }
    app()->instance('currentTenantId', $tenantId);
    $result = app('tenant.service')->initializeTenantResources($tenant);
    $this->info("Initialized tenant resources: " . json_encode($result, JSON_UNESCAPED_UNICODE));
})->purpose('Initialize default resources for a tenant');
