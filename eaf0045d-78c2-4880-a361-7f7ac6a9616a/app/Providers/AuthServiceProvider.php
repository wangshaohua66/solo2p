<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        \App\Models\PowerStation::class => \App\Policies\PowerStationPolicy::class,
        \App\Models\MeterReading::class => \App\Policies\MeterReadingPolicy::class,
        \App\Models\Listing::class => \App\Policies\ListingPolicy::class,
        \App\Models\Contract::class => \App\Policies\ContractPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();

        Gate::define('access-exchange', function ($user) {
            return $user->isExchange();
        });

        Gate::define('access-regulator', function ($user) {
            return $user->isRegulator();
        });

        Gate::define('access-generator', function ($user) {
            return $user->isGenerator();
        });

        Gate::define('access-purchaser', function ($user) {
            return $user->isPurchaser();
        });

        Gate::define('view-all-data', function ($user) {
            return $user->isExchange() || $user->isRegulator();
        });
    }
}
