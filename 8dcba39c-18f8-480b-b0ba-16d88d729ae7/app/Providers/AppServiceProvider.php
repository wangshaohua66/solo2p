<?php

namespace App\Providers;

use App\Services\AutomationEngine;
use App\Services\ConditionEvaluator;
use App\Services\NotificationService;
use App\Services\ReportService;
use App\Services\SlaMonitor;
use App\Services\TenantService;
use App\Services\WorkflowEngine;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton('tenant.service', function ($app) {
            return new TenantService();
        });

        $this->app->singleton('condition.evaluator', function ($app) {
            return new ConditionEvaluator();
        });

        $this->app->singleton('workflow.engine', function ($app) {
            return new WorkflowEngine(
                $app->make('condition.evaluator')
            );
        });

        $this->app->singleton('sla.monitor', function ($app) {
            return new SlaMonitor();
        });

        $this->app->singleton('notification.service', function ($app) {
            return new NotificationService();
        });

        $this->app->singleton('automation.engine', function ($app) {
            return new AutomationEngine(
                $app->make('condition.evaluator'),
                $app->make('notification.service')
            );
        });

        $this->app->singleton('report.service', function ($app) {
            return new ReportService();
        });

        $this->app->alias('tenant.service', TenantService::class);
        $this->app->alias('condition.evaluator', ConditionEvaluator::class);
        $this->app->alias('workflow.engine', WorkflowEngine::class);
        $this->app->alias('sla.monitor', SlaMonitor::class);
        $this->app->alias('notification.service', NotificationService::class);
        $this->app->alias('automation.engine', AutomationEngine::class);
        $this->app->alias('report.service', ReportService::class);
    }

    public function boot(): void
    {
        //
    }
}
