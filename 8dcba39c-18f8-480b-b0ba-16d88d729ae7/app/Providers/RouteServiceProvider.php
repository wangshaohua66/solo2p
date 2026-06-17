<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    public const HOME = '/home';

    public function boot(): void
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api/v1')
                ->group(base_path('routes/api.php'));
        });
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $identifier = $request->user()?->id
                ?? $request->header('X-API-Key')
                ?? $request->ip();
            return Limit::perMinute(5000)->by($identifier);
        });

        RateLimiter::for('tickets.create', function (Request $request) {
            $tenantId = app('currentTenantId') ?? 'global';
            return Limit::perSecond(500)->by('ticket_create_' . $tenantId);
        });

        RateLimiter::for('tickets.batch', function (Request $request) {
            $identifier = $request->user()?->id ?? $request->ip();
            return Limit::perMinute(60)->by($identifier);
        });

        RateLimiter::for('reports.heavy', function (Request $request) {
            $identifier = $request->user()?->id ?? $request->ip();
            return Limit::perMinute(30)->by($identifier);
        });

        RateLimiter::for('webhooks', function (Request $request) {
            return Limit::perMinute(100)->by($request->ip());
        });

        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });
    }
}
