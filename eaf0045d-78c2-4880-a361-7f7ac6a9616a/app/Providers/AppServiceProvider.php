<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->registerServices();
    }

    public function boot(): void
    {
        //
    }

    protected function registerServices(): void
    {
        $services = [
            \App\Services\AuditLogService::class,
            \App\Services\MeterDataService::class,
            \App\Services\CertificateService::class,
            \App\Services\MatchingService::class,
            \App\Services\ContractService::class,
            \App\Services\SettlementService::class,
            \App\Services\ReportService::class,
        ];

        foreach ($services as $service) {
            $this->app->singleton($service, function ($app) use ($service) {
                return new $service(...$this->resolveDependencies($service));
            });
        }
    }

    protected function resolveDependencies(string $serviceClass): array
    {
        $dependencies = [];

        $reflection = new \ReflectionClass($serviceClass);
        $constructor = $reflection->getConstructor();

        if ($constructor) {
            foreach ($constructor->getParameters() as $param) {
                $paramClass = $param->getType()?->getName();
                if ($paramClass && class_exists($paramClass)) {
                    $dependencies[] = app($paramClass);
                }
            }
        }

        return $dependencies;
    }
}
